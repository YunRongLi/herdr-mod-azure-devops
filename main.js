import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState } from "gpui-base";
import { theme, run, props, openOverlay, closeOverlay, focused, notify } from "herdr";
import {
  loadConfig,
  getActiveProfile,
  setActiveProfile,
  isConfigured,
} from "./src/config.js";
import {
  getCurrentUser,
  getPullRequests,
  getPullRequestThreads,
  getPullRequestChanges,
  postPullRequestThreadComment,
  getAssignedWorkItems,
  getWorkItemDetail,
  postWorkItemComment,
} from "./src/client.js";
import {
  formatPRThreadPrompt,
  formatPRPrompt,
  formatWorkItemPrompt,
  dispatchAgentTask,
  planAgentRouting,
  sendToTerminal,
  launchNewAgent,
} from "./src/agent.js";
import { renderHeader } from "./src/components/header.js";
import { renderSidebarButton } from "./src/views/sidebar-button.js";
import { SettingsView } from "./src/views/settings.js";
import { renderPRList } from "./src/views/pr-list.js";
import { renderPRDetail } from "./src/views/pr-detail.js";
import { renderAgentPicker } from "./src/views/agent-picker.js";
import { renderWIList } from "./src/views/wi-list.js";
import { renderWIDetail } from "./src/views/wi-detail.js";

export default class AzureDevOpsMod extends View {
  init(_props, cx) {
    this.cx = cx;
    const p = _props || props() || {};
    this.isSidebarButton = p.role === "sidebar-button";
    this.isDialog = p.role === "settings";
    this.dialogOverlayId = p.overlay;

    if (this.isSidebarButton) {
      return;
    }

    this.mode = "prs"; // "prs" | "workitems"
    this.showingSettings = !isConfigured();
    this.isProfileMenuOpen = false;

    this.user = null;
    this.prFilter = "mine";
    this.prStatusFilter = "active";
    this.prs = [];
    this.selectedPR = null;
    this.agentPicker = null;
    this.prThreads = [];
    this.prChanges = [];
    this.prSubTab = "threads";
    this.prThreadStatusFilter = "all";

    this.wiStatusFilter = "active";
    this.wiTypeFilter = "all";
    this.workItems = [];
    this.selectedWI = null;
    this.wiComments = [];

    this.threadInputs = new Map();
    this.submittingThreadId = null;

    this.wiCommentInput = InputState.new({ placeholder: "Write a discussion comment..." });
    this.wiCommentInput.on("submit", (_e, submitCx) => {
      if (this.selectedWI) {
        this.submitWIComment(this.selectedWI.id, submitCx);
      }
    });
    this.submittingWIComment = false;

    this.loading = false;
    this.error = null;
    const initialProfile = getActiveProfile();
    this.lastProfileSignature = initialProfile ? `${initialProfile.id}:${initialProfile.user || ""}` : null;

    this.settingsView = new SettingsView({
      isDialog: this.isDialog,
      onDone: (doneCx) => {
        const overlayId = props()?.overlay || this.dialogOverlayId;
        if (overlayId) {
          closeOverlay(overlayId);
        } else {
          this.showingSettings = false;
          this.isProfileMenuOpen = false;
          const p = getActiveProfile();
          this.lastProfileSignature = p ? `${p.id}:${p.user || ""}` : null;
          const activeCx = doneCx || this.cx || cx;
          if (activeCx) {
            this.refresh(activeCx);
          }
        }
      },
    });

    if (isConfigured() && !this.isDialog) {
      this.refresh(cx);
    }

    // Refresh every 2 minutes
    cx.timer.every(120000, (timerCx) => {
      if (!this.showingSettings && isConfigured()) {
        this.refresh(timerCx);
      }
    });

    // Detect profile or target user configuration changes every second
    cx.timer.every(1000, (timerCx) => {
      if (this.isDialog || this.showingSettings || !isConfigured()) return;
      const profile = getActiveProfile();
      const currentSignature = profile ? `${profile.id}:${profile.user || ""}` : null;
      if (this.lastProfileSignature !== null && this.lastProfileSignature !== currentSignature) {
        this.lastProfileSignature = currentSignature;
        this.selectedPR = null;
        this.selectedWI = null;
        this.user = null;
        this.refresh(timerCx);
      }
    });
  }

