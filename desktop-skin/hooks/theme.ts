/**
 * The skin's data: palettes, copy and switches. The drawing code reads only
 * this, so a new colourway is a new THEME object, not new drawing code.
 *
 * `unit02` is the internal name of the colourway (red and orange, black and
 * amber accents); nothing on screen says it. On screen the skin is SCARLET LINK
 * and its mascot is BOLT, both original.
 */

export type Palette = {
  /** The page behind everything. */
  bg: string
  /** Glass panels and the bubble. */
  panel: string
  /** The main colour: frames, the mascot's shell, progress. */
  red: string
  /** The second colour: highlights, the mascot's visor glint. */
  orange: string
  /** Accent: warning stripes, readouts. */
  amber: string
  /** Accent: stripes, outlines. */
  ink: string
  text: string
  muted: string
  /** Hairlines and the hex grid. */
  line: string
}

export type Appearance = 'auto' | 'dark' | 'light'

export type Phase = {
  /** Step code in the status bar. */
  code: string
  zh: string
  en: string
  /** The status sentence under it. */
  status: string
  /** When the phase starts, in ms from the start of the ceremony. */
  at: number
}

export const THEME = {
  id: 'unit02',
  name: 'SCARLET LINK',
  nameZh: '绯红链接',
  os: 'HUD OS · 02',
  mascot: 'BOLT',
  palette: {
    dark: {
      bg: '#120607',
      panel: 'rgba(36, 12, 12, 0.72)',
      red: '#E5231B',
      orange: '#FF7A1A',
      amber: '#FFB000',
      ink: '#0B0B0C',
      text: '#FBE9E2',
      muted: '#B98D84',
      line: 'rgba(255, 122, 26, 0.32)',
    },
    light: {
      bg: '#FFF4EC',
      panel: 'rgba(255, 233, 219, 0.78)',
      red: '#D21F17',
      orange: '#F26A0F',
      amber: '#D99400',
      ink: '#1A0D0B',
      text: '#2A1210',
      muted: '#8A5A50',
      line: 'rgba(210, 31, 23, 0.22)',
    },
  } satisfies Record<'dark' | 'light', Palette>,
  /** The ceremony, in order; the last phase holds until the end. */
  phases: [
    { code: 'SL-01', zh: '驾驶舱接入', en: 'CAPSULE DOCKING', status: '舱体下降，锁定装置啮合中', at: 600 },
    { code: 'SL-02', zh: '神经连接', en: 'NEURAL LINK', status: '建立神经回路，逐层点亮', at: 2600 },
    { code: 'SL-03', zh: '同步率爬升', en: 'SYNC RATE RISING', status: '同步率爬升中，保持呼吸平稳', at: 4600 },
    { code: 'SL-04', zh: '启动完成', en: 'BOOT COMPLETE', status: '全部系统在线，欢迎回来', at: 7400 },
  ] satisfies Phase[],
  /** The whole ceremony; the band shows the HUD after it. */
  bootMs: 9400,
  /** Spinner words by what the turn is doing. */
  spinner: {
    thinking: '神经演算',
    requesting: '信号上行',
    'tool-input': '装填中',
    'tool-use': '外部作业',
    responding: '回传中',
  } as Record<string, string>,
  /** What BOLT says when it has no figure to read out. */
  quips: [
    '舱内温度正常，可以开工',
    '我只是个螺栓，但我很可靠',
    '红色是最快的颜色',
    '警示条已擦亮',
    '六边形是最稳的形状',
  ],
  decor: {
    hexGrid: true,
    warningStripes: true,
    scanLine: true,
  },
}

export function paletteOf(appearance: Appearance, fallback: 'dark' | 'light' = 'dark'): Palette {
  return THEME.palette[appearance === 'auto' ? fallback : appearance]
}
