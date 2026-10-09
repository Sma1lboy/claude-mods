import type { EngineInterface, Register, RenderElement } from 'claude-code'

import { bootSvg, cardSvg, hudSvg } from './art'
import { bubbleOf, cellsOf, EMPTY, fromUsage, placeOf, type Readings } from './telemetry'
import { paletteOf, THEME, type Appearance } from './theme'

const COMMAND = 'skin'
const PANE = 'scarlet-link'
/** How often the terminal line's bubble moves to its next line. */
const SAY_MS = 8000

/** Kept between sessions in `$.store`. */
type Prefs = {
  appearance: Appearance
  hidden: boolean
  /** The ceremony played or was skipped once; it does not replay unasked. */
  bootSeen: boolean
  /** Draw every animation's last frame (the terminal has no OS reading of it). */
  still: boolean
}

const DEFAULT_PREFS: Prefs = { appearance: 'auto', hidden: false, bootSeen: false, still: false }

let prefs: Prefs = { ...DEFAULT_PREFS }
let readings: Readings = { ...EMPTY }
/** `dark` or `light`, what the terminal's own theme reads as, for `auto`. */
let terminalTone: 'dark' | 'light' = 'dark'
/** Set at the first drawing of the band in this session while the ceremony is due. */
let bootTimer: { cancel: () => void } | null = null
let booting = false
let sayTicker: { cancel: () => void } | null = null
let sayIndex = 0
/** The one read of the store and the terminal's theme, shared by whichever hook runs first. */
let loading: Promise<void> | null = null

/** The band may draw before `session.start` has read the store; both wait on one load. */
function loadPrefs($: EngineInterface): Promise<void> {
  loading ??= (async () => {
    try {
      prefs = prefsOf(await $.store.get('prefs'))
    } catch {
      prefs = { ...DEFAULT_PREFS }
    }
    try {
      const theme = (await $.config.list()).find(row => row.key === 'theme')
      terminalTone = /light/i.test(String(theme?.value ?? '')) ? 'light' : 'dark'
    } catch {
      // dark
    }
  })()
  return loading
}

function prefsOf(v: unknown): Prefs {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Prefs>
  return {
    appearance: o.appearance === 'dark' || o.appearance === 'light' ? o.appearance : 'auto',
    hidden: o.hidden === true,
    bootSeen: o.bootSeen === true,
    still: o.still === true,
  }
}

async function savePrefs($: EngineInterface, next: Partial<Prefs>): Promise<void> {
  prefs = { ...prefs, ...next }
  try {
    await $.store.set('prefs', prefs)
  } catch {
    // kept in memory for this session
  }
}

async function readAll($: EngineInterface): Promise<void> {
  const [usage, model, turns, root] = await Promise.all([
    $.session.usage().catch(() => null),
    $.session.model().catch(() => null),
    $.session.turns().catch(() => null),
    $.session.repo().then(r => r?.root ?? null).catch(() => null).then(async r => r ?? (await $.session.root().catch(() => null))),
  ])
  readings = {
    ...readings,
    ...(usage ? fromUsage(usage) : {}),
    model: model ?? readings.model,
    turns: turns ?? readings.turns,
    project: root ? (root.replace(/\/+$/, '').split('/').at(-1) ?? null) : readings.project,
  }
}

function redraw($: EngineInterface): void {
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // the next drawing picks it up
  }
}

async function finishBoot($: EngineInterface): Promise<void> {
  bootTimer?.cancel()
  bootTimer = null
  if (!booting) return
  booting = false
  await savePrefs($, { bootSeen: true })
  redraw($)
}

function replayBoot($: EngineInterface): Promise<void> {
  bootTimer?.cancel()
  bootTimer = null
  booting = false
  return savePrefs($, { bootSeen: false, hidden: false })
}

/** The terminal palette: the fixed appearance, else the terminal's own tone. */
function termPalette() {
  return paletteOf(prefs.appearance, terminalTone)
}

