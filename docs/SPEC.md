# Specification: Herdr Azure DevOps Mod (`herdr-mod-azure-devops`)

## 1. Objective
Build a standalone, single-repository native Herdr mod in Pure JavaScript (ES Modules) targeting Linux first. The mod enables engineers and AI coding agents to monitor, inspect, and interact with Azure DevOps (ADO) Pull Requests and Work Items directly inside Herdr without requiring external Python or Node.js runtimes.

Authentication is strictly Zero-PAT, utilizing short-lived Azure CLI OAuth Bearer tokens (`az account get-access-token`). Network operations are handled natively via `fetch()` against Azure DevOps REST API v7.1.

On first launch, if configuration is missing, the mod presents an in-panel Settings / Onboarding page prompting for the Azure DevOps Organization URL, target Project, and default Agent runner, persisting settings to mod storage.

---

## 2. Tech Stack & Environment
- Runtime: Herdr Desktop Application (GPUI native UI runtime, non-DOM).
- Target OS: Linux first (Ubuntu / Debian / Fedora / Arch desktop environments).
- Language: Pure JavaScript (ECMAScript 2022+ ESM).
- Host Tools: Azure CLI (`az`) with active `az login` session.
- Dependencies: Zero external runtime packages. No Python, Node.js, npm, or virtual environments required.

---

## 3. Commands
- Check Mod Integrity:
  ```bash
  herdr-app check ~/.config/herdr-app/mods/azure-devops
  ```
- Symlink Mod to Herdr (Linux):
  ```bash
  ln -s "$(pwd)" ~/.config/herdr-app/mods/azure-devops
  ```
- Symlink Mod to Herdr (Windows / PowerShell):
  ```powershell
  New-Item -ItemType SymbolicLink -Path "$HOME\.config\herdr-app\mods\azure-devops" -Target (Get-Location)
  ```
- Capture Screen Snapshot:
  ```bash
  herdr-app shot ado-panel.png
  ```
- Launch Mod as Standalone Tab:
  ```bash
  herdr-app do tab.new '{"name":"Azure DevOps","mod":"azure-devops"}'
  ```

---

## 4. Project Structure
```text
herdr-mod-azure-devops/
├── docs/
│   └── SPEC.md                  # Feature and design specification
├── mod.json                     # Herdr mod manifest ("place": "none", "focusable": true)
├── main.js                      # Root GPUI entry point, routing, and state manager
├── jsconfig.json                # Language server / VS Code editor configuration
├── gpui-kit.d.ts                # GPUI type definitions
├── herdr.d.ts                   # Herdr API definitions
├── src/
│   ├── auth.js                  # Token acquisition via az CLI exec
│   ├── client.js                # ADO REST API v7.1 client (native fetch)
│   ├── config.js                # Settings persistence and loader
│   ├── agent.js                 # Agent prompt formatter and tab.new dispatcher
│   ├── views/
│   │   ├── settings.js          # In-panel settings & onboarding configuration
│   │   ├── pr-list.js           # Pull requests list (assigned / mine)
│   │   ├── pr-detail.js         # PR overview, description, and file changes
│   │   ├── pr-threads.js        # PR review comment threads
│   │   ├── wi-list.js           # Work items list (assigned to me)
│   │   └── wi-detail.js         # Work item description and discussion comments
│   └── components/
│       ├── header.js            # Top bar navigation, mode tabs, and settings toggle
│       └── status-badge.js      # Status indicators (Active, Completed, Abandoned)
└── assets/
    ├── ado.svg                  # Azure DevOps branding icon
    ├── pr.svg                   # Pull request icon
    ├── wi.svg                   # Work item icon
    └── settings.svg             # Settings gear icon
```

---

## 5. Architectural Contracts

### A. First-Use Onboarding & Settings (`src/config.js` & `src/views/settings.js`)
- On startup, `src/config.js` loads the configuration.
- If `organization` or `project` is empty, the root view switches immediately to `views/settings.js`.
- The user can input:
  1. Organization URL (e.g., `https://dev.azure.com/MyOrg`)
  2. Default Project name (e.g., `ProjectAlpha`)
  3. Preferred Agent executable (default: `claude` or `cursor-agent`)
