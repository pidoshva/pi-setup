#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: configure-keybindings.py /path/to/pi-agent-dir", file=sys.stderr)
        return 2

    agent_dir = Path(sys.argv[1]).expanduser().resolve()
    path = agent_dir / "keybindings.json"
    if path.exists():
        try:
            config = json.loads(path.read_text())
        except json.JSONDecodeError as exc:
            print(f"Invalid JSON in {path}: {exc}", file=sys.stderr)
            return 1
        if not isinstance(config, dict):
            print(f"Expected object in {path}", file=sys.stderr)
            return 1
    else:
        config = {}

    # Free Shift+Tab for the Claude-like mode switcher extension. Keep thinking
    # cycling available on an alternate shortcut.
    existing = config.get("app.thinking.cycle")
    if existing in (None, "shift+tab") or existing == ["shift+tab"]:
        config["app.thinking.cycle"] = ["ctrl+shift+t"]

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config, indent=2) + "\n")
    print(f"Configured keybindings in {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
