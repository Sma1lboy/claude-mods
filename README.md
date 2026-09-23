# claude-mods

Mods for Claude Code: plugins built on function hooks, TypeScript running inside Claude Code.

## usageline

A line under the prompt, in the spirit of [ccstatusline](https://github.com/sirmalloc/ccstatusline), that also explains the cache:

```
haiku 4.5 │ ctx ███████░ 90% │ cache 12% │ ● hot 4:53 │ today $1.42 · rove │ ⚠ miss: idle 7m > 5m ttl, +181k rewritten
```

| Segment | What it shows |
| --- | --- |
| model | the model that answered the last turn |
| `ctx` | how full the context window is; green under 60%, yellow under 85%, red above |
| `cache` | share of the last turn's prompt read from the prompt cache |
| `● hot 4:53` | time left before the prompt cache expires; `○ cold` once it has |
| `today` | what this project (its git root) has cost today, across every session |
| `⚠ miss` | shown when the last turn rewrote the cache, with the likely reason: `first turn`, `idle Nm > 5m ttl`, `model a→b`, `after compact`, or `prefix changed` |

`/usageline` prints the ledger: this project's last seven days, then every project today.

Per-turn cost is the change in the session's own `/cost` total, so no price table is kept. The ledger is stored per day, project and model in the plugin's store and keeps 90 days.

### Install

Mods are early access and only load with function hooks switched on. Add this to `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Then:

```
claude plugin marketplace add sma1lboy/claude-mods
claude plugin install usageline@claude-mods
```

To run it from a checkout: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir usageline`.

### Limits

- The countdown assumes the 5-minute cache TTL; a 1-hour TTL is not read yet.
- A turn's usage is summed over its responses, so a miss is judged from the turn total.
- It records turns from when it is installed; older history is not imported.

## Development

```
npm install
npm run typecheck   # tsc over every mod
npm test            # claude plugin test usageline
```

`types/claude-code.d.ts` comes from `/plugin-types` in Claude Code and is not committed; regenerate it after an update.
