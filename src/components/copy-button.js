import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, notify } from "herdr";
import { sanitizeText } from "../utils.js";

/**
 * Reusable clipboard copy button component.
 * Copies text using GPUI native context clipboard API with toast notification feedback.
 *
 * @param {Object} props
 * @param {string} props.text Content to clip/copy to clipboard
 * @param {string} [props.label] Button label text (default: "Copy")
 * @param {string} [props.tooltip] Tooltip text
 * @param {string} [props.notifyTitle] Notification title shown on successful copy
 * @param {number} [props.height] Component height in pixels (default: 20)
 * @param {number} [props.textSize] Font size in pixels (default: 10.5)
 */
export function copyButton({
  text = "",
  label = "Copy",
  tooltip = "Copy to clipboard",
  notifyTitle = "Copied to clipboard",
  height = 20,
  textSize = 10.5,
}) {
  const t = theme() || {};
  const cleanedText = sanitizeText(text || "").trim();

  return h_flex()
    .h(height)
    .px(6)
    .gap(4)
    .items_center()
    .rounded(4)
    .bg(t.chrome || "#252528")
    .border_1()
    .border_color(t.border || "#33353a")
    .cursor_pointer()
    .hover((s) => s.bg(t.hover || "#2d2e34").text_color(t.foreground || "#ffffff"))
    .text_size(textSize)
    .font_medium()
    .text_color(t.muted || "#9ca3af")
    .tooltip(tooltip)
    .on_click((_e, cx) => {
      if (cx && typeof cx.stop_propagation === "function") {
        cx.stop_propagation();
      }
      if (cx && typeof cx.write_to_clipboard === "function") {
        cx.write_to_clipboard(cleanedText);
      }
      try {
        notify({
          title: notifyTitle,
          body: cleanedText.length > 60 ? `${cleanedText.slice(0, 57)}...` : cleanedText,
          level: "info",
        });
      } catch {
        // Notification is non-critical feedback
      }
    })
    .child(label);
}
