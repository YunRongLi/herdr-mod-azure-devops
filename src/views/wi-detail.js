import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";
import { openExternalUrl, sanitizeText } from "../utils.js";

/**
 * Strips HTML tags from rich text fields (e.g. ADO Description)
 * and cleans dangerous control characters.
 * @param {string} html
 * @returns {string}
 */
function stripHtml(html) {
  if (!html) return "";
  const cleaned = html
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
  return sanitizeText(cleaned);
}

/**
 * Detailed view of a single Work Item.
 *
 * @param {Object} props
 * @param {any} props.item Work item data
 * @param {Array<any>} props.comments Discussion comments
 * @param {(event: any, cx: any) => void} props.onBack Callback to return to list
 * @param {(item: any, comments: Array<any>) => void} props.onSolveWithAgent
 */
export function renderWIDetail({ item, comments = [], onBack, onSolveWithAgent }) {
  const t = theme();

  const handleOpenInBrowser = async () => {
    if (!item.url) return;
    try {
      await openExternalUrl(item.url);
    } catch {
      // Handled inside openExternalUrl
    }
  };

  const cleanDescription = stripHtml(item.description);

  return v_flex()
    .size_full()
    .min_h(0)
    .p(12)
    .gap(10)
    .bg(t.chrome)
    .child(
      h_flex()
        .w_full()
        .flex_none()
        .items_center()
        .justify_between()
        .child(
          h_flex()
            .gap(6)
            .items_center()
            .cursor_pointer()
            .hover((s) => s.text_color(t.foreground))
            .text_color(t.muted)
            .text_size(12)
            .on_click((_e, cx) => {
              if (onBack) onBack(_e, cx);
            })
            .child("← Back to Work Items")
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
                .cursor_pointer()
                .hover((s) => s.bg(t.hover))
                .on_click(() => onSolveWithAgent(item, comments))
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
                .cursor_pointer()
                .hover((s) => s.bg(t.hover).text_color(t.foreground))
                .on_click(handleOpenInBrowser)
                .child("Open in ADO ↗")
            )
        )
    )
    .child(
      v_flex()
        .id("wi-detail-scroll")
        .flex_1()
        .w_full()
        .min_h(0)
        .overflow_y_scrollbar()
        .gap(10)
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
                .child(statusBadge(item.type, "wi"))
                .child(statusBadge(item.state, "wi"))
                .child(
                  div()
                    .text_size(13)
                    .text_color(t.foreground)
                    .child(`#${item.id} ${item.title}`)
                )
            )
            .child(
              div()
                .text_size(11)
                .text_color(t.dim)
                .child(`Assigned to: ${item.assignedTo}`)
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
              div()
                .text_size(11)
                .text_color(t.dim)
                .child("Description")
            )
            .child(
              div()
                .text_size(12)
                .text_color(t.foreground)
                .child(cleanDescription || "(No description provided)")
            )
        )
        .child(
          v_flex()
            .w_full()
            .gap(6)
            .child(
              div()
                .text_size(11)
                .text_color(t.dim)
                .child(`Discussion (${comments.length})`)
            )
            .when(comments.length === 0, (el) =>
              el.child(
                div()
                  .p(8)
                  .text_size(11)
                  .text_color(t.dim)
                  .child("No comments posted.")
              )
            )
            .when(comments.length > 0, (el) =>
              el.children(
                comments.map((comment) =>
                  v_flex()
                    .w_full()
                    .p(8)
                    .rounded(6)
                    .bg(t.background)
                    .border_1()
                    .border_color(t.border)
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
                              comment.createdDate
                                ? new Date(comment.createdDate).toLocaleDateString()
                                : ""
                            )
                        )
                    )
                    .child(
                      div()
                        .text_size(12)
                        .text_color(t.muted)
                        .child(stripHtml(comment.text))
                    )
                )
              )
            )
        )
    );
}