- Settings are saved to mod storage and editable at any time via a gear icon in the header.

### B. Authentication (`src/auth.js`)
Zero-PAT enforcement using host Azure CLI session:
```javascript
import { exec } from "herdr";

export async function getAccessToken() {
  const res = await exec("az", [
    "account", "get-access-token",
    "--resource", "499b84ac-1321-427f-aa17-267ca6975798",
    "-o", "json"
  ]);
  if (res.code !== 0) {
    throw new Error(res.stderr || "Azure CLI authentication failed. Run 'az login' on the host.");
  }
  const parsed = JSON.parse(res.stdout);
  return parsed.accessToken;
}
```

### C. ADO REST Client (`src/client.js`)
Wraps native `fetch()` calls adding `Authorization: Bearer <token>` and `Content-Type: application/json`.
Primary endpoints:
- Current user identity: `GET https://vssps.dev.azure.com/{org}/_apis/profile/profiles/me?api-version=7.1`
- Pull Requests: `GET https://dev.azure.com/{org}/{project}/_apis/git/pullrequests?searchCriteria.creatorId={id}&api-version=7.1` and `searchCriteria.reviewerId={id}`
- PR Review Threads: `GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/threads?api-version=7.1`
- PR Iterations / Changes: `GET https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/iterations?api-version=7.1`
- Work Items WIQL: `POST https://dev.azure.com/{org}/{project}/_apis/wit/wiql?api-version=7.1`
- Work Item Details: `GET https://dev.azure.com/{org}/{project}/_apis/wit/workitems/{id}?$expand=all&api-version=7.1`

### D. Agent Interaction Bridge (`src/agent.js`)
Formats context into instructions for Herdr coding agents and dispatches:
- Launch in new agent tab:
  ```javascript
  import { run } from "herdr";
  export function dispatchAgentTask({ title, prompt, agent = "claude" }) {
    run("tab.new", { name: title, argv: [agent], task: prompt });
  }
  ```
- Send to focused terminal:
  ```javascript
  import { exec, focused } from "herdr";
  export async function sendToFocusedTerminal(prompt) {
    const f = focused();
    if (f?.terminal) {
      await exec("hc", ["send", f.terminal, prompt]);
    }
  }
  ```

---

## 6. Code Style & Patterns
- Declarative GPUI chaining using `div()`, `v_flex()`, `h_flex()`, `Input()`, and `Button()`.
- Explicit state management using `cx.notify()` after async updates.
- All asynchronous calls executed inside `cx.spawn(async (cx) => { ... })`.
- No DOM APIs, no `window`, no `document`, and no `setTimeout` (use `cx.timer`).

---

## 7. Testing Strategy
- Structural Integrity: Validate with `herdr-app check ~/.config/herdr-app/mods/azure-devops`.
- Multi-Container Verification:
  - Sidebar docking: Verified inside `layouts/main.json` `panel-body`.
  - Independent tab: Verified via `tab.new { mod: "azure-devops" }`.
- Error Recovery: Test behavior when Azure CLI token is expired or network is offline.
- Snapshot Auditing: Generate rendering screenshots via `herdr-app shot`.

---

## 8. Boundaries
- Always:
  - Run `herdr-app check` before declaring any milestone completed.
  - Preserve responsive, non-blocking UI during network latency.
  - Mask or sanitize sensitive data in error views.
- Ask First:
  - Modifying user layout JSON files (`layouts/main.json`) to insert hardcoded buttons.
- Never:
  - Accept, store, or prompt for Personal Access Tokens (PAT).
  - Use synchronous loops or blocking operations on the GPUI thread.
  - Rely on Node.js or Python runtime binaries.

---

## 9. Success Criteria
- [x] Architecture approved: Pure JavaScript (ESM) in a single standalone repo.
- [ ] Onboarding view prompts for Org URL and Project when unconfigured.
- [ ] Successfully queries and renders active PRs (assigned / created).
- [ ] Displays PR review threads with author names and resolution status.
- [ ] Displays PR changed files list.
- [ ] Queries and renders assigned Work Items with full descriptions and comments.
- [ ] "Solve with Agent" button opens a new Herdr agent tab with full context.
- [ ] Passes `herdr-app check` without warnings or syntax errors.
