# Contributing

Use Node 24+ and the pinned pnpm version. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, and `pnpm test`. Changes to runtime behavior also need the real acceptance checks in `docs/TESTING.md`.

Keep this a thin bridge. Project Graph owns PRG serialization, object references, graph semantics and persistence. Never add a custom PRG parser, cached canonical graph, or guessed replacement refs. Preserve upstream errors and test failures as well as successful calls.

Use the public fixture and disposable copies. Do not commit personal project files, installation state, absolute machine paths or credentials. Include behavior changes, verification and compatibility limits in a PR. Discuss larger tool/interface changes before implementation.

Contributions are made under GPL-3.0-only. Include attribution and original licenses for third-party code; prefer calling upstream tools rather than copying their implementations.
