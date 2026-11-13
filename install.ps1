# ==============================================================================
# Herdr Azure DevOps Mod - Installer & Layout Integrator (PowerShell)
#
# Designed for maximum composability and compatibility with other Herdr mods.
# - Non-destructively patches the active custom layout without overwriting
#   sibling mod nodes or custom user configurations.
# - Preserves Herdr's pristine read-only shipped layouts (main, terminals, win98).
# - Avoids touching or deleting files owned by other mods or user experiments.
# - Supports idempotent installation, custom layout targets, and clean uninstall.
# ==============================================================================

param(
    [string]$Layout = "",
    [switch]$NoSwitch = $false,
    [switch]$Uninstall = $false,
    [switch]$Help = $false
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host "Usage: .\install.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Layout <name>   Target layout name (default: auto-detected custom layout or 'devops')"
    Write-Host "  -NoSwitch        Install/uninstall without switching the active layout"
    Write-Host "  -Uninstall       Cleanly remove mod link and layout entries without touching other mods"
    Write-Host "  -Help            Show this help message"
    exit 0
}

$HerdrHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { "$HOME\.config\herdr-app" }
$ModSource = $PSScriptRoot
$TargetModDir = "$HerdrHome\mods\azure-devops"
$BaseLayout = "$HerdrHome\layouts\main.json"
$SharedFile = "$HerdrHome\shared.json"

if (-not (Test-Path $HerdrHome)) {
    Write-Error "Herdr directory not found at '$HerdrHome'. Launch Herdr first."
    exit 1
}

if (-not (Test-Path "$HerdrHome\mods")) {
    New-Item -ItemType Directory -Path "$HerdrHome\mods" -Force | Out-Null
}
if (-not (Test-Path "$HerdrHome\layouts")) {
    New-Item -ItemType Directory -Path "$HerdrHome\layouts" -Force | Out-Null
}

$ShippedLayouts = @("main", "terminals", "win98")

# Determine target layout
$TargetLayoutName = $Layout
if ([string]::IsNullOrWhiteSpace($TargetLayoutName)) {
    $activeLayout = ""
    if (Test-Path $SharedFile) {
        try {
            $shared = Get-Content -Raw $SharedFile | ConvertFrom-Json
            $activeLayout = $shared.layout
        } catch {}
    }

    if (-not [string]::IsNullOrWhiteSpace($activeLayout) -and ($ShippedLayouts -notcontains $activeLayout)) {
        $TargetLayoutName = $activeLayout
    } else {
        $TargetLayoutName = "devops"
    }
}

$TargetLayoutFile = "$HerdrHome\layouts\$TargetLayoutName.json"

# Helper function to find a node by ID recursively
function Find-LayoutNode($node, [string]$targetId) {
    if ($node -is [PSCustomObject]) {
        if ($node.id -eq $targetId) { return $node }
        if ($node.children) {
            foreach ($child in $node.children) {
                $found = Find-LayoutNode $child $targetId
                if ($found) { return $found }
            }
        }
    } elseif ($node -is [System.Collections.IEnumerable] -and $node -isnot [string]) {
        foreach ($item in $node) {
            $found = Find-LayoutNode $item $targetId
            if ($found) { return $found }
        }
    }
    return $null
}

# ------------------------------------------------------------------------------
# UNINSTALL MODE
# ------------------------------------------------------------------------------
if ($Uninstall) {
    Write-Host "Uninstalling Herdr Azure DevOps mod..."

    if (Test-Path $TargetModDir) {
        Remove-Item -Recurse -Force $TargetModDir -ErrorAction SilentlyContinue
        Write-Host "Removed mod link: $TargetModDir"
    }

    if (Test-Path $TargetLayoutFile) {
        try {
            $layoutJson = Get-Content -Raw $TargetLayoutFile | ConvertFrom-Json -Depth 30
            $sidebar = Find-LayoutNode $layoutJson "sidebar"
            if ($sidebar -and $sidebar.children) {
                $sidebar.children = @($sidebar.children | Where-Object { $_.id -ne "devops-sidebar-nav" })
            }
            $panelBody = Find-LayoutNode $layoutJson "panel-body"
            if ($panelBody -and $panelBody.children) {
                $panelBody.children = @($panelBody.children | Where-Object { $_.id -ne "azure-devops" })
            }
            $layoutJson | ConvertTo-Json -Depth 30 | Set-Content -Path $TargetLayoutFile -Encoding utf8
            Write-Host "Cleaned Azure DevOps nodes from: $TargetLayoutFile"
        } catch {
            Write-Host "Notice: Could not clean layout entries: $_"
        }
    }

    if ((Test-Path $SharedFile) -and (-not $NoSwitch)) {
        try {
            $shared = Get-Content -Raw $SharedFile | ConvertFrom-Json
            if ($shared.layout -eq $TargetLayoutName) {
                $shared.layout = "main"
                $shared | ConvertTo-Json -Depth 15 | Set-Content -Path $SharedFile -Encoding utf8
                Write-Host "Reverted active layout in shared.json to 'main'."
            }
        } catch {}

        if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
            herdr-app do layout.switch '{"name":"main"}' 2>$null | Out-Null
        }
    }

    Write-Host "Uninstallation complete."
    exit 0
}

