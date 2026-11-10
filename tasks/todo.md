# Tasks: Herdr Azure DevOps Mod (`herdr-mod-azure-devops`)

- [x] Task 1: Initialize Mod Scaffolding and Assets
  - Acceptance: Mod manifest `mod.json` registered, TypeScript definition files copied, SVG icons created for branding and navigation.
  - Verify: Directory contains `mod.json`, `gpui-kit.d.ts`, `herdr.d.ts`, and `assets/*.svg`.
  - Files: `mod.json`, `jsconfig.json`, `assets/ado.svg`, `assets/pr.svg`, `assets/wi.svg`, `assets/settings.svg`

- [x] Task 2: Implement Configuration Storage and Manager
  - Acceptance: `src/config.js` can read and write organization URL, project name, and preferred agent to mod storage, and accurately detect if onboarding is needed.
  - Verify: Unit test / execution verifying config read/write roundtrip and fallback defaults.
  - Files: `src/config.js`

- [x] Task 3: Implement Zero-PAT Authentication Provider
  - Acceptance: `src/auth.js` retrieves Azure CLI Bearer tokens using `exec("az", ...)`, caches them until expiration, and surfaces actionable error messages if `az login` is required.
  - Verify: Execution of token retrieval test against local `az` CLI.
  - Files: `src/auth.js`

- [x] Task 4: Implement Azure DevOps REST API Client
  - Acceptance: `src/client.js` wraps native `fetch()` calls to query current user profile, pull requests (assigned/created), PR threads, iterations/changes, and assigned work items via WIQL.
  - Verify: Code syntax verification and query parameter testing.
  - Files: `src/client.js`

- [x] Task 5: Implement In-Panel Settings & Onboarding View
  - Acceptance: `src/views/settings.js` provides GPUI input fields for Organization URL, Project, and Agent runner, with validation and save button updating `src/config.js`.
  - Verify: View renders input states and dispatches save notification.
  - Files: `src/views/settings.js`

- [x] Task 6: Implement Common Components (Header & Status Badges)
  - Acceptance: `src/components/header.js` renders view tabs (PRs vs. Work Items), refresh action, and settings toggle; `src/components/status-badge.js` renders styled badges.
  - Verify: Components render without styling or layout errors.
  - Files: `src/components/header.js`, `src/components/status-badge.js`

- [x] Task 7: Implement Pull Requests Views (List, Detail, Threads, Changes)
  - Acceptance: `src/views/pr-list.js` lists active PRs; `src/views/pr-detail.js` displays overview and files changed; `src/views/pr-threads.js` displays nested comment threads.
  - Verify: PR list and details render correctly with drill-down navigation.
  - Files: `src/views/pr-list.js`, `src/views/pr-detail.js`, `src/views/pr-threads.js`

- [x] Task 8: Implement Work Items Views (List & Detail)
  - Acceptance: `src/views/wi-list.js` displays assigned work items; `src/views/wi-detail.js` shows description, discussion comments, and metadata.
  - Verify: Work item views render and respond to selection.
  - Files: `src/views/wi-list.js`, `src/views/wi-detail.js`

- [x] Task 9: Implement Agent Delegation Bridge
  - Acceptance: `src/agent.js` formats PR thread comments and Work Item descriptions into structured prompts and dispatches to Herdr via `tab.new` or `hc send`.
  - Verify: "Solve with Agent" button triggers `dispatchAgentTask()` with expected payload.
  - Files: `src/agent.js`

- [x] Task 10: Implement Root Coordinator View and Mod Check
  - Acceptance: `main.js` connects all views, handles routing, and responds to loading/error states. `herdr-app check` passes with zero errors.
  - Verify: `herdr-app check .` exits with code 0.
  - Files: `main.js`
