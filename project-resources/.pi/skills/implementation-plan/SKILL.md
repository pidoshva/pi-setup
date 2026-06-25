---
name: implementation-plan
description: Creates a concise implementation plan after an architecture pass. Use when the user asks to plan, design, sequence, or de-risk a feature/refactor before editing code.
---

# Implementation Plan

Use this after an architecture pass for changes spanning multiple files, services, schemas, event topics, or frontend flows.

## Output Format

```md
## Goal

## Scope
- In:
- Out:

## Plan
1.
2.
3.

## Files Expected To Change
- `path`: why

## Validation
- targeted commands first
- broader commands if needed

## Risks / Rollback
- risk:
- rollback:
```

## Rules

- Keep plans short and executable.
- Prefer existing repo patterns over new abstractions.
- Identify validation commands before implementation.
- Ask for approval before creating a locked plan artifact or making risky/destructive changes.
