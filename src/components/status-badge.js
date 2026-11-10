import { div } from "gpui-kit";
import { theme } from "herdr";

/**
 * Renders a compact status pill badge.
 * @param {string} status Status text
 * @param {string} [type] Optional type context: "pr" | "wi" | "thread"
 */
export function statusBadge(status, type = "pr") {
  const t = theme();
  const normalized = (status || "").toLowerCase();

  let bg = t.chrome;
  let textColor = t.muted;

  if (["active", "new", "in progress"].includes(normalized)) {
    bg = t.hover;
    textColor = t.accent || t.foreground;
  } else if (["completed", "done", "fixed", "closed"].includes(normalized)) {
    bg = t.background;
    textColor = t.muted;
  } else if (["abandoned", "wontfix", "removed", "blocked"].includes(normalized)) {
    bg = t.background;
    textColor = t.dim;
  }

  return div()
    .px(6)
    .py(2)
    .rounded(4)
    .bg(bg)
    .border_1()
    .border_color(t.border)
    .text_size(10)
    .text_color(textColor)
    .child(status || "Unknown");
}
