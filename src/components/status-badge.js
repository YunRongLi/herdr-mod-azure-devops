import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme } from "herdr";

/**
 * Renders a compact, accessible status badge with semantic color tokens.
 *
 * @param {string} status Status text
 * @param {"pr" | "wi" | "thread"} [type] Context type
 * @param {any} [themeOverride] Pre-fetched theme object to avoid host bridge calls
 */
export function statusBadge(status, type = "pr", themeOverride = null) {
  const t = themeOverride || theme() || {};
  const normalized = (status || "").toLowerCase().trim();

  let bg = t.chrome || "#252528";
  let textColor = t.muted || "#9ca3af";
  let dotColor = null;

  if (["active", "new", "in progress", "in_progress"].includes(normalized)) {
    bg = t.hover || "#2d2e34";
    textColor = t.accent || t.foreground || "#e5e7eb";
    dotColor = t.accent || t.status?.working || "#5b8def";
  } else if (["completed", "done", "fixed", "closed", "resolved"].includes(normalized)) {
    bg = t.background || "#1a1b1e";
    textColor = t.muted || "#9ca3af";
    dotColor = t.status?.done || "#3fae6a";
  } else if (["abandoned", "wontfix", "wont_fix", "removed", "blocked", "rejected"].includes(normalized)) {
    bg = t.background || "#1a1b1e";
    textColor = t.dim || "#6b7280";
    dotColor = t.status?.blocked || "#d9649a";
  } else if (["bug", "issue"].includes(normalized)) {
    bg = t.hover || "#2d2e34";
    textColor = t.foreground || "#e5e7eb";
    dotColor = t.status?.blocked || "#e3814f";
  }

  return h_flex()
    .h(20)
    .px(6)
    .gap(5)
    .items_center()
    .rounded(4)
    .bg(bg)
    .border_1()
    .border_color(t.border || "#33353a")
    .text_size(10.5)
    .font_medium()
    .text_color(textColor)
    .when(Boolean(dotColor), (el) =>
      el.child(
        div()
          .size(5)
          .rounded_full()
          .bg(dotColor)
      )
    )
    .child(status || "Unknown");
}
