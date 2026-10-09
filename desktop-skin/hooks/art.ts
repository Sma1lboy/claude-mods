/**
 * The skin's vector drawings, each one SVG document for the desktop's `Svg`
 * element drawn with `isInteractive`, which plays CSS animation.
 *
 * Every animation moves `transform` or `opacity` only, so the compositor runs
 * it. Each element's resting style is its final state, and under
 * `prefers-reduced-motion: reduce` every animation is dropped, so a person who
 * asked for less motion sees the final frame. Colours come from CSS variables:
 * dark by default, light under `prefers-color-scheme: light` when the
 * appearance is `auto`, or fixed by the `a-dark` / `a-light` class.
 *
 * All of it is drawn here; no outside image or font is loaded.
 */

import { THEME, type Appearance, type Palette } from './theme'
import { cellsOf, placeOf, type Readings } from './telemetry'

const MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, 'PingFang SC', 'Microsoft YaHei', monospace`

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function vars(p: Palette): string {
  return Object.entries(p)
    .map(([k, v]) => `--${k}:${v};`)
    .join('')
}

/** The palette as CSS variables on the root, per appearance. */
function paletteCss(): string {
  const { dark, light } = THEME.palette
  return [
    `svg{${vars(dark)}}`,
    `@media (prefers-color-scheme: light){svg.a-auto{${vars(light)}}}`,
    `svg.a-light{${vars(light)}}`,
    `svg.a-dark{${vars(dark)}}`,
  ].join('')
}

const BASE_CSS = [
  `text{font-family:${MONO};fill:var(--text)}`,
  `.mono{letter-spacing:.18em}`,
  `.wide{letter-spacing:.42em}`,
  `.muted{fill:var(--muted)}`,
  `.amber{fill:var(--amber)}`,
  `.red{fill:var(--red)}`,
  `.orange{fill:var(--orange)}`,
  `.fb{transform-box:fill-box;transform-origin:center}`,
  `.fl{transform-box:fill-box;transform-origin:left center}`,
].join('')

const REDUCE_CSS = `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`

/** Hex grid, warning stripes and the visor gradient, shared by every drawing. */
function defs(): string {
  const hex = 'M7 0 L21 0 L28 12 L21 24 L7 24 L0 12 Z'
  return `<defs>
<pattern id="hex" width="42" height="24" patternUnits="userSpaceOnUse">
<path d="${hex}" fill="none" stroke="var(--line)" stroke-width="1"/>
<path d="${hex}" transform="translate(21 12)" fill="none" stroke="var(--line)" stroke-width="1"/>
</pattern>
<pattern id="stripes" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<rect width="16" height="16" fill="var(--amber)"/><rect width="8" height="16" fill="var(--ink)"/>
</pattern>
<linearGradient id="visor" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="var(--ink)"/><stop offset="1" stop-color="var(--red)" stop-opacity=".55"/>
</linearGradient>
<linearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="var(--orange)" stop-opacity="0"/><stop offset=".5" stop-color="var(--orange)" stop-opacity=".22"/><stop offset="1" stop-color="var(--orange)" stop-opacity="0"/>
</linearGradient>
</defs>`
}

function open(viewW: number, viewH: number, appearance: Appearance, css: string, label: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" width="${viewW}" height="${viewH}" ` +
    `class="a-${appearance}" role="img" aria-label="${esc(label)}">` +
    `<style>${paletteCss()}${BASE_CSS}${css}${REDUCE_CSS}</style>${defs()}`
  )
}

/**
 * BOLT, the skin's mascot: a small helmet robot with hex-nut ears, a visor
 * with two pill eyes and an antenna lamp, peeking up over an edge with both
 * mitts. Drawn in a 120 × 120 box whose bottom edge is the edge it holds.
 */
