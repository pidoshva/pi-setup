---
name: architecture-pass
description: Performs a fast read-only architecture and context discovery pass before non-trivial implementation. Use when planning changes, refactors, migrations, new endpoints, frontend flows, or when the user asks for Claude-Code-like context management.
---

# Architecture Pass

Run this before non-trivial code changes. Stay read-only unless the user explicitly asks to implement.

## Goals

Produce a compact, accurate context pack that lets implementation stay fast while preserving architectural judgment.

## Workflow

1. Restate the user's goal in one sentence.
2. Identify likely affected apps/libs/packages from paths, service names, imports, and project config.
3. Read only high-signal files first:
   - `AGENTS.md`, `CLAUDE.md`, `README.md`, or equivalent repo guidance
   - relevant project/package config
   - module/entrypoint files
   - public interfaces/controllers/routes/components
   - directly related services/composables/helpers
   - existing nearby tests
4. Search for existing patterns before proposing new ones.
5. Prefer LSP/navigation tools when they can answer faster than broad text search.
6. Stop when enough context exists to make a safe architectural recommendation.

## Output Format

```md
## Goal

## Affected Areas
- `path`: why it matters

## Existing Patterns Found
- Pattern:
- Example files:

## Architecture Notes
- boundaries/data flow/auth/API/event/database implications as relevant

## Risks / Unknowns

## Recommended Implementation Path
1.
2.
3.

## Validation Plan
- lint/test/build commands to run
```

## Rules

- Keep the context pack concise.
- Distinguish observed facts from assumptions.
- If another repo-local skill applies, load it after this pass and mention why.
- Do not implement during this skill unless the user explicitly requested implementation too.