  refresh(cx) {
    if (this.loading || !isConfigured()) return;

    const profile = getActiveProfile();
    if (!profile) {
      this.showingSettings = true;
      cx.notify();
      return;
    }

    this.loading = true;
    this.error = null;
    cx.notify();

    cx.spawn(async (spawnCx) => {
      try {
        if (!this.user) {
          try {
            this.user = await getCurrentUser(profile);
          } catch {
            // User query failed or not critical; proceed with general queries
          }
        }

        if (this.mode === "prs") {
          const prs = await getPullRequests(profile, {
            filter: this.prFilter,
            prStatus: this.prStatusFilter,
            userId: this.user?.id,
            user: profile.user,
            currentUser: this.user,
          });
          this.prs = prs;

          if (this.selectedPR) {
            const updated = prs.find((p) => p.id === this.selectedPR.id) || this.selectedPR;
            await this.loadPRDetails(updated, spawnCx);
          }
        } else {
          const items = await getAssignedWorkItems(profile, {
            status: this.wiStatusFilter,
            type: this.wiTypeFilter,
          });
          this.workItems = items;

          if (this.selectedWI) {
            const updated = items.find((i) => i.id === this.selectedWI.id) || this.selectedWI;
            await this.loadWIDetails(updated, spawnCx);
          }
        }
      } catch (err) {
        this.error = err.message || String(err);
      } finally {
        this.loading = false;
        spawnCx.notify();
      }
    });
  }

  async loadPRDetails(pr, cx) {
    const profile = getActiveProfile();
    if (!profile) return;

    try {
      const [threads, changes] = await Promise.all([
        getPullRequestThreads(profile, {
          repositoryId: pr.repositoryId,
          pullRequestId: pr.id,
        }),
        getPullRequestChanges(profile, {
          repositoryId: pr.repositoryId,
          pullRequestId: pr.id,
        }),
      ]);
      this.selectedPR = pr;
      this.prThreads = threads;
      this.prChanges = changes;

      // Pre-allocate thread reply inputs outside render
      for (const th of threads) {
        if (!this.threadInputs.has(th.id)) {
          const inp = InputState.new({ placeholder: "Reply to this thread..." });
          inp.on("submit", (_e, submitCx) => this.submitPRReply(th.id, submitCx));
          this.threadInputs.set(th.id, inp);
        }
      }
    } catch (err) {
      this.error = `Failed to load PR details: ${err.message || String(err)}`;
    } finally {
      cx.notify();
    }
  }

  submitPRReply(threadId, cx) {
    if (this.submittingThreadId || !this.selectedPR) return;
    const inputState = this.threadInputs.get(threadId);
    if (!inputState) return;
    const content = inputState.value().trim();
    if (!content) return;

    const profile = getActiveProfile();
    if (!profile) return;

    this.submittingThreadId = threadId;
    this.error = null;
    const activeCx = cx || this.cx;
    activeCx?.notify();

    activeCx?.spawn(async (spawnCx) => {
      try {
        await postPullRequestThreadComment(profile, {
          repositoryId: this.selectedPR.repositoryId,
          pullRequestId: this.selectedPR.id,
          threadId,
          content,
        });
        inputState.set_value("");
        try {
          notify({
            title: "Reply Posted",
            body: content.length > 50 ? `${content.slice(0, 47)}...` : content,
            level: "info",
          });
        } catch {
          // Toast is non-critical feedback
        }
        await this.loadPRDetails(this.selectedPR, spawnCx);
      } catch (err) {
        this.error = `Failed to post reply: ${err.message || String(err)}`;
      } finally {
        this.submittingThreadId = null;
        spawnCx.notify();
      }
    });
  }

  submitWIComment(workItemId, cx) {
    if (this.submittingWIComment || !this.selectedWI) return;
    const content = this.wiCommentInput.value().trim();
    if (!content) return;

    const profile = getActiveProfile();
    if (!profile) return;

    this.submittingWIComment = true;
    this.error = null;
    const activeCx = cx || this.cx;
    activeCx?.notify();

    activeCx?.spawn(async (spawnCx) => {
      try {
        await postWorkItemComment(profile, {
          workItemId,
          text: content,
        });
        this.wiCommentInput.set_value("");
        try {
          notify({
            title: "Comment Posted",
            body: content.length > 50 ? `${content.slice(0, 47)}...` : content,
            level: "info",
          });
        } catch {
          // Toast is non-critical feedback
        }
        await this.loadWIDetails(this.selectedWI, spawnCx);
      } catch (err) {
        this.error = `Failed to post comment: ${err.message || String(err)}`;
      } finally {
        this.submittingWIComment = false;
        spawnCx.notify();
      }
    });
  }