export function bolt(): string {
  return `<g class="bolt">
<g class="bolt-bob">
<line x1="60" y1="22" x2="60" y2="8" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
<circle class="bolt-lamp" cx="60" cy="7" r="5.5" fill="var(--amber)" stroke="var(--ink)" stroke-width="2"/>
<path d="M14 48 l5 -3 5 3 0 8 -5 3 -5 -3 Z" transform="translate(-4 0)" fill="var(--orange)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M96 48 l5 -3 5 3 0 8 -5 3 -5 -3 Z" transform="translate(4 0)" fill="var(--orange)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
<rect x="18" y="20" width="84" height="74" rx="28" fill="var(--red)" stroke="var(--ink)" stroke-width="3"/>
<rect x="40" y="26" width="40" height="7" rx="3.5" fill="url(#stripes)" stroke="var(--ink)" stroke-width="1.5"/>
<rect x="27" y="42" width="66" height="28" rx="14" fill="url(#visor)" stroke="var(--ink)" stroke-width="2.5"/>
<rect class="bolt-eye fb" x="41" y="50" width="11" height="13" rx="5.5" fill="var(--amber)"/>
<rect class="bolt-eye fb" x="68" y="50" width="11" height="13" rx="5.5" fill="var(--amber)"/>
<path d="M80 46 l6 0 -9 20 -6 0 Z" fill="var(--orange)" opacity=".55"/>
<path d="M44 80 h32" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
<path d="M48 86 h24" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" opacity=".35"/>
</g>
<rect x="20" y="98" width="26" height="16" rx="8" fill="var(--orange)" stroke="var(--ink)" stroke-width="2.5"/>
<rect x="74" y="98" width="26" height="16" rx="8" fill="var(--orange)" stroke="var(--ink)" stroke-width="2.5"/>
<path d="M27 100 v6 M33 100 v6 M39 100 v6 M81 100 v6 M87 100 v6 M93 100 v6" stroke="var(--ink)" stroke-width="1.6" opacity=".5"/>
</g>`
}

/** BOLT's motion: it peeks up after `delayMs`, then bobs, blinks and pulses its lamp. */
function boltCss(delayMs: number): string {
  return [
    `.bolt{animation:peek .9s cubic-bezier(.2,1.4,.4,1) ${delayMs}ms both}`,
    `@keyframes peek{from{transform:translateY(70px);opacity:0}to{transform:none;opacity:1}}`,
    `.bolt-bob{animation:bob 3.2s ease-in-out ${delayMs + 900}ms infinite}`,
    `@keyframes bob{0%,100%{transform:none}50%{transform:translateY(-3px)}}`,
    `.bolt-eye{animation:blink 4.6s ${delayMs + 1400}ms infinite}`,
    `@keyframes blink{0%,90%,100%{transform:none}94%{transform:scaleY(.12)}}`,
    `.bolt-lamp{animation:lamp 1.6s ease-in-out infinite}`,
    `@keyframes lamp{0%,100%{opacity:1}50%{opacity:.35}}`,
  ].join('')
}

/**
 * BOLT's speech bubble: each line shows for `stepS` seconds in turn, then the
 * bubble fades out and rests before the round starts again. Resting style (and
 * so the reduced-motion frame) is the first line, shown.
 */
function bubble(lines: string[], x: number, y: number, w: number, h: number, size: number): { svg: string; css: string } {
  const stepS = 4
  const restS = 8
  const total = lines.length * stepS + restS
  const pct = (s: number) => `${((s / total) * 100).toFixed(2)}%`
  const css = [
    `.bub{animation:bub ${total}s linear infinite}`,
    `@keyframes bub{0%{opacity:0;transform:scale(.92)}2%{opacity:1;transform:none}${pct(lines.length * stepS - 0.4)}{opacity:1;transform:none}${pct(lines.length * stepS)}{opacity:0;transform:scale(.96)}100%{opacity:0}}`,
    ...lines.map((_, i) => {
      const a = i * stepS
      const b = (i + 1) * stepS
      return (
        `.say${i}{opacity:${i === 0 ? 1 : 0};animation:say${i} ${total}s linear infinite}` +
        `@keyframes say${i}{0%{opacity:0}${pct(a)}{opacity:0}${pct(a + 0.3)}{opacity:1}${pct(b - 0.3)}{opacity:1}${pct(b)}{opacity:0}100%{opacity:0}}`
      )
    }),
  ].join('')
  const svg = `<g class="bub fb">
<path d="M${x} ${y + h * 0.62} l-14 8 l14 -2 Z" fill="var(--panel)" stroke="var(--orange)" stroke-width="1.5" stroke-linejoin="round"/>
<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(16, h / 2)}" fill="var(--panel)" stroke="var(--orange)" stroke-width="1.5"/>
<text x="${x + 16}" y="${y + 18}" font-size="10" class="mono amber">${esc(THEME.mascot)} ›</text>
${lines.map((t, i) => `<text class="say${i}" x="${x + 16}" y="${y + h - 14}" font-size="${size}">${esc(t)}</text>`).join('\n')}
</g>`
  return { svg, css }
}

