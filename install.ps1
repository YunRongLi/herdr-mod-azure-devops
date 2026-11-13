$ErrorActionPreference = "Stop"

$HerdrHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { "$HOME\.config\herdr-app" }
$ModSource = $PSScriptRoot
$TargetModDir = "$HerdrHome\mods\azure-devops"
$DevopsTabsDir = "$HerdrHome\mods\devops-tabs"
$DevopsLayout = "$HerdrHome\layouts\devops.json"
$BaseLayout = "$HerdrHome\layouts\main.json"
$SharedFile = "$HerdrHome\shared.json"

Write-Host "Installing Herdr Azure DevOps mod..."
Write-Host "Herdr directory: $HerdrHome"

if (-not (Test-Path $HerdrHome)) {
    Write-Error "Herdr directory not found at '$HerdrHome'. Run herdr-app first."
    exit 1
}

if (-not (Test-Path "$HerdrHome\mods")) {
    New-Item -ItemType Directory -Path "$HerdrHome\mods" -Force | Out-Null
}
if (-not (Test-Path "$HerdrHome\layouts")) {
    New-Item -ItemType Directory -Path "$HerdrHome\layouts" -Force | Out-Null
}

# Clean up any leftover rollback artifacts or deprecated devops-tabs
Get-ChildItem -Path "$HerdrHome\layouts" -Filter "main-edited*.json" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path "$HerdrHome\mods" -Filter "tabs-edited*" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path "$HerdrHome\mods" -Filter "new-menu-edited*" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
if (Test-Path $DevopsTabsDir) {
    Remove-Item -Recurse -Force $DevopsTabsDir -ErrorAction SilentlyContinue
}

# 1. Symlink or copy mod
if (Test-Path $TargetModDir) {
    Remove-Item -Recurse -Force $TargetModDir
}

try {
    New-Item -ItemType SymbolicLink -Path $TargetModDir -Target $ModSource -ErrorAction Stop | Out-Null
    Write-Host "Symlinked mod to: $TargetModDir"
} catch {
    Copy-Item -Recurse -Path $ModSource -Destination $TargetModDir -Force
    Write-Host "Copied mod to: $TargetModDir"
}

# 2. Configure custom devops layout (preserves Herdr's pristine main.json)
if (Test-Path $BaseLayout) {
    $layoutJson = Get-Content -Raw $BaseLayout | ConvertFrom-Json -Depth 20

    function Update-LayoutNode($node) {
        if ($node -is [PSCustomObject]) {
            if ($node.id -eq "sidebar" -and $node.children) {
                $hasNav = $false
                foreach ($c in $node.children) {
                    if ($c.id -eq "devops-sidebar-nav") { $hasNav = $true }
                }
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
                    foreach ($c in $node.children) {
                        if ($c.id -eq "sidebar-footer" -and -not $inserted) {
                            $newChildren += $newNav
                            $inserted = $true
                        }
                        $newChildren += $c
                    }
                    if (-not $inserted) {
                        $newChildren += $newNav
                    }
                    $node.children = $newChildren
                }
            }
            if ($node.id -eq "panel-body" -and $node.children) {
                $hasAdo = $false
                foreach ($c in $node.children) {
                    if ($c.id -eq "azure-devops") { $hasAdo = $true }
                }
                if (-not $hasAdo) {
                    $newBlock = [PSCustomObject]@{
                        id = "azure-devops"
                        type = "block"
                        content = [PSCustomObject]@{ mod = "azure-devops" }
                    }
                    $node.children = @($node.children) + $newBlock
                }
            }
            foreach ($prop in $node.PSObject.Properties) {
                Update-LayoutNode $prop.Value
            }
        } elseif ($node -is [System.Collections.IEnumerable] -and $node -isnot [string]) {
            foreach ($item in $node) {
                Update-LayoutNode $item
            }
        }
    }

    Update-LayoutNode $layoutJson
    $layoutJson | ConvertTo-Json -Depth 20 | Set-Content -Path $DevopsLayout -Encoding utf8
    Write-Host "Configured custom layouts/devops.json with sidebar navigation."
}

# 3. Update shared.json
if (Test-Path $SharedFile) {
    try {
        $shared = Get-Content -Raw $SharedFile | ConvertFrom-Json
        $panels = if ($shared."workspace.panels") { @($shared."workspace.panels") } else { @("files", "changes") }
        $panels = @($panels | Where-Object { $_ -ne "azure-devops" })
        $shared."workspace.panels" = $panels
        $shared.layout = "devops"
        $shared | ConvertTo-Json -Depth 10 | Set-Content -Path $SharedFile -Encoding utf8
    } catch {}
}

# 4. Verify mod and switch layout
if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
    herdr-app check $TargetModDir
    Write-Host "Mod check passed."

    try {
        herdr-app do layout.switch '{"name":"devops"}' 2>$null | Out-Null
        Write-Host "Active Herdr window switched to DevOps layout."
    } catch {}
}

Write-Host ""
Write-Host "Installation complete!"
Write-Host "The 'Azure DevOps' button is now located in the left sidebar alongside Spaces and Agents."
Write-Host "Clicking it automatically opens or switches to your Azure DevOps tab."
