import type { On, RenderElement, RenderNode } from 'claude-code'
import { describe, expect, mock, test, tier } from 'claude-code/testing'

import SETTINGS from './settings'

tier('user')

const HINT = {
  plugin: 'usageline',
  component: 'PromptHint',
  surface: 'terminal',
  requestId: 'hint',
  viewport: { columns: 240, rows: 40, isFullscreen: false },
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

const GIT: Record<string, string> = {
  'rev-parse --git-dir': '.git',
  'symbolic-ref --short HEAD': 'main',
  'diff --shortstat': ' 2 files changed, 12 insertions(+), 3 deletions(-)',
  'diff --cached --shortstat': '',
}

/** The world under the plugin: a repo at /w/rove whose session cost the test moves. */
function world(on: On, settings: unknown = SETTINGS) {
  const cost = { usd: 0 }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.repo', () => ({ value: { root: '/w/rove', remote: null, internal: false, name: 'rove' } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { context: { window: 1_000_000, percent: 42, tokens: 180_600 }, rateLimits: [], cost: { ...cost } } }))
  on('fs.read', ($, e) => {
    if (e.path !== '/Users/me/.config/usageline/settings.json') throw new Error(`ENOENT ${e.path}`)
    return { value: JSON.stringify(settings) }
  })
  on('process.run', ($, e) => {
    const key = (e.argv as string[]).slice(2).join(' ')
    return { value: key in GIT ? { exitCode: 0, stdout: GIT[key]!, stderr: '' } : { exitCode: 1, stdout: '', stderr: '' } }
  })
  on('ui.render', () => h('Text', null, '? for shortcuts') as RenderElement)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  mock.store(on)
  mock.env(on, { HOME: '/Users/me' })
  return { cost, clock: mock.clock(on, { now: Date.UTC(2026, 8, 23, 12) }) }
}

/** The text a drawing shows, children flattened in order. */
function textOf(n: RenderNode | undefined): string {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  return ((n as { children?: RenderNode[] }).children ?? []).map(textOf).join('')
}

const turn = (write: number, read: number) => ({
  answer: 'ok',
  durationMs: 1000,
  isAborted: false,
  reason: 'answer',
  turnId: 't',
  usage: { model: 'claude-opus-5-5', input_tokens: 10, output_tokens: 500, cache_read_input_tokens: read, cache_creation_input_tokens: write },
})

describe('register', () => {
  test('the ccstatusline layout draws under the hint, with cost, cache and hit rate at the end', async ($, on) => {
    const w = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/rove' })
    await $.turn.start({ turnId: 't', prompt: 'hi' } as never)
    w.cost.usd = 0.4
    await $.turn.complete(turn(2_000, 180_000) as never)

    const ui = await $.ui.mount(HINT as never)
    const text = textOf(await ui.drawn())
    expect(text.indexOf('mod |'), 'our line sits above the hint, right under the status line').toBeLessThan(text.indexOf('? for shortcuts'))
    expect(text).toContain('mod | 𖠰 main | ⎇ main | Ctx: 180.6k | Out: — | (+12,-3) | Cost: $0.40 | Cache: 🟢 5m | Cache Hit: 98.9%')
    expect(text).not.toContain('Miss')

    await w.clock.advance(7 * 60_000)
    expect(textOf(await ui.drawn())).toContain('Cache: ❄️ COLD')

    await $.turn.start({ turnId: 't2', prompt: 'back' } as never)
    w.cost.usd = 1.4
    await $.turn.complete(turn(180_000, 0) as never)
    expect(textOf(await ui.drawn())).toContain('Cost: $1.40 | Cache: 🟢 5m | Cache Hit: 0.0% | Miss: idle 7m > 5m ttl, +180k rewritten')
  })

  test('with no settings file the default line is drawn', async ($, on) => {
    world(on, null)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/rove' })
    const ui = await $.ui.mount(HINT as never)
    expect(textOf(await ui.drawn())).toContain('opus 5.5 | Ctx: ███░░░░░ 42%')
  })

  test('/usageline prints the ledger', async ($, on) => {
    const w = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/rove' })
    w.cost.usd = 0.4
    await $.turn.complete(turn(2_000, 180_000) as never)
    const out = await $.command.run({ command: 'usageline', args: '' } as never)
    expect(JSON.stringify(out)).toContain('2026-09-23')
  })
})