/** The telemetry strip: label and figure per cell, the context cell with a bar. */
function strip(r: Readings, x: number, y: number, w: number): string {
  const cells = cellsOf(r)
  const cw = w / cells.length
  const bar = r.percent === null ? '' :
    `<rect x="${x}" y="${y + 10}" width="${cw - 16}" height="3" rx="1.5" fill="var(--line)"/>` +
    `<rect class="grow fl" x="${x}" y="${y + 10}" width="${((cw - 16) * Math.min(100, r.percent)) / 100}" height="3" rx="1.5" fill="var(--${r.percent >= 80 ? 'red' : 'amber'})"/>`
  return (
    cells
      .map(
        (c, i) =>
          `<text x="${x + i * cw}" y="${y}" font-size="10" class="mono muted">${c.label}</text>` +
          `<text x="${x + i * cw + c.label.length * 8 + 8}" y="${y}" font-size="12" class="${c.hot ? 'red' : 'amber'}">${esc(c.value)}</text>`,
      )
      .join('') + bar
  )
}

const STRIP_CSS = `.grow{animation:grow 1.2s cubic-bezier(.2,.8,.2,1) .4s both}@keyframes grow{from{transform:scaleX(0)}to{transform:none}}`

/**
 * The band above the prompt, after the ceremony: glass panel over a hex grid,
 * BOLT peeking up from the bottom edge with its bubble, the name block, and
 * the telemetry strip.
 */
export function hudSvg(r: Readings, lines: string[], appearance: Appearance): string {
  const W = 960
  const H = 132
  const b = bubble(lines, 150, 16, 420, 62, 15)
  const css = [
    boltCss(0),
    b.css,
    STRIP_CSS,
    `.scan{animation:scan 7s linear infinite}@keyframes scan{from{transform:translateX(-260px)}to{transform:translateX(${W}px)}}`,
    `.live{animation:lamp 1.6s ease-in-out infinite}`,
  ].join('')
  const where = placeOf(r)
  return (
    open(W, H, appearance, css, `${THEME.name} HUD: ${lines.join(' / ')}`) +
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" fill="var(--panel)" stroke="var(--line)" stroke-width="1.5"/>` +
    `<clipPath id="band"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16"/></clipPath>` +
    `<g clip-path="url(#band)">` +
    (THEME.decor.hexGrid ? `<rect x="560" y="0" width="${W - 560}" height="${H}" fill="url(#hex)" opacity=".7"/>` : '') +
    (THEME.decor.scanLine ? `<rect class="scan" x="0" y="0" width="260" height="${H}" fill="url(#scan)"/>` : '') +
    (THEME.decor.warningStripes ? `<rect x="0" y="${H - 6}" width="${W}" height="6" fill="url(#stripes)" opacity=".9"/>` : '') +
    `<g transform="translate(14 ${H - 120})">${bolt()}</g>` +
    `</g>` +
    b.svg +
    `<text x="600" y="38" font-size="22" font-weight="700" class="wide red">${esc(THEME.name)}</text>` +
    `<text x="600" y="58" font-size="11" class="mono muted">${esc(`${THEME.nameZh} · ${THEME.os}`)}</text>` +
    `<circle class="live" cx="${W - 34}" cy="32" r="5" fill="var(--amber)"/>` +
    `<text x="${W - 46}" y="36" font-size="10" text-anchor="end" class="mono amber">LINK</text>` +
    (where ? `<text x="600" y="76" font-size="11" class="mono">${esc(where)}</text>` : '') +
    `<g>${strip(r, 150, 104, W - 180)}</g>` +
    `</svg>`
  )
}

/** The pane's card: BOLT large on a hex field, with its bubble and the strip. */
export function cardSvg(r: Readings, lines: string[], appearance: Appearance): string {
  const W = 640
  const H = 300
  const b = bubble(lines, 230, 40, 380, 72, 16)
  const css = [boltCss(0), b.css, STRIP_CSS].join('')
  return (
    open(W, H, appearance, css, `${THEME.mascot}: ${lines.join(' / ')}`) +
    `<rect width="${W}" height="${H}" rx="18" fill="var(--bg)"/>` +
    `<rect width="${W}" height="${H}" rx="18" fill="url(#hex)" opacity=".8"/>` +
    `<rect x="0" y="0" width="${W}" height="8" fill="url(#stripes)"/>` +
    `<text x="24" y="40" font-size="12" class="wide muted">PILOT ASSIST</text>` +
    `<g transform="translate(26 ${H - 230}) scale(1.6)">${bolt()}</g>` +
    `<rect x="0" y="${H - 64}" width="${W}" height="64" fill="var(--panel)"/>` +
    b.svg +
    `<g>${strip(r, 24, H - 34, W - 48)}</g>` +
    `</svg>`
  )
}

