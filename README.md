# Project Graph Agent Bridge

Read and edit Project Graph files from Codex or another local MCP client. The bridge uses the official Project Graph runtime; it does not parse or rewrite the `.prg` format.

**Windows x64 preview.** Includes seven MCP tools and a pinned companion runtime. The stock Project Graph 4.2.3 application alone does not expose the required Tool CLI. See [compatibility](docs/COMPATIBILITY.md).

## Install on another Windows PC

Prerequisites: Windows 10/11 x64, Codex installed and signed in, Microsoft Edge WebView2 Runtime (normally installed with Project Graph), and an internet connection for the first install. Node.js and the required Visual C++ runtime DLLs are included. No pnpm, Rust, build tools or administrator rights are required by the installer.

1. Clone this repository or download its source ZIP and extract it.
2. Open Windows PowerShell in the extracted directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The installer downloads the pinned release ZIP, checks SHA256 before execution, creates a disposable demo from the public fixture, registers `project-graph` with Codex, and opens the compatible desktop. It does not replace the installed Project Graph application. Existing configuration and MCP registrations are preserved; conflicts produce an actionable error.

3. Start a new Codex task and say:

> Use Project Graph to inspect demo. Create a new text node and connect it to Plan.

If the new tools do not appear, restart Codex. **Save open-project edits with Ctrl+S in the companion desktop.**

The bridge needs no API key or subscription of its own. Codex account access is handled by Codex. Do not put account tokens or API keys in this repository.

## Use your own graph

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -ProjectFile "C:\Graphs\example.prg" -Alias example
```

For an existing installation, edit the private `bridge.local.json`: register the existing `.prg` under `projects`, add its parent directory under `allowedRoots`, and set permissions. Restart the MCP client after changing configuration. Close the same graph in an incompatible older desktop before opening it in the companion runtime. Formats requiring upgrade are rejected by the bridge rather than upgraded silently.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\start-project-graph.ps1 -Project example
.\scripts\bridge.ps1 prg_inspect -InputJson '{"project":"example","search":"Plan"}'
```

All tool calls use aliases, never arbitrary filesystem paths. Configured roots are canonicalized to reject symlink escapes. Default demo data permits deletion; a graph supplied with `-ProjectFile` does not. Deleting nodes also deletes their associated edges.

## Real example

[Computer knowledge and skills learning map](examples/computer-learning-map/README.md): an editable 152-node, 151-edge learning map with 30 BYOX practice projects, a desktop preview, and a readable outline.

## Tools

| Tool | Purpose |
| --- | --- |
| `prg_list_projects` | Discover aliases and permissions |
| `prg_inspect` | Read, literal text search, paginated snapshots, connected neighborhoods |
| `prg_create` | Create a TextNode in the open project's viewport |
| `prg_edit` | Edit text, color and dimensions |
| `prg_connect` | Add directed edges |
| `prg_delete` | Delete nodes and associated edges, if permitted |
| `prg_layout` | Native left-to-right layout for a connected DAG |

Inspect before editing and use refs from that project's latest snapshot. Partial failures and timeouts are not automatically retried. The bridge reads again after writes and returns verification details. Section member refs are exposed; fields omitted by the official snapshot are not recovered through private file parsing.

## Advanced installation

- `-CodexPath "C:\path\codex.exe"`: locate a portable Codex installation explicitly.
- `-McpName another-name -ConfigPath "C:\path\bridge.local.json"`: install an additional independent registration.
- `-SkipCodexRegistration`: configure another MCP client manually.
- `-NoLaunch`: do not open the companion desktop.
- `-BundlePath "C:\Downloads\runtime.zip"`: offline installation with the exact release ZIP; SHA256 is still checked.

Manual MCP command: the installed bundle's `node/node.exe`, with arguments `bridge/dist/index.js mcp stdio --config <absolute-config-path>`. Paths in an MCP configuration should be absolute. Prefer a 180-second tool timeout for large graphs.

## Development and tests

Developer prerequisites are separate from end-user installation: Node 24+, pnpm 11.19.0.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Tests use synthetic protocol data and a [public fixture](tests/fixtures/README.md). See [testing](docs/TESTING.md) for the real CLI/MCP/GUI acceptance workflow and [runtime builds](docs/runtime/BUILD.md) for reproducible companion builds.

## Privacy and licensing

Local configuration, user graphs, downloaded runtimes, logs and machine-specific evidence are excluded by `.gitignore`. Keep private screenshots and credentials in ignored local directories. Only the explicitly reviewed fixture and learning-map showcase are tracked. See [privacy](docs/PRIVACY.md) before contributing diagnostics.

GPL-3.0-only; see [LICENSE](LICENSE). This is an independent community integration, not an official Graphif or OpenAI release. Third-party components retain their original licenses; see [notices](THIRD_PARTY_NOTICES.md). Corresponding upstream source and build instructions accompany runtime releases.

Chinese users: clone 后运行上述 `install.ps1`，再在 Codex 新任务中说“读取 demo”。首次安装会下载兼容运行时，不需要自行编译。创建节点需打开配套桌面；改完按 Ctrl+S 保存。
