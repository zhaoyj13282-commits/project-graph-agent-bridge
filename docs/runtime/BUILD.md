# Rebuilding the Windows runtime

End users run `install.ps1`; these instructions are for release maintainers.

1. Fetch official Project Graph source at commit `1d36fbbe7a1a14bee0f4b79189597cae6cd848a7` (the release's upstream source ZIP contains the same tracked tree).
2. Use Node 26.8.1, pnpm 11.3.0, Rust 1.98.1, CMake 4.4.3, Windows x64 and Visual Studio 2022 C++ Build Tools. Install the upstream workspace with its frozen lockfile.
3. Run `scripts/build-runtime.ps1 -UpstreamPath <checkout> -NodePath <node.exe> -PnpmPath <pnpm.cmd>`. Cargo/CMake/MSVC must be available in the build shell. Rust/Cargo caches can be local; no global installation is required by this repository.

The recipe builds production assets with `--minify false`: the official snapshot uses constructor names, so minified GUI assets would report different object types than the CLI. Tauri embeds these assets through `tauri/custom-protocol`; no Vite server is shipped. The application name/identifier/version are overridden to keep the companion distinct from the stock app. Release symbols are stripped and source/home paths are remapped; scan finished artifacts for private build strings before distribution.

## CLI and dependency payload

Use upstream `app/vite.cli.config.ts` and `app/scripts/materialize-cli.ts` to materialize the official CLI at the pinned commit. The effective build steps are production dependency materialization, Vite CLI build, version stamping (`1.0.0-bridge.1d36fbb`) and inclusion of the target-native ownership helper. See the pinned upstream `docs/agents/cli.md` for the exact interface.

The distributable CLI has `jsdom` 29.1.1 and `sharp` 0.35.3 installed using `npm ci --omit=dev --ignore-scripts` and the public `runtime/cli-package-lock.json`. This produces a flat Windows ZIP-compatible dependency tree, including optional prebuilt Windows sharp binaries, without pnpm junctions. Build the bridge with its own frozen pnpm lock, then install its production dependencies using `runtime/bridge-package-lock.json` in the payload's bridge directory. Package-provided license files must remain present.

Bundle layout:

```text
node/node.exe + LICENSE
cli/project-graph.mjs + chunks + native helper + node_modules
desktop/project-graph.exe
bridge/dist + package.json + node_modules
LICENSE
THIRD_PARTY_NOTICES.md
```

Include Node 26.8.1 from its official Windows x64 ZIP, verified against the official SHASUMS256.txt. No app settings, WebView profiles, PRG data, credentials, logs, .env files, source maps or PDBs belong in the bundle. Public source fixtures are in the repository, not copied from developer state.

Zip the bundle, compute SHA256, and update `runtime-manifest.json`. Attach the pinned upstream source ZIP plus source/lockfiles/notices needed to reproduce the bundle to the GitHub release. Before publishing, run source and binary privacy scans, install into a clean directory with Windows PowerShell 5.1, and perform real CLI/MCP/GUI acceptance on the public fixture.

The source archive is generated using `git archive <pinned-commit>`, which excludes untracked build caches and machine-local files. The release repository supplies the build scripts, environment/configuration overrides, and dependency locks used in packaging. Third-party native dependencies retain their original notices and source locations.

Include the complete x64 Microsoft.VC143.CRT DLL set from the matching Visual Studio 2022 redistributable directory in node/, cli/ and desktop/. Keep its separate Microsoft license attribution. This lets the GUI, ownership helper and native Node addons load without a machine-wide VC++ installation. Inspect all native PE dependencies before release.

Set -PathPrefixToRemap to the common parent of source, Cargo cache and target directories. C/C++ release assertions are disabled with /DNDEBUG; /experimental:deterministic and /pathmap remove compiler source paths. Rust remapping alone does not cover native dependencies.

The supplied CMake toolchain keeps SentencePiece normalization data embedded and sets its unused fallback data directory to a neutral public path. It performs no installation into that fallback directory. This prevents CMake's build-local install prefix from leaking into the executable.
