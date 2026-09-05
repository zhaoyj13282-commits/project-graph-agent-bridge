# Third-party notices

- **Project Graph**: Graphif contributors, GPL-3.0-only. Official source: https://github.com/graphif/project-graph . Companion builds use commit `1d36fbbe7a1a14bee0f4b79189597cae6cd848a7`. A source archive for that commit accompanies binary releases. Packaging overrides application name/identifier/version and build flags; graph behavior is not forked.
- **Node.js**: Node.js contributors, MIT plus bundled third-party notices. Its complete license is included under `node/LICENSE` in runtime bundles.
- **MCP TypeScript SDK**: Model Context Protocol contributors, MIT.
- **Zod**: Colin McDonnell and contributors, MIT.
- **jsdom**: jsdom contributors, MIT; required by the official CLI runtime.
- **sharp / libvips**: sharp contributors, Apache-2.0; bundled libvips and dependencies retain their respective licenses, including LGPL-3.0-or-later. Package-provided notices/licenses are retained in the bundle.

Production dependencies retain package license files. Runtime source archives, dependency lockfiles and build scripts are provided alongside releases to allow inspection and rebuilding. This project does not claim ownership of upstream trademarks or third-party code.

- **Microsoft Visual C++ Runtime 14.42.34433 (x64)**: Microsoft Corporation, proprietary redistributable components, not covered by this repository's GPL license. App-local DLLs are taken from the Visual Studio 2022 Build Tools redistributable directory. See [Microsoft's redistribution guidance](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170) and [Visual Studio 2022 distributable code list](https://learn.microsoft.com/en-us/visualstudio/releases/2022/redistribution).

The matching native-image notice table, LGPL text, version inventory and source/build links are in runtime/licenses (licenses/ in the portable bundle). Compatible LGPL DLL replacements are permitted.
