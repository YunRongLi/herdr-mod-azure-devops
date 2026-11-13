import { div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";

/**
 * Renders the "Solve with Agent" idle-agent picker.
 *
 * Shows the idle, non-`agy` agents returned by `listIdleAgents`, pre-highlighting the one that
 * shares this mod's space (context-aware, per the confirmed intent). Pure UI: it takes the
 * candidate list and delegates the send/launch decisions back to the App via `onSelect`.
 *
 * @param {Object} props
 * @param {string} props.title Short context title, e.g. "PR #12 · Solve with Agent".
 * @param {Array<{ terminal: string|null, app: string|null, space_name: string, tab_name: string, inCurrentSpace: boolean }>} props.candidates
 * @param {(terminal: string) => void} props.onSelect Called with the chosen agent's stable terminal name.
 * @param {() => void} props.onCancel Called when the picker is dismissed.
 */
export function renderAgentPicker({ title, candidates = [], onSelect, onCancel }) {
  const t = theme();
  const accent = t.accent || t.selected;

  const row = (c) => {
    const label = c.app || "agent";
    const location = [c.space_name, c.tab_name].filter(Boolean).join("  ·  ");
    const isSameSpace = Boolean(c.inCurrentSpace);

    const right = h_flex().gap(4).items_center();
    if (isSameSpace) {
      right.child(div().text_size(10).text_color(accent).child("same space"));
    }
    right.child(div().text_size(10).text_color(t.muted).child(location || " "));

    return h_flex()
      .w_full()
      .items_center()
      .justify_between()
      .gap(6)
      .p(8)
      .rounded(6)
      .cursor_pointer()
      .border_1()
      .when(isSameSpace, (el) => el.bg(t.selected).border_color(accent))
      .when(!isSameSpace, (el) => el.bg(t.background).border_color(t.border))
      .hover((s) => s.bg(t.hover).border_color(accent))
      .on_click(() => onSelect(c.terminal))
      .child(
        div().text_size(12).text_color(t.foreground).child(label)
      )
      .child(right);
  };

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
        .gap(6)
        .pb(6)
        .border_b(1)
        .border_color(t.border)
        .child(div().text_size(13).text_color(t.foreground).child(title))
        .child(
          h_flex()
            .h(22)
            .px(8)
            .items_center()
            .rounded(4)
            .bg(t.background)
            .border_1()
            .border_color(t.border)
            .cursor_pointer()
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .text_size(10)
            .text_color(t.muted)
            .on_click(() => onCancel())
            .child("Cancel")
        )
    )
    .child(
      v_flex()
        .id("agent-picker-scroll")
        .flex_1()
        .w_full()
        .min_h(0)
        .overflow_y_scrollbar()
        .gap(6)
        .when(
          candidates.length === 0,
          (el) =>
            el.child(
              div()
                .p(16)
                .text_size(12)
                .text_color(t.dim)
                .child("No idle agents available.")
            )
        )
        .when(candidates.length > 0, (el) => el.children(candidates.map(row)))
    );
}
