# Moneta starter kit

Drop the contents of this folder into a fresh repo root:

```
CLAUDE.md                  # conventions contract (Claude Code reads this automatically)
moneta-prd.md              # product requirements
moneta-master-prompt.md    # paste this as the kickoff message
.claude/agents/            # five project subagents (auto-loaded by Claude Code)
```

Then:

1. `git init && git add -A && git commit -m "chore: moneta starter kit"`
2. Start the lead session on Opus: `claude --model claude-opus-4-8`
3. Paste the contents of `moneta-master-prompt.md`.

The lead (Opus) plans, integrates, and reviews; implementation is delegated to the
Sonnet agents (design-engineer, backend-engineer, parser-engineer, feature-engineer),
and qa-reviewer (Opus, read-only) gates every phase exit.
