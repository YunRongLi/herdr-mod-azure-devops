import { div } from "gpui-kit";
import { TextView } from "gpui-base";
import { theme } from "herdr";
import { openExternalUrl, sanitizeText } from "../utils.js";

/**
 * Renders text that supports mouse selection and copying.
 * Uses GPUI's native TextView with selectable(true).
 *
 * @param {Object} props
 * @param {string} props.id Unique stable identifier for the TextView
 * @param {string} [props.text] Text or markdown content to display
 * @param {string} [props.html] Optional HTML content (if provided and non-empty, rendered via TextView.html)
 * @param {string} [props.fallback] Fallback message when text/html is empty
 * @param {number} [props.textSize=12] Text size in pixels
 * @param {string} [props.textColor] Text color override
 * @param {boolean} [props.selectable=true] Whether mouse selection is enabled
 * @param {boolean} [props.scrollable=false] Whether TextView should scroll internally
 * @param {boolean} [props.flex1=false] Whether wrapper div should take flex-1
 */
export function selectableText({
  id,
  text = "",
  html = null,
  fallback = "",
  textSize = 12,
  textColor,
  selectable = true,
  scrollable = false,
  flex1 = false,
}) {
  const t = theme() || {};
  const effectiveColor = textColor || t.foreground || "#ffffff";
  const elementId = id || `selectable-${Math.random().toString(36).slice(2, 9)}`;

  const hasHtml = Boolean(html && typeof html === "string" && html.trim().length > 0);
  const rawContent = hasHtml ? html : (text || "");
  const sanitized = sanitizeText(rawContent).trim();

  if (!sanitized) {
    if (!fallback) {
      return div().when(flex1, (el) => el.flex_1());
    }
    return div()
      .when(flex1, (el) => el.flex_1())
      .text_size(textSize)
      .text_color(t.dim || "#6b7280")
      .child(fallback);
  }

  const tv = hasHtml
    ? TextView.html(elementId, sanitized.startsWith("<") ? sanitized : `<span>${sanitized}</span>`)
    : TextView.markdown(elementId, sanitized);

  tv.w_full()
    .text_size(textSize)
    .text_color(effectiveColor)
    .selectable(selectable)
    .scrollable(scrollable)
    .on_link_click((url) => {
      if (url) {
        openExternalUrl(url).catch(() => {});
      }
    });

  return div()
    .when(flex1, (el) => el.flex_1())
    .child(tv);
}