/** One phase's opacity window within the ceremony, as a keyframes rule. */
function windowCss(name: string, fromMs: number, toMs: number, totalMs: number, holdEnd: boolean): string {
  const pct = (ms: number) => `${Math.max(0, Math.min(100, (ms / totalMs) * 100)).toFixed(2)}%`
  const out = holdEnd ? '100%{opacity:1}' : `${pct(toMs - 200)}{opacity:1}${pct(toMs)}{opacity:0}100%{opacity:0}`
  return `.${name}{animation:${name} ${totalMs}ms linear both}@keyframes ${name}{0%{opacity:0}${pct(fromMs)}{opacity:0}${pct(fromMs + 250)}{opacity:1}${out}}`
}

/** A column of digits that rolls to `to` (0-9) through every digit, `turns` times. */
function odometer(x: number, y: number, size: number, turns: number, to: number, cls: string): string {
  const digits: string[] = []
  for (let t = 0; t < turns; t++) for (let d = 0; d < 10; d++) digits.push(String(d))
  for (let d = 0; d <= to; d++) digits.push(String(d))
  const lh = size * 1.1
  return (
    `<g clip-path="url(#odo)" transform="translate(${x} ${y})"><g class="${cls}">` +
    digits.map((d, i) => `<text x="0" y="${i * lh}" font-size="${size}" font-weight="700" class="amber">${d}</text>`).join('') +
    `</g></g>`
  )
}

/**
 * The boot ceremony, one drawing that plays its phases in turn over
 * `THEME.bootMs`: capsule docking, neural link, sync rate rising, boot
 * complete. The welcome names the real project and model; nothing else in it
 * stands for a session figure.
 */