# ------------------------------------------------------------------------------
# INSTALL MODE
# ------------------------------------------------------------------------------
Write-Host "Installing Herdr Azure DevOps mod..."
Write-Host "Herdr directory: $HerdrHome"
Write-Host "Target layout: $TargetLayoutName ($TargetLayoutFile)"

# 1. Symlink or copy mod
if (Test-Path $TargetModDir) {
    Remove-Item -Recurse -Force $TargetModDir -ErrorAction SilentlyContinue
}

try {
    New-Item -ItemType SymbolicLink -Path $TargetModDir -Target $ModSource -ErrorAction Stop | Out-Null
    Write-Host "Symlinked mod to: $TargetModDir"
} catch {
    Copy-Item -Recurse -Path $ModSource -Destination $TargetModDir -Force
    Write-Host "Copied mod to: $TargetModDir"
}

# 2. Non-destructively patch target layout
$sourceFile = if (Test-Path $TargetLayoutFile) { $TargetLayoutFile } else { $BaseLayout }
if (Test-Path $sourceFile) {
    $layoutJson = Get-Content -Raw $sourceFile | ConvertFrom-Json -Depth 30

    $sidebar = Find-LayoutNode $layoutJson "sidebar"
    if ($sidebar -and $sidebar.children) {
        $hasNav = ($sidebar.children | Where-Object { $_.id -eq "devops-sidebar-nav" }).Count -gt 0
        if (-not $hasNav) {
            $newNav = [PSCustomObject]@{
                id = "devops-sidebar-nav"
                type = "block"
                size = [PSCustomObject]@{ px = 36 }
                content = [PSCustomObject]@{
                    mod = "azure-devops"
                    props = [PSCustomObject]@{ role = "sidebar-button" }
                }
            }
            $newChildren = @()
            $inserted = $false
            foreach ($c in $sidebar.children) {
                if ($c.id -eq "sidebar-footer" -and -not $inserted) {
                    $newChildren += $newNav
                    $inserted = $true
                }
                $newChildren += $c
            }
            if (-not $inserted) {
                $newChildren += $newNav
            }
            $sidebar.children = $newChildren
        }
    }

    $panelBody = Find-LayoutNode $layoutJson "panel-body"
    if ($panelBody -and $panelBody.children) {
        $hasAdo = ($panelBody.children | Where-Object { $_.id -eq "azure-devops" }).Count -gt 0
        if (-not $hasAdo) {
            $newBlock = [PSCustomObject]@{
                id = "azure-devops"
                type = "block"
                content = [PSCustomObject]@{ mod = "azure-devops" }
            }
            $panelBody.children = @($panelBody.children) + $newBlock
        }
    }

    $layoutJson | ConvertTo-Json -Depth 30 | Set-Content -Path $TargetLayoutFile -Encoding utf8
    Write-Host "Layout configured non-destructively: $TargetLayoutFile"
}

# 3. Update shared.json
if (Test-Path $SharedFile) {
    try {
        $shared = Get-Content -Raw $SharedFile | ConvertFrom-Json
        $panels = if ($shared."workspace.panels") { @($shared."workspace.panels") } else { @("files", "changes") }
        $shared."workspace.panels" = @($panels | Where-Object { $_ -ne "azure-devops" })
        if (-not $NoSwitch) {
            $shared.layout = $TargetLayoutName
        }
        $shared | ConvertTo-Json -Depth 15 | Set-Content -Path $SharedFile -Encoding utf8
    } catch {}
}

# 4. Verify mod and switch layout
if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
    herdr-app check $TargetModDir
    Write-Host "Mod check passed."

    if (-not $NoSwitch) {
        try {
            herdr-app do layout.switch "{\"name\":\"$TargetLayoutName\"}" 2>$null | Out-Null
            Write-Host "Active Herdr window switched to '$TargetLayoutName' layout."
        } catch {}
    }
}

Write-Host ""
Write-Host "Installation complete!"
Write-Host "The 'Azure DevOps' button is configured in layout '$TargetLayoutName' in the left sidebar alongside Spaces and Agents."
Write-Host "Clicking it automatically opens or switches to your Azure DevOps tab."
