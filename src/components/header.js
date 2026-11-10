import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme } from "herdr";

/**
 * Top navigation and control header for Azure DevOps mod.
 *
 * @param {Object} props
 * @param {"prs" | "workitems"} props.mode Current active tab
 * @param {(mode: "prs" | "workitems") => void} props.onModeChange Mode switcher callback
 * @param {() => void} props.onRefresh Refresh trigger callback
 * @param {() => void} props.onOpenSettings Settings view opener callback
 * @param {boolean} [props.loading] Whether a fetch operation is active
 * @param {string} [props.project] Currently selected project name
 */
export function renderHeader({ mode, onModeChange, onRefresh, onOpenSettings, loading = false, project = "" }) {
  const t = theme();

  const tabPill = (id, label, icon, active) =>
    h_flex()
      .id(`tab-pill-${id}`)
      .h(26)
      .px(8)
      .gap(6)
      .items_center()
      .rounded(5)
      .text_size(12)
      .bg(active ? t.selected : "transparent")
      .text_color(active ? t.foreground : t.muted)
      .hover((s) => s.bg(active ? t.selected : t.hover))
      .on_click(() => onModeChange(id))
      .child(svg(icon).size(13))
      .child(label);

  const iconAction = (id, icon, tooltip, onClick, spin = false) =>
    h_flex()
      .id(id)
      .size(26)
      .items_center()
      .justify_center()
      .rounded(5)
      .text_color(t.muted)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => onClick(cx))
      .child(
        spin
          ? svg(icon).size(13).spin(900).text_color(t.accent || t.foreground)
          : svg(icon).size(13)
      );

  return h_flex()
    .w_full()
    .h(38)
    .px(10)
    .gap(6)
    .items_center()
    .border_b(1)
    .border_color(t.border)
    .bg(t.chrome)
    .child(
      h_flex()
        .gap(4)
        .flex_1()
        .items_center()
        .child(tabPill("prs", "Pull Requests", "assets/pr.svg", mode === "prs"))
        .child(tabPill("workitems", "Work Items", "assets/wi.svg", mode === "workitems"))
    )
    .when(Boolean(project), (el) =>
      el.child(
        div()
          .text_size(11)
          .text_color(t.dim)
          .px(6)
          .child(project)
      )
    )
    .child(
      h_flex()
        .gap(2)
        .items_center()
        .child(iconAction("btn-header-refresh", "assets/refresh.svg", "Refresh", onRefresh, loading))
        .child(iconAction("btn-header-settings", "assets/settings.svg", "Settings", onOpenSettings))
    );
}
