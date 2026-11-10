$ErrorActionPreference = "Stop"

$HerdrHome = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { "$HOME\.config\herdr-app" }
$ModSource = $PSScriptRoot
$TargetModDir = "$HerdrHome\mods\azure-devops"
$LayoutFile = "$HerdrHome\layouts\main.json"
$TabsFile = "$HerdrHome\mods\tabs\main.js"

Write-Host "Installing Herdr Azure DevOps mod..."
Write-Host "Herdr directory: $HerdrHome"

if (-not (Test-Path $HerdrHome)) {
    Write-Error "Herdr directory not found at '$HerdrHome'. Run herdr-app first."
    exit 1
}

if (-not (Test-Path "$HerdrHome\mods")) {
    New-Item -ItemType Directory -Path "$HerdrHome\mods" -Force | Out-Null
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

# 2. Register in layouts/main.json
if (Test-Path $LayoutFile) {
    $content = Get-Content -Raw $LayoutFile
    if ($content -notmatch '"id":\s*"azure-devops"') {
        $targetStr = '"id": "changes"'
        $blockStr = @"
                    {
                      "id": "changes",
                      "type": "block",
                      "content": {
                        "mod": "changes"
                      }
                    },
                    {
                      "id": "azure-devops",
                      "type": "block",
                      "content": {
                        "mod": "azure-devops"
                      }
                    }
"@
        if ($content -match '\{\s*"id":\s*"changes"[^}]+}') {
            $matched = $Matches[0]
            $replacement = "$matched,`n                    {`n                      `"id`": `"azure-devops`",`n                      `"type`": `"block`",`n                      `"content`": {`n                        `"mod`": `"azure-devops`"`n                      }`n                    }"
            $content = $content.Replace($matched, $replacement)
            Set-Content -Path $LayoutFile -Value $content -Encoding utf8
            Write-Host "Registered panel in layouts/main.json"
        }
    }
}

# 3. Add DevOps button to tabs/main.js
if (Test-Path $TabsFile) {
    $tabsContent = Get-Content -Raw $TabsFile
    if ($tabsContent -notmatch '"azure-devops"') {
        $targetLine = '.when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))'
        $newLine = "$targetLine`n      .child(panelButton(`"azure-devops`", `"DevOps`", `"mods/azure-devops/assets/ado.svg`"))"
        if ($tabsContent.Contains($targetLine)) {
            $tabsContent = $tabsContent.Replace($targetLine, $newLine)
            Set-Content -Path $TabsFile -Value $tabsContent -Encoding utf8
            Write-Host "Added DevOps button to mods/tabs/main.js"
        }
    }
}

# 4. Verify mod
if (Get-Command herdr-app -ErrorAction SilentlyContinue) {
    herdr-app check $TargetModDir
    Write-Host "Mod check passed."
}

Write-Host "Installation complete! The 'DevOps' button is now live in your Herdr tab bar."
