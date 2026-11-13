import { div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, panes, run, theme, layout } from "herdr";

function find(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

const narrow = () => {
  try {
    const root = layout();
    const sb = find(root, "sidebar");
    return (sb?.size?.px ?? Infinity) < 160;
  } catch {
    return false;
  }
};

/**
 * Sidebar navigation button for Azure DevOps, placed alongside Spaces and Agents.
 * Supports expanded mode (icon + label + new tab action) and collapsed rail mode (icon + tooltip).
 */
export function renderSidebarButton() {
  const t = theme() || {};
  const selectedBg = t.selected || t.hover || "#2d2e34";
  const hoverBg = t.hover || "#2d2e34";
  const fg = t.foreground || "#ffffff";
  const muted = t.muted || "#9ca3af";
  const dim = t.dim || "#6b7280";
  const accent = t.accent || t.status?.done || "#5b8def";

  const collapsed = narrow();

  let isDevOpsActive = false;
  let existingTab = null;

  try {
    const sp = spaces() || [];
    const currentSpace = sp.find((s) => s && s.active);
    const activeTabId = currentSpace?.tabs?.find((t) => t && t.active)?.id;
    const allPanes = panes() || [];

    isDevOpsActive = Boolean(
      activeTabId && allPanes.some((p) => p && p.tab === activeTabId && p.mod === "azure-devops")
    );

    existingTab = currentSpace?.tabs?.find((t) =>
      t && allPanes.some((p) => p && p.tab === t.id && p.mod === "azure-devops")
    );
  } catch {
    // Graceful fallback if spaces or panes state is transient
  }

  const handleOpenDevOps = (_e, cx) => {
    if (cx && typeof cx.stop_propagation === "function") {
      cx.stop_propagation();
    }
    if (existingTab && !isDevOpsActive) {
      run("tab.select", { id: existingTab.id });
    } else {
      run("tab.new", { name: "Azure DevOps", mod: "azure-devops" });
    }
  };

  const handleForceNewTab = (_e, cx) => {
    if (cx && typeof cx.stop_propagation === "function") {
      cx.stop_propagation();
    }
    run("tab.new", { name: "Azure DevOps", mod: "azure-devops" });
  };

  if (collapsed) {
    return h_flex()
      .size_full()
      .items_center()
      .justify_center()
      .child(
        h_flex()
          .id("devops-sidebar-rail")
          .w(32)
          .h(28)
          .relative()
          .items_center()
          .justify_center()
          .rounded(6)
          .cursor_pointer()
          .when(isDevOpsActive, (el) => el.bg(selectedBg))
          .text_color(isDevOpsActive ? fg : muted)
          .hover((s) => s.bg(isDevOpsActive ? selectedBg : hoverBg).text_color(fg))
          .tooltip("Azure DevOps")
          .on_click(handleOpenDevOps)
          .child(svg("mods/azure-devops/assets/ado.svg").size(15))
          .when(isDevOpsActive, (el) =>
            el.child(
              div()
                .absolute()
                .top(5)
                .right(5)
                .size(5)
                .rounded_full()
                .bg(accent)
            )
          )
      );
  }

  return h_flex()
    .size_full()
    .px(8)
    .items_center()
    .child(
      h_flex()
        .id("devops-sidebar-btn")
        .w_full()
        .h(30)
        .px(8)
        .items_center()
        .justify_between()
        .rounded(6)
        .cursor_pointer()
        .when(isDevOpsActive, (el) => el.bg(selectedBg))
        .text_color(isDevOpsActive ? fg : muted)
        .hover((s) => s.bg(isDevOpsActive ? selectedBg : hoverBg).text_color(fg))
        .on_click(handleOpenDevOps)
        .child(
          h_flex()
            .items_center()
            .gap(8)
            .child(svg("mods/azure-devops/assets/ado.svg").size(14).flex_none())
            .child(
              div()
                .text_size(12.5)
                .font_medium()
                .text_color(isDevOpsActive ? fg : muted)
                .child("Azure DevOps")
            )
        )
        .child(
          h_flex()
            .id("devops-sidebar-new-tab")
            .size(20)
            .items_center()
            .justify_center()
            .rounded(4)
            .text_size(13)
            .text_color(dim)
            .hover((s) => s.bg(hoverBg).text_color(fg))
            .tooltip("Open in new tab")
            .on_click(handleForceNewTab)
            .child("+")
        )
    );
}
