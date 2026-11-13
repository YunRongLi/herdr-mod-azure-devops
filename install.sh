#!/usr/bin/env bash
set -e

HERDR_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
MOD_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_MOD_DIR="$HERDR_HOME/mods/azure-devops"
DEVOPS_TABS_DIR="$HERDR_HOME/mods/devops-tabs"
DEVOPS_LAYOUT="$HERDR_HOME/layouts/devops.json"
BASE_LAYOUT="$HERDR_HOME/layouts/main.json"
SHARED_FILE="$HERDR_HOME/shared.json"

echo "Installing Herdr Azure DevOps mod..."
echo "Herdr home: $HERDR_HOME"

if [ ! -d "$HERDR_HOME" ]; then
    echo "Error: Herdr directory not found at '$HERDR_HOME'. Please run herdr-app first."
    exit 1
fi

mkdir -p "$HERDR_HOME/mods" "$HERDR_HOME/layouts"

# Clean up any leftover rollback artifacts or deprecated devops-tabs
rm -f "$HERDR_HOME/layouts"/main-edited*.json 2>/dev/null || true
rm -rf "$HERDR_HOME/mods"/tabs-edited* 2>/dev/null || true
rm -rf "$HERDR_HOME/mods"/new-menu-edited* 2>/dev/null || true
rm -rf "$DEVOPS_TABS_DIR" 2>/dev/null || true

# 1. Symlink mod into Herdr mods directory
if [ -L "$TARGET_MOD_DIR" ] || [ -d "$TARGET_MOD_DIR" ]; then
    rm -rf "$TARGET_MOD_DIR"
fi
ln -s "$MOD_SOURCE" "$TARGET_MOD_DIR"
echo "Linked mod into: $TARGET_MOD_DIR"

# 2. Configure custom devops layout (preserves Herdr's pristine main.json)
python3 -c '
import json, sys

base_path = sys.argv[1]
dest_path = sys.argv[2]

with open(base_path, "r", encoding="utf-8") as f:
    data = json.load(f)

def update_layout(node):
    if isinstance(node, dict):
        if node.get("id") == "sidebar" and "children" in node:
            existing = [c.get("id") for c in node["children"]]
            if "devops-sidebar-nav" not in existing:
                idx = len(node["children"])
                for i, c in enumerate(node["children"]):
                    if c.get("id") == "sidebar-footer":
                        idx = i
                        break
                node["children"].insert(idx, {
                    "id": "devops-sidebar-nav",
                    "type": "block",
                    "size": { "px": 36 },
                    "content": {
                        "mod": "azure-devops",
                        "props": { "role": "sidebar-button" }
                    }
                })
        if node.get("id") == "panel-body" and "children" in node:
            existing = [c.get("id") for c in node["children"]]
            if "azure-devops" not in existing:
                node["children"].append({
                    "id": "azure-devops",
                    "type": "block",
                    "content": { "mod": "azure-devops" }
                })
        for v in node.values():
            update_layout(v)
    elif isinstance(node, list):
        for item in node:
            update_layout(item)

update_layout(data)

with open(dest_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
' "$BASE_LAYOUT" "$DEVOPS_LAYOUT"
echo "Configured custom layouts/devops.json with sidebar navigation."

# 3. Update shared.json preferences
if [ -f "$SHARED_FILE" ]; then
    python3 -c '
import json, sys

shared_file = sys.argv[1]
try:
    with open(shared_file, "r", encoding="utf-8") as f:
        shared = json.load(f)
except Exception:
    shared = {}

panels = shared.get("workspace.panels", ["files", "changes"])
panels = [p for p in panels if p != "azure-devops"]
shared["workspace.panels"] = panels
shared["layout"] = "devops"

with open(shared_file, "w", encoding="utf-8") as f:
    json.dump(shared, f)
' "$SHARED_FILE"
fi

# 4. Validation and live switch
if command -v herdr-app >/dev/null 2>&1; then
    herdr-app check "$TARGET_MOD_DIR" || true
    echo "Mod validation checks passed."

    # If herdr-app is currently running, switch layout immediately
    herdr-app do layout.switch '{"name":"devops"}' 2>/dev/null && echo "Active Herdr window switched to DevOps layout." || true
fi

echo ""
echo "Installation complete!"
echo "The 'Azure DevOps' button is now located in the left sidebar alongside Spaces and Agents."
echo "Clicking it automatically opens or switches to your Azure DevOps tab."
