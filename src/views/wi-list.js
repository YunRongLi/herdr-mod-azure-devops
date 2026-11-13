import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";
import { statusFilter } from "../components/status-filter.js";

/**
 * Renders a skeleton placeholder card for work items.
 */
function renderSkeletonWICard(t) {
  return v_flex()
    .w_full()
    .p(10)
    .gap(6)
    .rounded(6)
    .bg(t.background)
    .border_1()
    .border_color(t.border)
    .child(
      h_flex()
        .w_full()
        .items_center()
        .gap(6)
        .child(div().w(40).h(16).rounded(4).bg(t.hover))
        .child(div().w(48).h(16).rounded(4).bg(t.hover))
        .child(div().w(180).h(14).rounded(4).bg(t.hover))
    )
    .child(
      h_flex()
        .w_full()
        .items_center()
        .justify_between()
        .child(div().w(100).h(12).rounded(3).bg(t.hover))
        .child(div().w(50).h(12).rounded(3).bg(t.hover))
    );
}

/**
 * List view of Work Items assigned to current user with type and state filters.
 *
 * @param {Object} props
 * @param {Array<any>} props.items Work items array
 * @param {string} [props.status="active"] Active work item state filter
 * @param {string} [props.type="all"] Active work item type filter
 * @param {(status: string) => void} [props.onStatusChange]
 * @param {(type: string) => void} [props.onTypeChange]
 * @param {(item: any, cx?: any) => void} props.onSelectItem Callback when a work item is clicked
 * @param {boolean} [props.loading]
 */
export function renderWIList({
  items = [],
  status = "active",
  type = "all",
  onStatusChange = () => {},
  onTypeChange = () => {},
  onSelectItem,
  loading = false,
}) {
  const t = theme();

  const itemCard = (item) => {
    if (!item || !item.id) return null;
    return v_flex()
      .w_full()
      .p(10)
      .gap(6)
      .rounded(6)
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .cursor_pointer()
      .hover((s) => s.border_color(t.accent || t.selected || t.border || "#5b8def"))
      .on_click((_e, cx) => onSelectItem(item, cx))
      .child(
        h_flex()
          .w_full()
          .items_center()
          .gap(6)
          .child(statusBadge(item.type, "wi", t))
          .child(statusBadge(item.state, "wi", t))
          .child(
            div()
              .text_size(11)
              .font_medium()
              .text_color(t.dim)
              .child(`#${item.id}`)
          )
          .child(
            div()
              .flex_1()
              .truncate()
              .text_size(12.5)
              .font_medium()
              .text_color(t.foreground)
              .child(item.title || "Untitled Work Item")
          )
      )
      .child(
        h_flex()
          .w_full()
          .items_center()
          .justify_between()
          .text_size(10.5)
          .text_color(t.dim)
          .child(
            h_flex()
              .gap(4)
              .items_center()
              .child(div().text_color(t.muted).child(item.areaPath || item.iterationPath || "General"))
          )
          .child(
            div().child(
              item.changedDate
                ? new Date(item.changedDate).toLocaleDateString()
                : ""
            )
          )
      );
  };

  const MAX_VISIBLE = 50;
  const visibleItems = items.slice(0, MAX_VISIBLE);
  const remainingCount = items.length - visibleItems.length;

  return v_flex()
    .size_full()
    .min_h(0)
    .p(10)
    .gap(8)
    .bg(t.chrome)
    .child(
      v_flex()
        .w_full()
        .flex_none()
        .gap(6)
        .pb(6)
        .border_b(1)
        .border_color(t.border)
        .child(
          h_flex()
            .w_full()
            .items_center()
            .justify_between()
            .gap(6)
            .child(
              div()
                .text_size(11.5)
                .font_medium()
                .text_color(t.foreground)
                .child("Assigned to Me")
            )
            .child(
              statusFilter({
                options: [
                  { id: "all", label: "All Types" },
                  { id: "task", label: "Task" },
                  { id: "bug", label: "Bug" },
                  { id: "feature", label: "Feature" },
                  { id: "pbi", label: "PBI" },
                ],
                activeId: type,
                onChange: onTypeChange,
                height: 20,
                textSize: 10,
              })
            )
        )
        .child(
          h_flex()
            .w_full()
            .overflow_x_scrollbar()
            .child(
              statusFilter({
                options: [
                  { id: "all", label: "All States" },
                  { id: "active", label: "Active" },
                  { id: "todo", label: "To Do" },
                  { id: "in_progress", label: "In Progress" },
                  { id: "committed", label: "Committed" },
                  { id: "resolved", label: "Resolved" },
                  { id: "not_started", label: "Not Started" },
                  { id: "removed", label: "Removed" },
                ],
                activeId: status,
                onChange: onStatusChange,
                height: 20,
                textSize: 10,
              })
            )
        )
    )
    .child(
      v_flex()
        .id("wi-list-scroll")
        .flex_1()
        .w_full()
        .min_h(0)
        .overflow_y_scrollbar()
        .gap(6)
        .when(loading, (el) =>
          el.children([
            renderSkeletonWICard(t),
            renderSkeletonWICard(t),
            renderSkeletonWICard(t),
          ])
        )
        .when(!loading && items.length === 0, (el) =>
          el.child(
            v_flex()
              .size_full()
              .items_center()
              .justify_center()
              .p(24)
              .gap(8)
              .child(svg("mods/azure-devops/assets/wi.svg").size(28).text_color(t.dim))
              .child(
                div()
                  .text_size(13)
                  .font_medium()
                  .text_color(t.foreground)
                  .child(
                    `No ${type === "all" ? "" : type + " "}work items matching ${status} state`
                  )
              )
              .child(
                div()
                  .text_size(11)
                  .text_color(t.dim)
                  .child("Tasks, bugs, or stories assigned to you will show up here.")
              )
          )
        )
        .when(!loading && items.length > 0, (el) =>
          el
            .children(visibleItems.map(itemCard).filter(Boolean))
            .when(remainingCount > 0, (container) =>
              container.child(
                h_flex()
                  .w_full()
                  .py(8)
                  .items_center()
                  .justify_center()
                  .child(
                    div()
                      .text_size(11)
                      .text_color(t.dim)
                      .child(`Showing 50 of ${items.length} work items`)
                  )
              )
            )
        )
    );
}