  async loadWIDetails(item, cx) {
    const profile = getActiveProfile();
    if (!profile) return;

    try {
      const detail = await getWorkItemDetail(profile, item.id);
      this.selectedWI = detail.item;
      this.wiComments = detail.comments;
    } catch (err) {
      this.error = `Failed to load Work Item details: ${err.message || String(err)}`;
    } finally {
      cx.notify();
    }
  }

  switchProfile(profileId, cx) {
    setActiveProfile(profileId);
    const profile = getActiveProfile();
    this.lastProfileSignature = profile ? `${profile.id}:${profile.user || ""}` : null;
    this.isProfileMenuOpen = false;
    this.selectedPR = null;
    this.selectedWI = null;
    this.agentPicker = null;
    this.user = null;
    this.prs = [];
    this.workItems = [];
    this.refresh(cx);
  }

  /**
   * Routes a "Solve with Agent" task per `planAgentRouting`: declined if the configured runner
   * is `agy`; auto-sent to a lone idle agent; otherwise opens the idle-agent picker. Never
   * drives `agy` in any path.
   *
   * @param {Object} params
   * @param {string} params.title Tab/context title.
   * @param {string} params.prompt Formatted, hardened agent prompt.
   */
  beginSolve({ title, prompt }) {
    // A fresh solve request always supersedes any previously opened picker.
    this.agentPicker = null;
    try {
      const currentSpace = focused()?.space ?? null;
      const { blockedByAgy, idleAgents } = planAgentRouting({
        agent: loadConfig().agent,
        currentSpace,
      });

      if (blockedByAgy) {
        notify({
          title: "Can't drive Antigravity (agy) here",
          body: "Run 'agy -p' directly, or use a Gemini Enterprise / AI Studio API key.",
          level: "warning",
        });
        return;
      }

      if (idleAgents.length === 1) {
        sendToTerminal({ terminal: idleAgents[0].terminal, prompt });
        return;
      }

      if (idleAgents.length > 1) {
        this.agentPicker = { title, prompt, candidates: idleAgents };
        notify({
          title: `${idleAgents.length} idle agents available for ${title}`,
          body: "Pick one to solve it.",
        });
        this.cx?.notify();
        return;
      }

      // No idle agent to route to: spawn a fresh tab with the configured runner. (If the
      // configured runner is `agy`/`antigravity`, `blockedByAgy` above already declined, so this
      // path only runs with a non-`agy` runner.)
      launchNewAgent({ agent: loadConfig().agent, title, prompt });
    } catch (err) {
      notify({ title: `Solve with Agent error: ${err?.message || err}`, level: "error" });
    }
  }

