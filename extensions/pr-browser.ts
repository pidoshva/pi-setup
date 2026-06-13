import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import type { Component, OverlayHandle, TUI } from "@earendil-works/pi-tui";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

const SHORTCUT = "f4";

type PullRequest = {
  number: number;
  title: string;
  author: string;
  url: string;
  headRefName: string;
  baseRefName: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  isDraft: boolean;
  reviewDecision: string;
  reviews: Review[];
  latestReviews: Review[];
};

type Review = {
  author: string;
  state: string;
};

type PrRow =
  | { type: "section"; label: string }
  | { type: "pr"; pr: PullRequest };

type RawPullRequest = Omit<PullRequest, "author" | "reviews" | "latestReviews"> & {
  author?: { login?: string };
  reviews?: RawReview[];
  latestReviews?: RawReview[];
};

type RawReview = {
  author?: { login?: string };
  state?: string;
};

type PrAction = "review" | "diff" | "view" | "checkout";

export default function prBrowser(pi: ExtensionAPI) {
  let handle: OverlayHandle | null = null;
  let panel: PrBrowserPanel | null = null;

  async function loadPrs(cwd: string): Promise<PullRequest[]> {
    const result = await pi.exec(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "open",
        "--limit",
        "50",
        "--json",
        "number,title,author,url,headRefName,baseRefName,additions,deletions,changedFiles,isDraft,reviewDecision,reviews,latestReviews",
      ],
      { cwd, timeout: 10000 },
    );

    if (result.code !== 0) throw new Error(result.stderr || result.stdout || "Failed to list PRs");

    const values = JSON.parse(result.stdout) as Array<RawPullRequest>;
    return values.map(pr => ({
      ...pr,
      author: pr.author?.login ?? "unknown",
      reviews: normalizeReviews(pr.reviews),
      latestReviews: normalizeReviews(pr.latestReviews),
      reviewDecision: pr.reviewDecision ?? "UNKNOWN",
    }));
  }

  async function getViewerLogin(cwd: string): Promise<string | null> {
    const result = await pi.exec("gh", ["api", "user", "--jq", ".login"], { cwd, timeout: 5000 });
    return result.code === 0 ? result.stdout.trim() || null : null;
  }

  async function refresh(cwd: string) {
    if (!panel) return;
    panel.setLoading(true);
    panel.requestRender();

    try {
      panel.setPrs(await loadPrs(cwd));
      panel.setError(null);
    } catch (error) {
      panel.setError(error instanceof Error ? error.message : String(error));
    } finally {
      panel.setLoading(false);
      panel.requestRender();
    }
  }

  async function runAction(ctx: PrContext, pr: PullRequest, action: PrAction) {
    if (action === "review") {
      closePanel();
      ctx.ui.setEditorText(`/review ${pr.url}`);
      ctx.ui.notify(`Prepared /review for PR #${pr.number}`, "info");
      return;
    }

    if (action === "diff") {
      closePanel();
      ctx.ui.notify(`Loading diff for PR #${pr.number}…`, "info");
      const result = await pi.exec("gh", ["pr", "diff", String(pr.number)], { cwd: ctx.cwd, timeout: 30000 });
      const diff = result.stdout || result.stderr || `No diff available for PR #${pr.number}`;
      await ctx.ui.custom(
        (tui: TUI, theme: Theme, _keybindings: unknown, done: () => void) => new PrDiffViewer(tui, theme, done, `PR #${pr.number}: ${pr.title}`, diff),
        {
          overlay: true,
          overlayOptions: {
            width: "88%",
            minWidth: 90,
            maxHeight: "92%",
            anchor: "center",
            margin: 1,
            visible: () => true,
          },
        },
      );
      return;
    }

    if (action === "checkout") {
      closePanel();
      ctx.ui.setEditorText(`gh pr checkout ${pr.number}`);
      ctx.ui.notify(`Prepared checkout for PR #${pr.number}`, "info");
      return;
    }

    if (action === "view") {
      const copy = await pi.exec("bash", ["-lc", "printf %s \"$1\" | (pbcopy || xclip -selection clipboard || wl-copy)", "copy-pr-url", pr.url], {
        cwd: ctx.cwd,
        timeout: 5000,
      });
      const open = await pi.exec("bash", ["-lc", "open \"$1\" || xdg-open \"$1\" || sensible-browser \"$1\"", "open-pr-url", pr.url], {
        cwd: ctx.cwd,
        timeout: 5000,
      });

      if (copy.code !== 0) ctx.ui.setEditorText(pr.url);

      if (open.code === 0 && copy.code === 0) {
        ctx.ui.notify(`Opened and copied ${pr.url}`, "info");
      } else if (open.code === 0) {
        ctx.ui.notify("Opened PR; could not copy link, pasted URL into editor", "warning");
      } else if (copy.code === 0) {
        ctx.ui.notify("Copied PR link; could not open browser", "warning");
      } else {
        ctx.ui.notify("Could not open or copy PR link; pasted URL into editor", "warning");
      }
    }
  }

  function closePanel() {
    handle?.hide();
    handle = null;
    panel = null;
  }

  async function show(ctx: PrContext) {
    if (handle) {
      closePanel();
      return;
    }

    await ctx.ui.custom(
      (tui: TUI, theme: Theme, _keybindings: unknown, done: () => void) => {
        panel = new PrBrowserPanel(tui, theme, done, () => refresh(ctx.cwd), (pr, action) => runAction(ctx, pr, action));
        void getViewerLogin(ctx.cwd).then(login => panel?.setViewerLogin(login));
        void refresh(ctx.cwd);
        return panel;
      },
      {
        overlay: true,
        overlayOptions: {
          width: "76%",
          minWidth: 90,
          maxHeight: "86%",
          anchor: "center",
          margin: 1,
          visible: () => true,
        },
        onHandle: (overlayHandle: OverlayHandle) => {
          handle = overlayHandle;
          overlayHandle.focus();
        },
      },
    );

    handle = null;
    panel = null;
  }

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("pr-browser", `prs: ${SHORTCUT}`);
  });

  pi.registerCommand("prs", {
    description: `Browse open GitHub PRs (${SHORTCUT})`,
    handler: async (_args, ctx) => {
      await show(ctx);
    },
  });

  pi.registerShortcut(SHORTCUT, {
    description: "Browse open GitHub PRs",
    handler: async ctx => {
      await show(ctx);
    },
  });
}

