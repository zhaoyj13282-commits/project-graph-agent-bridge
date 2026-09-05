# Compatibility

| Component | Supported / tested |
| --- | --- |
| Prebuilt installer | Windows 10/11 x64; PowerShell 5.1 or newer |
| Companion runtime | Official Project Graph commit `1d36fbbe7a1a14bee0f4b79189597cae6cd848a7`, locally packaged as a separate application |
| Stock Project Graph 4.2.3 | Not a compatible Tool CLI; keep it installed, but use the companion runtime for this bridge |
| Node | Included in the Windows bundle; no global Node installation required |
| Codex | Local stdio MCP client; sign in through Codex, not this bridge |
| macOS / Linux / ARM64 | No prebuilt runtime or end-to-end acceptance in this release; source code is not a compatibility guarantee |
| ChatGPT Web | Remote HTTP MCP, authentication and tunneling are not implemented |

The installer probes required tool discovery before registering MCP. A compatible tool list alone does not prove an already installed GUI shares the live runtime; use the pinned companion build.

Creating text nodes requires an open matching project. Open-project mutations change live state and need GUI save. Closed-capable native tools persist successful changes themselves. No automatic format upgrade or write retry is enabled.

The current upstream lacks standalone edge deletion and a save tool. Snapshot fields omit `sizeAdjust`, so its operation acknowledgement is checked while visible text/color/width/graph state is re-read. Layout is limited to connected non-Section DAG nodes in one container.

The companion is a community development snapshot packaged with production assets. It uses a separate application identifier, does not replace the stock installation, and is not a signed official Graphif installer. Keep backups before adopting a development runtime for important graphs.

Known pinned-upstream bug: closed graphs with manually sized TextNodes can return TOOL_EXECUTION_FAILED because the closed runtime initializes text measurement too late. Open such graphs in the companion desktop first; the learning-map example documents this limitation.
