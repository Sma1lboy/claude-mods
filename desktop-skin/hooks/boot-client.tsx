import type { ClientModule } from 'claude-code'

/**
 * The terminal's boot ceremony, drawn in cells on the drawing thread: the
 * phase title, its step code and status, a hex row that lights up, the sync
 * readout and a progress bar. Everything it shows comes in as props; it posts
 * `{ done: true }` when the time runs out and `{ skip: true }` on any key.
 */
type Props = {
  ms: number
  tickMs: number
  /** Draw the last frame at once (reduced motion, set from /skin). */
  still: boolean
  phases: { code: string; zh: string; en: string; status: string; at: number }[]
  red: string
  orange: string
  amber: string
  muted: string
}

type State = { t: number; posted: boolean }

const BootClient: ClientModule<Props, State> = (p, s) => {
  const { Box, Text } = s.elements
  if (s.state === undefined) {
    s.setState({ t: p.still ? p.ms : 0, posted: false })
    s.every(p.tickMs, () => {
      const cur = s.state ?? { t: 0, posted: false }
      const t = Math.min(p.ms, cur.t + p.tickMs)
      if (t >= p.ms && !cur.posted) s.post({ done: true })
      s.setState({ t, posted: cur.posted || t >= p.ms })
    })
    s.onKey(() => s.post({ skip: true }))
  }
  const t = s.state?.t ?? 0
  let i = 0
  while (i + 1 < p.phases.length && p.phases[i + 1]!.at <= t) i++
  const ph = p.phases[i]!
  const next = p.phases[i + 1]?.at ?? p.ms
  const local = Math.min(1, Math.max(0, (t - ph.at) / Math.max(1, next - ph.at)))
  const width = Math.max(10, Math.min(48, (s.columns || 60) - 12))
  const filled = Math.round((t / p.ms) * width)
  const hexes = Array.from({ length: 9 }, (_, k) => (i > 1 || (i === 1 && k < local * 9) ? '⬢' : '⬡')).join(' ')
  // The readout is part of the ceremony, not a session figure.
  const sync = i < 2 ? 0 : i === 2 ? Math.round(local * 100) : 100
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={p.red} bold>SCARLET LINK</Text>
        <Text color={p.muted}>{`  ${ph.code} / 0${p.phases.length}`}</Text>
      </Text>
      <Text>
        <Text bold>{ph.zh}</Text>
        <Text color={p.muted}>{`  ${ph.en}`}</Text>
      </Text>
      <Text color={p.orange}>{hexes}</Text>
      <Text>
        <Text color={p.amber} bold>{`SYNC ${String(sync).padStart(3, ' ')}%  `}</Text>
        <Text color={p.red}>{'█'.repeat(filled)}</Text>
        <Text color={p.muted}>{'░'.repeat(width - filled)}</Text>
      </Text>
      <Text color={p.muted} wrap="truncate-end">{`${ph.status} · 任意键跳过`}</Text>
    </Box>
  )
}

export default BootClient
