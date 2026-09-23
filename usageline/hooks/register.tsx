import type { EngineInterface, Register, RenderElement, TurnCompleteInput } from 'claude-code'

import {
  addTurn,
  bar,
  bookOf,
  ctxColor,
  dayOf,
  emptyBook,
  fmtClock,
  fmtPct,
  fmtTokens,
  fmtUsd,
  hitColor,
  hitRate,
  missReason,
  report,
  shortModel,
  sumDay,
  totalsOf,
  type Book,
} from './ledger'

const STORE_KEY = 'book'
const COMMAND = 'usageline'
// ponytail: assumes the 5-minute prompt cache; a 1-hour TTL setting is not read.
const TTL_MS = 5 * 60_000
/** Countdown under a minute turns the TTL segment from success to warning. */
const TTL_WARN_MS = 60_000

let book: Book = emptyBook()
let project = ''
let model = ''
let ctxPct: number | null = null
/** cost.usd as last read: the baseline the next turn's delta is taken from. */
let lastCost: number | null = null
let turnStartMs: number | null = null
let prevEndMs: number | null = null
let prevModel: string | null = null
let compactedSince = false
let last: { hit: number | null; miss: string | null; written: number } | null = null
/** Turns are recorded one at a time: two finishing together must not share a cost delta. */
let recording: Promise<void> = Promise.resolve()

async function readUsage($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage()
    ctxPct = u.context.percent ?? ctxPct
    if (u.cost) lastCost = u.cost.usd
  } catch {
    // the line keeps its previous figures
  }
}

function redraw($: EngineInterface): void {
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // the next render picks the figures up
  }
}

async function record($: EngineInterface, e: TurnCompleteInput): Promise<void> {
  const u = e.usage
  if (!u) return
  const now = await $.clock.now()
  const before = lastCost
  await readUsage($)
  const usd = before !== null && lastCost !== null ? Math.max(0, lastCost - before) : 0

  addTurn(book, dayOf(now), project, u.model, u, usd)
  try {
    await $.store.set(STORE_KEY, book)
  } catch {
    // the in-memory book is unaffected
  }

  if (e.agentId === undefined) {
    last = {
      hit: hitRate(totalsOf(u)),
      miss: missReason(u, {
        prevEndMs,
        startMs: turnStartMs ?? now,
        prevModel,
        model: u.model,
        compactedSince,
        isSubagent: false,
        ttlMs: TTL_MS,
      }),
      written: u.cache_creation_input_tokens,
    }
    prevEndMs = now
    prevModel = u.model
    model = u.model
    compactedSince = false
  }
  redraw($)
}

type Seg = { text: string; color?: string; dim?: boolean }

function segments(now: number, working: boolean): Seg[] {
  const segs: Seg[] = []
  if (model) segs.push({ text: shortModel(model), color: 'claude' })
  if (ctxPct !== null) segs.push({ text: `ctx ${bar(ctxPct / 100)} ${ctxPct}%`, color: ctxColor(ctxPct) })
  if (last?.hit != null) segs.push({ text: `cache ${fmtPct(last.hit)}`, color: hitColor(last.hit) })
  if (working) segs.push({ text: '● hot', color: 'success' })
  else if (prevEndMs !== null) {
    const left = TTL_MS - (now - prevEndMs)
    segs.push(
      left > 0
        ? { text: `● hot ${fmtClock(left)}`, color: left < TTL_WARN_MS ? 'warning' : 'success' }
        : { text: '○ cold', dim: true },
    )
  }
  const today = sumDay(book, dayOf(now), project)
  if (today.turns > 0) {
    const name = project.split('/').at(-1) ?? project
    segs.push({ text: `today ${fmtUsd(today.usd)} · ${name}` })
  }
  if (last?.miss) segs.push({ text: `⚠ miss: ${last.miss}, +${fmtTokens(last.written)} rewritten`, color: 'warning' })
  return segs
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    try {
      book = bookOf(await $.store.get(STORE_KEY))
    } catch {
      book = emptyBook()
    }
    try {
      project = (await $.session.repo())?.root ?? (await $.session.root())
    } catch {
      project = e.cwd
    }
    try {
      model = await $.session.model()
    } catch {
      // filled in by the first turn
    }
    await readUsage($)
    try {
      await $.command.register({ name: COMMAND, description: 'This project’s token and cost ledger, by day' })
    } catch (error) {
      $.ui.log(`usageline: /${COMMAND} not registered: ${error}`)
    }
    // The TTL countdown ticks while the cache is warm; the line holds still otherwise.
    $.clock.every(1000, () => {
      void $.clock.now().then(now => {
        if (prevEndMs !== null && now - prevEndMs < TTL_MS + 2000) redraw($)
      })
    })
    // The hint may have drawn before this start finished.
    redraw($)
    return result
  })

  on('turn.start', async ($, e, next) => {
    turnStartMs = await $.clock.now()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    recording = recording.then(() => record($, e)).catch(() => undefined)
    await recording
    return result
  })

  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (e.trigger !== 'precompute' && e.agentId === undefined) compactedSince = true
    return result
  })

  // A cleared or resumed conversation starts a new prompt cache.
  for (const command of ['clear', 'resume']) {
    on('command.run', { command }, async ($, e, next) => {
      const result = await next(e)
      prevEndMs = null
      last = null
      compactedSince = false
      redraw($)
      return result
    })
  }

  on('command.run', { command: COMMAND }, async $ => {
    const now = await $.clock.now()
    return { text: report(book, project, dayOf(now)) }
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const now = await $.clock.now()
    const segs = segments(now, e.props.isWorking)
    if (segs.length === 0) return hint
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {hint}
        <Text wrap="truncate-end">
          {segs.map((s, i) => (
            <Text key={String(i)}>
              {i > 0 ? <Text dimColor>{' │ '}</Text> : null}
              <Text color={s.color} dimColor={s.dim}>
                {s.text}
              </Text>
            </Text>
          ))}
        </Text>
      </Box>
    ) as RenderElement
  })
}
