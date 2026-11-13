import { div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { theme } from "herdr";
import {
  loadConfig,
  getActiveProfile,
  addProfile,
  updateProfile,
  removeProfile,
  setActiveProfile,
  setAgentRunner,
  isConfigured,
  isValidProjectName,
} from "../config.js";
import { assertSafeAdoUrl, isValidAgentName } from "../utils.js";

export class SettingsView {
  /**
   * @param {Object} options
   * @param {() => void} [options.onDone] Callback when settings view is closed
   * @param {boolean} [options.isDialog] Whether displayed in overlay dialog mode
   */
  constructor({ onDone, isDialog = false } = {}) {
    this.onDone = onDone || (() => {});
    this.isDialog = isDialog;
    this.lastActiveProfileId = null;

    this.nameInput = InputState.new({ placeholder: "Display Label (e.g., Alpha Team)" });
    this.orgInput = InputState.new({ placeholder: "https://dev.azure.com/Organization" });
    this.projectInput = InputState.new({ placeholder: "Project Name" });
    this.newProfileUserInput = InputState.new({ placeholder: "e.g., Jane Doe or user@example.com (optional)" });

    const activeProfile = getActiveProfile();
    this.userInput = InputState.new({ placeholder: "e.g., Jane Doe or user@example.com (optional)" });
    this.userInput.set_value(activeProfile?.user || "");

    const currentConfig = loadConfig();
    this.agentInput = InputState.new({ placeholder: "claude" });
    this.agentInput.set_value(currentConfig.agent || "claude");

    this.errorMessage = null;
    this.successMessage = null;
  }

  handleAddProfile(cx) {
    const name = this.nameInput.value().trim();
    const org = this.orgInput.value().trim();
    const project = this.projectInput.value().trim();

    if (!org) {
      this.errorMessage = "Organization URL is required.";
      this.successMessage = null;
      cx.notify();
      return;
    }

    try {
      assertSafeAdoUrl(org);
    } catch (err) {
      this.errorMessage = err.message || "Invalid Organization URL. Must be HTTPS.";
      this.successMessage = null;
      cx.notify();
      return;
    }

    if (!project) {
      this.errorMessage = "Project name is required.";
      this.successMessage = null;
      cx.notify();
      return;
    }

    if (!isValidProjectName(project)) {
      this.errorMessage = "Project name contains invalid characters. Use alphanumeric, spaces, and hyphens.";
      this.successMessage = null;
      cx.notify();
      return;
    }

    const user = this.newProfileUserInput.value().trim();

    try {
      addProfile({ name, organization: org, project, user, setAsActive: true });
      this.nameInput.set_value("");
      this.orgInput.set_value("");
      this.projectInput.set_value("");
      this.newProfileUserInput.set_value("");
      this.userInput.set_value(user);
      this.errorMessage = null;
      this.successMessage = `Added and selected project '${project}'!`;
    } catch (err) {
      this.errorMessage = err.message || "Failed to add profile.";
      this.successMessage = null;
    }
    cx.notify();
  }

  handleRemoveProfile(profileId, cx) {
    removeProfile(profileId);
    const active = getActiveProfile();
    this.userInput.set_value(active?.user || "");
    this.errorMessage = null;
    this.successMessage = "Profile removed.";
    cx.notify();
  }

  handleSelectActive(profileId, cx) {
    const updated = setActiveProfile(profileId);
    this.userInput.set_value(updated?.user || "");
    this.errorMessage = null;
    this.successMessage = "Active project updated.";
    cx.notify();
  }

  handleSaveUser(cx) {
    const active = getActiveProfile();
    if (!active) {
      this.errorMessage = "Please add or select a project target first.";
      this.successMessage = null;
      cx.notify();
      return;
    }
    const user = this.userInput.value().trim();
    updateProfile(active.id, { user });
    this.errorMessage = null;
    this.successMessage = user
      ? `Saved user filter '${user}' for active project.`
      : "Cleared user filter; Pull Requests will use default identity.";
    cx.notify();
  }

  handleSaveAgent(cx) {
    const agent = this.agentInput.value().trim() || "claude";
    if (!isValidAgentName(agent)) {
      this.errorMessage = "Invalid agent runner identifier. Use alphanumeric and hyphens (e.g., 'claude').";
      this.successMessage = null;
      cx.notify();
      return;
    }
    setAgentRunner(agent);
    this.errorMessage = null;
    this.successMessage = "Agent runner preference saved.";
    cx.notify();
  }

  render() {
    const t = theme();
    const config = loadConfig();
    const activeProfile = getActiveProfile();

    if (activeProfile && activeProfile.id !== this.lastActiveProfileId) {
      this.lastActiveProfileId = activeProfile.id;
      this.userInput.set_value(activeProfile.user || "");
    }

    const canExit = isConfigured() || this.isDialog;

    const fieldLabel = (text) =>
      div().text_size(11).text_color(t.muted).mb(3).child(text);

    const inputWrapper = (inputState) =>
      div()
        .w_full()
        .h(30)
        .px(8)
        .rounded(6)
        .border_1()
        .border_color(t.border)
        .bg(t.background)
        .child(Input.new(inputState).size_full().text_size(12).text_color(t.foreground));

    const button = (id, label, primary, onClick) =>
      h_flex()
        .id(id)
        .h(28)
        .px(10)
        .items_center()
        .justify_center()
        .rounded(5)
        .text_size(11)
        .bg(primary ? t.accent : t.chrome)
        .text_color(primary ? t.foreground : t.muted)
        .border_1()
        .border_color(primary ? t.accent : t.border)
        .hover((s) => s.bg(primary ? t.accent : t.hover))
        .on_click((_e, cx) => onClick(cx))
        .child(label);

    const profileRow = (p) => {
      const isActive = p.id === config.activeProfileId;
      return h_flex()
        .w_full()
        .p(8)
        .gap(6)
        .items_center()
        .justify_between()
        .rounded(6)
        .bg(t.background)
        .border_1()
        .border_color(isActive ? t.accent : t.border)
        .child(
          v_flex()
            .flex_1()
            .gap(1)
            .child(
              h_flex()
                .gap(6)
                .items_center()
                .child(
                  div()
                    .text_size(12)
                    .text_color(t.foreground)
                    .child(p.name)
                )
                .when(isActive, (el) =>
                  el.child(
                    div()
                      .px(4)
                      .py(1)
                      .rounded(3)
                      .bg(t.accent)
                      .text_size(9)
                      .text_color(t.foreground)
                      .child("Active")
                  )
                )
                .when(Boolean(p.user), (el) =>
                  el.child(
                    div()
                      .px(4)
                      .py(1)
                      .rounded(3)
                      .bg(t.chrome)
                      .border_1()
                      .border_color(t.border)
                      .text_size(9)
                      .text_color(t.muted)
                      .child(`User: ${p.user}`)
                  )
                )
            )
            .child(
              div()
                .text_size(10)
                .text_color(t.dim)
                .child(`${p.organization} · ${p.project}`)
            )
        )
        .child(
          h_flex()
            .gap(4)
            .items_center()
            .when(!isActive, (el) =>
              el.child(
                h_flex()
                  .h(22)
                  .px(6)
                  .items_center()
                  .rounded(4)
                  .bg(t.chrome)
                  .border_1()
                  .border_color(t.border)
                  .text_size(10)
                  .text_color(t.muted)
                  .hover((s) => s.bg(t.hover).text_color(t.foreground))
                  .on_click((_e, cx) => this.handleSelectActive(p.id, cx))
                  .child("Select")
              )
            )
            .when(config.profiles.length > 1, (el) =>
              el.child(
                h_flex()
                  .h(22)
                  .px(6)
                  .items_center()
                  .rounded(4)
                  .bg(t.chrome)
                  .border_1()
                  .border_color(t.border)
                  .text_size(10)
                  .text_color(t.dim)
                  .hover((s) => s.bg(t.status?.blocked || "#421818").text_color(t.foreground))
                  .on_click((_e, cx) => this.handleRemoveProfile(p.id, cx))
                  .child("Remove")
              )
            )
        );
    };

    return v_flex()
      .size_full()
      .p(14)
      .gap(12)
      .overflow_y_scrollbar()
      .bg(t.chrome)
      .child(
        h_flex()
          .w_full()
          .items_center()
          .justify_between()
          .child(
            h_flex()
              .gap(8)
              .items_center()
              .child(svg("mods/azure-devops/assets/settings.svg").size(16).text_color(t.foreground))
              .child(div().text_size(14).text_color(t.foreground).child("Azure DevOps Settings"))
          )
          .when(canExit, (el) =>
            el.child(button("btn-settings-done", this.isDialog ? "Close" : "Done", true, (cx) => this.onDone(cx)))
          )
      )
      .when(Boolean(this.errorMessage), (el) =>
        el.child(
          div()
            .p(8)
            .rounded(6)
            .bg(t.status?.blocked || "#501c1c")
            .text_color(t.foreground)
            .text_size(11)
            .child(this.errorMessage)
        )
      )
      .when(Boolean(this.successMessage), (el) =>
        el.child(
          div()
            .p(8)
            .rounded(6)
            .bg(t.background)
            .border_1()
            .border_color(t.accent)
            .text_color(t.foreground)
            .text_size(11)
            .child(this.successMessage)
        )
      )
      .child(
        v_flex()
          .w_full()
          .gap(6)
          .child(div().text_size(12).text_color(t.foreground).child("Configured Projects"))
          .when(config.profiles.length === 0, (el) =>
            el.child(div().text_size(11).text_color(t.dim).child("No projects configured yet."))
          )
          .when(config.profiles.length > 0, (el) =>
            el.children(config.profiles.map(profileRow))
          )
      )
      .when(Boolean(activeProfile), (el) =>
        el.child(
          v_flex()
            .w_full()
            .p(10)
            .gap(8)
            .rounded(6)
            .bg(t.background)
            .border_1()
            .border_color(t.border)
            .child(
              v_flex()
                .gap(2)
                .child(
                  div()
                    .text_size(12)
                    .font_semibold()
                    .text_color(t.foreground)
                    .child(`Active Profile Filter: ${activeProfile.name}`)
                )
                .child(
                  div()
                    .text_size(10)
                    .text_color(t.dim)
                    .child("Filters Pull Requests (Created by Me & Assigned to Me) by display name or email. Work Items continue using @me.")
                )
            )
            .child(
              v_flex()
                .gap(3)
                .child(fieldLabel("Target User Name or Email (e.g., Jane Doe)"))
                .child(inputWrapper(this.userInput))
            )
            .child(
              h_flex()
                .mt(4)
                .child(button("btn-save-user", "Save User Filter", false, (cx) => this.handleSaveUser(cx)))
            )
        )
      )
      .child(
        v_flex()
          .w_full()
          .p(10)
          .gap(8)
          .rounded(6)
          .bg(t.background)
          .border_1()
          .border_color(t.border)
          .child(div().text_size(12).text_color(t.foreground).child("Add Organization & Project"))
          .child(
            v_flex()
              .gap(3)
              .child(fieldLabel("Display Label (optional)"))
              .child(inputWrapper(this.nameInput))
          )
          .child(
            v_flex()
              .gap(3)
              .child(fieldLabel("Organization URL (HTTPS)"))
              .child(inputWrapper(this.orgInput))
          )
          .child(
            v_flex()
              .gap(3)
              .child(fieldLabel("Project Name"))
              .child(inputWrapper(this.projectInput))
          )
          .child(
            v_flex()
              .gap(3)
              .child(fieldLabel("Target User Name (optional)"))
              .child(inputWrapper(this.newProfileUserInput))
          )
          .child(
            h_flex()
              .mt(4)
              .child(button("btn-add-profile", "+ Add Project Target", true, (cx) => this.handleAddProfile(cx)))
          )
      )
      .child(
        v_flex()
          .w_full()
          .p(10)
          .gap(8)
          .rounded(6)
          .bg(t.background)
          .border_1()
          .border_color(t.border)
          .child(div().text_size(12).text_color(t.foreground).child("Coding Agent Integration"))
          .child(
            v_flex()
              .gap(3)
              .child(fieldLabel("Preferred Agent Executable"))
              .child(inputWrapper(this.agentInput))
              .child(
                div()
                  .mt(2)
                  .text_size(10)
                  .text_color(t.dim)
                  .child("Executable launched for new agents, e.g. claude, pi, or codex. Antigravity (agy/antigravity) is never driven from here.")
              )
          )
          .child(
            h_flex()
              .mt(4)
              .child(button("btn-save-agent", "Save Agent Setting", false, (cx) => this.handleSaveAgent(cx)))
          )
      );
  }
}
