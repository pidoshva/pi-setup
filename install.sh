#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT_DIR="${2:-}"
      if [[ -z "$PROJECT_DIR" ]]; then
        echo "--project requires a repo path" >&2
        exit 2
      fi
      shift 2
      ;;
    --help|-h)
      cat <<'USAGE'
Usage: ./install.sh [--project /path/to/repo]

Installs global Pi theme/footer/spinner/runtime patches.

Options:
  --project PATH   Also install project-local Claude compatibility resources:
                   .pi/settings.json, .pi/APPEND_SYSTEM.md, workflow skills,
                   Claude/Codex skill directory wiring, Claude command prompts,
                   and copied Claude agents.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${PI_PACKAGE_DIR:-}" ]]; then
  PI_BIN="$(command -v pi || true)"
  if [[ -n "$PI_BIN" ]]; then
    PI_CLI_PATH="$(awk '{ for (i=1; i<=NF; i++) if ($i ~ /@earendil-works\/pi-coding-agent\/dist\/cli\.js$/) print $i }' "$PI_BIN" | tail -1)"
    if [[ -n "$PI_CLI_PATH" ]]; then
      PI_PACKAGE_DIR="${PI_CLI_PATH%/dist/cli.js}"
    fi
  fi
fi
PI_PACKAGE_DIR="${PI_PACKAGE_DIR:-$(npm root -g 2>/dev/null)/@earendil-works/pi-coding-agent}"

if [[ ! -d "$PI_PACKAGE_DIR" ]]; then
  echo "Could not find Pi package at: $PI_PACKAGE_DIR" >&2
  echo "Set PI_PACKAGE_DIR=/path/to/@earendil-works/pi-coding-agent and retry." >&2
  exit 1
fi

mkdir -p "$AGENT_DIR/themes" "$AGENT_DIR/extensions"
cp "$ROOT/themes/neon-friendly.json" "$AGENT_DIR/themes/neon-friendly.json"
cp "$ROOT/extensions/neon-footer.ts" "$AGENT_DIR/extensions/neon-footer.ts"
cp "$ROOT/extensions/claude-mode.ts" "$AGENT_DIR/extensions/claude-mode.ts"
cp "$ROOT/config/spinner-verbs.json" "$AGENT_DIR/spinner-verbs.json"

python3 "$ROOT/scripts/configure-keybindings.py" "$AGENT_DIR"
python3 "$ROOT/scripts/disable-legacy-plan-mode-conflicts.py" "$AGENT_DIR"
python3 "$ROOT/scripts/patch-pi.py" "$PI_PACKAGE_DIR"

if [[ -n "$PROJECT_DIR" ]]; then
  python3 "$ROOT/scripts/enable-project-compat.py" "$PROJECT_DIR"
fi

echo "Installed Pi setup. Restart Pi once to load runtime patches, then run /reload for resources."
