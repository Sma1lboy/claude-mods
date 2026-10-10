#!/bin/sh
# A fresh worktree has no node_modules and no types/ (both gitignored):
# install, then write the mod API declarations the typecheck reads.
set -e
npm ci
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude -p /plugin-types >/dev/null
mkdir -p types
cp .claude/types/claude-code.d.ts types/
rm -rf .claude
