# Herdr Azure DevOps Mod

Native Azure DevOps panel mod for the [Herdr](https://github.com/herdr-org/herdr) desktop application.

Monitor, inspect, and interact with Azure DevOps Pull Requests and Work Items directly alongside your workspaces and terminals, with Zero-PAT authentication (Azure CLI Bearer tokens) and one-click agent delegation.

## Features

- Zero External Runtimes: Pure JavaScript (ES Modules). No Python, Node.js, or npm dependencies.
- Zero-PAT Policy: Transparently uses your host `az login` OAuth session.
- First-Use Onboarding: In-panel settings configuration view to set Organization URL and Project.
- Sidebar Navigation Integration: Dockable navigation button in the left sidebar alongside Spaces and Agents that auto-opens or switches to your Azure DevOps tab.
- Pull Requests Inspector:
  - Filter by "Assigned to Me" and "Created by Me".
  - Drill down into review comment threads with file paths and line numbers.
  - Inspect modified files list.
- Work Items Tracker:
  - Query active assigned Work Items.
  - View full descriptions and discussion comments.
- One-Click Agent Delegation:
  - "Solve with Agent" formats a PR/thread/work-item prompt and routes it to a coding agent.
  - Routes to an existing **idle** agent (via `hc send`) when one is available, otherwise spawns a
    new Herdr agent tab (`tab.new`) running your preferred executable.
  - When several idle agents are available, an inline picker lets you choose one (same-space
    agent pre-selected); a single idle agent is used automatically.
  - **Never drives Antigravity** (`agy` / `antigravity`) under a consumer plan — see below.

## Quick Install (Automated)

The installation scripts automatically link the mod, non-destructively patch the active custom layout (preserving any existing mods or user customizations), and activate it immediately—without modifying any of Herdr's read-only shipped files:

### Linux / macOS
```bash
git clone https://github.com/YunRongLi/herdr-mod-azure-devops.git ~/herdr-mod-azure-devops
cd ~/herdr-mod-azure-devops
./install.sh
```

Advanced options for multi-mod setups:
```bash
# Integrate into a specific custom layout:
./install.sh --layout my-layout

# Install without switching the active layout:
./install.sh --no-switch

# Clean uninstall without affecting other mods:
./install.sh --uninstall
```

### Windows (PowerShell)
```powershell
git clone https://github.com/YunRongLi/herdr-mod-azure-devops.git "$HOME\herdr-mod-azure-devops"
cd "$HOME\herdr-mod-azure-devops"
.\install.ps1
```

Advanced options for multi-mod setups:
```powershell
# Integrate into a specific custom layout:
.\install.ps1 -Layout "my-layout"

# Install without switching the active layout:
.\install.ps1 -NoSwitch

# Clean uninstall without affecting other mods:
.\install.ps1 -Uninstall
```

## Manual Installation (Alternative)

### 1. Symlink or copy to Herdr mods directory:
- Linux: `ln -s "$(pwd)" ~/.config/herdr-app/mods/azure-devops`
- Windows: `New-Item -ItemType SymbolicLink -Path "$HOME\.config\herdr-app\mods\azure-devops" -Target (Get-Location)`

### 2. Verify:
```bash
herdr-app check ~/.config/herdr-app/mods/azure-devops
```

### 3. Open in Herdr:
- As a Standalone Tab:
  ```bash
  herdr-app do tab.new '{"name":"Azure DevOps","mod":"azure-devops"}'
  ```
- As a Split Pane:
  ```bash
  herdr-app do pane.split '{"direction":"right","mod":"azure-devops"}'
  ```

## Solve with Agent — Routing & Guardrails

Clicking **"Solve with Agent"** on a PR or a review thread formats a hardened prompt and hands it
to a coding agent. Routing (decided purely from live agent state, then executed):

1. **Blocked → decline.** If the only way to run would be to drive Antigravity and no other idle
   agent exists, the mod declines with a notice and sends nothing.
2. **Exactly one idle agent → auto-send.** The prompt is sent straight to it (`hc send`).
3. **Multiple idle agents → picker.** An inline picker lists the idle agents (the one sharing this
   mod's space is pre-highlighted); pick one to receive the prompt.
4. **No idle agents → spawn.** A new Herdr agent tab opens running your preferred executable
   (`claude` by default) with the prompt as its first message.

**Preferred executable.** Set in Settings → *Coding Agent Integration → Preferred Agent
Executable*. Valid values are launcher names such as `claude`, `pi`, or `codex` (alphanumeric and
hyphens). `pi` is a first-class supported runner.

**Antigravity guardrail.** This is a third-party mod. Driving Antigravity/Gemini CLI (`agy` /
`antigravity`) from it under a consumer plan violates Antigravity's consumer FAQ/ToS (account
suspension risk), so the mod never wraps or drives it. An agent is treated as Antigravity when its
reported `app` or terminal `argv` contains `agy` or `antigravity`; such agents are never offered in
the picker and never auto-selected. If your preferred executable is itself `agy`/`antigravity`, the
mod only declines when there is no other idle agent to route to — if a `pi`/`claude`/`codex` agent
is idle, it is used instead. When nothing is idle and the preferred executable is `agy`/`antigravity`,
the mod reports an error (it will not spawn or drive `agy`).
