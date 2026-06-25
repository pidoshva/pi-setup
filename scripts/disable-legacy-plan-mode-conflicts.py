#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path


SHORTCUT_RE = re.compile(
    r'\n\s*pi\.registerShortcut\("shift\+tab",\s*\{.*?\n\s*\}\);\n',
    re.DOTALL,
)
MODE_COMMAND_RE = re.compile(
    r'\n\s*pi\.registerCommand\("mode",\s*\{.*?\n\s*\}\);\n',
    re.DOTALL,
)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: disable-legacy-plan-mode-conflicts.py /path/to/pi-agent-dir", file=sys.stderr)
        return 2

    agent_dir = Path(sys.argv[1]).expanduser().resolve()
    path = agent_dir / "extensions" / "plan-mode.ts"
    if not path.exists():
        print("No legacy plan-mode extension found")
        return 0

    text = path.read_text()
    original = text
    text = SHORTCUT_RE.sub("\n  // Shift+Tab is owned by claude-mode.ts (normal → plan → auto).\n", text)
    text = MODE_COMMAND_RE.sub("\n  // /mode is owned by claude-mode.ts (normal | plan | auto).\n", text)

    if text == original:
        print(f"No legacy plan-mode conflicts found in {path}")
        return 0

    backup = path.with_suffix(path.suffix + ".bak")
    if not backup.exists():
        backup.write_text(original)
    path.write_text(text)
    print(f"Disabled legacy plan-mode Shift+Tab and /mode conflicts in {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
