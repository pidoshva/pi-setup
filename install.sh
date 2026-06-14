#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="${PI_AGENT_DIR:-$HOME/.pi/agent}"
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
cp "$ROOT/config/spinner-verbs.json" "$AGENT_DIR/spinner-verbs.json"

python3 "$ROOT/scripts/patch-pi.py" "$PI_PACKAGE_DIR"

echo "Installed Pi setup. Restart Pi once to load runtime patches, then run /reload for resources."