export function bootSvg(r: Pick<Readings, 'project' | 'model'>, appearance: Appearance): string {
  const W = 960
  const H = 320
  const T = THEME.bootMs
  const [p1, p2, p3, p4] = THEME.phases
  const ends = [p2!.at, p3!.at, p4!.at, T]
  const phases = THEME.phases
  const size = 64
  const lh = size * 1.1
  // The sync readout: hundreds 0→1, tens rolls once to 0, units rolls ten times.
  const sync = (cls: string, steps: number) =>
    `.${cls}{transform:translateY(${-steps * lh}px);animation:${cls} ${ends[2]! - p3!.at - 400}ms steps(${steps}, end) ${p3!.at + 200}ms both}` +
    `@keyframes ${cls}{from{transform:none}to{transform:translateY(${-steps * lh}px)}}`
  const css = [
    boltCss(p4!.at + 300),
    // Base styles are the last frame; the animations below play into it.
    `.p1,.p2,.p3{opacity:0}.p4{opacity:1}`,
    ...phases.map((p, i) => windowCss(`p${i + 1}`, p.at, ends[i]!, T, i === phases.length - 1)),
    ...phases.map((p, i) => windowCss(`s${i + 1}`, p.at, ends[i]!, T, i === phases.length - 1)),
    `.s1,.s2,.s3{opacity:0}`,
    `.brand{animation:fade 600ms ease-out both}@keyframes fade{from{opacity:0}to{opacity:1}}`,
    `.prog{animation:prog ${T}ms linear both}@keyframes prog{from{transform:scaleX(0)}to{transform:none}}`,
    `.stripes{animation:slide 1.2s linear infinite}@keyframes slide{from{transform:none}to{transform:translateX(-22.6px)}}`,
    // Phase 1: the capsule drops into its rails, then three locks light.
    `.capsule{animation:dock 1300ms cubic-bezier(.3,1.3,.5,1) ${p1!.at + 100}ms both}@keyframes dock{from{transform:translateY(-150px)}to{transform:none}}`,
    ...[0, 1, 2].map(i => `.lock${i}{animation:on 200ms ${p1!.at + 1300 + i * 180}ms both}`),
    `@keyframes on{from{opacity:.15}to{opacity:1}}`,
    // Phase 2: hexes light left to right, links grow between them.
    ...Array.from({ length: 9 }, (_, i) => `.n${i}{animation:on 220ms ${p2!.at + 200 + i * 160}ms both}`),
    ...Array.from({ length: 8 }, (_, i) => `.k${i}{animation:link 200ms ${p2!.at + 300 + i * 160}ms both}`),
    `@keyframes link{from{transform:scaleX(0)}to{transform:none}}`,
    // Phase 3: the readout rolls to 100 and the arcs turn.
    sync('d0', 1),
    sync('d1', 10),
    sync('d2', 100),
    `.arc{animation:spin 2.4s linear infinite}.arc2{animation:spin 3.6s linear infinite reverse}@keyframes spin{to{transform:rotate(360deg)}}`,
    `.fill3{animation:link ${ends[2]! - p3!.at - 400}ms ease-in ${p3!.at + 200}ms both}`,
    // Phase 4: the ring opens, dots orbit.
    `.ring{animation:ring 900ms cubic-bezier(.2,.9,.3,1.2) ${p4!.at}ms both}@keyframes ring{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}`,
    `.orbit{animation:spin 6s linear infinite}`,
    `.d0 text,.d1 text,.d2 text{font-variant-numeric:tabular-nums}`,
  ].join('')

  const where = placeOf(r)
  const cx = W / 2
  const title = (p: (typeof phases)[number], y: number) =>
    `<text x="${cx}" y="${y}" font-size="30" text-anchor="middle" class="wide" font-weight="700">${esc(p.zh)}</text>` +
    `<text x="${cx}" y="${y + 22}" font-size="10" text-anchor="middle" class="wide muted">${esc(p.en)}</text>`

  const hexAt = (x: number, y: number, r: number) =>
    `M${x - r} ${y} L${x - r / 2} ${y - r * 0.87} L${x + r / 2} ${y - r * 0.87} L${x + r} ${y} L${x + r / 2} ${y + r * 0.87} L${x - r / 2} ${y + r * 0.87} Z`

  return (
    open(W, H, appearance, css, `${THEME.name} boot: ${phases.map(p => p.zh).join(' → ')}`) +
    `<clipPath id="odo"><rect x="0" y="${-size}" width="${size * 2}" height="${lh}"/></clipPath>` +
    `<clipPath id="stage"><rect x="0" y="0" width="${W}" height="${H}" rx="18"/></clipPath>` +
    `<g clip-path="url(#stage)">` +
    `<rect width="${W}" height="${H}" fill="var(--bg)"/>` +
    `<rect width="${W}" height="${H}" fill="url(#hex)" opacity=".55"/>` +
    `<g class="stripes"><rect x="0" y="0" width="${W + 40}" height="6" fill="url(#stripes)"/></g>` +
    // Brand block, top left; the clock-free status, top right.
    `<g class="brand">` +
    `<text x="28" y="40" font-size="20" font-weight="700" class="wide red">${esc(THEME.name)}</text>` +
    `<text x="28" y="58" font-size="10" class="mono muted">${esc(THEME.nameZh)} · ${esc(THEME.os)}</text>` +
    `<text x="28" y="74" font-size="9" class="mono orange">PILOT PROFILE · ${esc(where || 'STANDBY')}</text>` +
    `<text x="${W - 28}" y="40" font-size="10" text-anchor="end" class="mono amber">BOOT SEQUENCE</text>` +
    `</g>` +
    // Phase 1: capsule docking.
    `<g class="p1">${title(p1!, 112)}` +
    `<rect x="${cx - 70}" y="150" width="6" height="110" fill="var(--line)"/><rect x="${cx + 64}" y="150" width="6" height="110" fill="var(--line)"/>` +
    `<g class="capsule"><rect x="${cx - 52}" y="160" width="104" height="92" rx="26" fill="var(--red)" stroke="var(--ink)" stroke-width="3"/>` +
    `<rect x="${cx - 34}" y="176" width="68" height="12" rx="6" fill="url(#stripes)"/>` +
    `<rect x="${cx - 30}" y="200" width="60" height="30" rx="15" fill="url(#visor)"/></g>` +
    [0, 1, 2]
      .map(i => `<g class="lock${i}"><circle cx="${cx + 110 + i * 34}" cy="206" r="7" fill="var(--amber)"/><text x="${cx + 110 + i * 34}" y="232" font-size="9" text-anchor="middle" class="mono muted">L${i + 1}</text></g>`)
      .join('') +
    `</g>` +
    // Phase 2: neural link.
    `<g class="p2">${title(p2!, 112)}` +
    Array.from({ length: 8 }, (_, i) => `<rect class="k${i} fl" x="${cx - 256 + i * 64 + 18}" y="203" width="28" height="3" fill="var(--orange)"/>`).join('') +
    Array.from({ length: 9 }, (_, i) => `<path class="n${i}" d="${hexAt(cx - 256 + i * 64, 204, 16)}" fill="${i % 2 ? 'var(--orange)' : 'var(--red)'}" stroke="var(--ink)" stroke-width="2"/>`).join('') +
    `</g>` +
    // Phase 3: sync rate rising.
    `<g class="p3">${title(p3!, 112)}` +
    `<g transform="translate(${cx - 200} 214)"><circle r="44" fill="none" stroke="var(--line)" stroke-width="6"/>` +
    `<path class="arc fb" d="M0 -44 A44 44 0 0 1 44 0" fill="none" stroke="var(--red)" stroke-width="6" stroke-linecap="round"/>` +
    `<path class="arc2 fb" d="M0 32 A32 32 0 0 1 -32 0" fill="none" stroke="var(--amber)" stroke-width="4" stroke-linecap="round"/></g>` +
    `<text x="${cx - 110}" y="186" font-size="10" class="wide muted">SYNC</text>` +
    odometer(cx - 110, 250, size, 0, 1, 'd0') +
    odometer(cx - 110 + size * 0.62, 250, size, 1, 0, 'd1') +
    odometer(cx - 110 + size * 1.24, 250, size, 10, 0, 'd2') +
    `<text x="${cx - 110 + size * 1.9}" y="250" font-size="30" class="amber">%</text>` +
    `<rect x="${cx + 120}" y="208" width="200" height="8" rx="4" fill="var(--line)"/>` +
    `<rect class="fill3 fl" x="${cx + 120}" y="208" width="200" height="8" rx="4" fill="var(--amber)"/>` +
    `</g>` +
    // Phase 4: boot complete.
    `<g class="p4">` +
    `<g class="ring fb"><circle cx="${cx}" cy="168" r="100" fill="none" stroke="var(--red)" stroke-width="5"/>` +
    `<circle cx="${cx}" cy="168" r="76" fill="none" stroke="var(--line)" stroke-width="2"/></g>` +
    `<g class="orbit" style="transform-origin:${cx}px 168px"><circle cx="${cx + 100}" cy="168" r="6" fill="var(--amber)"/><circle cx="${cx - 87}" cy="119" r="4" fill="var(--orange)"/><circle cx="${cx - 36}" cy="261" r="4" fill="var(--orange)"/></g>` +
    `<rect x="${cx - 250}" y="138" width="500" height="88" rx="10" fill="var(--bg)" opacity=".86"/>` +
    `<text x="${cx}" y="172" font-size="28" text-anchor="middle" class="wide" font-weight="700">${esc(p4!.zh)} · 欢迎回来</text>` +
    `<text x="${cx}" y="194" font-size="10" text-anchor="middle" class="wide muted">${esc(p4!.en)} · WELCOME BACK, PILOT</text>` +
    (where ? `<text x="${cx}" y="216" font-size="11" text-anchor="middle" class="mono amber">${esc(where)}</text>` : '') +
    `<g transform="translate(${W - 150} ${H - 160}) scale(.9)">${bolt()}</g>` +
    `</g>` +
    // Status bar: step code, status sentence, progress, credit.
    `<rect x="0" y="${H - 40}" width="${W}" height="40" fill="var(--panel)"/>` +
    phases
      .map(
        (p, i) =>
          `<g class="s${i + 1}"><text x="28" y="${H - 16}" font-size="10" class="mono amber">${esc(p.code)} / 0${phases.length}</text>` +
          `<text x="${cx}" y="${H - 16}" font-size="11" text-anchor="middle">${esc(p.status)}</text></g>`,
      )
      .join('') +
    `<text x="${W - 28}" y="${H - 16}" font-size="9" text-anchor="end" class="mono muted">RUNS ON CLAUDE CODE</text>` +
    `<rect x="0" y="${H - 42}" width="${W}" height="2" fill="var(--line)"/>` +
    `<rect class="prog fl" x="0" y="${H - 42}" width="${W}" height="2" fill="var(--red)"/>` +
    `</g></svg>`
  )
}
