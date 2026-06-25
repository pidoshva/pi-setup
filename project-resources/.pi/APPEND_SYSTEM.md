# Claude-Code-Like Project Workflow

Optimize for Claude-Code-like architectural continuity while preserving Pi speed.

When work is non-trivial, prefer this loop:

1. **Architecture pass**: gather a compact context pack from high-signal files and existing patterns before editing.
2. **Plan**: create a short implementation sequence when the change spans multiple files, services, schemas, event topics, or frontend flows.
3. **Implement safely**: make small coherent edits, follow repo conventions, and validate with targeted commands first.
4. **Handoff**: summarize goal, decisions, files touched, validation, risks, and next steps before long pauses, compaction, or branch/session switches.

Use repo-local skills when applicable:

- `architecture-pass` for read-only discovery and architectural context packs.
- `implementation-plan` for sequencing and de-risking changes.
- `safe-implementation` for disciplined edits and validation.
- `handoff-summary` for session continuity and compaction-friendly summaries.

Compaction and summaries should preserve:

- user's goal and constraints
- affected files and why they matter
- architectural decisions and rationale
- rejected approaches
- commands run and results
- files read/modified
- unresolved risks/blockers
- exact next steps

Prefer concise, high-signal context over broad file dumps. Distinguish observed facts from assumptions.
