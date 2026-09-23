// Pure bookkeeping for usageline: no `$`, so tests call it directly.

export type TurnTokens = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

export type Totals = {
  inTok: number
  outTok: number
  cacheRead: number
  cacheWrite: number
  usd: number
  turns: number
}

/** day (YYYY-MM-DD, local) → project root → model → totals */
export type Book = { v: 1; days: Record<string, Record<string, Record<string, Totals>>> }

/** Days kept in the store; the store caps at 4 MiB for the whole plugin. */
export const KEEP_DAYS = 90

/** A turn counts as a cache miss when it rewrote at least this much and read less than it wrote. */
export const MISS_MIN_WRITE = 10_000

export const emptyBook = (): Book => ({ v: 1, days: {} })

export function bookOf(saved: unknown): Book {
  if (typeof saved !== 'object' || saved === null) return emptyBook()
  const b = saved as Partial<Book>
  if (b.v !== 1 || typeof b.days !== 'object' || b.days === null) return emptyBook()
  return { v: 1, days: b.days }
}

export function dayOf(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const zero = (): Totals => ({ inTok: 0, outTok: 0, cacheRead: 0, cacheWrite: 0, usd: 0, turns: 0 })

function add(into: Totals, t: Totals): void {
  into.inTok += t.inTok
  into.outTok += t.outTok
  into.cacheRead += t.cacheRead
  into.cacheWrite += t.cacheWrite
  into.usd += t.usd
  into.turns += t.turns
}

export function addTurn(
  book: Book,
  day: string,
  project: string,
  model: string,
  u: TurnTokens,
  usd: number,
): void {
  const models = ((book.days[day] ??= {})[project] ??= {})
  add((models[model] ??= zero()), {
    inTok: u.input_tokens,
    outTok: u.output_tokens,
    cacheRead: u.cache_read_input_tokens,
    cacheWrite: u.cache_creation_input_tokens,
    usd,
    turns: 1,
  })
  const days = Object.keys(book.days).sort()
  for (const old of days.slice(0, Math.max(0, days.length - KEEP_DAYS))) delete book.days[old]
}

/** Share of the prompt served from the cache, 0..1; null when nothing was sent. */
export function hitRate(t: { inTok: number; cacheRead: number; cacheWrite: number }): number | null {
  const sent = t.inTok + t.cacheRead + t.cacheWrite
  return sent === 0 ? null : t.cacheRead / sent
}

export const totalsOf = (u: TurnTokens): Totals => ({
  inTok: u.input_tokens,
  outTok: u.output_tokens,
  cacheRead: u.cache_read_input_tokens,
  cacheWrite: u.cache_creation_input_tokens,
  usd: 0,
  turns: 1,
})

export type MissContext = {
  /** End of the previous main-loop turn, or null on the session's first. */
  prevEndMs: number | null
  startMs: number
  prevModel: string | null
  model: string
  compactedSince: boolean
  isSubagent: boolean
  ttlMs: number
}

/**
 * Why a turn rewrote its prompt cache, or null when it mostly read it.
 * ponytail: turn usage is summed over the turn's responses, so a miss on the
 * first response is judged from the total; per-response usage would be exact.
 */
export function missReason(u: TurnTokens, c: MissContext): string | null {
  const w = u.cache_creation_input_tokens
  if (w < MISS_MIN_WRITE || w <= u.cache_read_input_tokens) return null
  if (c.isSubagent) return 'subagent'
  if (c.prevEndMs === null) return 'first turn'
  if (c.compactedSince) return 'after compact'
  if (c.prevModel !== null && c.prevModel !== c.model)
    return `model ${shortModel(c.prevModel)}→${shortModel(c.model)}`
  const idle = c.startMs - c.prevEndMs
  if (idle > c.ttlMs) return `idle ${fmtDuration(idle)} > ${fmtDuration(c.ttlMs)} ttl`
  return 'prefix changed'
}

export function sumDay(book: Book, day: string, project?: string): Totals {
  const t = zero()
  for (const [p, models] of Object.entries(book.days[day] ?? {})) {
    if (project !== undefined && p !== project) continue
    for (const m of Object.values(models)) add(t, m)
  }
  return t
}

export function shortModel(id: string): string {
  const m = id.match(/claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(?:\[.*\])?$/)
  if (!m) return id
  return m[3] ? `${m[1]} ${m[2]}.${m[3]}` : `${m[1]} ${m[2]}`
}

export function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 999_950) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

export const fmtUsd = (n: number): string => (n < 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(1)}`)

export const fmtPct = (r: number): string => `${Math.round(r * 100)}%`

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** An 8-cell bar, like ccstatusline's short context bar. */
export function bar(ratio: number, cells = 8): string {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * cells)
  return '█'.repeat(filled) + '░'.repeat(cells - filled)
}

/** success / warning / error by how much of the prompt came from the cache. */
export const hitColor = (r: number): string => (r >= 0.8 ? 'success' : r >= 0.5 ? 'warning' : 'error')

/** success / warning / error by how full the context window is. */
export const ctxColor = (pct: number): string => (pct < 60 ? 'success' : pct < 85 ? 'warning' : 'error')

/** The /usage report: this project's last `days` days, then every project today. */
export function report(book: Book, project: string, today: string, days = 7): string {
  const head = ['day', 'turns', 'input', 'output', 'cache r', 'cache w', 'hit', 'cost']
  const rowOf = (label: string, t: Totals) => [
    label,
    String(t.turns),
    fmtTokens(t.inTok),
    fmtTokens(t.outTok),
    fmtTokens(t.cacheRead),
    fmtTokens(t.cacheWrite),
    (() => {
      const r = hitRate(t)
      return r === null ? '-' : fmtPct(r)
    })(),
    fmtUsd(t.usd),
  ]
  const dayList = Object.keys(book.days)
    .filter(d => d <= today)
    .sort()
    .reverse()
    .slice(0, days)
  const mine = dayList
    .map(d => [d, sumDay(book, d, project)] as const)
    .filter(([, t]) => t.turns > 0)
  const all = zero()
  for (const [, t] of mine) add(all, t)

  const byProject = Object.entries(book.days[today] ?? {})
    .map(([p, models]) => {
      const t = zero()
      for (const m of Object.values(models)) add(t, m)
      return [p, t] as const
    })
    .sort((a, b) => b[1].usd - a[1].usd)

  const table = (h: string[], rows: string[][]) => {
    const w = h.map((_, i) => Math.max(h[i]!.length, ...rows.map(r => r[i]!.length)))
    const line = (r: string[]) => r.map((c, i) => (i === 0 ? c.padEnd(w[i]!) : c.padStart(w[i]!))).join('  ')
    return [line(h), ...rows.map(line)].join('\n')
  }

  const out = [`${project}`, '']
  out.push(mine.length === 0 ? 'no turns recorded here yet' : table(head, [...mine.map(([d, t]) => rowOf(d, t)), rowOf(`${mine.length}d total`, all)]))
  if (byProject.length > 0) {
    out.push('', `today, every project`, '')
    out.push(table(['project', ...head.slice(1)], byProject.map(([p, t]) => rowOf(p.split('/').at(-1) ?? p, t))))
  }
  return out.join('\n')
}
