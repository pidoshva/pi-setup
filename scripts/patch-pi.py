#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


def patch(path: Path, replacements: list[tuple[str, str]]) -> None:
    text = path.read_text()
    original = text
    for old, new in replacements:
        if new in text:
            continue
        if old not in text:
            print(f"[warn] pattern not found in {path}: {old[:80]!r}")
            continue
        text = text.replace(old, new, 1)
    if text != original:
        path.write_text(text)
        print(f"patched {path}")
    else:
        print(f"ok {path}")


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: patch-pi.py /path/to/@earendil-works/pi-coding-agent", file=sys.stderr)
        return 2

    root = Path(sys.argv[1])
    interactive = root / "dist/modes/interactive/interactive-mode.js"
    footer_data = root / "dist/core/footer-data-provider.js"
    tui = root / "node_modules/@earendil-works/pi-tui/dist/tui.js"

    if not interactive.exists() or not footer_data.exists() or not tui.exists():
        print(f"Pi package layout not recognized under {root}", file=sys.stderr)
        return 1

    patch(footer_data, [
        ('import { dirname, join, resolve } from "path";', 'import { basename, dirname, join, resolve } from "path";'),
        ('''    /** Extension status texts set via ctx.ui.setStatus() */\n    getExtensionStatuses() {''', '''    /** Current footer cwd. */\n    getCwd() {\n        return this.cwd;\n    }\n    /** Whether the current cwd itself is a git repository root. */\n    isCwdGitRepository() {\n        return !!this.gitPaths && resolve(this.cwd) === resolve(this.gitPaths.repoDir);\n    }\n    /** Current git repository root name, null when cwd is not a repo root. */\n    getGitRepoName() {\n        return this.isCwdGitRepository() ? basename(this.gitPaths.repoDir) : null;\n    }\n    /** Extension status texts set via ctx.ui.setStatus() */\n    getExtensionStatuses() {'''),
    ])

    patch(tui, [
        ('''                    if (this.overlayStack.length === 0)\n                        this.terminal.hideCursor();\n                    this.requestRender();''', '''                    if (this.overlayStack.length === 0)\n                        this.terminal.hideCursor();\n                    this.requestRender(true);'''),
        ('''        if (this.overlayStack.length === 0)\n            this.terminal.hideCursor();\n        this.requestRender();''', '''        if (this.overlayStack.length === 0)\n            this.terminal.hideCursor();\n        this.requestRender(true);'''),
    ])

    patch(interactive, [
        ('''    defaultWorkingMessage = "Working...";\n    defaultHiddenThinkingLabel = "Thinking...";''', '''    defaultWorkingMessage = "Working...";\n    spinnerVerbs = undefined;\n    currentSpinnerVerb = undefined;\n    defaultHiddenThinkingLabel = "Thinking...";'''),
        ('''    getWorkingLoaderMessage() {\n        return this.workingMessage ?? this.defaultWorkingMessage;\n    }\n    createWorkingLoader() {''', '''    loadSpinnerVerbs() {\n        if (this.spinnerVerbs !== undefined) {\n            return this.spinnerVerbs;\n        }\n        try {\n            const configPath = path.join(getAgentDir(), "spinner-verbs.json");\n            const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));\n            const verbs = parsed?.spinnerVerbs?.verbs;\n            this.spinnerVerbs = Array.isArray(verbs) ? verbs.filter((verb) => typeof verb === "string" && verb.trim()) : [];\n        }\n        catch {\n            this.spinnerVerbs = [];\n        }\n        return this.spinnerVerbs;\n    }\n    pickSpinnerVerb() {\n        const verbs = this.loadSpinnerVerbs();\n        if (verbs.length === 0) {\n            this.currentSpinnerVerb = undefined;\n            return;\n        }\n        const next = verbs[Math.floor(Math.random() * verbs.length)];\n        this.currentSpinnerVerb = `${next}...`;\n    }\n    getWorkingLoaderMessage() {\n        return this.workingMessage ?? this.currentSpinnerVerb ?? this.defaultWorkingMessage;\n    }\n    createWorkingLoader() {'''),
        ('''                this.stopWorkingLoader();\n                if (this.workingVisible) {\n                    this.loadingAnimation = this.createWorkingLoader();''', '''                this.stopWorkingLoader();\n                this.pickSpinnerVerb();\n                if (this.workingVisible) {\n                    this.loadingAnimation = this.createWorkingLoader();'''),
        ('''        this.workingMessage = undefined;\n        this.workingVisible = true;\n        this.setWorkingIndicator();''', '''        this.workingMessage = undefined;\n        this.currentSpinnerVerb = undefined;\n        this.spinnerVerbs = undefined;\n        this.workingVisible = true;\n        this.setWorkingIndicator();'''),
        ('''            if (text === "/quit") {\n                this.editor.setText("");\n                await this.shutdown();\n                return;\n            }\n            // Handle bash command (! for normal, !! for excluded from context)''', '''            if (text === "/quit") {\n                this.editor.setText("");\n                await this.shutdown();\n                return;\n            }\n            if (text === "/cd" || text.startsWith("/cd ") || text === "cd" || text.startsWith("cd ")) {\n                this.editor.setText("");\n                this.handleChangeDirectoryCommand(text);\n                return;\n            }\n            // Handle bash command (! for normal, !! for excluded from context)'''),
        ('''    openExternalEditor() {\n        // Determine editor (respect $VISUAL, then $EDITOR)''', '''    handleChangeDirectoryCommand(text) {\n        const rawTarget = text.replace(/^\\/?cd(?:\\s+|$)/, "").trim();\n        const target = rawTarget || os.homedir();\n        const currentCwd = this.sessionManager.getCwd();\n        const expandedTarget = target === "~" ? os.homedir() : target.startsWith("~/") ? path.join(os.homedir(), target.slice(2)) : target;\n        const nextCwd = path.resolve(currentCwd, expandedTarget);\n        try {\n            if (!fs.existsSync(nextCwd) || !fs.statSync(nextCwd).isDirectory()) {\n                this.showError(`Directory not found: ${target}`);\n                return;\n            }\n            this.sessionManager.cwd = nextCwd;\n            process.chdir(nextCwd);\n            this.footerDataProvider.setCwd(nextCwd);\n            this.updateTerminalTitle();\n            this.footer.invalidate();\n            this.showStatus(`Directory: ${nextCwd}`);\n            this.ui.requestRender(true);\n        }\n        catch (error) {\n            this.showError(error instanceof Error ? error.message : String(error));\n        }\n    }\n    openExternalEditor() {\n        // Determine editor (respect $VISUAL, then $EDITOR)'''),
    ])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