  render() {
    const t = theme();
    const config = loadConfig();

    const p = props() || {};
    if (this.isSidebarButton || p.role === "sidebar-button") {
      return renderSidebarButton();
    }

    const isOverlayDialog = Boolean(this.isDialog || p.role === "settings" || p.overlay);

    if (this.showingSettings || isOverlayDialog) {
      return this.settingsView.render();
    }

    const header = renderHeader({
      mode: this.mode,
      onModeChange: (nextMode) => {
        if (this.mode !== nextMode) {
          this.mode = nextMode;
          this.selectedPR = null;
          this.selectedWI = null;
          this.agentPicker = null;
          this.error = null;
          this.isProfileMenuOpen = false;
          this.refresh(this.cx || { notify: () => {} });
        }
      },
      onRefresh: (cx) => this.refresh(cx),
      onOpenSettings: (openCx) => {
        this.showingSettings = true;
        this.isProfileMenuOpen = false;
        const activeCx = openCx || this.cx;
        if (activeCx) {
          activeCx.notify();
        }
      },
      onOpenAsTab: () => {
        run("tab.new", { name: "Azure DevOps", mod: "azure-devops" });
      },
      onSplitPane: () => {
        run("pane.split", { direction: "right", mod: "azure-devops" });
      },
      loading: this.loading,
      profiles: config.profiles,
      activeProfileId: config.activeProfileId,
      onSelectProfile: (profileId) => {
        this.switchProfile(profileId, this.cx || { notify: () => {} });
      },
      isProfileMenuOpen: this.isProfileMenuOpen,
      onToggleProfileMenu: () => {
        this.isProfileMenuOpen = !this.isProfileMenuOpen;
      },
    });

    const errorBanner = this.error
      ? v_flex()
          .w_full()
          .p(10)
          .bg(t.status?.blocked || "#421818")
          .border_b(1)
          .border_color(t.border)
          .gap(4)
          .child(
            div()
              .text_size(12)
              .text_color(t.foreground)
              .child(this.error)
          )
          .child(
            h_flex()
              .gap(6)
              .items_center()
              .child(
                h_flex()
                  .h(22)
                  .px(6)
                  .items_center()
                  .rounded(4)
                  .bg(t.chrome)
                  .text_size(11)
                  .text_color(t.muted)
                  .hover((s) => s.bg(t.hover).text_color(t.foreground))
                  .on_click((_e, cx) => this.refresh(cx))
                  .child("Retry")
              )
          )
      : null;

    let content;
    if (this.agentPicker) {
      content = renderAgentPicker({
        title: this.agentPicker.title,
        candidates: this.agentPicker.candidates,
        onSelect: (terminal) => {
          const pending = this.agentPicker;
          this.agentPicker = null;
          if (pending) sendToTerminal({ terminal, prompt: pending.prompt });
          this.cx?.notify();
        },
        onCancel: () => {
          this.agentPicker = null;
          this.cx?.notify();
        },
      });
    } else if (this.mode === "prs") {
      if (this.selectedPR) {
        content = renderPRDetail({
          pr: this.selectedPR,
          threads: this.prThreads,
          changes: this.prChanges,
          subTab: this.prSubTab,
          threadStatus: this.prThreadStatusFilter,
          getThreadInput: (id) => this.threadInputs.get(id),
          onReplyThread: (id, cx) => this.submitPRReply(id, cx),
          submittingThreadId: this.submittingThreadId,
          onThreadStatusChange: (status) => {
            this.prThreadStatusFilter = status;
            this.cx?.notify();
          },
          onSubTabChange: (tab, cx) => {
            this.prSubTab = tab;
            const activeCx = cx || this.cx;
            if (activeCx) activeCx.notify();
          },
          onBack: (_e, cx) => {
            this.selectedPR = null;
            const activeCx = cx || this.cx;
            if (activeCx) activeCx.notify();
          },
          onSolvePR: (pr) => {
            this.beginSolve({ title: `PR #${pr.id}`, prompt: formatPRPrompt(pr) });
          },
          onSolveThread: (thread, pr) => {
            this.beginSolve({
              title: `PR #${pr.id} Comment`,
              prompt: formatPRThreadPrompt({ thread, pr }),
            });
          },
        });
      } else {
        content = renderPRList({
          prs: this.prs,
          filter: this.prFilter,
          status: this.prStatusFilter,
          onFilterChange: (f) => {
            this.prFilter = f;
            this.refresh(this.cx || { notify: () => {} });
          },
          onStatusChange: (s) => {
            this.prStatusFilter = s;
            this.refresh(this.cx || { notify: () => {} });
          },
          onSelectPR: (pr, cx) => {
            const activeCx = cx || this.cx;
            activeCx?.spawn((spawnCx) => this.loadPRDetails(pr, spawnCx));
          },
          loading: this.loading,
        });
      }
    } else {
      if (this.selectedWI) {
        content = renderWIDetail({
          item: this.selectedWI,
          comments: this.wiComments,
          commentInput: this.wiCommentInput,
          onPostComment: (id, cx) => this.submitWIComment(id, cx),
          submittingComment: this.submittingWIComment,
          onBack: (_e, cx) => {
            this.selectedWI = null;
            const activeCx = cx || this.cx;
            if (activeCx) activeCx.notify();
          },
          onSolveWithAgent: (item, comments) => {
            const prompt = formatWorkItemPrompt({ item, comments });
            dispatchAgentTask({
              title: `Work Item #${item.id}`,
              prompt,
            });
          },
        });
      } else {
        content = renderWIList({
          items: this.workItems,
          status: this.wiStatusFilter,
          type: this.wiTypeFilter,
          onStatusChange: (s) => {
            this.wiStatusFilter = s;
            this.refresh(this.cx || { notify: () => {} });
          },
          onTypeChange: (tp) => {
            this.wiTypeFilter = tp;
            this.refresh(this.cx || { notify: () => {} });
          },
          onSelectItem: (item, cx) => {
            const activeCx = cx || this.cx;
            activeCx?.spawn((spawnCx) => this.loadWIDetails(item, spawnCx));
          },
          loading: this.loading,
        });
      }
    }

    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .child(header)
      .when(Boolean(errorBanner), (el) => el.child(errorBanner))
      .child(v_flex().flex_1().w_full().min_h(0).child(content));
  }
}
