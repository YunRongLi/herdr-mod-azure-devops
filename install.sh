#!/usr/bin/env bash
# ==============================================================================
# Herdr Azure DevOps Mod - Installer & Layout Integrator
#
# Designed for maximum composability and compatibility with other Herdr mods.
# - Non-destructively patches the active custom layout without overwriting
#   sibling mod nodes or custom user configurations.
# - Preserves Herdr's pristine read-only shipped layouts (main, terminals, win98).
# - Avoids touching or deleting files owned by other mods or user experiments.
# - Supports idempotent installation, custom layout targets, and clean uninstall.
# ==============================================================================

set -e

HERDR_HOME="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
MOD_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_MOD_DIR="$HERDR_HOME/mods/azure-devops"
BASE_LAYOUT="$HERDR_HOME/layouts/main.json"
SHARED_FILE="$HERDR_HOME/shared.json"

UNINSTALL=false
NO_SWITCH=false
LAYOUT_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -u|--uninstall)
      UNINSTALL=true
      shift
      ;;
    --no-switch)
      NO_SWITCH=true
      shift
      ;;
    -l|--layout)
      LAYOUT_NAME="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: ./install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -l, --layout <name>   Target layout name (default: auto-detected custom layout or 'devops')"
      echo "  --no-switch           Install/uninstall without switching the active layout"
      echo "  -u, --uninstall       Cleanly remove mod link and layout entries without touching other mods"
      echo "  -h, --help            Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Run './install.sh --help' for usage."
      exit 1
      ;;
  esac
done

if [ ! -d "$HERDR_HOME" ]; then
  echo "Error: Herdr directory not found at '$HERDR_HOME'. Please launch Herdr first."
  exit 1
fi

mkdir -p "$HERDR_HOME/mods" "$HERDR_HOME/layouts"

# Determine target layout
SHIPPED_LAYOUTS=("main" "terminals" "win98")

