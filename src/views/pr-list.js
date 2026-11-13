import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";

/**
 * List view of Pull Requests with sub-filter toggle.
 *
 * @param {Object} props
 * @param {Array<any>} props.prs List of PRs
 * @param {"assigned" | "mine"} props.filter Active sub-filter
 * @param {(filter: "assigned" | "mine") => void} props.onFilterChange
 * @param {(pr: any, cx?: any) => void} props.onSelectPR Callback when a PR card is clicked
 * @param {boolean} [props.loading]
 */
export function renderPRList({ prs = [], filter = "assigned", onFilterChange, onSelectPR, loading = false }) {
  const t = theme();

  const filterTab = (id, label) => {
    const active = filter === id;
    return h_flex()
      .h(24)
      .px(8)
      .items_center()
      .rounded(4)
      .text_size(11)
      .cursor_pointer()
      .when(active, (el) => el.bg(t.selected))
      .text_color(active ? t.foreground : t.muted)
      .hover((s) => s.bg(active ? t.selected : t.hover))
      .on_click(() => onFilterChange(id))
      .child(label);
  };

  const prCard = (pr) =>
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
      .on_click((_e, cx) => onSelectPR(pr, cx))
      .child(
        h_flex()
          .w_full()
          .items_center()
          .justify_between()
          .gap(6)
          .child(
            h_flex()
              .gap(6)
              .flex_1()
              .items_center()
              .child(statusBadge(pr.status, "pr"))
              .child(
                div()
                  .text_size(12)
                  .text_color(t.foreground)
                  .child(`#${pr.id} ${pr.title}`)
              )
          )
      )
      .child(
        h_flex()
          .w_full()
          .items_center()
          .justify_between()
          .text_size(10)
          .text_color(t.dim)
          .child(div().child(`${pr.repositoryName ? `${pr.repositoryName} · ` : ""}${pr.sourceBranch} → ${pr.targetBranch}`))
          .child(div().child(pr.author))
      );

  return v_flex()
    .size_full()
    .min_h(0)
    .p(10)
    .gap(8)
    .bg(t.chrome)
    .child(
      h_flex()
        .w_full()
        .flex_none()
        .items_center()
        .gap(4)
        .pb(4)
        .border_b(1)
        .border_color(t.border)
        .child(filterTab("assigned", "Assigned to Me"))
        .child(filterTab("mine", "Created by Me"))
    )
    .child(
      v_flex()
        .id("pr-list-scroll")
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
              .child("Loading Pull Requests...")
          )
        )
        .when(!loading && prs.length === 0, (el) =>
          el.child(
            div()
              .p(16)
              .text_size(12)
              .text_color(t.dim)
              .child(
                filter === "assigned"
                  ? "No Pull Requests assigned to you."
                  : "You have not created any active Pull Requests."
              )
          )
        )
        .when(!loading && prs.length > 0, (el) =>
          el.children(prs.map(prCard))
        )
    );
}
