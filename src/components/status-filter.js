import { div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme } from "herdr";

/**
 * Reusable status filter pill component.
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, count?: number }>} props.options Filter choices
 * @param {string} props.activeId Currently active filter ID
 * @param {(id: string) => void} props.onChange Callback when a filter choice is selected
 * @param {number} [props.height=24] Filter button height
 * @param {number} [props.textSize=11] Font size
 */
export function statusFilter({
  options = [],
  activeId,
  onChange,
  height = 24,
  textSize = 11,
}) {
  const t = theme() || {};

  return h_flex()
    .gap(4)
    .items_center()
    .children(
      options.map((opt) => {
        const isActive = activeId === opt.id;
        const hasCount = typeof opt.count === "number";

        return h_flex()
          .h(height)
          .px(7)
          .gap(4)
          .items_center()
          .rounded(4)
          .cursor_pointer()
          .text_size(textSize)
          .font_medium()
          .when(isActive, (el) =>
            el
              .bg(t.selected || "#2d2e34")
              .text_color(t.foreground || "#ffffff")
              .border_1()
              .border_color(t.accent || t.selected || "#5b8def")
          )
          .when(!isActive, (el) =>
            el
              .bg(t.chrome || "#252528")
              .text_color(t.muted || "#9ca3af")
              .border_1()
              .border_color(t.border || "#33353a")
              .hover((s) =>
                s.bg(t.hover || "#2d2e34").text_color(t.foreground || "#ffffff")
              )
          )
          .on_click((_e, cx) => {
            if (cx && typeof cx.stop_propagation === "function") {
              cx.stop_propagation();
            }
            if (activeId !== opt.id) {
              onChange(opt.id);
            }
          })
          .child(div().child(opt.label))
          .when(hasCount, (el) =>
            el.child(
              div()
                .px(4)
                .py(1)
                .rounded(3)
                .text_size(textSize * 0.85)
                .bg(isActive ? (t.chrome || "#1e1e22") : (t.background || "#18181b"))
                .text_color(isActive ? (t.accent || t.foreground || "#ffffff") : (t.dim || "#6b7280"))
                .child(String(opt.count))
            )
          );
      })
    );
}
