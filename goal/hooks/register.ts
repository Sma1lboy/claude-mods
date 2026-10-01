import type { Register } from 'claude-code'

const NAME = 'goal'
const TOOL = `mcp__${NAME}__${NAME}`

const DESCRIPTION = `Runs the built-in /goal command for this session.
- args "<condition>": sets the session goal. After each turn a separate check decides whether the condition is met, and Claude keeps working until it is. Write a condition that can be checked from the transcript, e.g. "all tests in npm test pass".
- args "clear": clears the active goal.
- args omitted: shows the active goal.
The command runs once the current turn ends, not during this call.`

/** The /goal args the model asked for this turn; run once the turn ends. */
let pending: string | null = null

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    try {
      await $.tool.register({
        name: NAME,
        description: DESCRIPTION,
        inputSchema: {
          type: 'object',
          properties: { args: { type: 'string', description: 'A condition, "clear", or omitted for the status' } },
        },
      })
    } catch (error) {
      $.ui.log(`goal: tool not registered: ${error}`)
    }
    return result
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId) return { deny: 'goal can only be set from the main conversation, not a subagent.' }
    const args = typeof e.args === 'string' ? e.args.trim() : ''
    // command.run is refused inside a tool.call (it would wait on this turn); turn.complete runs it.
    pending = args
    return { result: `Queued /goal${args ? ` ${args}` : ''}; it runs when this turn ends and replaces any /goal queued earlier this turn.` }
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || pending === null) return result
    const args = pending
    pending = null
    if (e.reason !== 'answer') {
      $.ui.log(`goal: /goal ${args} dropped, the turn ended with ${e.reason}`)
      return result
    }
    $.command.run({ command: 'goal', ...(args && { args }) }).catch(error => $.ui.log(`goal: /goal ${args} failed: ${error}`))
    return result
  })
}
