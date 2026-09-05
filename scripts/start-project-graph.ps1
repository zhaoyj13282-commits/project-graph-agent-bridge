#requires -Version 5.1
param(
 [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Project = 'demo',
 [string]$ConfigPath,
 [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
if (-not $ConfigPath) { $ConfigPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'bridge.local.json' }
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$descriptor = $config.projects.PSObject.Properties[$Project]
if (-not $descriptor) { throw "Unknown project alias: $Project" }
$projectFile = (Resolve-Path -LiteralPath $descriptor.Value.path).Path
if (-not $config.desktop) { throw 'No compatible desktop configured. Run install.ps1.' }
$desktopExe = (Resolve-Path -LiteralPath $config.desktop.executable).Path
if ($CheckOnly) { Write-Output "Runtime ready; project alias: $Project"; exit 0 }
Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER -ErrorAction SilentlyContinue
$started = Start-Process -FilePath $desktopExe -ArgumentList @('"' + $projectFile + '"') -WindowStyle Hidden -PassThru
Write-Output "Project Graph Bridge Runtime started for '$Project' (PID $($started.Id)). Save changes with Ctrl+S."
