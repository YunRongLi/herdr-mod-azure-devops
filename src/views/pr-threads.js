import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";
import { copyButton } from "../components/copy-button.js";

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
 * Renders the review comments and discussion threads for a PR.
 * Displays newest comments first and oldest comments at the end.
 *
 * @param {Object} props
 * @param {Array<any>} props.threads
 * @param {any} props.pr
 * @param {(thread: any, pr: any) => void} props.onSolveThread
 */
export function renderPRThreads({ threads = [], pr, onSolveThread }) {
  const t = theme();

  if (!threads || threads.length === 0) {
    return div()
      .p(16)
      .text_size(12)
      .text_color(t.dim)
      .child("No comment threads found on this Pull Request.");
  }

  // Ensure threads are sorted with newest activity first
  const sortedThreads = [...threads].sort((a, b) => {
    const timeA = a.latestActivityTime ?? new Date(a.comments?.[0]?.publishedDate || a.publishedDate || 0).getTime();
    const timeB = b.latestActivityTime ?? new Date(b.comments?.[0]?.publishedDate || b.publishedDate || 0).getTime();
    return timeB - timeA || (b.id || 0) - (a.id || 0);
  });

  const threadCard = (thread) => {
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
              .child(statusBadge(thread.status, "thread"))
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
            sortedComments.map((comment) =>
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
                  div()
                    .text_size(12)
                    .text_color(t.muted)
                    .child(comment.content || "(No comment text)")
                )
            )
          )
      );
  };

  return v_flex()
    .w_full()
    .children(sortedThreads.map(threadCard));
}
