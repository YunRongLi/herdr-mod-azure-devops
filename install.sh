#!/usr/bin/env bash
set -e

HERDR_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
MOD_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_MOD_DIR="$HERDR_HOME/mods/azure-devops"
LAYOUT_FILE="$HERDR_HOME/layouts/main.json"
TABS_FILE="$HERDR_HOME/mods/tabs/main.js"

echo "Installing Herdr Azure DevOps mod..."
echo "Herdr home: $HERDR_HOME"

if [ ! -d "$HERDR_HOME" ]; then
    echo "Error: Herdr directory not found at '$HERDR_HOME'. Please install or run herdr-app first."
    exit 1
fi

mkdir -p "$HERDR_HOME/mods"

# 1. Symlink or copy mod
if [ -L "$TARGET_MOD_DIR" ] || [ -d "$TARGET_MOD_DIR" ]; then
    rm -rf "$TARGET_MOD_DIR"
fi
ln -s "$MOD_SOURCE" "$TARGET_MOD_DIR"
echo "Linked mod into: $TARGET_MOD_DIR"

# 2. Register in layouts/main.json
if [ -f "$LAYOUT_FILE" ]; then
    if ! grep -q '"id": "azure-devops"' "$LAYOUT_FILE"; then
        python3 -c '
import json, sys
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

def add_block(node):
    if isinstance(node, dict):
        if node.get("id") == "panel-body" and "children" in node:
            existing = [c.get("id") for c in node["children"]]
            if "azure-devops" not in existing:
                node["children"].append({
                    "id": "azure-devops",
                    "type": "block",
                    "content": { "mod": "azure-devops" }
                })
                return True
        for k, v in node.items():
            if add_block(v):
                return True
    elif isinstance(node, list):
        for item in node:
            if add_block(item):
                return True
    return False

if add_block(data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print("Registered panel in layouts/main.json")
' "$LAYOUT_FILE" || true
    fi
fi

# 3. Add DevOps button to tabs/main.js
if [ -f "$TABS_FILE" ]; then
    if ! grep -q '"azure-devops"' "$TABS_FILE"; then
        sed -i 's/\(\.when(enabled\.includes("changes")[^)]*)\)/\1\n      .child(panelButton("azure-devops", "DevOps", "mods\/azure-devops\/assets\/ado.svg"))/' "$TABS_FILE" || true
        echo "Added DevOps button to mods/tabs/main.js"
    fi
fi

# 4. Add Azure DevOps to new-menu
NEW_MENU_FILE="$HERDR_HOME/mods/new-menu/main.js"
if [ -f "$NEW_MENU_FILE" ]; then
    if ! grep -q '"ado-tab"' "$NEW_MENU_FILE"; then
        sed -i 's/\(this\.row("terminal"[^)]*)\)/\1\n      .child(this.row("ado-tab", svg("mods\/azure-devops\/assets\/ado.svg").size(14), "Azure DevOps", () => run("tab.new", { name: "Azure DevOps", space: space?.id, mod: "azure-devops" })))/' "$NEW_MENU_FILE" || true
        echo "Added Azure DevOps to mods/new-menu/main.js"
    fi
fi

# 5. Verify mod
if command -v herdr-app >/dev/null 2>&1; then
    herdr-app check "$TARGET_MOD_DIR"
    echo "Mod validation check passed."
fi

echo "Installation complete. The DevOps button is now active in Herdr."
