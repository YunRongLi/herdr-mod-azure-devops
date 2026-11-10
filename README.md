# Herdr Azure DevOps Mod

Native Azure DevOps panel mod for the [Herdr](https://github.com/herdr-org/herdr) desktop application.

Monitor, inspect, and interact with Azure DevOps Pull Requests and Work Items directly alongside your workspaces and terminals, with Zero-PAT authentication (Azure CLI Bearer tokens) and one-click agent delegation.

## Features

- Zero External Runtimes: Pure JavaScript (ES Modules). No Python, Node.js, or npm dependencies.
- Zero-PAT Policy: Transparently uses your host `az login` OAuth session.
- First-Use Onboarding: In-panel settings configuration view to set Organization URL and Project.
- Tab Bar Integration: Dockable sidebar with a top-bar `DevOps` button next to Files and Changes.
- Pull Requests Inspector:
  - Filter by "Assigned to Me" and "Created by Me".
  - Drill down into review comment threads with file paths and line numbers.
  - Inspect modified files list.
- Work Items Tracker:
  - Query active assigned Work Items.
  - View full descriptions and discussion comments.
- One-Click Agent Delegation:
  - "Solve with Agent" dispatches formatted task prompts directly into a new Herdr agent tab (`tab.new`) or active terminal (`hc send`).

## Quick Install (Automated)

The installation scripts automatically link the mod, register the panel block in `layouts/main.json`, and insert the `DevOps` button into your top tab bar:

### Linux / macOS
```bash
git clone https://github.com/YunRongLi/herdr-mod-azure-devops.git ~/herdr-mod-azure-devops
cd ~/herdr-mod-azure-devops
./install.sh
```

### Windows (PowerShell)
```powershell
git clone https://github.com/YunRongLi/herdr-mod-azure-devops.git "$HOME\herdr-mod-azure-devops"
cd "$HOME\herdr-mod-azure-devops"
.\install.ps1
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
