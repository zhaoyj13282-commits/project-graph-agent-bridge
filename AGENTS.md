# AGENTS.md

## Purpose

This repository builds **Project Graph Agent Bridge**: a thin adapter that lets Codex, ChatGPT, and other MCP-capable agents read and modify existing Project Graph `.prg` files.

Read these first:

1. `docs/PRODUCT.md`
2. `docs/TECHNICAL_DESIGN.md`

Product intent wins over architectural preference.

## Core rule

**Do not parse, rewrite, or reimplement the `.prg` format.**

Use the upstream `project-graph` CLI as the graph backend:

```text
project-graph --version
project-graph tool list
project-graph tool describe <tool>
project-graph tool invoke <tool> --project <path> --input <JSON>
```

Project Graph owns serialization, graph semantics, open-project routing, persistence, and object references.

## Development order

Work milestone by milestone.

### M0 first

Implement only:

- `ProjectGraphCliLocator`
- `ProjectGraphCliAdapter`
- structured CLI errors
- a real `.prg` integration fixture
- integration test:
  `get_all_nodes -> create_text_node -> get_all_nodes`

Do **not** start MCP, HTTP, skills, hooks, UI, caching, or indexing before M0 passes.

### Then M1

Add:

- project alias registry
- thin `GraphService`
- stdio MCP
- minimal tools:
  `prg_list_projects`, `prg_inspect`, `prg_create`, `prg_edit`,
  `prg_connect`, `prg_delete`, `prg_layout`

## Engineering principles

- Prefer the smallest working change.
- Validate against a real Project Graph runtime early.
- Reuse upstream tools; do not duplicate their behavior.
- Keep MCP tools client-agnostic; Codex is one client, not the product boundary.
- Keep model-facing tool surface small.
- Use project aliases instead of exposing arbitrary filesystem paths.
- Preserve upstream structured errors and error codes.
- Inspect before mutating; re-inspect affected graph state after mutation.
- Do not invent stable node IDs: use upstream `n1` / `e1` references returned by Project Graph.
- Do not add infrastructure for hypothetical future needs.

## Non-goals for MVP

Do not introduce unless a milestone explicitly requires it:

- graph database
- vector database / embeddings
- React or other UI
- Docker
- CRDT
- filesystem watchers
- autonomous agents
- graph-change hooks
- custom PRG DSL
- direct MessagePack/ZIP mutation
- Git graph-diff system
- cross-project semantic index

## Stack

Use:

- Node.js 20+
- TypeScript
- pnpm
- Zod
- Vitest
- standard MCP TypeScript SDK when M1 starts

Keep dependencies minimal.

## Validation

Before considering a milestone complete:

```bash
pnpm typecheck
pnpm test
```

For behavior involving Project Graph, prefer an integration test against the real CLI over mocks.

Do not claim an upstream tool supports an input field until verified with:

```bash
project-graph tool describe <tool>
```

## Error handling

Never silently swallow Project Graph errors.

Normalize them, but preserve:

- upstream code
- message
- details when available

Unknown/stale refs should trigger a fresh inspect, not guessed replacement refs.

## Security

Agent-facing APIs must not accept unrestricted filesystem access.

Resolve a configured project alias to a canonical `.prg` path and enforce configured roots/permissions.

Treat operations as:

- read
- write
- destructive
- raw

`raw` and destructive actions should be easy to disable.

## Scope discipline

If implementation starts requiring direct knowledge of `stage.msgpack`, Project Graph rendering internals, or Project Graph service internals, stop and verify whether the upstream CLI already exposes the needed capability.

If a feature is not required to complete the current milestone, defer it.
