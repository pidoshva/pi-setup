# Pi Setup

Personal Pi setup bundle for a Claude-Code-like OrderProtection workflow.

Installs global Pi resources:

- `neon-friendly` theme
- `neon-footer` extension
- custom spinner verbs
- runtime patches for the installed Pi package:
  - recover interactive UI after errors instead of exiting
  - force full redraw after extension overlays close
  - dynamic `/cd` / `cd` command support
  - footer repo/directory detection improvements
  - random spinner verbs from `~/.pi/agent/spinner-verbs.json`

Can also install project-local Claude compatibility resources:

- `.pi/settings.json` with:
  - Claude skills loaded from `../.claude/skills`
  - Codex skills loaded from `../.codex/skills`
  - Claude commands loaded as Pi prompt templates from `../.claude/commands`
  - skill commands enabled
  - compaction and branch summaries enabled
- `.pi/APPEND_SYSTEM.md` with a Claude-Code-like work loop
- native Pi workflow skills:
  - `architecture-pass`
  - `implementation-plan`
  - `safe-implementation`
  - `handoff-summary`
- copied Claude agents from `.claude/agents/*.md` into `.pi/agents/`
- canonical `SKILL.md` copies for Claude skills that only have lowercase `skill.md`

## Install global Pi setup

```bash
git clone https://github.com/pidoshva/pi-setup pi-setup
cd pi-setup
./install.sh
```

Then restart Pi once.

## Install global setup plus project compatibility

From this repo:

```bash
./install.sh --project /path/to/repo
```

Example:

```bash
./install.sh --project ~/Documents/OrderProtection/monolog
```

Or run only the project compatibility step:

```bash
python3 scripts/enable-project-compat.py /path/to/repo
```

Restart Pi inside the target repo after changing project resources.

## Reload-only changes

Theme, footer extension, and spinner verb config can be adjusted and reloaded with:

```text
/reload
```

Runtime patches and project skill/settings discovery require restarting Pi because Node and Pi session startup cache loaded resources.

## Notes / limitations

Pi does not natively load Claude Code MCP servers from `.mcp.json`. For MCP parity, expose the needed MCP capability as a Pi extension/tool or a CLI-backed skill. This setup wires skills, prompt templates, agents, workflow prompt context, compaction behavior, footer UX, and runtime patches; MCP servers remain the main remaining compatibility gap.
