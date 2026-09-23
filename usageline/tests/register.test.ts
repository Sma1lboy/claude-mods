import type { On, RenderElement, RenderNode } from 'claude-code'
import { describe, expect, mock, test, tier } from 'claude-code/testing'

tier('user')

const HINT = {
  plugin: 'usageline',
  component: 'PromptHint',
  surface: 'terminal',
  requestId: 'hint',
  viewport: { columns: 200, rows: 40, isFullscreen: false },
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
} as const

/** The world under the plugin: a repo at /w/rove, a session whose cost the test moves. */
function world(on: On) {
  const cost = { usd: 0 }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.repo', () => ({ value: { root: '/w/rove', remote: null, internal: false, name: 'rove' } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', () => ({ value: { context: { window: 1_000_000, percent: 42, tokens: 420_000 }, rateLimits: [], cost: { ...cost } } }))
  on('ui.render', () => h('Text', null, '? for shortcuts') as RenderElement)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  mock.store(on)
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
  usage: {
    model: 'claude-opus-5-5',
    input_tokens: 10,
    output_tokens: 500,
    cache_read_input_tokens: read,
    cache_creation_input_tokens: write,
  },
})

describe('register', () => {
  test('the line under the hint shows context, cache, TTL and today, then names an idle miss', async ($, on) => {
    const w = world(on)
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w/rove' })

    await $.turn.start({ turnId: 't', prompt: 'hi' } as never)
    w.cost.usd = 0.4
    await $.turn.complete(turn(2_000, 180_000) as never)

    const ui = await $.ui.mount(HINT as never)
    const first = textOf(await ui.drawn())
    expect(first).toContain('? for shortcuts')
    expect(first).toContain('ctx')
    expect(first).toContain('42%')
    expect(first).toContain('cache 99%')
    expect(first).toContain('hot 5:00')
    expect(first).toContain('today $0.40 · rove')

    await w.clock.advance(7 * 60_000)
    expect(textOf(await ui.drawn())).toContain('cold')

    await $.turn.start({ turnId: 't2', prompt: 'back' } as never)
    w.cost.usd = 1.4
    await $.turn.complete(turn(180_000, 0) as never)
    const after = textOf(await ui.drawn())
    expect(after).toContain('miss: idle 7m > 5m ttl, +180k rewritten')
    expect(after).toContain('today $1.40')

    const out = await $.command.run({ command: 'usageline', args: '' } as never)
    expect(JSON.stringify(out)).toContain('2026-09-23')
  })
})
