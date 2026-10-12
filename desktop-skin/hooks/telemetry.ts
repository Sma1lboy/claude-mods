import type { SessionUsage } from 'claude-code'

import { THEME } from './theme'

/**
 * What the skin knows about the session, each figure as the engine answered
 * it. A figure the engine did not give stays null and is drawn as a dash or
 * left out; nothing is estimated.
 */
export type Readings = {
  model: string | null
  /** Context tokens the last response was answered over. */
  tokens: number | null
  /** Those tokens over the window, 0 to 100. */
  percent: number | null
  window: number | null
  /** The session's cost in USD, as /cost totals it. */
  usd: number | null
  /** The 5-hour and 7-day windows, percent used, when on a subscription. */
  fiveHour: number | null
  sevenDay: number | null
  turns: number | null
  /** Project directory name. */
  project: string | null
}

export const EMPTY: Readings = {
  model: null,
  tokens: null,
  percent: null,
  window: null,
  usd: null,
  fiveHour: null,
  sevenDay: null,
  turns: null,
  project: null,
}

export function fromUsage(u: SessionUsage): Pick<Readings, 'tokens' | 'percent' | 'window' | 'usd' | 'fiveHour' | 'sevenDay'> {
  const limit = (kind: string) => u.rateLimits.find(r => r.kind === kind)?.percentUsed ?? null
  return {
    tokens: u.context.tokens ?? null,
    percent: u.context.percent ?? null,
    window: u.context.window || null,
    usd: u.cost?.usd ?? null,
    fiveHour: limit('five_hour'),
    sevenDay: limit('seven_day'),
  }
}

export function tokensText(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/** `claude-opus-5-5[1m]` → `opus 5.5`. */
export function modelText(id: string): string {
  const m = id.match(/claude-([a-z]+)-(\d+)-(\d+)/)
  return m ? `${m[1]} ${m[2]}.${m[3]}` : id.replace(/\[.*\]$/, '')
}

/** Where the pilot is: project and model, the parts the engine gave. */
export function placeOf(r: Pick<Readings, 'project' | 'model'>): string {
  return [r.project, r.model === null ? null : modelText(r.model)].filter(Boolean).join(' · ')
}

/** One cell of the telemetry strip. */
export type Cell = { label: string; value: string; hot?: boolean }

/** The strip under the band: every figure the engine gave, a dash for the rest. */
export function cellsOf(r: Readings): Cell[] {
  const dash = '—'
  return [
    { label: 'CTX', value: r.percent === null ? dash : `${r.percent}%`, hot: (r.percent ?? 0) >= 80 },
    { label: 'TOK', value: r.tokens === null ? dash : tokensText(r.tokens) },
    { label: 'COST', value: r.usd === null ? dash : `$${r.usd.toFixed(2)}` },
    ...(r.fiveHour === null ? [] : [{ label: '5H', value: `${r.fiveHour}%`, hot: r.fiveHour >= 80 }]),
    ...(r.sevenDay === null ? [] : [{ label: '7D', value: `${r.sevenDay}%`, hot: r.sevenDay >= 80 }]),
    { label: 'MODEL', value: r.model === null ? dash : modelText(r.model) },
  ]
}

/**
 * What BOLT says, in order: one line per figure the engine gave, then quips
 * to fill up to `min` lines. A figure that is missing is never said.
 */
export function bubbleOf(r: Readings, min = 3): string[] {
  const out: string[] = []
  if (r.percent !== null) {
    const left = 100 - r.percent
    out.push(left <= 20 ? `上下文只剩 ${left}%，该考虑压缩了` : `上下文已用 ${r.percent}%，还很宽裕`)
  }
  if (r.usd !== null) out.push(`本次会话花了 $${r.usd.toFixed(2)}`)
  if (r.fiveHour !== null) out.push(`5 小时额度用了 ${r.fiveHour}%`)
  if (r.sevenDay !== null) out.push(`7 天额度用了 ${r.sevenDay}%`)
  if (r.turns !== null && r.turns > 0) out.push(`已经聊了 ${r.turns} 轮`)
  for (let i = 0; out.length < min && i < THEME.quips.length; i++) out.push(THEME.quips[i]!)
  return out
}
