#requires -Version 7.3
param(
 [Parameter(Mandatory=$true)][string]$UpstreamPath,
 [string]$PathPrefixToRemap,
 [string]$NodePath = (Get-Command node.exe -ErrorAction Stop).Source,
 [string]$PnpmPath = (Get-Command pnpm.cmd -ErrorAction Stop).Source,
 [string]$TargetPath = (Join-Path (Split-Path $PSScriptRoot -Parent) '.runtime/release-target')
)
$ErrorActionPreference='Stop'
$upstream=(Resolve-Path -LiteralPath $UpstreamPath).Path
$expected='1d36fbbe7a1a14bee0f4b79189597cae6cd848a7'
if ((git -C $upstream rev-parse HEAD) -ne $expected) {throw 'Wrong upstream revision. Use the commit pinned by runtime-manifest.json.'}
$env:PATH=(Split-Path $NodePath -Parent)+';'+$env:PATH
& $PnpmPath --dir $upstream --filter @graphif/project-graph exec vite build --minify false
if ($LASTEXITCODE -ne 0) {throw 'Frontend build failed'}
$env:CARGO_TARGET_DIR=[IO.Path]::GetFullPath($TargetPath)
$env:CARGO_PROFILE_RELEASE_LTO='false'
$env:CARGO_PROFILE_RELEASE_CODEGEN_UNITS='16'
$env:CARGO_PROFILE_RELEASE_OPT_LEVEL='1'
$env:CARGO_PROFILE_RELEASE_DEBUG='0'
$env:CARGO_PROFILE_RELEASE_STRIP='symbols'
if (-not $PathPrefixToRemap) { $PathPrefixToRemap = $upstream }
$env:RUSTFLAGS="--remap-path-prefix=$PathPrefixToRemap=/build --remap-path-prefix=$env:USERPROFILE=/home/builder"
$env:CFLAGS='/DNDEBUG /experimental:deterministic /pathmap:"'+$PathPrefixToRemap+'"=C:\build'
$env:CXXFLAGS=$env:CFLAGS
$env:CMAKE_TOOLCHAIN_FILE=Join-Path (Split-Path $PSScriptRoot -Parent) 'runtime/windows-toolchain.cmake'
$env:TAURI_CONFIG='{"productName":"Project Graph Bridge Runtime","identifier":"community.projectgraph.bridge","version":"0.1.0"}'
& cargo build --manifest-path (Join-Path $upstream 'app/src-tauri/Cargo.toml') --locked --release --features tauri/custom-protocol --bin project-graph --bin project-graph-ownership-helper
if ($LASTEXITCODE -ne 0) {throw 'Native runtime build failed'}
Write-Output "Native files are in $TargetPath/release. See docs/runtime/BUILD.md for CLI materialization and packaging."
