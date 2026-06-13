import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { basename, join } from "node:path";

const AF_CONFIG_PATH = join(homedir(), ".config", "agent-factory", "config.json");

function readAgentFactoryIdentity() {
  try {
    if (!existsSync(AF_CONFIG_PATH)) return { username: userInfo().username || "agent", avatar: { color: "#c084fc" } };
    const parsed = JSON.parse(readFileSync(AF_CONFIG_PATH, "utf8"));
    return {
      username: parsed.username || userInfo().username || "agent",
      avatar: { color: "#c084fc", ...(parsed.avatar || {}) },
    };
  } catch {
    return { username: userInfo().username || "agent", avatar: { color: "#c084fc" } };
  }
}

function fmt(n: number) {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

const footerMagenta = (text: string) => `\x1b[38;2;192;132;252m${text}\x1b[0m`;
const footerOrange = (text: string) => `\x1b[38;2;255;158;100m${text}\x1b[0m`;

function pill(theme: any, label: string, value: string, color: string = "accent") {
  const valueText = color === "footerMagenta" ? footerMagenta(value) : color === "footerOrange" ? footerOrange(value) : theme.fg(color, value);
  return `${theme.fg("dim", label)} ${valueText}`;
}

function fitLine(line: string, width: number) {
  return truncateToWidth(line, Math.max(1, width));
}

function installFooter(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]) {
  ctx.ui.setFooter((tui, theme, footerData) => {
    const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

    return {
      dispose: () => unsubBranch(),
      invalidate() {},
      render(width: number): string[] {
        let input = 0;
        let output = 0;
        let cost = 0;

        for (const e of ctx.sessionManager.getBranch()) {
          if (e.type === "message" && e.message.role === "assistant") {
            const message = e.message as AssistantMessage;
            input += message.usage?.input || 0;
            output += message.usage?.output || 0;
            cost += message.usage?.cost?.total || 0;
          }
        }

        const af = readAgentFactoryIdentity();
        const branch = footerData.getGitBranch();
        const repoName = (footerData as any).getGitRepoName?.();
        const statuses = [...footerData.getExtensionStatuses().values()].filter(Boolean);
        const cwd = basename(ctx.cwd || process.cwd());
        const model = ctx.model?.id || "no model";
        const contextUsage = ctx.getContextUsage?.();
        const contextPercent = contextUsage?.percent ?? null;
        const contextText = contextPercent === null ? "—" : `${Math.round(contextPercent * 100)}%`;

        const statusText = statuses.length ? statuses.join("  •  ") : "ready";

        const topLeftParts = [
          footerMagenta("●"),
          pill(theme, "user", af.username, "footerMagenta"),
          theme.fg("dim", "│"),
          pill(theme, "dir", cwd, "footerOrange"),
        ];
        if (repoName && branch) {
          topLeftParts.push(
            theme.fg("dim", "│"),
            pill(theme, "repo", repoName, "footerMagenta"),
            theme.fg("dim", "on"),
            footerOrange(branch),
          );
        }
        const topLeft = topLeftParts.join(" ");
        const topRight = pill(theme, "model", model, "muted");
        const topPad = " ".repeat(Math.max(1, width - visibleWidth(topLeft) - visibleWidth(topRight)));

        const bottomLeft = [
          theme.fg("dim", "↳"),
          pill(theme, "tokens", `↑${fmt(input)} ↓${fmt(output)}`, "muted"),
          theme.fg("dim", "│"),
          pill(theme, "cost", `$${cost.toFixed(3)}`, "footerOrange"),
          theme.fg("dim", "│"),
          pill(theme, "ctx", contextText, contextPercent !== null && contextPercent > 0.75 ? "footerOrange" : "footerMagenta"),
        ].join(" ");
        const bottomRight = `${theme.fg("dim", "status")} ${statuses.length ? footerOrange(statusText) : footerMagenta(statusText)}`;
        const bottomPad = " ".repeat(Math.max(1, width - visibleWidth(bottomLeft) - visibleWidth(bottomRight)));

        return [
          fitLine(topLeft + topPad + topRight, width),
          fitLine(bottomLeft + bottomPad + bottomRight, width),
        ];
      },
    };
  });
}

export default function neonFooter(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => installFooter(ctx));
  pi.on("input", async (_event, ctx) => installFooter(ctx));
}
