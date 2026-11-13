import { div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { statusBadge } from "../components/status-badge.js";

/**
 * Renders a skeleton placeholder card during data loading.
 */
function renderSkeletonCard(t) {
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
        .justify_between()
        .child(
          h_flex()
            .gap(6)
            .items_center()
            .child(div().w(48).h(16).rounded(4).bg(t.hover))
            .child(div().w(160).h(14).rounded(4).bg(t.hover))
        )
        .child(div().w(36).h(14).rounded(4).bg(t.hover))
    )
    .child(
      h_flex()
        .w_full()
        .items_center()
        .justify_between()
        .child(div().w(120).h(12).rounded(3).bg(t.hover))
        .child(div().w(60).h(12).rounded(3).bg(t.hover))
    );
}

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
export function renderPRList({
  prs = [],
  filter = "assigned",
  onFilterChange,
  onSelectPR,
  loading = false,
  onRefresh = () => {},
}) {
  const t = theme();

  const filterTab = (id, label) => {
    const active = filter === id;
    return h_flex()
      .h(24)
      .px(8)
      .items_center()
      .rounded(5)
      .text_size(11.5)
      .font_medium()
      .cursor_pointer()
      .when(active, (el) => el.bg(t.selected || "#2d2e34"))
      .text_color(active ? t.foreground : t.muted)
      .hover((s) => s.bg(active ? t.selected : t.hover).text_color(t.foreground))
      .on_click(() => onFilterChange(id))
      .child(label);
  };

  const prCard = (pr) =>
    v_flex()
      .w_full()
      .p(10)
      .gap(6)
      .rounded(6)
      .bg(t.background)
      .border_1()
      .border_color(t.border)
      .cursor_pointer()
      .hover((s) => s.border_color(t.accent || t.selected || t.border || "#5b8def"))
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
              .min_w(0)
              .items_center()
              .child(statusBadge(pr.status, "pr"))
              .child(
                div()
                  .text_size(11)
                  .font_medium()
                  .text_color(t.dim)
                  .child(`#${pr.id}`)
              )
              .child(
                div()
                  .flex_1()
                  .truncate()
                  .text_size(12.5)
                  .font_medium()
                  .text_color(t.foreground)
                  .child(pr.title || "Untitled PR")
              )
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
              .when(Boolean(pr.repositoryName), (el) =>
                el.child(
                  div()
                    .px(4)
                    .py(1)
                    .rounded(3)
                    .bg(t.chrome)
                    .text_color(t.muted)
                    .child(pr.repositoryName)
                )
              )
              .child(
                div()
                  .text_color(t.dim)
                  .child(`${pr.sourceBranch || "source"} → ${pr.targetBranch || "target"}`)
              )
          )
          .child(div().text_color(t.muted).child(pr.author || "Unknown author"))
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
        .justify_between()
        .pb(4)
        .border_b(1)
        .border_color(t.border)
        .child(
          h_flex()
            .gap(4)
            .items_center()
            .child(filterTab("assigned", "Assigned to Me"))
            .child(filterTab("mine", "Created by Me"))
        )
        .child(
          div()
            .text_size(11)
            .text_color(t.dim)
            .child(!loading ? `${prs.length} pull request${prs.length === 1 ? "" : "s"}` : "")
        )
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
          el.children([
            renderSkeletonCard(t),
            renderSkeletonCard(t),
            renderSkeletonCard(t),
          ])
        )
        .when(!loading && prs.length === 0, (el) =>
          el.child(
            v_flex()
              .size_full()
              .items_center()
              .justify_center()
              .p(24)
              .gap(8)
              .child(svg("mods/azure-devops/assets/pr.svg").size(28).text_color(t.dim))
              .child(
                div()
                  .text_size(13)
                  .font_medium()
                  .text_color(t.foreground)
                  .child(
                    filter === "assigned"
                      ? "No pull requests assigned to you"
                      : "No pull requests created by you"
                  )
              )
              .child(
                div()
                  .text_size(11)
                  .text_color(t.dim)
                  .child(
                    filter === "assigned"
                      ? "When reviewers add you to pull requests, they will appear here."
                      : "New pull requests you author will show up in this list."
                  )
              )
              .child(
                h_flex()
                  .mt(6)
                  .h(24)
                  .px(10)
                  .items_center()
                  .rounded(4)
                  .bg(t.hover)
                  .border_1()
                  .border_color(t.border)
                  .text_size(11)
                  .text_color(t.foreground)
                  .cursor_pointer()
                  .hover((s) => s.bg(t.selected))
                  .on_click(() => onFilterChange(filter === "assigned" ? "mine" : "assigned"))
                  .child(filter === "assigned" ? "View Created by Me" : "View Assigned to Me")
              )
          )
        )
        .when(!loading && prs.length > 0, (el) =>
          el.children(prs.map(prCard))
        )
    );
}
