import { describe, expect, test, tier } from 'claude-code/testing'

tier('user')

const TOOL = 'mcp__goal__goal'
const done = (reason = 'answer') => ({ answer: 'ok', durationMs: 1000, isAborted: false, reason, turnId: 't' }) as never

describe('register', () => {
  test('a goal call runs /goal with its args once the turn ends', async ($, on) => {
    const runs: unknown[] = []
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('tool.register', ($, e) => ({ value: { tool: `mcp__goal__${e.name}` } }))
    on('turn.complete', ($, e) => ({ text: e.answer }))
    on('command.run', ($, e) => {
      runs.push([e.command, e.args])
      return { text: 'Goal set' }
    })
    await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/w' })

    const out = await $.tool.call({ tool: TOOL, args: 'tests pass' } as never)
    expect(JSON.stringify(out)).toContain('Queued /goal tests pass')
    expect(runs).toEqual([])

    await $.turn.complete(done())
    expect(runs).toEqual([['goal', 'tests pass']])

    await $.tool.call({ tool: TOOL, args: 'clear' } as never)
    await $.turn.complete(done('aborted'))
    expect(runs).toEqual([['goal', 'tests pass']])
  })
})
