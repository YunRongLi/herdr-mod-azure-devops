import { div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { theme } from "herdr";
import { loadConfig, saveConfig, isConfigured, isValidProjectName } from "../config.js";
import { assertSafeAdoUrl, isValidAgentName } from "../utils.js";

export class SettingsView {
  /**
   * @param {Object} options
   * @param {() => void} options.onDone Callback when settings saved or canceled
   */
  constructor({ onDone }) {
    this.onDone = onDone;
    const current = loadConfig();

    this.orgInput = InputState.new({ placeholder: "https://dev.azure.com/Organization" });
    this.orgInput.set_value(current.organization || "");

    this.projectInput = InputState.new({ placeholder: "Project Name" });
    this.projectInput.set_value(current.project || "");

    this.agentInput = InputState.new({ placeholder: "claude" });
    this.agentInput.set_value(current.agent || "claude");

    this.errorMessage = null;
    this.saving = false;
  }

  save(cx) {
    const org = this.orgInput.value().trim();
    const project = this.projectInput.value().trim();
    const agent = this.agentInput.value().trim() || "claude";

    if (!org) {
      this.errorMessage = "Organization URL is required.";
      cx.notify();
      return;
    }

    try {
      assertSafeAdoUrl(org);
    } catch (err) {
      this.errorMessage = err.message || "Invalid Organization URL. Must be a secure HTTPS Azure DevOps address.";
      cx.notify();
      return;
    }

    if (!project) {
      this.errorMessage = "Project name is required.";
      cx.notify();
      return;
    }

    if (!isValidProjectName(project)) {
      this.errorMessage = "Project name contains invalid characters. Use letters, numbers, spaces, and hyphens.";
      cx.notify();
      return;
    }

    if (!isValidAgentName(agent)) {
      this.errorMessage = "Agent runner must be a valid executable identifier (e.g. 'claude', 'cursor-agent').";
      cx.notify();
      return;
    }

    this.saving = true;
    this.errorMessage = null;
    cx.notify();

    try {
      saveConfig({ organization: org, project, agent });
      this.saving = false;
      if (this.onDone) {
        this.onDone();
      }
    } catch (err) {
      this.errorMessage = err.message || "Failed to save configuration.";
      this.saving = false;
    }
    cx.notify();
  }

  cancel() {
    if (this.onDone) {
      this.onDone();
    }
  }

  render() {
    const t = theme();
    const canCancel = isConfigured();

    const fieldLabel = (text) =>
      div().text_size(12).text_color(t.muted).mb(4).child(text);

    const inputWrapper = (inputState) =>
      div()
        .w_full()
        .h(32)
        .px(8)
        .rounded(6)
        .border_1()
        .border_color(t.border)
        .bg(t.background)
        .child(Input.new(inputState).size_full().text_size(13).text_color(t.foreground));

    const button = (id, label, primary, onClick) =>
      h_flex()
        .id(id)
        .h(30)
        .px(12)
        .items_center()
        .justify_center()
        .rounded(6)
        .text_size(12)
        .bg(primary ? t.accent : t.chrome)
        .text_color(primary ? t.foreground : t.muted)
        .border_1()
        .border_color(primary ? t.accent : t.border)
        .hover((s) => s.bg(primary ? t.accent : t.hover))
        .on_click((_e, cx) => onClick(cx))
        .child(label);

    return v_flex()
      .size_full()
      .p(16)
      .gap(14)
      .bg(t.chrome)
      .child(
        h_flex()
          .gap(8)
          .items_center()
          .child(svg("assets/settings.svg").size(18).text_color(t.foreground))
          .child(div().text_size(15).text_color(t.foreground).child("Azure DevOps Settings"))
      )
      .child(
        div()
          .text_size(12)
          .text_color(t.dim)
          .child("Configure target organization and project. Authentication is handled automatically via host 'az login'.")
      )
      .when(Boolean(this.errorMessage), (el) =>
        el.child(
          div()
            .p(8)
            .rounded(6)
            .bg(t.status?.blocked || "#501c1c")
            .text_color(t.foreground)
            .text_size(12)
            .child(this.errorMessage)
        )
      )
      .child(
        v_flex()
          .gap(4)
          .child(fieldLabel("Organization URL (HTTPS only)"))
          .child(inputWrapper(this.orgInput))
      )
      .child(
        v_flex()
          .gap(4)
          .child(fieldLabel("Project Name"))
          .child(inputWrapper(this.projectInput))
      )
      .child(
        v_flex()
          .gap(4)
          .child(fieldLabel("Default Coding Agent Runner"))
          .child(inputWrapper(this.agentInput))
      )
      .child(
        h_flex()
          .gap(8)
          .mt(6)
          .items_center()
          .child(button("btn-save-settings", this.saving ? "Saving..." : "Save Configuration", true, (cx) => this.save(cx)))
          .when(canCancel, (el) =>
            el.child(button("btn-cancel-settings", "Cancel", false, () => this.cancel()))
          )
      );
  }
}
