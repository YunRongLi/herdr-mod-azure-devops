#!/usr/bin/env bash
set -e

HERDR_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
MOD_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_MOD_DIR="$HERDR_HOME/mods/azure-devops"
DEVOPS_TABS_DIR="$HERDR_HOME/mods/devops-tabs"
DEVOPS_LAYOUT="$HERDR_HOME/layouts/devops.json"
BASE_LAYOUT="$HERDR_HOME/layouts/main.json"
BASE_TABS_DIR="$HERDR_HOME/mods/tabs"
SHARED_FILE="$HERDR_HOME/shared.json"

echo "Installing Herdr Azure DevOps mod..."
echo "Herdr home: $HERDR_HOME"

if [ ! -d "$HERDR_HOME" ]; then
    echo "Error: Herdr directory not found at '$HERDR_HOME'. Please run herdr-app first."
    exit 1
fi

mkdir -p "$HERDR_HOME/mods" "$HERDR_HOME/layouts"

# Clean up any leftover rollback artifacts from past broken installs
rm -f "$HERDR_HOME/layouts"/main-edited*.json 2>/dev/null || true
rm -rf "$HERDR_HOME/mods"/tabs-edited* 2>/dev/null || true
rm -rf "$HERDR_HOME/mods"/new-menu-edited* 2>/dev/null || true

# 1. Symlink mod into Herdr mods directory
if [ -L "$TARGET_MOD_DIR" ] || [ -d "$TARGET_MOD_DIR" ]; then
    rm -rf "$TARGET_MOD_DIR"
fi
ln -s "$MOD_SOURCE" "$TARGET_MOD_DIR"
echo "Linked mod into: $TARGET_MOD_DIR"

# 2. Create custom devops-tabs mod (preserves Herdr's pristine tabs mod)
rm -rf "$DEVOPS_TABS_DIR"
cp -r "$BASE_TABS_DIR" "$DEVOPS_TABS_DIR"
python3 -c '
import sys

tabs_file = sys.argv[1]
with open(tabs_file, "r", encoding="utf-8") as f:
    content = f.read()

target = ".when(enabled.includes(\"changes\"), el => el.child(panelButton(\"changes\", \"Changes\", \"mods/changes/changes.svg\")))"
button = ".when(enabled.includes(\"changes\"), el => el.child(panelButton(\"changes\", \"Changes\", \"mods/changes/changes.svg\")))\n      .child(panelButton(\"azure-devops\", \"DevOps\", \"mods/azure-devops/assets/ado.svg\"))"

if target in content and "azure-devops" not in content:
    content = content.replace(target, button, 1)
    with open(tabs_file, "w", encoding="utf-8") as f:
        f.write(content)
' "$DEVOPS_TABS_DIR/main.js"
echo "Configured custom devops-tabs mod."

# 3. Create custom devops layout (preserves Herdr's pristine main.json)
python3 -c '
import json, sys

base_path = sys.argv[1]
dest_path = sys.argv[2]

with open(base_path, "r", encoding="utf-8") as f:
    data = json.load(f)

def update_layout(node):
    if isinstance(node, dict):
        if node.get("id") == "tabs" and node.get("content", {}).get("mod") == "tabs":
            node["content"]["mod"] = "devops-tabs"
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
echo "Configured custom layouts/devops.json."

# 4. Update shared.json preferences
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
if "azure-devops" not in panels:
    panels.append("azure-devops")
shared["workspace.panels"] = panels
shared["layout"] = "devops"

with open(shared_file, "w", encoding="utf-8") as f:
    json.dump(shared, f)
' "$SHARED_FILE"
fi

# 5. Validation and live switch
if command -v herdr-app >/dev/null 2>&1; then
    herdr-app check "$TARGET_MOD_DIR"
    herdr-app check "$DEVOPS_TABS_DIR"
    echo "Mod validation checks passed."

    # If herdr-app is currently running, switch layout immediately
    herdr-app do layout.switch '{"name":"devops"}' 2>/dev/null && echo "Active Herdr window switched to DevOps layout." || true
fi

echo ""
echo "Installation complete!"
echo "The 'DevOps' button is now configured in your top tab bar next to Files and Changes."
