import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";

/**
 * List view of active Work Items assigned to current user.
 *
 * @param {Object} props
 * @param {Array<any>} props.items Work items array
 * @param {(item: any, cx?: any) => void} props.onSelectItem Callback when a work item is clicked
 * @param {boolean} [props.loading]
 */
export function renderWIList({ items = [], onSelectItem, loading = false }) {
  const t = theme();

  const itemCard = (item) =>
    v_flex()
      .w_full()
      .p(10)
      .gap(4)
      .rounded(6)
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .cursor_pointer()
      .hover((s) => s.border_color(t.accent || t.selected))
      .on_click((_e, cx) => onSelectItem(item, cx))
      .child(
        h_flex()
          .w_full()
          .items_center()
          .gap(6)
          .child(statusBadge(item.type, "wi"))
          .child(statusBadge(item.state, "wi"))
          .child(
            div()
              .text_size(12)
              .text_color(t.foreground)
              .child(`#${item.id} ${item.title}`)
          )
      )
      .child(
        h_flex()
          .w_full()
          .items_center()
          .justify_between()
          .text_size(10)
          .text_color(t.dim)
          .child(div().child(item.areaPath || item.iterationPath || "General"))
          .child(
            div().child(
              item.changedDate
                ? new Date(item.changedDate).toLocaleDateString()
                : ""
            )
          )
      );

  return v_flex()
    .size_full()
    .min_h(0)
    .p(10)
    .gap(8)
    .bg(t.chrome)
    .child(
      v_flex()
        .id("wi-list-scroll")
        .flex_1()
        .w_full()
        .min_h(0)
        .overflow_y_scrollbar()
        .gap(6)
        .when(loading, (el) =>
          el.child(
            div()
              .p(16)
              .text_size(12)
              .text_color(t.dim)
              .child("Loading Work Items...")
          )
        )
        .when(!loading && items.length === 0, (el) =>
          el.child(
            div()
              .p(16)
              .text_size(12)
              .text_color(t.dim)
              .child("No active Work Items assigned to you.")
          )
        )
        .when(!loading && items.length > 0, (el) =>
          el.children(items.map(itemCard))
        )
    );
}
