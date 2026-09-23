// The ccstatusline settings format (~/.config/ccstatusline/settings.json), read
// by usageline from its own ~/.config/usageline/settings.json.

export type WidgetItem = {
  id?: string
  type: string
  color?: string
  backgroundColor?: string
  bold?: boolean
  rawValue?: boolean
  character?: string
  customText?: string
  commandPath?: string
  timeout?: number
  [key: string]: unknown
}

export type Settings = {
  lines: WidgetItem[][]
  colorLevel: number
  defaultSeparator?: string
  globalBold?: boolean
}

/** What usageline draws with no settings file: a line about the cache. */
export const DEFAULT_SETTINGS: Settings = {
  colorLevel: 2,
  lines: [
    [
      { type: 'model', rawValue: true, color: 'brightMagenta' },
      { type: 'separator' },
      { type: 'context-bar', color: 'brightBlack' },
      { type: 'separator' },
      { type: 'cache-hit-rate', color: 'green' },
      { type: 'separator' },
      { type: 'cache-timer', color: 'brightCyan' },
      { type: 'separator' },
      { type: 'usageline-today', color: 'green' },
      { type: 'separator' },
      { type: 'usageline-cache-miss', color: 'yellow' },
    ],
  ],
}

export function settingsOf(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS
  const s = raw as Record<string, unknown>
  const lines = Array.isArray(s['lines'])
    ? (s['lines'] as unknown[])
        .filter(Array.isArray)
        .map(line => (line as unknown[]).filter((w): w is WidgetItem => typeof (w as WidgetItem)?.type === 'string'))
    : DEFAULT_SETTINGS.lines
  return {
    lines,
    colorLevel: typeof s['colorLevel'] === 'number' ? s['colorLevel'] : 2,
    defaultSeparator: typeof s['defaultSeparator'] === 'string' ? s['defaultSeparator'] : undefined,
    globalBold: s['globalBold'] === true,
  }
}

// ccstatusline's palette: name → [chalk name, ansi256 index, truecolor hex].
const PALETTE: Record<string, [string, number, string]> = {
  black: ['black', 16, '#000000'],
  red: ['red', 160, '#cc0000'],
  green: ['green', 70, '#4e9a06'],
  yellow: ['yellow', 178, '#c4a000'],
  blue: ['blue', 26, '#3465a4'],
  magenta: ['magenta', 96, '#75507b'],
  cyan: ['cyan', 30, '#06989a'],
  white: ['white', 188, '#d3d7cf'],
  brightBlack: ['blackBright', 59, '#555753'],
  brightRed: ['redBright', 203, '#ef2929'],
  brightGreen: ['greenBright', 155, '#8ae234'],
  brightYellow: ['yellowBright', 227, '#fce94f'],
  brightBlue: ['blueBright', 111, '#729fcf'],
  brightMagenta: ['magentaBright', 140, '#ad7fa8'],
  brightCyan: ['cyanBright', 80, '#34e2e2'],
  brightWhite: ['whiteBright', 231, '#eeeeec'],
}

/**
 * A ccstatusline color name at the settings' color level, as the Text `color`
 * prop takes it; undefined draws the terminal's default.
 */
export function colorOf(name: string | undefined, level: number): string | undefined {
  if (!name) return undefined
  if (name.startsWith('hex:')) return `#${name.slice(4)}`
  if (name.startsWith('ansi256:')) return `ansi256(${name.slice(8)})`
  const key = name.startsWith('bg') ? name[2]!.toLowerCase() + name.slice(3) : name
  const hit = PALETTE[key]
  if (!hit) return undefined
  return level >= 3 ? hit[2] : level === 2 ? `ansi256(${hit[1]})` : hit[0]
}
