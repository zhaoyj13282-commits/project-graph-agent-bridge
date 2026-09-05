# Public release acceptance

## Verified locally

- Windows x64: TypeScript check and 37 unit/subprocess/MCP/setup tests passed.
- Windows PowerShell 5.1: reject altered archive checksum and escaping ZIP entries; preserve existing config; round-trip Unicode and quoted JSON.
- Synthetic fixture: three TextNodes (Observe, Plan, Act), two LineEdges, created from a new official Project Graph project.
- Learning-map case: 152 TextNodes, 151 LineEdges, one connected root, opened and read through the production companion. Closed loading of manual-width nodes is an upstream limitation recorded in COMPATIBILITY.md.
- Native dependencies: PE imports inspected; required VC143 runtime DLLs included for app-local loading. WebView2 remains an external prerequisite.

The portable installation, real seven-tool MCP loop, GUI save/disk readback and published-download checks are recorded below when run. A local clean directory is not a separate clean Windows machine; GitHub's Windows runner provides additional installer/closed-read coverage.

## Portable bundle acceptance

Windows PowerShell 5.1 installed the SHA256-pinned 81 MB payload into a source-only export. Its bundled Node/CLI inspected the closed demo (exactly 5 objects). The embedded-production desktop opened demo.prg as the visible tab. Both real integration tests passed: all seven MCP tools with permission/source-fixture checks, and get/create/get plus GUI Ctrl+S and closed-copy disk readback. No Vite server was used.

The final 5,471-file payload passed UTF-8/UTF-16 scans for the builder's private identifiers and path variants. Gitleaks found one reviewed public Tauri documentation password example at ProjectUpgrader-C2CEsQ4r.mjs:101; it is upstream example text, not an account credential. No other secret findings were present.

## Published installation and CI follow-up

A fresh GitHub clone downloaded the released ZIP through install.ps1, verified its hash, registered a temporary Codex MCP entry, and read the closed demo (5 objects). The temporary registration was removed. Source tests passed on GitHub Windows, Linux and macOS runners.

The first GitHub Windows bundle job exposed a .NET Framework console-BOM difference. It was reproduced locally with Console.InputEncoding set to UTF-8 with BOM. The source-side PowerShell wrapper now creates its native stdin writer with BOM-free UTF-8 and restores the caller's console encoding. Both console variants pass regression tests (38 total local tests). This is the v0.1.1 source fix; the validated v0.1.0 runtime ZIP and SHA256 are unchanged.

Final remote check: [GitHub Actions run 33957449631](https://github.com/zhaoyj13282-commits/project-graph-agent-bridge/actions/runs/33957449631) passed all three source-test OS jobs and the Windows PowerShell 5.1 published-bundle install/closed-inspect job. The source tag v0.1.1 contains the wrapper correction; runtime assets remain byte-identical to v0.1.0.