type PrContext = {
  cwd: string;
  ui: {
    custom: Function;
    notify: (message: string, level?: "info" | "error" | "warning") => void;
    setEditorText: (text: string) => void;
    setStatus: (key: string, value: string | undefined) => void;
  };
};

type DiffFileSection = {
  path: string;
  lines: string[];
  expanded: boolean;
  status: "added" | "modified" | "deleted" | "renamed";
  language: string;
};

type DiffRow =
  | { type: "file"; section: DiffFileSection; sectionIndex: number }
  | { type: "line"; section: DiffFileSection; sectionIndex: number; line: string; lineIndex: number };

function normalizeReviews(reviews: RawReview[] | undefined): Review[] {
  return (reviews ?? []).map(review => ({
    author: review.author?.login ?? "unknown",
    state: review.state ?? "UNKNOWN",
  }));
}

function shortReviewState(state: string): string {
  if (state === "APPROVED") return "approved";
  if (state === "CHANGES_REQUESTED") return "changes";
  if (state === "COMMENTED") return "commented";
  if (state === "DISMISSED") return "dismissed";
  return state.toLowerCase();
}

class PrDiffViewer implements Component {
  private scroll = 0;
  private selectedIndex = 0;
  private sections: DiffFileSection[];
  private rows: DiffRow[] = [];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly done: () => void,
    private readonly title: string,
    diff: string,
  ) {
    this.sections = parseDiffSections(diff);
    this.rebuildRows();
  }

  invalidate() {
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, "q") || matchesKey(data, SHORTCUT)) {
      this.done();
      return;
    }

    if (matchesKey(data, "return")) {
      const row = this.rows[this.selectedIndex];
      if (row?.type === "file") {
        row.section.expanded = !row.section.expanded;
        const selectedSectionIndex = row.sectionIndex;
        this.rebuildRows();
        this.selectedIndex = this.rows.findIndex(next => next.type === "file" && next.sectionIndex === selectedSectionIndex);
        if (this.selectedIndex < 0) this.selectedIndex = 0;
        this.keepSelectionVisible();
        this.tui.requestRender();
      }
      return;
    }

    if (matchesKey(data, "up")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.keepSelectionVisible();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "down")) {
      this.selectedIndex = Math.min(Math.max(0, this.rows.length - 1), this.selectedIndex + 1);
      this.keepSelectionVisible();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "pageUp")) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 24);
      this.keepSelectionVisible();
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "pageDown")) {
      this.selectedIndex = Math.min(Math.max(0, this.rows.length - 1), this.selectedIndex + 24);
      this.keepSelectionVisible();
      this.tui.requestRender();
    }
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 2);
    const border = (text: string) => this.theme.fg("border", text);
    const line = (text = "") => border("│") + truncateToWidth(text, innerWidth, "…", true).padEnd(innerWidth) + border("│");
    const visibleRows = this.rows.slice(this.scroll, this.scroll + 24);
    const body = visibleRows.map((row, offset) => this.renderRow(row, this.scroll + offset));

    return [
      border(`╭${"─".repeat(innerWidth)}╮`),
      line(this.theme.fg("accent", ` ${this.title}`)),
      line(this.theme.fg("dim", " Esc/q/F4 close · ↑/↓ row · Enter expand/collapse file")),
      border(`├${"─".repeat(innerWidth)}┤`),
      ...(body.length ? body.map(value => line(value)) : [line(this.theme.fg("dim", " No diff output"))]),
      border(`╰${"─".repeat(innerWidth)}╯`),
    ];
  }

  private rebuildRows() {
    this.rows = [];
    this.sections.forEach((section, sectionIndex) => {
      this.rows.push({ type: "file", section, sectionIndex });
      if (section.expanded) {
        section.lines.forEach((line, lineIndex) => this.rows.push({ type: "line", section, sectionIndex, line, lineIndex }));
      }
    });
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.rows.length - 1));
    this.scroll = Math.min(this.scroll, this.selectedIndex);
  }

  private keepSelectionVisible() {
    const viewportSize = 24;
    if (this.selectedIndex < this.scroll) this.scroll = this.selectedIndex;
    if (this.selectedIndex >= this.scroll + viewportSize) this.scroll = this.selectedIndex - viewportSize + 1;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.rows.length - viewportSize)));
  }

  private renderRow(row: DiffRow, index: number): string {
    if (row.type === "file") return this.renderFileRow(row.section, index);
    return this.renderCodeRow(row, index);
  }

  private renderFileRow(section: DiffFileSection, index: number): string {
    const selected = index === this.selectedIndex;
    const marker = section.expanded ? "▾" : "▸";
    const status = this.statusLabel(section);
    const lang = section.language ? this.theme.fg("dim", ` ${section.language}`) : "";
    const header = `${selected ? "›" : " "} ${marker} ${status} ${section.path}${lang} ${this.theme.fg("dim", `(${section.lines.length} lines)`)}`;
    return selected ? this.theme.bg("selectedBg", this.theme.fg("accent", header)) : this.colorFileHeader(section, header);
  }

  private renderCodeRow(row: Extract<DiffRow, { type: "line" }>, index: number): string {
    const selected = index === this.selectedIndex;
    const gutter = this.theme.fg(selected ? "accent" : "dim", selected ? "┃" : "│");
    const lineNo = this.theme.fg("dim", String(row.lineIndex + 1).padStart(4));
    const code = this.highlightDiffLine(row.line);
    const rendered = ` ${gutter} ${lineNo} ${code}`;
    return selected ? this.theme.bg("selectedBg", rendered) : rendered;
  }

  private highlightDiffLine(line: string): string {
    if (line.startsWith("diff --git")) return this.theme.fg("accent", line);
    if (line.startsWith("new file mode")) return this.theme.fg("success", line);
    if (line.startsWith("deleted file mode")) return this.theme.fg("error", line);
    if (line.startsWith("index ")) return this.theme.fg("dim", line);
    if (line.startsWith("@@")) return this.theme.fg("warning", this.theme.bold(line));
    if (line.startsWith("+++ ") || line.startsWith("--- ")) return this.theme.fg("muted", line);
    if (line.startsWith("+")) return this.theme.fg("success", `+${this.highlightCode(line.slice(1))}`);
    if (line.startsWith("-")) return this.theme.fg("error", `-${this.highlightCode(line.slice(1))}`);
    if (line.startsWith("\\")) return this.theme.fg("dim", line);
    return ` ${this.highlightCode(line.startsWith(" ") ? line.slice(1) : line)}`;
  }

  private colorFileHeader(section: DiffFileSection, header: string): string {
    if (section.status === "added") return this.theme.fg("success", header);
    if (section.status === "deleted") return this.theme.fg("error", header);
    if (section.status === "renamed") return this.theme.fg("accent", header);
    return this.theme.fg("warning", header);
  }

  private statusLabel(section: DiffFileSection): string {
    if (section.status === "added") return this.theme.fg("success", "added");
    if (section.status === "deleted") return this.theme.fg("error", "deleted");
    if (section.status === "renamed") return this.theme.fg("accent", "renamed");
    return this.theme.fg("warning", "modified");
  }

  private highlightCode(code: string): string {
    return code
      .replace(/\b(import|export|from|const|let|var|function|return|if|else|await|async|class|type|interface|private|public|readonly)\b/g, value => this.theme.fg("accent", value))
      .replace(/\b(true|false|null|undefined)\b/g, value => this.theme.fg("warning", value))
      .replace(/(['"`])([^'"`]*)\1/g, value => this.theme.fg("success", value));
  }
}

function parseDiffSections(diff: string): DiffFileSection[] {
  const sections: DiffFileSection[] = [];
  let current: DiffFileSection | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current) sections.push(current);
      const filePath = parseDiffPath(line);
      current = { path: filePath, lines: [line], expanded: false, status: "modified", language: languageForPath(filePath) };
      continue;
    }

    if (!current) {
      current = { path: "diff", lines: [], expanded: true, status: "modified", language: "" };
    }

    if (line.startsWith("new file mode")) current.status = "added";
    if (line.startsWith("deleted file mode")) current.status = "deleted";
    if (line.startsWith("rename from") || line.startsWith("rename to")) current.status = "renamed";
    current.lines.push(line);
  }

  if (current) sections.push(current);
  if (sections.length === 1) sections[0]!.expanded = true;
  return sections;
}

function languageForPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TSX",
    js: "JavaScript",
    jsx: "JSX",
    vue: "Vue",
    json: "JSON",
    md: "Markdown",
    css: "CSS",
    scss: "SCSS",
    html: "HTML",
    prisma: "Prisma",
    yml: "YAML",
    yaml: "YAML",
    sh: "Shell",
    sql: "SQL",
  };
  return ext ? map[ext] ?? ext : "";
}

function parseDiffPath(line: string): string {
  const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
  return match?.[2] ?? line.replace(/^diff --git\s+/, "");
}

class PrBrowserPanel implements Component {
  private prs: PullRequest[] = [];
  private rows: PrRow[] = [];
  private viewerLogin: string | null = null;
  private selectedRowIndex = 0;
  private selectedActionIndex = 0;
  private scroll = 0;
  private loading = true;
  private error: string | null = null;
  private readonly actions: Array<{ key: PrAction; label: string }> = [
    { key: "review", label: "/review" },
    { key: "diff", label: "diff" },
    { key: "view", label: "view" },
    { key: "checkout", label: "checkout" },
  ];

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly done: () => void,
    private readonly refresh: () => void | Promise<void>,
    private readonly runAction: (pr: PullRequest, action: PrAction) => void | Promise<void>,
  ) {}

  setPrs(prs: PullRequest[]) {
    this.prs = prs;
    this.rows = this.buildRows();
    this.selectedRowIndex = this.clampToSelectableRow(this.selectedRowIndex);
    this.scroll = Math.min(this.scroll, this.selectedRowIndex);
  }

  setViewerLogin(viewerLogin: string | null) {
    this.viewerLogin = viewerLogin;
    this.rows = this.buildRows();
    this.tui.requestRender();
  }

  setLoading(loading: boolean) {
    this.loading = loading;
  }

  setError(error: string | null) {
    this.error = error;
  }

  requestRender() {
    this.tui.requestRender();
  }

  invalidate() {
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, SHORTCUT)) {
      this.done();
      return;
    }

    if (matchesKey(data, "r")) {
      void this.refresh();
      return;
    }

    if (matchesKey(data, "up")) {
      this.selectedRowIndex = this.previousSelectableRow(this.selectedRowIndex);
      this.scroll = Math.min(this.scroll, this.selectedRowIndex);
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "down")) {
      this.selectedRowIndex = this.nextSelectableRow(this.selectedRowIndex);
      this.scroll = Math.max(this.scroll, this.selectedRowIndex - 16);
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "left")) {
      this.selectedActionIndex = Math.max(0, this.selectedActionIndex - 1);
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "right") || matchesKey(data, "tab")) {
      this.selectedActionIndex = Math.min(this.actions.length - 1, this.selectedActionIndex + 1);
      this.tui.requestRender();
      return;
    }

    const selectedPr = this.selectedPr();
    if (matchesKey(data, "return") && selectedPr) {
      const action = this.actions[this.selectedActionIndex]!;
      void this.runAction(selectedPr, action.key);
    }
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 2);
    const border = (text: string) => this.theme.fg("border", text);
    const line = (text = "") => border("│") + truncateToWidth(text, innerWidth, "…", true).padEnd(innerWidth) + border("│");
    const visibleRows = this.rows.slice(this.scroll, this.scroll + 17);

    return [
      border(`╭${"─".repeat(innerWidth)}╮`),
      line(this.theme.fg("accent", " Open pull requests")),
      line(this.theme.fg("dim", ` ${SHORTCUT}/Esc close · r refresh · ↑/↓ PR · ←/→ action · Enter run`)),
      line(this.formatActions()),
      border(`├${"─".repeat(innerWidth)}┤`),
      ...this.contentLines(visibleRows).map(value => line(value)),
      border(`╰${"─".repeat(innerWidth)}╯`),
    ];
  }

  private contentLines(visibleRows: PrRow[]): string[] {
    if (this.loading) return [this.theme.fg("dim", " Loading PRs…")];
    if (this.error) return [this.theme.fg("error", ` ${this.error}`)];
    if (visibleRows.length === 0) return [this.theme.fg("dim", " No open PRs")];

    return visibleRows.map((row, offset) => {
      const absoluteIndex = this.scroll + offset;
      if (row.type === "section") return this.theme.bold(this.theme.fg("muted", row.label));
      return this.formatPr(row.pr, absoluteIndex);
    });
  }

  private formatActions(): string {
    return this.actions
      .map((action, index) => index === this.selectedActionIndex ? this.theme.fg("accent", `[${action.label}]`) : this.theme.fg("dim", ` ${action.label} `))
      .join("  ");
  }

  private formatPr(pr: PullRequest, index: number): string {
    const selected = index === this.selectedRowIndex;
    const pointer = selected ? this.theme.fg("accent", "›") : " ";
    const size = pr.additions + pr.deletions;
    const sizeText = `${pr.changedFiles} files, +${pr.additions}/-${pr.deletions}`;
    const draft = pr.isDraft ? this.theme.fg("warning", " draft") : "";
    const reviewSummary = this.formatReviewSummary(pr).padEnd(26);
    const text = `${pointer} #${String(pr.number).padEnd(5)} ${pr.author.padEnd(14)} ${String(size).padStart(5)}Δ  ${sizeText.padEnd(24)} ${reviewSummary} ${pr.title}${draft}`;
    return selected ? this.theme.fg("accent", text) : text;
  }

  private buildRows(): PrRow[] {
    const reviewCandidates = this.prs.filter(pr => !pr.isDraft);
    const untouched = reviewCandidates.filter(pr => this.reviewCount(pr) === 0);
    const reviewedByMe = this.viewerLogin ? reviewCandidates.filter(pr => this.hasReviewBy(pr, this.viewerLogin!)) : [];
    const reviewedByOthers = reviewCandidates.filter(pr => this.reviewCount(pr) > 0 && (!this.viewerLogin || !this.hasReviewBy(pr, this.viewerLogin)));
    const drafts = this.prs.filter(pr => pr.isDraft);

    const rows: PrRow[] = [];
    this.pushSection(rows, "Not reviewed by anyone", untouched);
    this.pushSection(rows, this.viewerLogin ? "Reviewed by others, not me" : "Reviewed", reviewedByOthers);
    this.pushSection(rows, "Reviewed by me", reviewedByMe);
    this.pushSection(rows, "Drafts", drafts);
    return rows;
  }

  private pushSection(rows: PrRow[], label: string, prs: PullRequest[]) {
    if (prs.length === 0) return;
    rows.push({ type: "section", label: ` ${label} (${prs.length})` });
    for (const pr of prs) rows.push({ type: "pr", pr });
  }

  private hasReviewBy(pr: PullRequest, login: string): boolean {
    return [...pr.latestReviews, ...pr.reviews].some(review => review.author === login);
  }

  private selectedPr(): PullRequest | null {
    const row = this.rows[this.selectedRowIndex];
    return row?.type === "pr" ? row.pr : null;
  }

  private clampToSelectableRow(index: number): number {
    if (this.rows.length === 0) return 0;
    if (this.rows[index]?.type === "pr") return index;
    return this.nextSelectableRow(index);
  }

  private previousSelectableRow(index: number): number {
    for (let i = Math.max(0, index - 1); i >= 0; i--) {
      if (this.rows[i]?.type === "pr") return i;
    }
    return this.clampToSelectableRow(index);
  }

  private nextSelectableRow(index: number): number {
    for (let i = Math.min(this.rows.length - 1, index + 1); i < this.rows.length; i++) {
      if (this.rows[i]?.type === "pr") return i;
    }
    return this.rows[index]?.type === "pr" ? index : 0;
  }

  private formatReviewSummary(pr: PullRequest): string {
    const reviews = this.effectiveReviews(pr);
    if (reviews.length === 0) return this.theme.fg("dim", "not reviewed");

    const reviewedByMe = this.viewerLogin && reviews.some(review => review.author === this.viewerLogin);
    const reviewers = reviews.slice(0, 3).map(review => `${review.author}:${shortReviewState(review.state)}`).join(", ");
    const extra = reviews.length > 3 ? ` +${reviews.length - 3}` : "";
    const me = reviewedByMe ? " me" : "";
    return `${reviews.length} review${reviews.length === 1 ? "" : "s"}${me}: ${reviewers}${extra}`;
  }

  private effectiveReviews(pr: PullRequest): Review[] {
    return pr.latestReviews.length > 0 ? pr.latestReviews : pr.reviews;
  }

  private reviewCount(pr: PullRequest): number {
    return this.effectiveReviews(pr).length;
  }
}
