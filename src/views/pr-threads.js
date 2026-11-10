import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";

/**
 * Renders the review comments and discussion threads for a PR.
 *
 * @param {Object} props
 * @param {Array<any>} props.threads
 * @param {any} props.pr
 * @param {(thread: any, pr: any) => void} props.onSolveThread
 */
export function renderPRThreads({ threads, pr, onSolveThread }) {
  const t = theme();

  if (!threads || threads.length === 0) {
    return div()
      .p(16)
      .text_size(12)
      .text_color(t.dim)
      .child("No comment threads found on this Pull Request.");
  }

  const threadCard = (thread) => {
    const hasContext = Boolean(thread.filePath);
    const locationText = hasContext
      ? `${thread.filePath}${thread.lineNumber ? `:${thread.lineNumber}` : ""}`
      : "General Discussion";

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
              .h(22)
              .px(6)
              .gap(4)
              .items_center()
              .rounded(4)
              .bg(t.chrome)
              .border_1()
              .border_color(t.border)
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
      .child(
        v_flex()
          .w_full()
          .gap(6)
          .children(
            thread.comments.map((comment) =>
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
                      div()
                        .text_size(10)
                        .text_color(t.dim)
                        .child(
                          comment.publishedDate
                            ? new Date(comment.publishedDate).toLocaleDateString()
                            : ""
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

  return v_flex().w_full().gap(4).children(threads.map(threadCard));
}
