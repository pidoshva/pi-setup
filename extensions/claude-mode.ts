import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type ClaudeMode = "normal" | "plan" | "auto";

const MODE_ORDER: ClaudeMode[] = ["normal", "plan", "auto"];
const READ_ONLY_TOOL_ALLOWLIST = new Set([
  "read",
  "grep",
  "find",
  "ls",
  "search",
  "scrape",
  "web_search",
  "code_search",
  "fetch_content",
  "get_search_content",
  "lsp_diagnostics",
  "lsp_hover",
  "lsp_definition",
  "lsp_references",
  "lsp_symbols",
  "recall",
]);

const DESTRUCTIVE_BASH_PATTERNS = [
  /(^|\s)(rm|rmdir|mv|cp|mkdir|touch|chmod|chown|chgrp|ln|tee|truncate|dd|shred)\b/i,
  /(^|[^<])>(?!>)/,
  />>/,
  /\b(npm|yarn|pnpm)\s+(install|uninstall|update|ci|link|publish|add|remove)\b/i,
  /\bpip\s+(install|uninstall)\b/i,
  /\bbrew\s+(install|uninstall|upgrade)\b/i,
  /\bgit\s+(add|commit|push|pull|merge|rebase|reset|checkout|stash|cherry-pick|revert|tag|init|clone)\b/i,
  /\b(sudo|su|kill|pkill|killall|reboot|shutdown)\b/i,
];

function isReadOnlyBash(command: string): boolean {
  return !DESTRUCTIVE_BASH_PATTERNS.some(pattern => pattern.test(command));
}

function label(mode: ClaudeMode): string {
  if (mode === "normal") return "● normal";
  if (mode === "plan") return "⏸ plan";
  return "⚡ auto";
}

function instructions(mode: ClaudeMode): string {
  if (mode === "plan") {
    return `\n\n[PI MODE: PLAN]\nYou are in plan mode. Do not modify files, run destructive commands, create commits, push branches, or perform irreversible actions. Gather context, reason about the change, and present a concise implementation plan. Ask for approval before implementation.`;
  }

  if (mode === "auto") {
    return `\n\n[PI MODE: AUTO]\nYou are in auto mode. Work autonomously toward the user's goal: gather necessary context, make safe edits, validate with targeted commands, and summarize results. Still ask before destructive, credential-bearing, production, or high-risk operations.`;
  }

  return `\n\n[PI MODE: NORMAL]\nYou are in normal mode. Help with the user's request using the usual repo and tool guidelines. Make changes when requested, but avoid unnecessary autonomy and ask before ambiguous or risky actions.`;
}

export default function claudeMode(pi: ExtensionAPI): void {
  let mode: ClaudeMode = "auto";
  let defaultTools: string[] | undefined;

  function rememberDefaultTools(): void {
    const active = pi.getActiveTools?.();
    if (!defaultTools && Array.isArray(active) && active.length > 0) {
      defaultTools = [...active];
    }
  }

  function toolsForPlanMode(): string[] {
    rememberDefaultTools();
    const active = defaultTools ?? pi.getActiveTools?.() ?? [];
    const readOnly = active.filter(tool => READ_ONLY_TOOL_ALLOWLIST.has(tool));
    if (active.includes("bash") && !readOnly.includes("bash")) readOnly.push("bash");
    return readOnly.length > 0 ? readOnly : ["read", "bash"];
  }

  function applyMode(ctx?: ExtensionContext): void {
    rememberDefaultTools();

    if (mode === "plan") {
      pi.setActiveTools?.(toolsForPlanMode());
    } else if (defaultTools && defaultTools.length > 0) {
      pi.setActiveTools?.(defaultTools);
    }

    const text = label(mode);
    ctx?.ui.setStatus("claude-mode", text);
  }

  function setMode(next: ClaudeMode, ctx?: ExtensionContext): void {
    mode = next;
    applyMode(ctx);
    ctx?.ui.notify(`Mode: ${mode}`, "info");
    pi.appendEntry("claude-mode", { mode });
  }

  function cycleMode(ctx?: ExtensionContext): void {
    const index = MODE_ORDER.indexOf(mode);
    setMode(MODE_ORDER[(index + 1) % MODE_ORDER.length], ctx);
  }

  pi.registerCommand("mode", {
    description: "Show or set Pi mode: normal, plan, or auto",
    handler: async (args, ctx) => {
      const requested = args.trim().toLowerCase();
      if (!requested) {
        ctx.ui.notify(`Current mode: ${mode}. Use /mode normal, /mode plan, /mode auto, or Shift+Tab to cycle.`, "info");
        return;
      }
      if (requested !== "normal" && requested !== "plan" && requested !== "auto") {
        ctx.ui.notify("Usage: /mode [normal|plan|auto]", "error");
        return;
      }
      setMode(requested, ctx);
    },
  });

  pi.registerShortcut("shift+tab", {
    description: "Cycle Pi mode: normal → plan → auto",
    handler: async ctx => cycleMode(ctx),
  });

  pi.on("session_start", async (_event, ctx) => {
    rememberDefaultTools();
    const entries = ctx.sessionManager.getEntries();
    const lastMode = entries
      .filter((entry: { type: string; customType?: string }) => entry.type === "custom" && entry.customType === "claude-mode")
      .pop() as { data?: { mode?: ClaudeMode } } | undefined;

    if (lastMode?.data?.mode && MODE_ORDER.includes(lastMode.data.mode)) {
      mode = lastMode.data.mode;
    }

    applyMode(ctx);
  });

  pi.on("before_agent_start", async event => ({
    systemPrompt: event.systemPrompt + instructions(mode),
  }));

  pi.on("tool_call", async event => {
    if (mode !== "plan") return;

    if (event.toolName === "bash") {
      const command = String((event.input as { command?: unknown }).command ?? "");
      if (!isReadOnlyBash(command)) {
        return {
          block: true,
          reason: `Plan mode blocks destructive bash commands. Switch to normal/auto with Shift+Tab or /mode auto to execute.\nCommand: ${command}`,
        };
      }
      return;
    }

    if (!READ_ONLY_TOOL_ALLOWLIST.has(event.toolName)) {
      return {
        block: true,
        reason: `Plan mode blocks tool '${event.toolName}'. Switch to normal/auto with Shift+Tab or /mode auto to execute.`,
      };
    }
  });
}