/** The terminal's one-line HUD: name, every figure the engine gave, BOLT's line. */
function terminalLine($: EngineInterface, e: Parameters<typeof $.ui.resolve>[0], width: number): RenderElement {
  const { Text } = $.ui.resolve(e)
  const p = termPalette()
  const lines = bubbleOf(readings)
  const say = lines[sayIndex % lines.length] ?? ''
  return (
    <Text wrap="truncate-end">
      <Text color={p.amber}>{'◢◤ '}</Text>
      <Text color={p.red} bold>{THEME.name}</Text>
      {cellsOf(readings).map(c => (
        <Text key={c.label}>
          <Text color={p.muted}>{` │ ${c.label} `}</Text>
          <Text color={c.hot ? p.red : p.amber}>{c.value}</Text>
        </Text>
      ))}
      {width >= 100 ? <Text color={p.orange}>{` │ ${THEME.mascot}› ${say}`}</Text> : null}
    </Text>
  ) as RenderElement
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await loadPrefs($)
    await readAll($)
    try {
      await $.command.register({
        name: COMMAND,
        description: 'SCARLET LINK skin: the pane, or boot | on | off | dark | light | auto | still | motion',
      })
    } catch (error) {
      $.ui.log(`desktop-skin: /${COMMAND} not registered: ${error}`)
    }
    redraw($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined) {
      await readAll($)
      redraw($)
    }
    return result
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'boot') {
      await replayBoot($)
      redraw($)
      return { text: '启动仪式会在提示框上方重播。' }
    }
    if (arg === 'off' || arg === 'on') {
      await savePrefs($, { hidden: arg === 'off' })
      redraw($)
      return { text: arg === 'off' ? 'SCARLET LINK 已收起，/skin on 恢复。' : 'SCARLET LINK 已展开。' }
    }
    if (arg === 'dark' || arg === 'light' || arg === 'auto') {
      await savePrefs($, { appearance: arg })
      redraw($)
      return { text: `外观：${arg}` }
    }
    if (arg === 'still' || arg === 'motion') {
      await savePrefs($, { still: arg === 'still' })
      redraw($)
      return { text: arg === 'still' ? '动画已停在最后一帧。' : '动画已恢复。' }
    }
    await readAll($)
    await $.ui.open({ id: PANE, title: THEME.name })
    return {}
  })

  on('ui.message', async ($, e, next) => {
    const data = e.data as { done?: true; skip?: true } | null
    if (data?.done || data?.skip) await finishBoot($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await loadPrefs($)
    if (prefs.hidden || e.props.hasSurvey) return next(e)
    if (!prefs.bootSeen && !booting) {
      booting = true
      bootTimer = $.clock.after(THEME.bootMs, () => void finishBoot($))
    }
    if (e.surface === 'desktop') {
      const { Box, Svg, Button } = $.ui.resolve(e)
      if (booting) {
        return (
          <Box flexDirection="column" gap={1}>
            <Svg source={bootSvg(readings, prefs.appearance)} alt={`${THEME.name} 启动仪式`} isInteractive />
            <Box flexDirection="row" justifyContent="flex-end">
              <Button key="skip" label="跳过 SKIP" dimColor onPress={() => finishBoot($)} />
            </Box>
          </Box>
        ) as RenderElement
      }
      const lines = bubbleOf(readings)
      return (
        <Svg source={hudSvg(readings, lines, prefs.appearance)} alt={`${THEME.name}: ${lines.join(' / ')}`} isInteractive />
      ) as RenderElement
    }
    if (e.surface === 'terminal') {
      const { Box, Client, Button } = $.ui.resolve(e)
      if (booting) {
        const p = termPalette()
        return (
          <Box flexDirection="column">
            <Client
              key="boot"
              module="./boot-client.tsx"
              props={{
                ms: THEME.bootMs,
                tickMs: 100,
                still: prefs.still,
                phases: THEME.phases,
                red: p.red,
                orange: p.orange,
                amber: p.amber,
                muted: p.muted,
              }}
            />
            <Button key="skip" label="跳过 SKIP" hotkey="s" dimColor onPress={() => finishBoot($)} />
          </Box>
        ) as RenderElement
      }
      // The bubble's line moves on in the terminal alone, which redraws text cheaply.
      sayTicker ??= $.clock.every(SAY_MS, () => {
        sayIndex++
        redraw($)
      })
      return terminalLine($, e, e.props.bodyColumns)
    }
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    await loadPrefs($)
    if (prefs.hidden) return next(e)
    const word = THEME.spinner[e.props.mode]
    // The desktop's word says what the step is doing; only its bare `Working` is replaced.
    if (word === undefined || (e.surface === 'desktop' && e.props.word !== 'Working')) return next(e)
    return next({ ...e, props: { ...e.props, word } })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    await loadPrefs($)
    const lines = bubbleOf(readings)
    const p = termPalette()
    const { Box, Text } = $.ui.resolve(e)
    const card = (
      <Box flexDirection="column">
        <Text>
          <Text color={p.red} bold>{THEME.name}</Text>
          <Text color={p.muted}>{`  ${THEME.nameZh} · ${THEME.os}`}</Text>
        </Text>
        <Text color={p.amber}>{placeOf(readings) || 'STANDBY'}</Text>
        {lines.map((l, i) => (
          <Text key={`say${i}`}>
            <Text color={p.orange}>{`${THEME.mascot}› `}</Text>
            {l}
          </Text>
        ))}
      </Box>
    )
    // The mobile app draws no Select yet: the card alone.
    if (e.surface === 'mobile') return card as RenderElement
    const { Button, Select } = $.ui.resolve(e)
    const controls = (
      <Box flexDirection="row" gap={2} flexWrap="wrap">
        <Select
          key="appearance"
          label="外观"
          value={prefs.appearance}
          options={[
            { value: 'auto', label: '跟随系统 auto' },
            { value: 'dark', label: '深色 dark' },
            { value: 'light', label: '浅色 light' },
          ]}
          onSelect={async (value: string) => {
            await savePrefs($, { appearance: value as Appearance })
            redraw($)
          }}
        />
        <Button
          key="replay"
          label="重播启动仪式"
          hotkey="b"
          onPress={async () => {
            await replayBoot($)
            redraw($)
          }}
        />
        <Button
          key="toggle"
          label={prefs.hidden ? '展开 HUD' : '收起 HUD'}
          hotkey="h"
          onPress={async () => {
            await savePrefs($, { hidden: !prefs.hidden })
            redraw($)
          }}
        />
        <Button
          key="motion"
          label={prefs.still ? '恢复动画' : '停止动画'}
          hotkey="m"
          onPress={async () => {
            await savePrefs($, { still: !prefs.still })
            redraw($)
          }}
        />
        <Button key="close" label="关闭" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
      </Box>
    )
    if (e.surface === 'terminal') {
      return (
        <Box flexDirection="column" gap={1}>
          {card}
          {controls}
        </Box>
      ) as RenderElement
    }
    const { Svg } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" gap={1}>
        <Svg source={cardSvg(readings, lines, prefs.appearance)} alt={`${THEME.mascot}: ${lines.join(' / ')}`} isInteractive />
        {controls}
      </Box>
    ) as RenderElement
  })
}
