import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { theme } from "herdr";
import { loadConfig, isConfigured } from "./src/config.js";
import {
  getCurrentUser,
  getPullRequests,
  getPullRequestThreads,
  getPullRequestChanges,
  getAssignedWorkItems,
  getWorkItemDetail,
} from "./src/client.js";
import {
  formatPRThreadPrompt,
  formatPRPrompt,
  formatWorkItemPrompt,
  dispatchAgentTask,
} from "./src/agent.js";
import { renderHeader } from "./src/components/header.js";
import { SettingsView } from "./src/views/settings.js";
import { renderPRList } from "./src/views/pr-list.js";
import { renderPRDetail } from "./src/views/pr-detail.js";
import { renderWIList } from "./src/views/wi-list.js";
import { renderWIDetail } from "./src/views/wi-detail.js";

export default class AzureDevOpsMod extends View {
  init(_props, cx) {
    this.cx = cx;
    this.mode = "prs"; // "prs" | "workitems"
    this.showingSettings = !isConfigured();

    this.user = null;
    this.prFilter = "assigned";
    this.prs = [];
    this.selectedPR = null;
    this.prThreads = [];
    this.prChanges = [];
    this.prSubTab = "threads";

    this.workItems = [];
    this.selectedWI = null;
    this.wiComments = [];

    this.loading = false;
    this.error = null;

    this.settingsView = new SettingsView({
      onDone: () => {
        this.showingSettings = false;
        this.refresh(cx);
      },
    });

    if (isConfigured()) {
      this.refresh(cx);
    }

    // Refresh every 2 minutes
    cx.timer.every(120000, (timerCx) => {
      if (!this.showingSettings && isConfigured()) {
        this.refresh(timerCx);
      }
    });
  }

  refresh(cx) {
    if (this.loading || !isConfigured()) return;

    const config = loadConfig();
    this.loading = true;
    this.error = null;
    cx.notify();

    cx.spawn(async (spawnCx) => {
      try {
        if (!this.user) {
          try {
            this.user = await getCurrentUser(config);
          } catch {
            // User query failed or not critical; proceed with general queries
          }
        }

        if (this.mode === "prs") {
          const prs = await getPullRequests(config, {
            filter: this.prFilter,
            userId: this.user?.id,
          });
          this.prs = prs;

          // If a PR was selected, refresh its details
          if (this.selectedPR) {
            const updated = prs.find((p) => p.id === this.selectedPR.id) || this.selectedPR;
            await this.loadPRDetails(updated, spawnCx);
          }
        } else {
          const items = await getAssignedWorkItems(config);
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
    const config = loadConfig();
    try {
      const [threads, changes] = await Promise.all([
        getPullRequestThreads(config, {
          repositoryId: pr.repositoryId,
          pullRequestId: pr.id,
        }),
        getPullRequestChanges(config, {
          repositoryId: pr.repositoryId,
          pullRequestId: pr.id,
        }),
      ]);
      this.selectedPR = pr;
      this.prThreads = threads;
      this.prChanges = changes;
    } catch (err) {
      this.error = `Failed to load PR details: ${err.message || String(err)}`;
    } finally {
      cx.notify();
    }
  }

  async loadWIDetails(item, cx) {
    const config = loadConfig();
    try {
      const detail = await getWorkItemDetail(config, item.id);
      this.selectedWI = detail.item;
      this.wiComments = detail.comments;
    } catch (err) {
      this.error = `Failed to load Work Item details: ${err.message || String(err)}`;
    } finally {
      cx.notify();
    }
  }

  render() {
    const t = theme();
    const config = loadConfig();

    if (this.showingSettings) {
      return this.settingsView.render();
    }

    const header = renderHeader({
      mode: this.mode,
      onModeChange: (nextMode) => {
        if (this.mode !== nextMode) {
          this.mode = nextMode;
          this.selectedPR = null;
          this.selectedWI = null;
          this.error = null;
          this.refresh(this.cx || { notify: () => {} });
        }
      },
      onRefresh: (cx) => this.refresh(cx),
      onOpenSettings: () => {
        this.showingSettings = true;
      },
      loading: this.loading,
      project: config.project,
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
    if (this.mode === "prs") {
      if (this.selectedPR) {
        content = renderPRDetail({
          pr: this.selectedPR,
          threads: this.prThreads,
          changes: this.prChanges,
          subTab: this.prSubTab,
          onSubTabChange: (tab) => {
            this.prSubTab = tab;
          },
          onBack: () => {
            this.selectedPR = null;
          },
          onSolvePR: (pr) => {
            const prompt = formatPRPrompt(pr);
            dispatchAgentTask({ title: `PR #${pr.id}`, prompt });
          },
          onSolveThread: (thread, pr) => {
            const prompt = formatPRThreadPrompt({ thread, pr });
            dispatchAgentTask({
              title: `PR #${pr.id} Comment`,
              prompt,
            });
          },
        });
      } else {
        content = renderPRList({
          prs: this.prs,
          filter: this.prFilter,
          onFilterChange: (f) => {
            this.prFilter = f;
            this.refresh(this.cx || { notify: () => {} });
          },
          onSelectPR: (pr) => {
            this.cx?.spawn((cx) => this.loadPRDetails(pr, cx));
          },
          loading: this.loading,
        });
      }
    } else {
      if (this.selectedWI) {
        content = renderWIDetail({
          item: this.selectedWI,
          comments: this.wiComments,
          onBack: () => {
            this.selectedWI = null;
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
          onSelectItem: (item) => {
            this.cx?.spawn((cx) => this.loadWIDetails(item, cx));
          },
          loading: this.loading,
        });
      }
    }

    return v_flex()
      .size_full()
      .bg(t.chrome)
      .child(header)
      .when(Boolean(errorBanner), (el) => el.child(errorBanner))
      .child(div().flex_1().w_full().child(content));
  }
}