if [ -z "$LAYOUT_NAME" ]; then
  ACTIVE_LAYOUT=""
  if [ -f "$SHARED_FILE" ]; then
    ACTIVE_LAYOUT=$(python3 -c '
import json, sys
try:
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        print(json.load(f).get("layout", ""))
except Exception:
    pass
' "$SHARED_FILE" 2>/dev/null || true)
  fi

  is_shipped=false
  for s in "${SHIPPED_LAYOUTS[@]}"; do
    if [ "$ACTIVE_LAYOUT" = "$s" ]; then
      is_shipped=true
      break
    fi
  done

  if [ -n "$ACTIVE_LAYOUT" ] && [ "$is_shipped" = false ]; then
    LAYOUT_NAME="$ACTIVE_LAYOUT"
  else
    LAYOUT_NAME="devops"
  fi
fi

TARGET_LAYOUT_FILE="$HERDR_HOME/layouts/${LAYOUT_NAME}.json"

# ------------------------------------------------------------------------------
# UNINSTALL MODE
# ------------------------------------------------------------------------------
if [ "$UNINSTALL" = true ]; then
  echo "Uninstalling Herdr Azure DevOps mod..."

  # 1. Remove mod symlink
  if [ -L "$TARGET_MOD_DIR" ] || [ -d "$TARGET_MOD_DIR" ]; then
    rm -rf "$TARGET_MOD_DIR"
    echo "Removed mod link: $TARGET_MOD_DIR"
  fi

  # 2. Non-destructively remove layout nodes
  if [ -f "$TARGET_LAYOUT_FILE" ]; then
    python3 -c '
import json, sys

layout_path = sys.argv[1]

def find_node(node, target_id):
    if isinstance(node, dict):
        if node.get("id") == target_id:
            return node
        for child in node.get("children", []):
            found = find_node(child, target_id)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = find_node(item, target_id)
            if found:
                return found
    return None

try:
    with open(layout_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    sidebar = find_node(data, "sidebar")
    if sidebar and "children" in sidebar:
        sidebar["children"] = [
            c for c in sidebar["children"]
            if not (isinstance(c, dict) and c.get("id") == "devops-sidebar-nav")
        ]

    panel_body = find_node(data, "panel-body")
    if panel_body and "children" in panel_body:
        panel_body["children"] = [
            c for c in panel_body["children"]
            if not (isinstance(c, dict) and c.get("id") == "azure-devops")
        ]

    with open(layout_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Cleaned Azure DevOps nodes from: {layout_path}")
except Exception as e:
    print(f"Notice: Could not clean layout entries: {e}")
' "$TARGET_LAYOUT_FILE"
  fi

  # 3. Revert shared layout if needed
  if [ -f "$SHARED_FILE" ] && [ "$NO_SWITCH" = false ]; then
    python3 -c '
import json, sys

shared_file = sys.argv[1]
layout_name = sys.argv[2]

try:
    with open(shared_file, "r", encoding="utf-8") as f:
        shared = json.load(f)
    if shared.get("layout") == layout_name:
        shared["layout"] = "main"
        with open(shared_file, "w", encoding="utf-8") as f:
            json.dump(shared, f, indent=2)
        print("Reverted active layout in shared.json to \"main\".")
except Exception:
    pass
' "$SHARED_FILE" "$LAYOUT_NAME"

    if command -v herdr-app >/dev/null 2>&1; then
      herdr-app do layout.switch '{"name":"main"}' 2>/dev/null || true
    fi
  fi

  echo "Uninstallation complete."
  exit 0
fi

# ------------------------------------------------------------------------------
# INSTALL MODE
# ------------------------------------------------------------------------------
echo "Installing Herdr Azure DevOps mod..."
echo "Herdr home: $HERDR_HOME"
echo "Target layout: $LAYOUT_NAME ($TARGET_LAYOUT_FILE)"

# 1. Symlink mod into Herdr mods directory
if [ -L "$TARGET_MOD_DIR" ] || [ -d "$TARGET_MOD_DIR" ]; then
  rm -rf "$TARGET_MOD_DIR"
fi
ln -s "$MOD_SOURCE" "$TARGET_MOD_DIR"
echo "Linked mod into: $TARGET_MOD_DIR"

# 2. Non-destructively patch target layout
python3 -c '
import json, sys, os

target_path = sys.argv[1]
base_path = sys.argv[2]

def find_node(node, target_id):
    if isinstance(node, dict):
        if node.get("id") == target_id:
            return node
        for child in node.get("children", []):
            found = find_node(child, target_id)
            if found:
                return found
    elif isinstance(node, list):
        for item in node:
            found = find_node(item, target_id)
            if found:
                return found
    return None

# If target layout exists, load it directly to preserve other mods and user customizations.
# Otherwise, seed from base layout (main.json).
source_path = target_path if os.path.exists(target_path) else base_path
with open(source_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# 1. Ensure devops-sidebar-nav block exists in sidebar
sidebar = find_node(data, "sidebar")
if sidebar and "children" in sidebar:
    children = sidebar["children"]
    existing_ids = [c.get("id") for c in children if isinstance(c, dict)]
    if "devops-sidebar-nav" not in existing_ids:
        nav_node = {
            "id": "devops-sidebar-nav",
            "type": "block",
            "size": { "px": 36 },
            "content": {
                "mod": "azure-devops",
                "props": { "role": "sidebar-button" }
            }
        }
        # Insert before sidebar-footer if present, else append
        idx = next((i for i, c in enumerate(children) if isinstance(c, dict) and c.get("id") == "sidebar-footer"), len(children))
        children.insert(idx, nav_node)

# 2. Ensure azure-devops block exists in panel-body stack
panel_body = find_node(data, "panel-body")
if panel_body and "children" in panel_body:
    children = panel_body["children"]
    existing_ids = [c.get("id") for c in children if isinstance(c, dict)]
    if "azure-devops" not in existing_ids:
        children.append({
            "id": "azure-devops",
            "type": "block",
            "content": { "mod": "azure-devops" }
        })

with open(target_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
print(f"Layout configured non-destructively: {target_path}")
' "$TARGET_LAYOUT_FILE" "$BASE_LAYOUT"

# 3. Update shared.json preferences non-destructively
if [ -f "$SHARED_FILE" ]; then
  python3 -c '
import json, sys

shared_file = sys.argv[1]
layout_name = sys.argv[2]
no_switch = sys.argv[3] == "true"

try:
    with open(shared_file, "r", encoding="utf-8") as f:
        shared = json.load(f)
except Exception:
    shared = {}

# Clean up legacy panel references if present, preserving all other panels
panels = shared.get("workspace.panels", ["files", "changes"])
shared["workspace.panels"] = [p for p in panels if p != "azure-devops"]

if not no_switch:
    shared["layout"] = layout_name

with open(shared_file, "w", encoding="utf-8") as f:
    json.dump(shared, f, indent=2)
' "$SHARED_FILE" "$LAYOUT_NAME" "$NO_SWITCH"
fi

# 4. Mod validation and live layout switch
if command -v herdr-app >/dev/null 2>&1; then
  herdr-app check "$TARGET_MOD_DIR" || true
  echo "Mod validation checks passed."

  if [ "$NO_SWITCH" = false ]; then
    herdr-app do layout.switch "{\"name\":\"$LAYOUT_NAME\"}" 2>/dev/null && echo "Active Herdr window switched to '$LAYOUT_NAME' layout." || true
  fi
fi

echo ""
echo "Installation complete!"
echo "The 'Azure DevOps' button is configured in layout '$LAYOUT_NAME' in the left sidebar alongside Spaces and Agents."
echo "Clicking it automatically opens or switches to your Azure DevOps tab."
