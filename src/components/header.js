import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { theme } from "herdr";

/**
 * Top navigation and control header with multi-profile switcher and GUI layout actions.
 *
 * @param {Object} props
 * @param {"prs" | "workitems"} props.mode Current active tab
 * @param {(mode: "prs" | "workitems") => void} props.onModeChange Mode switcher callback
 * @param {() => void} props.onRefresh Refresh trigger callback
 * @param {() => void} props.onOpenSettings Settings view opener callback
 * @param {() => void} [props.onOpenAsTab] Open as dedicated tab callback
 * @param {() => void} [props.onSplitPane] Split beside active pane callback
 * @param {boolean} [props.loading] Whether a fetch operation is active
 * @param {Array<import("../config.js").AdoProfile>} [props.profiles] List of configured profiles
 * @param {string} [props.activeProfileId] Active profile ID
 * @param {(profileId: string) => void} [props.onSelectProfile] Switch profile callback
 * @param {boolean} [props.isProfileMenuOpen] Whether profile switcher menu is visible
 * @param {() => void} [props.onToggleProfileMenu] Toggle profile dropdown callback
 */
export function renderHeader({
  mode,
  onModeChange,
  onRefresh,
  onOpenSettings,
  onOpenAsTab = () => {},
  onSplitPane = () => {},
  loading = false,
  profiles = [],
  activeProfileId = "",
  onSelectProfile = () => {},
  isProfileMenuOpen = false,
  onToggleProfileMenu = () => {},
}) {
  const t = theme();
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];
  const profileLabel = activeProfile ? activeProfile.name : "Select Project";

  const tabPill = (id, label, icon, active) =>
    h_flex()
      .id(`tab-pill-${id}`)
      .h(26)
      .px(8)
      .gap(6)
      .items_center()
      .rounded(5)
      .text_size(12)
      .when(active, (el) => el.bg(t.selected))
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
      .when(Boolean(tooltip), (el) => el.tooltip(tooltip))
      .on_click((_e, cx) => onClick(cx))
      .child(
        spin
          ? svg(icon).size(13).spin(900).text_color(t.accent || t.foreground)
          : svg(icon).size(13)
      );

  const profileSwitcher = h_flex()
    .id("btn-profile-switcher")
    .h(24)
    .px(7)
    .gap(4)
    .items_center()
    .rounded(4)
    .bg(isProfileMenuOpen ? t.selected : t.background)
    .border_1()
    .border_color(t.border)
    .hover((s) => s.bg(t.hover).text_color(t.foreground))
    .text_size(11)
    .text_color(t.foreground)
    .on_click((_e, cx) => {
      cx.stop_propagation();
      onToggleProfileMenu();
    })
    .child(div().child(profileLabel))
    .child(div().text_size(8).text_color(t.dim).child("▼"));

  const profileDropdown = isProfileMenuOpen
    ? v_flex()
        .w_full()
        .p(4)
        .bg(t.popover || t.background)
        .border_b(1)
        .border_color(t.border)
        .gap(2)
        .children(
          profiles.map((p) => {
            const isSelected = p.id === activeProfileId;
            return h_flex()
              .w_full()
              .h(28)
              .px(8)
              .items_center()
              .justify_between()
              .rounded(4)
              .when(isSelected, (el) => el.bg(t.selected))
              .hover((s) => s.bg(isSelected ? t.selected : t.hover))
              .text_size(11)
              .text_color(isSelected ? t.foreground : t.muted)
              .on_click((_e, cx) => {
                cx.stop_propagation();
                onSelectProfile(p.id);
              })
              .child(
                v_flex()
                  .gap(1)
                  .child(div().text_color(isSelected ? t.foreground : t.muted).child(p.name))
                  .child(div().text_size(9).text_color(t.dim).child(`${p.organization} · ${p.project}`))
              )
              .when(isSelected, (el) =>
                el.child(div().text_size(10).text_color(t.accent || t.foreground).child("Active"))
              );
          })
        )
        .child(
          h_flex()
            .w_full()
            .h(26)
            .px(8)
            .items_center()
            .rounded(4)
            .hover((s) => s.bg(t.hover))
            .text_size(11)
            .text_color(t.dim)
            .on_click((_e, cx) => {
              cx.stop_propagation();
              onOpenSettings(cx);
            })
            .child("+ Add / Manage Projects in Settings...")
        )
    : null;

  return v_flex()
    .w_full()
    .child(
      h_flex()
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
            .child(tabPill("prs", "Pull Requests", "mods/azure-devops/assets/pr.svg", mode === "prs"))
            .child(tabPill("workitems", "Work Items", "mods/azure-devops/assets/wi.svg", mode === "workitems"))
        )
        .when(profiles.length > 0, (el) => el.child(profileSwitcher))
        .child(
          h_flex()
            .gap(2)
            .items_center()
            .child(iconAction("btn-header-tab", "mods/azure-devops/assets/tab.svg", "Open as Tab", onOpenAsTab))
            .child(iconAction("btn-header-split", "mods/azure-devops/assets/split.svg", "Split Pane Beside Terminal", onSplitPane))
            .child(iconAction("btn-header-refresh", "mods/azure-devops/assets/refresh.svg", "Refresh", onRefresh, loading))
            .child(iconAction("btn-header-settings", "mods/azure-devops/assets/settings.svg", "Settings", onOpenSettings))
        )
    )
    .when(Boolean(profileDropdown), (el) => el.child(profileDropdown));
}
