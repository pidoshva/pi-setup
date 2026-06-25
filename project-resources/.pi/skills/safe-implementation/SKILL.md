---
name: safe-implementation
description: Implements a code change with Claude-Code-like discipline while preserving Pi speed. Use for non-trivial edits after context has been gathered or a plan exists.
---

# Safe Implementation

## Workflow

1. Confirm the goal and nearest existing pattern.
2. Make small coherent edits; avoid unrelated cleanup.
3. Prefer exact edits over rewrites.
4. Update tests/types/docs when behavior changes.
5. Run targeted validation first, then broader validation if warranted.
6. Inspect diagnostics after editing where available.
7. Summarize changed files, validation, risks, and next steps.

## Guardrails

- Do not overwrite user changes.
- Do not run destructive commands without explicit confirmation.
- Do not introduce new dependencies or architecture without a clear reason.
- Keep imports, naming, formatting, and test style consistent with nearby code.
- If validation cannot run, explain why and provide the exact command the user should run.
