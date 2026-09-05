# Testing

`pnpm test` builds and runs unit, subprocess, registry, graph-service, MCP and setup tests without private files. CI runs these tests on supported Node environments. The public fixture is never mutated.

## Real Windows acceptance

Install the runtime with `install.ps1 -SkipCodexRegistration -NoLaunch` in a clean checkout. Run `pnpm install --frozen-lockfile` and `pnpm build` for test dependencies. Start a dedicated GUI with CDP enabled only for testing:

```powershell
$config = Get-Content bridge.local.json -Raw | ConvertFrom-Json
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-address=127.0.0.1 --remote-debugging-port=19224'
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path (Get-Location) '.bridge-data/webview-test'
Start-Process -FilePath $config.desktop.executable -ArgumentList @('"' + $config.projects.demo.path + '"') -WindowStyle Hidden
pnpm exec playwright-cli -s=prg-bridge attach --cdp=http://127.0.0.1:19224
$env:PROJECT_GRAPH_CLI = $config.cli.executable
$env:PROJECT_GRAPH_CLI_ARGS = ConvertTo-Json -Compress -InputObject @($config.cli.prefixArgs)
$env:PROJECT_GRAPH_TEST_OPEN_PROJECT = $config.projects.demo.path
$env:PROJECT_GRAPH_BRIDGE_TEST_CONFIG = (Resolve-Path bridge.local.json).Path
pnpm test:integration
```

Keep the demo tab active. If the automation host terminates child processes on exit, keep its launch session alive while testing. M0 verifies get/create/get, GUI save and disk readback. M1 verifies all seven tools over a real stdio subprocess, including read-only denial and unchanged source-fixture bytes. Tests are serialized because they share a desktop project.

For GUI-to-agent acceptance, edit a demo TextNode through the GUI, inspect its ref through Bridge, save, close/reopen and inspect again. Do not count a process start, mocked protocol, skipped suite or config registration alone as real acceptance.

## Installer and privacy checks

Test the installer with Windows PowerShell 5.1 from a fresh checkout, first with `-BundlePath` for an offline bundle, then against the published URL. Verify a tampered archive fails SHA256 before execution/registration, existing configuration is preserved, and stdin JSON survives quotes/non-ASCII text.

Before release, inspect the exact tracked/exported files, scan them and the runtime bundle with Gitleaks, and scan both UTF-8/UTF-16 binary strings for local usernames, private paths and graph identifiers. Release evidence must contain only public/synthetic data.
