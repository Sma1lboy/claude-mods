import type { EngineInterface, Register, RenderElement, TurnCompleteInput, TurnUsage } from 'claude-code'

import { DEFAULT_SETTINGS, settingsOf, type Settings } from './config'
import { addTurn, bookOf, dayOf, emptyBook, missReason, report, sumDay, type Book } from './ledger'
import { lineOf, type Git, type Seg, type Snapshot } from './widgets'

const STORE_KEY = 'book'
const COMMAND = 'usageline'
// ponytail: assumes the 5-minute prompt cache; a 1-hour TTL setting is not read.
const TTL_MS = 5 * 60_000
/** How often the line is recomputed; it redraws only when its text changed. */
const TICK_MS = 5000
/** How often custom-command widgets rerun their command. */
const COMMAND_EVERY_MS = 30_000
const REFRESH_TOOLS = new Set(['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

let settings: Settings = DEFAULT_SETTINGS
let book: Book = emptyBook()
let project = ''
let model = ''
/** 0 until the first response, as ccstatusline shows a fresh session. */
let ctxTokens: number | null = 0
let ctxPct: number | null = null
/** cost.usd as last read: the baseline the next turn's delta is taken from. */
let lastCost: number | null = null
let outTokens = 0
let streamMs = 0
let working = false
let turnStartMs: number | null = null
/** The first request of the running main-loop turn: the one that meets the cache. */
let firstStep: TurnUsage | null = null
let prevEndMs: number | null = null
let prevModel: string | null = null
let compactedSince = false
let turn: Snapshot['turn'] = null
let miss: Snapshot['miss'] = null
let git: Git | null = null
let commands: Record<string, string> = {}
let commandsAt = 0
/** The text last drawn, so a tick redraws only on a change. */
let drawnKey = ''
/** Turns are recorded one at a time: two finishing together must not share a cost delta. */
let recording: Promise<void> = Promise.resolve()

async function readUsage($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage()
    // Right after an interrupt the context figures are absent; keep the last ones.
    if (u.context.tokens !== undefined) ctxTokens = u.context.tokens
    if (u.context.percent !== undefined) ctxPct = u.context.percent
    if (u.cost) lastCost = u.cost.usd
  } catch {
    // the line keeps its previous figures
  }
}

async function runGit($: EngineInterface, args: string[]): Promise<string | null> {
  try {
    const r = await $.process.run(['git', '--no-optional-locks', ...args], { timeoutMs: 3000 })
    return r.exitCode === 0 ? r.stdout.trim() : null
  } catch {
    return null
  }
}

function shortstat(out: string | null): [number, number] {
  const ins = Number(out?.match(/(\d+) insertion/)?.[1] ?? 0)
  const del = Number(out?.match(/(\d+) deletion/)?.[1] ?? 0)
  return [ins, del]
}

/** Worktree name, branch and line counts, the way ccstatusline's git widgets read them. */
async function readGit($: EngineInterface): Promise<void> {
  const gitDir = await runGit($, ['rev-parse', '--git-dir'])
  if (gitDir === null) {
    git = null
    return
  }
  const [branch, unstaged, staged] = await Promise.all([
    runGit($, ['symbolic-ref', '--short', 'HEAD']),
    runGit($, ['diff', '--shortstat']),
    runGit($, ['diff', '--cached', '--shortstat']),
  ])
  const dir = gitDir.replace(/\\/g, '/')
  const marker = dir.lastIndexOf('/worktrees/')
  const worktree = dir.endsWith('.git') ? 'main' : marker === -1 ? null : dir.slice(marker + '/worktrees/'.length)
  const [a, b] = shortstat(unstaged)
  const [c, d] = shortstat(staged)
  git = { worktree, branch, insertions: a + c, deletions: b + d }
}

async function readCommands($: EngineInterface, now: number): Promise<void> {
  commandsAt = now
  const items = settings.lines.flat().filter(w => w.type === 'custom-command' && w.commandPath)
  const next: Record<string, string> = {}
  await Promise.all(
    items.map(async w => {
      try {
        const r = await $.process.run(['sh', '-c', w.commandPath!], { timeoutMs: w.timeout ?? 1000 })
        // eslint-disable-next-line no-control-regex
        const line = r.stdout.replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').at(-1) ?? ''
        if (line) next[w.commandPath!] = line
      } catch {
        // a command that fails or times out draws nothing
      }
    }),
  )
  commands = next
}

function snapshot(now: number): Snapshot {
  const today = sumDay(book, dayOf(now), project)
  return {
    model,
    ctxTokens,
    ctxPct,
    sessionUsd: lastCost,
    outTokens,
    streamMs,
    turn,
    working,
    cacheLeftMs: prevEndMs === null ? null : TTL_MS - (now - prevEndMs),
    ttlMs: TTL_MS,
    miss,
    todayUsd: today.turns > 0 ? today.usd : null,
    git,
    commands,
  }
}

function linesAt(now: number): Seg[][] {
  const s = snapshot(now)
  return settings.lines.map(items => lineOf(items, s, settings)).filter(l => l.length > 0)
}

/** Redraws when the line's text changed since the last drawing, and only then. */
async function refresh($: EngineInterface): Promise<void> {
  const key = JSON.stringify(linesAt(await $.clock.now()))
  if (key === drawnKey) return
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
    turn = { input: u.input_tokens, read: u.cache_read_input_tokens, write: u.cache_creation_input_tokens }
    const first = firstStep ?? u
    const reason = missReason(first, {
      prevEndMs,
      startMs: turnStartMs ?? now,
      prevModel,
      model: u.model,
      compactedSince,
      isSubagent: false,
      ttlMs: TTL_MS,
    })
    miss = reason ? { reason, written: first.cache_creation_input_tokens } : null
    prevEndMs = now
    prevModel = u.model
    model = u.model
    compactedSince = false
    firstStep = null
  }
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
      const home = await $.env.get('HOME')
      settings = settingsOf(JSON.parse(await $.fs.read(`${home}/.config/usageline/settings.json`)))
    } catch (error) {
      $.ui.log(`usageline: default layout, settings not read: ${error}`)
      settings = DEFAULT_SETTINGS
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
    const now = await $.clock.now()
    await Promise.all([readUsage($), readGit($), readCommands($, now)])
    try {
      await $.command.register({ name: COMMAND, description: 'This project’s token and cost ledger, by day' })
    } catch (error) {
      $.ui.log(`usageline: /${COMMAND} not registered: ${error}`)
    }
    $.clock.every(TICK_MS, () => {
      void (async () => {
        const at = await $.clock.now()
        if (at - commandsAt >= COMMAND_EVERY_MS) await readCommands($, at)
        await refresh($)
      })()
    })
    // The hint may have drawn before this start finished.
    drawnKey = ''
    await refresh($)
    return result
  })

  on('turn.start', async ($, e, next) => {
    turnStartMs = await $.clock.now()
    firstStep = null
    working = true
    const result = await next(e)
    await refresh($)
    return result
  })

  // Output speed counts from the response's first streamed chunk, not from the
  // request: the wait before it is the prompt being read, not tokens being written.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    let firstAt: number | null = null
    let r = await stream.next()
    while (!r.done) {
      if (firstAt === null && r.value.kind !== 'engine') firstAt = await $.clock.now()
      yield r.value
      r = await stream.next()
    }
    const result = r.value
    if (result.usage) {
      outTokens += result.usage.output_tokens
      if (firstAt !== null) streamMs += (await $.clock.now()) - firstAt
      if (e.index === 0 && e.agentId === undefined) firstStep = result.usage
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    recording = recording.then(() => record($, e)).catch(() => undefined)
    await recording
    if (e.agentId === undefined) {
      working = false
      await readGit($)
    }
    await refresh($)
    return result
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && REFRESH_TOOLS.has(e.tool)) {
      await readGit($)
      await refresh($)
    }
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
      turn = null
      miss = null
      compactedSince = false
      await refresh($)
      return result
    })
  }

  on('command.run', { command: COMMAND }, async $ => {
    const now = await $.clock.now()
    return { text: report(book, project, dayOf(now)) }
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const hint = await next(e)
    const lines = linesAt(await $.clock.now())
    drawnKey = JSON.stringify(lines)
    if (lines.length === 0) return hint
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {hint}
        {lines.map((segs, row) => (
          <Text key={`l${row}`} wrap="truncate-end">
            {segs.map((s, i) => (
              <Text key={String(i)} color={s.color} backgroundColor={s.backgroundColor} bold={s.bold}>
                {s.text}
              </Text>
            ))}
          </Text>
        ))}
      </Box>
    ) as RenderElement
  })
}
