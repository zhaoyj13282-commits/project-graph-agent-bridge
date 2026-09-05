#requires -Version 5.1
[CmdletBinding()]
param(
 [string]$ProjectFile,
 [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$Alias = 'demo',
 [string]$CodexPath,
 [string]$ConfigPath,
 [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$McpName = 'project-graph',
 [string]$BundlePath,
 [switch]$SkipCodexRegistration,
 [switch]$NoLaunch
)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitProcess -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
 throw 'The prebuilt installer currently supports Windows x64 only. See docs/COMPATIBILITY.md.'
}
$root = [IO.Path]::GetFullPath($PSScriptRoot)
if (-not $ConfigPath) { $ConfigPath = Join-Path $root 'bridge.local.json' }
$ConfigPath = [IO.Path]::GetFullPath($ConfigPath)
if (Test-Path -LiteralPath $ConfigPath) { throw 'Configuration already exists. It has not been changed. Use -ConfigPath to install a separate configuration.' }
if (-not $SkipCodexRegistration) {
 if (-not $CodexPath) {
  $found = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($found) { $CodexPath = $found.Source }
 }
 if (-not $CodexPath) {
  $binRoot = Join-Path $env:LOCALAPPDATA 'OpenAI/Codex/bin'
  if (Test-Path -LiteralPath $binRoot) {
   $candidates = @(Get-ChildItem -LiteralPath $binRoot -Directory | Sort-Object LastWriteTime -Descending | ForEach-Object { Join-Path $_.FullName 'codex.exe' } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
   if ($candidates.Count -gt 0) { $CodexPath = $candidates[0] }
  }
 }
 if (-not $CodexPath -or -not (Test-Path -LiteralPath $CodexPath -PathType Leaf)) { throw 'Codex executable not found. Open Codex once, or pass -CodexPath to codex.exe.' }
 $CodexPath = (Resolve-Path -LiteralPath $CodexPath).Path
 if ([IO.Path]::GetExtension($CodexPath) -ne '.exe') { throw 'CodexPath must point to a native codex.exe.' }
 $savedPreference = $ErrorActionPreference
 $ErrorActionPreference = 'Continue'
 & $CodexPath mcp get $McpName --json 2>$null | Out-Null
 $existingExit = $LASTEXITCODE
 $ErrorActionPreference = $savedPreference
 if ($existingExit -eq 0) { throw "An MCP registration named '$McpName' already exists. It was not changed. Choose -McpName or remove the old entry explicitly." }
}
$manifest = Get-Content -LiteralPath (Join-Path $root 'runtime-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.bundle.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'No validated runtime bundle is declared in this checkout.' }
$runtimeRoot = Join-Path $root '.bridge-runtime'
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$target = Join-Path $runtimeRoot $manifest.version
$receipt = Join-Path $target 'installed.json'
if (-not (Test-Path -LiteralPath $receipt)) {
 if (Test-Path -LiteralPath $target) { throw 'An incomplete runtime directory exists. Use a clean checkout rather than overwriting it.' }
 if (-not $BundlePath) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $BundlePath = Join-Path $runtimeRoot $manifest.bundle.name
  Write-Host 'Downloading the pinned, prebuilt runtime (no compiler or Node installation needed)...'
  Invoke-WebRequest -Uri $manifest.bundle.url -OutFile $BundlePath -UseBasicParsing
 }
 $BundlePath = (Resolve-Path -LiteralPath $BundlePath).Path
 $hashStream = [IO.File]::OpenRead($BundlePath)
 $sha = [Security.Cryptography.SHA256]::Create()
 try { $actual = [BitConverter]::ToString($sha.ComputeHash($hashStream)).Replace('-','') } finally { $sha.Dispose(); $hashStream.Dispose() }
 if ($actual -ne $manifest.bundle.sha256) { throw 'Runtime SHA256 mismatch. Nothing was executed or registered.' }
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $staging = Join-Path $runtimeRoot ('staging-' + [Guid]::NewGuid().ToString('N'))
 $stagingPrefix = [IO.Path]::GetFullPath($staging) + [IO.Path]::DirectorySeparatorChar
 $archive = [IO.Compression.ZipFile]::OpenRead($BundlePath)
 try {
  foreach ($entry in $archive.Entries) {
   $name = $entry.FullName.Replace('/', '\')
   if ($name.Contains(':') -or [IO.Path]::IsPathRooted($name)) { throw 'Archive contains an unsafe path.' }
   $destination = [IO.Path]::GetFullPath((Join-Path $staging $name))
   if (-not $destination.StartsWith($stagingPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes its install directory.' }
  }
 } finally { $archive.Dispose() }
 [IO.Compression.ZipFile]::ExtractToDirectory($BundlePath, $staging)
 foreach ($relativeFile in @('node/node.exe','cli/project-graph.mjs','cli/project-graph-ownership-helper.exe','desktop/project-graph.exe','bridge/dist/index.js','LICENSE','THIRD_PARTY_NOTICES.md','node/vcruntime140.dll','node/msvcp140.dll','cli/vcruntime140_1.dll','cli/msvcp140.dll','desktop/vcruntime140_1.dll','desktop/msvcp140.dll')) {
  if (-not (Test-Path -LiteralPath (Join-Path $staging $relativeFile) -PathType Leaf)) { throw "Incomplete runtime: $relativeFile" }
 }
 # Both generated paths are checked before the directory move.
 $boundary = [IO.Path]::GetFullPath($runtimeRoot) + [IO.Path]::DirectorySeparatorChar
 foreach ($movePath in @($staging,$target)) { if (-not ([IO.Path]::GetFullPath($movePath)).StartsWith($boundary,[StringComparison]::OrdinalIgnoreCase)) { throw 'Install path escaped the runtime directory.' } }
 Move-Item -LiteralPath $staging -Destination $target
 [IO.File]::WriteAllText($receipt,(@{sha256=$actual;version=$manifest.version} | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
} else {
 $installed = Get-Content -LiteralPath $receipt -Raw -Encoding UTF8 | ConvertFrom-Json
 if ($installed.sha256 -ne $manifest.bundle.sha256) { throw 'Installed runtime receipt does not match this checkout.' }
}
$publicFixture = (Resolve-Path -LiteralPath (Join-Path $root 'tests/fixtures/public.prg')).Path
$usingDemo = -not $ProjectFile
if ($usingDemo) {
 $dataRoot = Join-Path $root '.bridge-data'
 New-Item -ItemType Directory -Path $dataRoot -Force | Out-Null
 $ProjectFile = Join-Path $dataRoot 'demo.prg'
 if (-not (Test-Path -LiteralPath $ProjectFile)) { Copy-Item -LiteralPath $publicFixture -Destination $ProjectFile }
}
$ProjectFile = (Resolve-Path -LiteralPath $ProjectFile).Path
if ([IO.Path]::GetExtension($ProjectFile) -ne '.prg') { throw 'ProjectFile must be an existing .prg file.' }
if ($Alias -eq 'example-readonly') { throw 'The alias example-readonly is reserved for the public fixture.' }
$nodeExe = Join-Path $target 'node/node.exe'
$entryPoint = Join-Path $target 'bridge/dist/index.js'
$projects = @{}
$projects[$Alias] = @{path=$ProjectFile;name=$Alias;permissions=@{read=$true;write=$true;destructive=$usingDemo}}
$projects['example-readonly'] = @{path=$publicFixture;name='Public example (read only)';permissions=@{read=$true;write=$false;destructive=$false}}
$config = @{
 cli=@{executable=$nodeExe;prefixArgs=@((Join-Path $target 'cli/project-graph.mjs'));timeoutMs=60000}
 desktop=@{executable=(Join-Path $target 'desktop/project-graph.exe')}
 allowedRoots=@((Split-Path $ProjectFile -Parent),(Split-Path $publicFixture -Parent))
 projects=$projects
}
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($ConfigPath,($config | ConvertTo-Json -Depth 8),$utf8)
& $nodeExe $entryPoint probe --config $ConfigPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Runtime compatibility probe failed. No MCP registration was made.' }
[IO.File]::WriteAllText((Join-Path $runtimeRoot 'active.json'),(@{path=$target;version=$manifest.version} | ConvertTo-Json),$utf8)
if (-not $SkipCodexRegistration) {
 & $CodexPath mcp add $McpName -- $nodeExe $entryPoint mcp stdio --config $ConfigPath
 if ($LASTEXITCODE -ne 0) { throw 'Codex registration failed. Runtime and local configuration are retained for diagnosis.' }
}
if (-not $NoLaunch) {
 Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS -ErrorAction SilentlyContinue
 Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER -ErrorAction SilentlyContinue
 Start-Process -FilePath $config.desktop.executable -ArgumentList @('"' + $ProjectFile + '"') -WindowStyle Hidden | Out-Null
}
Write-Host "Installed. Project alias: $Alias. Start a new Codex task and ask it to inspect this project."
Write-Host 'Open-project edits need Ctrl+S in Project Graph. See docs/COMPATIBILITY.md.'
