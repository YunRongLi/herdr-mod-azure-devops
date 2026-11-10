# Herdr Azure DevOps Mod

Native Azure DevOps panel mod for the [Herdr](https://github.com/herdr-org/herdr) desktop application.

Monitor, inspect, and interact with Azure DevOps Pull Requests and Work Items directly alongside your workspaces and terminals, with Zero-PAT authentication (Azure CLI Bearer tokens) and one-click agent delegation.

## Features

- Zero External Runtimes: Pure JavaScript (ES Modules). No Python, Node.js, or npm dependencies.
- Zero-PAT Policy: Transparently uses your host `az login` OAuth session.
- First-Use Onboarding: In-panel settings configuration view to set Organization URL and Project.
- Pull Requests Inspector:
  - Filter by "Assigned to Me" and "Created by Me".
  - Drill down into review comment threads with file paths and line numbers.
  - Inspect modified files list.
- Work Items Tracker:
  - Query active assigned Work Items.
  - View full descriptions and discussion comments.
- One-Click Agent Delegation:
  - "Solve with Agent" dispatches formatted task prompts directly into a new Herdr agent tab (`tab.new`) or active terminal (`hc send`).

## Installation

### Linux
Symlink this repository into your Herdr mods directory:
```bash
ln -s "$(pwd)" ~/.config/herdr-app/mods/azure-devops
```

### Windows (PowerShell)
```powershell
New-Item -ItemType SymbolicLink -Path "$HOME\.config\herdr-app\mods\azure-devops" -Target (Get-Location)
```

## Validation

Verify mod structure using the Herdr CLI:
```bash
herdr-app check ~/.config/herdr-app/mods/azure-devops
```

## Open in Herdr

- As a Standalone Tab:
  ```bash
  herdr-app do tab.new '{"name":"Azure DevOps","mod":"azure-devops"}'
  ```
- As a Split Pane:
  ```bash
  herdr-app do pane.split '{"direction":"right","mod":"azure-devops"}'
  ```
- Or dock into your layout sidebar `panel-body` stack.
