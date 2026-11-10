# Implementation Plan: Herdr Azure DevOps Mod (`herdr-mod-azure-devops`)

## 1. Architecture & Component Decomposition

The project is split into four distinct tiers:

1. **Manifest & Types (Tier 0):**
   - Mod declaration (`mod.json`) for Herdr integration.
   - GPUI and Herdr TypeScript definition files (`gpui-kit.d.ts`, `herdr.d.ts`) enabling type checking and editor completion.
   - SVG vector assets for branding, navigation, and item indicators.

2. **Core Services (Tier 1):**
   - `src/config.js`: Configuration loader and persistent storage for Organization URL, Project, and preferred Agent.
   - `src/auth.js`: Token manager executing `az account get-access-token` via Herdr's `exec()` host API with in-memory caching and automatic expiration refresh.
   - `src/client.js`: Asynchronous HTTP client wrapping native `fetch()` against Azure DevOps REST API v7.1.
   - `src/agent.js`: Task prompt generator and Herdr agent dispatcher (`tab.new` and `hc send`).

3. **Views and Presentation (Tier 2):**
   - `src/components/header.js`: Top control bar with view toggle (PRs vs. Work Items), refresh trigger, and settings launcher.
   - `src/components/status-badge.js`: Status indicators (Active, Completed, Abandoned, Resolved).
   - `src/views/settings.js`: Onboarding and settings editor with input validation and save handling.
   - `src/views/pr-list.js`: Master list of Pull Requests with sub-filtering (Assigned vs. Created).
   - `src/views/pr-detail.js` and `src/views/pr-threads.js`: PR details, thread comments tree, changes file list, and "Solve with Agent" action.
   - `src/views/wi-list.js` and `src/views/wi-detail.js`: Work item master list and detail viewer (description, discussion history, agent task action).

4. **Root Coordinator (Tier 3):**
   - `main.js`: Main GPUI `View` class coordinating routing between Settings, PRs, and Work Items, with asynchronous data loading and error boundary handling.

---

## 2. Implementation Order

```
[Tier 0: Scaffolding & Manifest]
               │
               ▼
   [Tier 1: Auth & REST Client]
               │
               ▼
[Tier 2A: Settings & Onboarding]
               │
               ▼
 [Tier 2B: PR & Work Item Views]
               │
               ▼
[Tier 2C: Agent Integration Bridge]
               │
               ▼
  [Tier 3: Main View Orchestrator]
               │
               ▼
    [Tier 4: Verification]
```

1. **Step 1: Scaffolding & Definitions**
   Establish directory layout, copy `.d.ts` types from Herdr, create `mod.json` and basic SVGs.
2. **Step 2: Core Auth & Configuration**
   Build `src/config.js` and `src/auth.js`. Verify `az` CLI token acquisition.
3. **Step 3: ADO REST Client**
   Build `src/client.js` with methods for current user identity, PRs, iterations, threads, and WIQL queries.
4. **Step 4: Onboarding / Settings View**
   Build `src/views/settings.js` allowing users to configure Org URL and Project interactively.
5. **Step 5: Pull Requests & Threads Views**
   Build `src/views/pr-list.js`, `src/views/pr-detail.js`, and `src/views/pr-threads.js`.
6. **Step 6: Work Items Views**
   Build `src/views/wi-list.js` and `src/views/wi-detail.js`.
7. **Step 7: Agent Bridge**
   Build `src/agent.js` providing "Solve with Agent" functionality.
8. **Step 8: Root View & Error Handling**
   Tie all components together in `main.js`.
9. **Step 9: Testing & Verification**
   Run `herdr-app check`, verify both tab and sidebar integration, and test with live/mock configurations.

---

## 3. Risks and Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Azure CLI not logged in or expired token | API calls return 401 or `exec("az")` fails | Catch auth errors explicitly; display an inline banner prompting user to run `az login` in a terminal. |
| Large PR diffs or thread count | UI stutter or GPUI rendering lag | Use virtualized lists (`v_virtual_list`) for long file lists and thread comments. |
| Incomplete user configuration | Runtime crashes on missing Org/Project | Gate the main view: if `config.isComplete()` is false, display `views/settings.js` automatically. |
| ADO API rate limiting or network latency | Blocked UI thread | Perform all HTTP requests inside `cx.spawn()`, with animated loading state. |

---

## 4. Verification Checkpoints

- **Checkpoint 1 (Scaffolding):** `mod.json` and types valid; `herdr-app check` loads mod without structural errors.
- **Checkpoint 2 (Auth & Config):** Settings can be saved to disk; `getAccessToken()` retrieves valid OAuth token.
- **Checkpoint 3 (UI & Navigation):** Settings, PR list, and Work Item views render cleanly in GPUI.
- **Checkpoint 4 (End-to-End):** Mod renders in Herdr sidebar and as a standalone tab; clicking "Solve with Agent" spawns a new agent tab.
