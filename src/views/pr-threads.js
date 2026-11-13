import { div } from "gpui-kit";
import { v_flex, h_flex, Input } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";
import { copyButton } from "../components/copy-button.js";
import { selectableText } from "../components/selectable-text.js";
import { statusFilter } from "../components/status-filter.js";

/**
 * Normalizes Azure DevOps thread status to standard filter token.
 * @param {string} raw
 * @returns {"active" | "pending" | "resolved" | "wontfix" | "closed"}
 */
function normalizeThreadStatus(raw) {
  const s = (raw || "active").toLowerCase().replace(/[^a-z]/g, "");
  if (s === "fixed" || s === "resolved") return "resolved";
  if (s === "wontfix" || s === "bydesign") return "wontfix";
  if (s === "closed") return "closed";
  if (s === "pending") return "pending";
  return "active";
}

/**
 * Formats a comment timestamp nicely with date and time.
 * @param {string} dateStr
 * @returns {string}
 */
function formatCommentDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats entire thread into plain text for clipboard export.
 */
function formatThreadCopyText(thread, locationText, comments) {
  const header = `[PR Thread: ${locationText} (${thread.status || "Active"})]`;
  const body = comments
    .map((c) => `${c.author || "Unknown"} (${formatCommentDate(c.publishedDate)}):\n${c.content || ""}`)
    .join("\n\n");
  return `${header}\n\n${body}`;
}

/**
 * Renders the review comments and discussion threads for a PR with status filtering.
 *
 * @param {Object} props
 * @param {Array<any>} props.threads
 * @param {any} props.pr
 * @param {(thread: any, pr: any) => void} props.onSolveThread
 * @param {string} [props.threadStatus="all"]
 * @param {(status: string) => void} [props.onThreadStatusChange]
 * @param {(threadId: number) => any} [props.getThreadInput]
 * @param {(threadId: number, cx: any) => void} [props.onReplyThread]
 * @param {number | null} [props.submittingThreadId]
 */
