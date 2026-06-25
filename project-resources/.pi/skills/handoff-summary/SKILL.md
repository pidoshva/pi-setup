---
name: handoff-summary
description: Produces a compact engineering handoff summary that preserves context across Pi compaction, session switches, or future agents. Use before ending a session, compacting, switching branches, or handing work to another agent.
---

# Handoff Summary

Produce a compact, high-signal summary.

## Format

```md
## Goal

## Current State

## Decisions Made
- decision: rationale

## Files Read
- `path`: why

## Files Modified
- `path`: what changed

## Validation
- command: result

## Risks / Blockers

## Next Steps
1.
2.
3.
```

## Rules

- Preserve exact commands and results.
- Distinguish observed facts from assumptions.
- Include rejected approaches when they matter.
- Keep it short enough to survive compaction.
