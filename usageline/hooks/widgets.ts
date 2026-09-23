// ccstatusline widgets drawn from what the engine reports, not from the transcript.
import { colorOf, type Settings, type WidgetItem } from './config'
import { bar, fmtTokens, shortModel } from './ledger'

/** ccstatusline's token format: one decimal on k and M (`180.6k`). */
const tokens = (n: number) => (n >= 999_950 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

export type Git = { worktree: string | null; branch: string | null; insertions: number; deletions: number }

export type Snapshot = {
  model: string
  ctxTokens: number | null
  ctxPct: number | null
  sessionUsd: number | null
  /** Output tokens and the time their requests took, summed over the session's steps. */
  outTokens: number
  streamMs: number
  /** The last main-loop turn's tokens, summed over its requests. */
  turn: { input: number; read: number; write: number } | null
  working: boolean
  /** Milliseconds left on the prompt cache; null before the first turn. */
  cacheLeftMs: number | null
  ttlMs: number
  miss: { reason: string; written: number } | null
  todayUsd: number | null
  /** null outside a git work tree. */
  git: Git | null
  /** Last stdout line of each custom-command, by command. */
  commands: Readonly<Record<string, string>>
}

export type Seg = { text: string; color?: string; backgroundColor?: string; bold?: boolean }

const labeled = (item: WidgetItem, label: string, value: string) => (item.rawValue ? value : `${label}${value}`)

const fixed = (n: number, d = 1) => n.toFixed(d)

/** ccstatusline's cache timer glyph for how much of the TTL is left. */
function cacheGlyph(left: number, ttl: number): string {
  if (left <= 0) return '❄️'
  const pct = left / ttl
  return pct > 0.5 ? '🟢' : pct > 0.2 ? '🟡' : '🔴'
}

/**
 * ponytail: the timer reads in whole minutes, not ccstatusline's m:ss; every
 * redraw of the hint line flashes one ghost frame on 2.1.280, so a per-second
 * countdown would flicker. Seconds once that engine bug is fixed.
 */
function countdown(left: number): string {
  if (left <= 0) return 'COLD'
  return left < 60_000 ? '<1m' : `${Math.floor(left / 60_000)}m`
}

export function widgetText(item: WidgetItem, s: Snapshot): string | null {
  switch (item.type) {
    case 'custom-text':
      return item.customText ?? null
    case 'custom-command':
      return item.commandPath ? (s.commands[item.commandPath] ?? null) : null
    case 'model':
      return s.model ? labeled(item, 'Model: ', shortModel(s.model)) : null
    case 'git-worktree':
      return s.git?.worktree ? labeled(item, '𖠰 ', s.git.worktree) : s.git ? null : labeled(item, '𖠰 ', 'no git')
    case 'git-branch':
      return s.git?.branch ? labeled(item, '⎇ ', s.git.branch) : s.git ? null : labeled(item, '⎇ ', 'no git')
    case 'git-changes':
      return s.git ? `(+${s.git.insertions},-${s.git.deletions})` : '(no git)'
    case 'context-length':
      return s.ctxTokens === null ? null : labeled(item, 'Ctx: ', tokens(s.ctxTokens))
    case 'context-percentage':
      return s.ctxPct === null ? null : labeled(item, 'Ctx: ', `${fixed(s.ctxPct)}%`)
    case 'context-bar':
      return s.ctxPct === null ? null : labeled(item, 'Ctx: ', `${bar(s.ctxPct / 100)} ${Math.round(s.ctxPct)}%`)
    case 'output-speed':
      return labeled(item, 'Out: ', s.streamMs > 0 ? `${fixed(s.outTokens / (s.streamMs / 1000))} t/s` : '—')
    case 'session-cost':
      return s.sessionUsd === null || s.sessionUsd < 0.005 ? null : labeled(item, 'Cost: ', `$${s.sessionUsd.toFixed(2)}`)
    case 'cache-timer':
      if (s.working) return labeled(item, 'Cache: ', '🔥 HOT')
      if (s.cacheLeftMs === null) return null
      return labeled(item, 'Cache: ', `${cacheGlyph(s.cacheLeftMs, s.ttlMs)} ${countdown(s.cacheLeftMs)}`)
    case 'cache-hit-rate': {
      const t = s.turn
      if (!t || t.read + t.write === 0) return null
      return labeled(item, 'Cache Hit: ', `${fixed((t.read / (t.read + t.write)) * 100)}%`)
    }
    case 'cache-read':
      return s.turn ? labeled(item, 'Cache Read: ', tokens(s.turn.read)) : null
    case 'cache-write':
      return s.turn ? labeled(item, 'Cache Write: ', tokens(s.turn.write)) : null
    case 'usageline-today':
      return s.todayUsd === null ? null : labeled(item, 'Today: ', `$${s.todayUsd.toFixed(2)}`)
    case 'usageline-cache-miss':
      return s.miss ? labeled(item, 'Miss: ', `${s.miss.reason}, +${fmtTokens(s.miss.written)} rewritten`) : null
    default:
      return null
  }
}

function separatorText(item: WidgetItem, settings: Settings): string {
  const sep = item.character ?? settings.defaultSeparator ?? '|'
  return sep === '|' ? ' | ' : sep === ',' ? ', ' : sep === '-' ? ' - ' : sep
}

/**
 * One configured line as colored segments. A separator shows only between two
 * widgets that drew something, as ccstatusline's does.
 */
export function lineOf(items: readonly WidgetItem[], s: Snapshot, settings: Settings): Seg[] {
  const out: Seg[] = []
  let pendingSep: Seg | null = null
  for (const item of items) {
    const style = {
      color: colorOf(item.color, settings.colorLevel),
      backgroundColor: colorOf(item.backgroundColor, settings.colorLevel),
      bold: item.bold ?? settings.globalBold,
    }
    if (item.type === 'separator' || item.type === 'flex-separator') {
      if (out.length > 0 && pendingSep === null) pendingSep = { text: separatorText(item, settings), ...style }
      continue
    }
    const text = widgetText(item, s)
    if (!text) continue
    if (pendingSep) out.push(pendingSep)
    pendingSep = null
    out.push({ text, ...style })
  }
  return out
}
