import type { On, SessionUsage } from 'claude-code'
import { describe, expect, mock, test, tier, type Engine, type MountTarget } from 'claude-code/testing'

tier('user')

const BOOT_MS = 9400

const BAND = {
  plugin: 'desktop-skin',
  component: 'AbovePrompt',
  requestId: 'band',
  viewport: { columns: 140, rows: 40, isFullscreen: false },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 140,
    scroll: { offset: 0, bodyRows: 19, totalRows: 0 },
    view: {},
  },
} as const

type Usage = Omit<SessionUsage, 'startedAt'>

const FULL: Usage = {
  context: { window: 1_000_000, percent: 42, tokens: 180_600 },
  rateLimits: [{ kind: 'five_hour', percentUsed: 23 }],
  cost: { usd: 0.4 },
}

/** The session under the plugin: a repo named claude-mods, its usage as given. */
function world(on: On, usage: Usage = FULL, store: Record<string, unknown> = {}) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.repo', () => ({ value: { root: '/w/claude-mods', remote: null, internal: false, name: 'claude-mods' } }))
  on('session.root', () => ({ value: '/w/claude-mods' }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.turns', () => ({ value: 3 }))
  on('session.usage', () => ({ value: { startedAt: 0, ...usage } }))
  on('config.list', () => ({ value: [] }))
  // The spinner's own drawing is its word; every other site draws nothing of the engine's.
  on('ui.render', ($, e) => h('Text', null, e.component === 'Spinner' ? e.props.word : '') as never)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  /** The plugin's store, which the test reads back. */
  const saved: Record<string, unknown> = { ...store }
  on('store.get', ($, e) => ({ value: saved[e.key] }))
  on('store.set', ($, e) => {
    saved[e.key] = e.value
    return { value: undefined }
  })
  return { saved, clock: mock.clock(on, { now: Date.UTC(2026, 9, 9, 12) }) }
}

const drawn = async (ui: { drawn: () => Promise<unknown> }) => JSON.stringify(await ui.drawn())

/** The band above the prompt, drawn on one surface. */
const band = <P extends 'desktop' | 'terminal'>($: Engine, surface: P) =>
  $.ui.mount({ ...BAND, surface } as unknown as MountTarget<P, 'AbovePrompt'>)

describe('desktop', () => {
  test('manual still mode disables SVG animation in the boot, HUD and pane', async ($, on) => {
    const { clock } = world(on, FULL, { prefs: { still: true } })
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const ui = await band($, 'desktop')
    expect(await drawn(ui)).toContain('svg *{animation:none!important}')
    await clock.advance(BOOT_MS)
    expect(await drawn(ui)).toContain('svg *{animation:none!important}')
    const pane = await $.ui.mount({
      plugin: 'desktop-skin', surface: 'desktop', component: 'Pane', requestId: 'scarlet-link',
      props: { title: 'SCARLET LINK', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30, totalRows: 0 }, view: {} },
    } as unknown as MountTarget<'desktop', 'Pane'>)
    expect(await drawn(pane)).toContain('svg *{animation:none!important}')
    await pane.press({ key: 'motion' })
    expect(await drawn(pane)).not.toContain('svg *{animation:none!important}')
    expect(await drawn(ui)).not.toContain('svg *{animation:none!important}')
  })

  test('the first band is the boot ceremony, then the HUD once it has played', async ($, on) => {
    const { clock } = world(on)
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const ui = await band($, 'desktop')

    const boot = await drawn(ui)
    expect(boot).toContain('"type":"Svg"')
    expect(boot).toContain('启动完成')
    expect(boot).toContain('claude-mods · opus 5.5')
    expect(await ui.find({ type: 'Button', key: 'skip' })).toBeDefined()

    await clock.advance(BOOT_MS)
    const hud = await drawn(ui)
    expect(hud).not.toContain('启动完成')
    expect(hud).toContain('上下文已用 42%')
    expect(hud).toContain('$0.40')
    expect(hud).toContain('5 小时额度用了 23%')
  })

  test('skip shows the HUD at once and records the ceremony as seen', async ($, on) => {
    const { saved } = world(on)
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const ui = await band($, 'desktop')
    await ui.press({ key: 'skip' })
    expect(await drawn(ui)).not.toContain('启动完成')
    expect(saved.prefs).toMatchObject({ bootSeen: true })
  })

  test('a ceremony seen before is not played again', async ($, on) => {
    world(on, FULL, { prefs: { bootSeen: true } })
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const ui = await band($, 'desktop')
    const hud = await drawn(ui)
    expect(hud).not.toContain('启动完成')
    expect(hud).toContain('上下文已用 42%')
  })

  test('a band drawn before the session start has read the store still knows the ceremony was seen', async ($, on) => {
    world(on, FULL, { prefs: { bootSeen: true } })
    expect(await drawn(await band($, 'desktop'))).not.toContain('启动完成')
  })

  test('a figure the engine did not give is drawn as a dash and never said', async ($, on) => {
    world(on, { context: { window: 200_000 }, rateLimits: [] }, { prefs: { bootSeen: true } })
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const ui = await band($, 'desktop')
    const hud = await drawn(ui)
    expect(hud).toContain('CTX</text>')
    expect(hud).not.toContain('上下文已用')
    expect(hud).not.toMatch(/\$\d/)
    expect(hud).not.toContain('额度')
    expect(hud).toContain('—')
  })

  test('the spinner keeps the desktop step words and themes the bare one', async ($, on) => {
    world(on)
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const spin = (word: string) =>
      $.ui.mount({
        plugin: 'desktop-skin',
        surface: 'desktop',
        component: 'Spinner',
        props: { word, message: null, suffix: '…', mode: 'thinking' },
      } as never)
    expect(await drawn(await spin('Creating notes.md'))).toContain('Creating notes.md')
    expect(await drawn(await spin('Working'))).toContain('神经演算')
  })
})