export function renderPRThreads({
  threads = [],
  pr,
  onSolveThread,
  threadStatus = "all",
  onThreadStatusChange = () => {},
  getThreadInput,
  onReplyThread,
  submittingThreadId = null,
}) {
  const t = theme();

  if (!threads || threads.length === 0) {
    return div()
      .p(16)
      .text_size(12)
      .text_color(t.dim)
      .child("No comment threads found on this Pull Request.");
  }

  // Calculate counts per status
  const statusCounts = {
    all: threads.length,
    active: 0,
    pending: 0,
    resolved: 0,
    wontfix: 0,
    closed: 0,
  };

  threads.forEach((th) => {
    const key = normalizeThreadStatus(th.status);
    if (typeof statusCounts[key] === "number") {
      statusCounts[key]++;
    }
  });

  const filterOptions = [
    { id: "all", label: "All", count: statusCounts.all },
    { id: "active", label: "Active", count: statusCounts.active },
    { id: "pending", label: "Pending", count: statusCounts.pending },
    { id: "resolved", label: "Resolved", count: statusCounts.resolved },
    { id: "wontfix", label: "Won't Fix", count: statusCounts.wontfix },
    { id: "closed", label: "Closed", count: statusCounts.closed },
  ];

  // Filter threads by active status selection
  const filteredThreads = threadStatus === "all"
    ? threads
    : threads.filter((th) => normalizeThreadStatus(th.status) === threadStatus);

  // Ensure threads are sorted with newest activity first
  const sortedThreads = [...filteredThreads].sort((a, b) => {
    const timeA = a.latestActivityTime ?? new Date(a.comments?.[0]?.publishedDate || a.publishedDate || 0).getTime();
    const timeB = b.latestActivityTime ?? new Date(b.comments?.[0]?.publishedDate || b.publishedDate || 0).getTime();
    return timeB - timeA || (b.id || 0) - (a.id || 0);
  });

  const threadCard = (thread) => {
    if (!thread || !thread.id) return null;
    const hasContext = Boolean(thread.filePath);
    const locationText = hasContext
      ? `${thread.filePath}${thread.lineNumber ? `:${thread.lineNumber}` : ""}`
      : "General Discussion";

    // Ensure comments within thread are sorted: newest first, oldest last
    const sortedComments = [...(thread.comments || [])].sort((a, b) => {
      const timeA = new Date(a.publishedDate || 0).getTime();
      const timeB = new Date(b.publishedDate || 0).getTime();
      return timeB - timeA || (b.id || 0) - (a.id || 0);
    });

    return v_flex()
      .w_full()
      .p(10)
      .mb(8)
      .gap(6)
      .rounded(6)
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .child(
        h_flex()
          .w_full()
          .items_center()
          .justify_between()
          .child(
            h_flex()
              .gap(6)
              .items_center()
              .child(statusBadge(thread.status, "thread", t))
              .child(
                div()
                  .text_size(11)
                  .text_color(hasContext ? t.foreground : t.muted)
                  .child(locationText)
              )
          )
          .child(
            h_flex()
              .gap(4)
              .items_center()
              .child(
                copyButton({
                  text: formatThreadCopyText(thread, locationText, sortedComments),
                  label: "Copy Thread",
                  tooltip: "Copy entire thread to clipboard",
                  notifyTitle: "Thread Copied",
                  height: 22,
                  textSize: 10,
                })
              )
              .child(
                h_flex()
                  .h(22)
                  .px(6)
                  .gap(4)
                  .items_center()
                  .rounded(4)
                  .bg(t.chrome)
                  .border_1()
                  .border_color(t.border)
                  .cursor_pointer()
                  .hover((s) => s.bg(t.hover).text_color(t.accent || t.foreground))
                  .text_size(10)
                  .text_color(t.muted)
                  .on_click((_e, cx) => {
                    cx.stop_propagation();
                    onSolveThread(thread, pr);
                  })
                  .child("Solve with Agent")
              )
          )
      )
      .child(
        v_flex()
          .w_full()
          .gap(6)
          .children(
            sortedComments.map((comment, commentIdx) =>
              v_flex()
                .w_full()
                .p(6)
                .rounded(4)
                .bg(t.chrome)
                .gap(2)
                .child(
                  h_flex()
                    .w_full()
                    .items_center()
                    .justify_between()
                    .child(
                      div()
                        .text_size(11)
                        .text_color(t.foreground)
                        .child(comment.author)
                    )
                    .child(
                      h_flex()
                        .gap(6)
                        .items_center()
                        .child(
                          div()
                            .text_size(10)
                            .text_color(t.dim)
                            .child(formatCommentDate(comment.publishedDate))
                        )
                        .child(
                          copyButton({
                            text: comment.content || "",
                            label: "Copy",
                            tooltip: "Copy comment to clipboard",
                            notifyTitle: "Comment Copied",
                            height: 18,
                            textSize: 9.5,
                          })
                        )
                    )
                )
                .child(
                  selectableText({
                    id: `pr-thread-${thread.id}-comment-${comment.id ?? commentIdx}`,
                    text: comment.content || "",
                    fallback: "(No comment text)",
                    textSize: 12,
                    textColor: t.foreground,
                  })
                )
            )
          )
      )
      .when(Boolean(getThreadInput && onReplyThread), (el) => {
        const inputState = getThreadInput(thread.id);
        const isSubmitting = submittingThreadId === thread.id;
        if (!inputState) return el;

        return el.child(
          h_flex()
            .w_full()
            .mt(4)
            .gap(6)
            .items_center()
            .child(
              h_flex()
                .flex_1()
                .h(26)
                .px(8)
                .items_center()
                .rounded(4)
                .bg(t.chrome || "#252528")
                .border_1()
                .border_color(t.border || "#33353a")
                .child(
                  Input.new(inputState)
                    .size_full()
                    .text_size(11.5)
                    .text_color(t.foreground || "#ffffff")
                )
            )
            .child(
              h_flex()
                .h(26)
                .px(10)
                .items_center()
                .rounded(4)
                .bg(isSubmitting ? (t.chrome || "#252528") : (t.hover || "#2d2e34"))
                .border_1()
                .border_color(t.border || "#33353a")
                .cursor_pointer()
                .text_size(11)
                .font_medium()
                .text_color(isSubmitting ? (t.dim || "#6b7280") : (t.foreground || "#ffffff"))
                .hover((s) => s.bg(t.selected || "#5b8def").text_color(t.foreground || "#ffffff"))
                .on_click((_e, cx) => {
                  if (cx && typeof cx.stop_propagation === "function") {
                    cx.stop_propagation();
                  }
                  if (!isSubmitting) {
                    onReplyThread(thread.id, cx);
                  }
                })
                .child(isSubmitting ? "Posting..." : "Reply")
            )
        );
      });
  };

  return v_flex()
    .w_full()
    .gap(8)
    .child(
      h_flex()
        .w_full()
        .items_center()
        .justify_between()
        .pb(6)
        .border_b(1)
        .border_color(t.border)
        .child(
          statusFilter({
            options: filterOptions,
            activeId: threadStatus,
            onChange: onThreadStatusChange,
            height: 22,
            textSize: 10,
          })
        )
    )
    .when(sortedThreads.length === 0, (el) =>
      el.child(
        div()
          .p(16)
          .text_size(12)
          .text_color(t.dim)
          .child(`No threads matching '${threadStatus}' status.`)
      )
    )
    .when(sortedThreads.length > 0, (el) =>
      el.children(sortedThreads.map(threadCard))
    );
}
