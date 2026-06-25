#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


DEFAULT_SETTINGS = {
    "enableSkillCommands": True,
    "skills": ["../.claude/skills", "../.codex/skills/code-improver"],
    "prompts": ["../.claude/commands"],
    "compaction": {"enabled": True, "reserveTokens": 16384, "keepRecentTokens": 24000},
    "branchSummary": {"enabled": True, "reserveTokens": 16384},
}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path}: {exc}")


def merge_unique(existing, values):
    result = list(existing) if isinstance(existing, list) else []
    # The full Codex skill directory duplicates many Claude skill names. Keep only
    # unique Codex skills that are not already represented in .claude/skills.
    result = [value for value in result if value != "../.codex/skills"]
    for value in values:
        if value not in result:
            result.append(value)
    return result


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def clean_global_project_skill_entries(repo: Path) -> int:
    """Remove project-specific skill dirs from global settings.

    Loading the same project skills globally and project-locally causes Pi skill
    collision warnings. Project-specific skills should live in the project .pi
    settings so they only apply when that repo is active.
    """
    settings_path = Path.home() / ".pi" / "agent" / "settings.json"
    if not settings_path.exists():
        return 0

    settings = load_json(settings_path)
    skills = settings.get("skills")
    if not isinstance(skills, list):
        return 0

    repo_resolved = repo.resolve()
    removed = 0
    next_skills = []
    for value in skills:
        if not isinstance(value, str):
            next_skills.append(value)
            continue

        path = Path(value).expanduser()
        if not path.is_absolute():
            next_skills.append(value)
            continue

        try:
            resolved = path.resolve()
            is_project_skill = resolved == repo_resolved / ".claude" / "skills" or resolved == repo_resolved / ".codex" / "skills" or resolved.is_relative_to(repo_resolved / ".claude" / "skills") or resolved.is_relative_to(repo_resolved / ".codex" / "skills")
        except OSError:
            is_project_skill = False

        if is_project_skill:
            removed += 1
            continue
        next_skills.append(value)

    if removed:
        settings["skills"] = next_skills
        write_json(settings_path, settings)
    return removed


def copy_tree_contents(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    for item in src.iterdir():
        target = dst / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)


def normalize_claude_skills(repo: Path) -> int:
    count = 0
    skills_dir = repo / ".claude" / "skills"
    if not skills_dir.exists():
        return count
    for lowercase in skills_dir.glob("*/skill.md"):
        canonical = lowercase.with_name("SKILL.md")
        if canonical.exists():
            continue
        shutil.copy2(lowercase, canonical)
        count += 1
    return count


def copy_claude_agents(repo: Path) -> int:
    agents_dir = repo / ".claude" / "agents"
    if not agents_dir.exists():
        return 0
    target_dir = repo / ".pi" / "agents"
    target_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for agent in agents_dir.glob("*.md"):
        shutil.copy2(agent, target_dir / agent.name)
        count += 1
    return count


def main() -> int:
    if len(sys.argv) > 2:
        print("usage: enable-project-compat.py [repo-root]", file=sys.stderr)
        return 2

    setup_root = Path(__file__).resolve().parents[1]
    repo = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) == 2 else Path.cwd().resolve()
    if not repo.exists() or not repo.is_dir():
        print(f"Repo directory not found: {repo}", file=sys.stderr)
        return 1

    pi_dir = repo / ".pi"
    resource_pi = setup_root / "project-resources" / ".pi"
    copy_tree_contents(resource_pi, pi_dir)

    settings_path = pi_dir / "settings.json"
    settings = load_json(settings_path)
    settings["enableSkillCommands"] = True
    settings["skills"] = merge_unique(settings.get("skills", []), DEFAULT_SETTINGS["skills"])
    settings["prompts"] = merge_unique(settings.get("prompts", []), DEFAULT_SETTINGS["prompts"])
    settings.setdefault("compaction", DEFAULT_SETTINGS["compaction"])
    settings.setdefault("branchSummary", DEFAULT_SETTINGS["branchSummary"])
    write_json(settings_path, settings)

    normalized = normalize_claude_skills(repo)
    agents = copy_claude_agents(repo)
    global_removed = clean_global_project_skill_entries(repo)

    print(f"Enabled Pi Claude compatibility in {repo}")
    print(f"- wrote/merged {settings_path.relative_to(repo)}")
    print("- installed Claude-like workflow skills and APPEND_SYSTEM.md")
    print(f"- normalized {normalized} lowercase Claude skill files")
    print(f"- copied {agents} Claude agents into .pi/agents")
    print(f"- removed {global_removed} duplicate project skill entries from global Pi settings")
    print("Restart Pi in this repo to load the updated project resources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
