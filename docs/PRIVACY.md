# Privacy

The repository and release bundle contain source code, dependencies, a synthetic three-node fixture, a reviewed learning-map example and public build provenance. They do not require your personal graph, account token or model API key.

## Local-only files

`.bridge-data/` holds your demo/working copies. `.bridge-runtime/` holds downloaded software and a local install receipt. `*.local.*` holds project paths and configuration. `.runtime/`, `.playwright-cli/`, logs, `.env*`, binaries and arbitrary `.prg` files are ignored. Store private screenshots in those ignored local directories. Only `tests/fixtures/public.prg` and the reviewed `examples/computer-learning-map/computer-learning-map.prg` showcase are allowed into version control.

Do not force-add ignored files. Before pushing, inspect `git diff --cached` and run a secret scanner. Git author emails are public commit metadata; use your GitHub noreply address if you do not want to publish a personal email.

## Runtime behavior

The stdio bridge does not expose a network server or upload PRG files. Graph contents are returned to the MCP client you invoke; that client's model/data policies still apply. The companion desktop retains upstream features and their network behavior. The installer contacts GitHub to download its pinned runtime. Project paths stay in local configuration but may appear in local upstream error details.

When reporting an issue, include OS, bridge/runtime versions, the error code and a reproduction using the public fixture. Remove graph text, private paths and credentials. Do not attach complete local config, screenshot or raw log files without reviewing them.
