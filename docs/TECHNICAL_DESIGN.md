# Technical design

```text
Codex / local MCP client -> stdio MCP -> GraphService
                                    -> ProjectRegistry
                                    -> official CLI subprocess
                                    -> open desktop or closed PRG
```

`ProjectGraphCliAdapter` owns shell-free argument arrays, discovery, JSON responses, structured errors, timeout/cancellation and output bounds. It neither parses PRG bytes nor retries writes.

`ProjectRegistry` maps configured aliases to canonical existing PRG files. Roots are mandatory; symlink escapes are rejected. Read is required for every operation, write for changes, destructive plus write for deletion.

`GraphService` maps seven stable tools to official runtime tools. It reads before/after changes, returns partial-error state when available and never guesses replacement refs. Inspect filtering operates only on the official JSON snapshot. No database, watcher or index is maintained.

`createServer` registers standard MCP SDK tools. Stdio stdout contains only protocol traffic. The operator CLI also supports UTF-8 JSON on stdin to avoid Windows PowerShell 5.1 argument corruption.

`install.ps1` reads a pinned checksum manifest, downloads a release bundle, validates archive paths, extracts into a repository-local runtime directory and generates ignored configuration. It preserves existing configuration and registrations. The companion desktop has a separate application identifier and embedded production assets. Build recipes and corresponding source accompany releases.

The model-facing MCP API does not accept executable paths, file paths, raw tools, shell commands or upgrade flags. Local operator configuration is trusted. Upstream errors may contain local paths; review diagnostics before publishing.

Current runtime constraints: creation requires Open Project; open changes require GUI save; no standalone edge-delete or save tool; `sizeAdjust` is acknowledged through the operation result because snapshots omit it. Every platform needs its own materialized native helper and acceptance; Windows validation does not imply macOS/Linux support.
