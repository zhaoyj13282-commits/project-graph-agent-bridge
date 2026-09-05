#requires -Version 5.1
param(
 [Parameter(Mandatory=$true)][ValidateSet('probe','prg_list_projects','prg_inspect','prg_create','prg_edit','prg_connect','prg_delete','prg_layout')][string]$Tool,
 [string]$InputJson = '{}',
 [string]$ConfigPath
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $ConfigPath) { $ConfigPath = Join-Path $root 'bridge.local.json' }
$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$receipt = Get-Content -LiteralPath (Join-Path $root '.bridge-runtime/active.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$entry = Join-Path $receipt.path 'bridge/dist/index.js'
# Explicit stream encodings also work in legacy consoles and redirected PS 5.1 hosts.
$info = New-Object Diagnostics.ProcessStartInfo
$info.FileName = $config.cli.executable
$verb = if ($Tool -eq 'probe') { 'probe' } else { "call $Tool --input-stdin" }
$info.Arguments = '"' + $entry + '" ' + $verb + ' --config "' + [IO.Path]::GetFullPath($ConfigPath) + '"'
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.RedirectStandardInput = $true
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$info.StandardOutputEncoding = New-Object Text.UTF8Encoding($false)
$info.StandardErrorEncoding = New-Object Text.UTF8Encoding($false)
$process = New-Object Diagnostics.Process
$process.StartInfo = $info
try {
 # .NET Framework uses Console.InputEncoding when constructing StandardInput.
 # UTF-8 with a BOM would prepend bytes that JSON.parse does not accept.
 $previousInputEncoding = [Console]::InputEncoding
 try {
  [Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
  [void]$process.Start()
 } finally { [Console]::InputEncoding = $previousInputEncoding }
 $stdout = $process.StandardOutput.ReadToEndAsync()
 $stderr = $process.StandardError.ReadToEndAsync()
 $process.StandardInput.Write($InputJson)
 $process.StandardInput.Close()
 $process.WaitForExit()
 $text = $stdout.GetAwaiter().GetResult()
 $errorText = $stderr.GetAwaiter().GetResult()
 if ($text) { Write-Output $text.TrimEnd() }
 if ($errorText) { [Console]::Error.Write($errorText) }
 $nativeExit = $process.ExitCode
} finally { $process.Dispose() }
exit $nativeExit
