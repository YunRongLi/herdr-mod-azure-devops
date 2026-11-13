import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";
import { renderPRThreads } from "./pr-threads.js";
import { openExternalUrl } from "../utils.js";

/**
 * Detailed view of a single Pull Request.
 *
 * @param {Object} props
 * @param {any} props.pr Selected PR data
 * @param {Array<any>} props.threads PR comment threads
 * @param {Array<any>} props.changes PR changed files
 * @param {"threads" | "changes"} props.subTab Currently active sub-tab
 * @param {(tab: "threads" | "changes") => void} props.onSubTabChange
 * @param {() => void} props.onBack Callback to return to PR list
 * @param {(pr: any) => void} props.onSolvePR Callback to dispatch full PR to agent
 * @param {(thread: any, pr: any) => void} props.onSolveThread Callback to dispatch thread to agent
 */
export function renderPRDetail({
  pr,
  threads = [],
  changes = [],
  subTab = "threads",
  onSubTabChange,
  onBack,
  onSolvePR,
  onSolveThread,
}) {
  const t = theme();

  const handleOpenInBrowser = async () => {
    if (!pr.url) return;
    try {
      await openExternalUrl(pr.url);
    } catch {
      // Handled inside openExternalUrl
    }
  };

  const subTabButton = (id, label, count) => {
    const active = subTab === id;
    return h_flex()
      .h(26)
      .px(8)
      .gap(4)
      .items_center()
      .rounded(5)
      .text_size(11)
      .when(active, (el) => el.bg(t.selected))
      .text_color(active ? t.foreground : t.muted)
      .hover((s) => s.bg(active ? t.selected : t.hover))
      .on_click(() => onSubTabChange(id))
      .child(label)
      .when(count !== undefined, (el) =>
        el.child(
          div()
            .px(4)
            .py(1)
            .rounded(3)
            .bg(active ? t.chrome : t.background)
            .text_size(9)
            .text_color(t.dim)
            .child(String(count))
        )
      );
  };

  const renderChanges = () => {
    if (!changes || changes.length === 0) {
      return div()
        .p(16)
        .text_size(12)
        .text_color(t.dim)
        .child("No modified files found for this Pull Request.");
    }

    return v_flex()
      .w_full()
      .gap(3)
      .children(
        changes.map((file) =>
          h_flex()
            .w_full()
            .p(6)
            .gap(6)
            .items_center()
            .rounded(4)
            .bg(t.background)
            .border_1()
            .border_color(t.border)
            .child(
              div()
                .px(4)
                .py(1)
                .rounded(3)
                .bg(t.chrome)
                .text_size(9)
                .text_color(file.changeType === "add" ? (t.status?.working || t.accent) : t.muted)
                .child(file.changeType || "edit")
            )
            .child(
              div()
                .text_size(11)
                .text_color(t.foreground)
                .child(file.path || "Unknown file")
            )
        )
      );
  };

  return v_flex()
    .size_full()
    .p(12)
    .gap(10)
    .bg(t.chrome)
    .child(
      h_flex()
        .w_full()
        .items_center()
        .justify_between()
        .child(
          h_flex()
            .gap(6)
            .items_center()
            .hover((s) => s.text_color(t.foreground))
            .text_color(t.muted)
            .text_size(12)
            .on_click(onBack)
            .child("← Back to PRs")
        )
        .child(
          h_flex()
            .gap(6)
            .items_center()
            .child(
              h_flex()
                .h(24)
                .px(8)
                .items_center()
                .rounded(4)
                .bg(t.accent)
                .text_color(t.foreground)
                .text_size(11)
                .hover((s) => s.bg(t.hover))
                .on_click(() => onSolvePR(pr))
                .child("Solve with Agent")
            )
            .child(
              h_flex()
                .h(24)
                .px(8)
                .items_center()
                .rounded(4)
                .bg(t.background)
                .border_1()
                .border_color(t.border)
                .text_color(t.muted)
                .text_size(11)
                .hover((s) => s.bg(t.hover).text_color(t.foreground))
                .on_click(handleOpenInBrowser)
                .child("Open in ADO ↗")
            )
        )
    )
    .child(
      v_flex()
        .w_full()
        .p(10)
        .rounded(6)
        .bg(t.background)
        .border_1()
        .border_color(t.border)
        .gap(4)
        .child(
          h_flex()
            .gap(6)
            .items_center()
            .child(statusBadge(pr.status, "pr"))
            .child(
              div()
                .text_size(13)
                .text_color(t.foreground)
                .child(pr.title)
            )
        )
        .child(
          div()
            .text_size(11)
            .text_color(t.dim)
            .child(`By ${pr.author} · ${pr.sourceBranch} → ${pr.targetBranch}`)
        )
        .when(Boolean(pr.description), (el) =>
          el.child(
            div()
              .mt(4)
              .text_size(12)
              .text_color(t.muted)
              .child(pr.description)
          )
        )
    )
    .child(
      h_flex()
        .w_full()
        .gap(4)
        .border_b(1)
        .border_color(t.border)
        .pb(4)
        .child(subTabButton("threads", "Review Threads", threads.length))
        .child(subTabButton("changes", "Changed Files", changes.length))
    )
    .child(
      v_flex()
        .flex_1()
        .w_full()
        .overflow_y_scrollbar()
        .child(
          subTab === "threads"
            ? renderPRThreads({ threads, pr, onSolveThread })
            : renderChanges()
        )
    );
}