describe('terminal', () => {
  test('the band draws no Svg: a Client ceremony that posts done, then one line', async ($, on) => {
    world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/claude-mods' })
    const ui = await band($, 'terminal')

    const boot = await drawn(ui)
    expect(boot).not.toContain('"type":"Svg"')
    expect(boot).toContain('"type":"Client"')
    await ui.resize({ columns: 80, rows: 6 })
    expect(JSON.stringify(await ui.drawn({ in: 'boot' }))).toContain('驾驶舱接入')

    await ui.advance(BOOT_MS)
    const line = await drawn(ui)
    expect(line).not.toContain('"type":"Client"')
    expect(line).toContain('SCARLET LINK')
    expect(line).toContain('42%')
  })

  test('a key in the ceremony skips it', async ($, on) => {
    world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/claude-mods' })
    const ui = await band($, 'terminal')
    await ui.key({ key: 'x' })
    expect(await drawn(ui)).not.toContain('"type":"Client"')
  })
})

describe('pane', () => {
  const PANE = {
    plugin: 'desktop-skin',
    component: 'Pane',
    requestId: 'scarlet-link',
    props: { title: 'SCARLET LINK', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 30, totalRows: 0 }, view: {} },
  } as const

  test('the desktop card draws, its appearance pick sticks, replay brings the ceremony back', async ($, on) => {
    const { saved } = world(on, FULL, { prefs: { bootSeen: true } })
    await $.session.start({ surface: null, isInteractive: false, cwd: '/w/claude-mods' })
    const pane = await $.ui.mount({ ...PANE, surface: 'desktop' } as unknown as MountTarget<'desktop', 'Pane'>)
    expect(await drawn(pane)).toContain('PILOT ASSIST')

    await pane.select({ key: 'appearance', value: 'light' })
    expect(saved.prefs).toMatchObject({ appearance: 'light' })
    expect(await drawn(pane)).toContain('class=\\"a-light\\"')

    await pane.press({ key: 'replay' })
    expect(await drawn(await band($, 'desktop'))).toContain('启动完成')
  })

  test('the terminal pane is text and controls', async ($, on) => {
    world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/claude-mods' })
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' } as unknown as MountTarget<'terminal', 'Pane'>)
    const text = await drawn(pane)
    expect(text).not.toContain('"type":"Svg"')
    expect(text).toContain('上下文已用 42%')
    expect(await pane.find({ type: 'Button', key: 'replay' })).toBeDefined()
  })
})
