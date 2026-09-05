# Product

Project Graph Agent Bridge makes an existing graph available to local agents through standard MCP. A human edits the graph in Project Graph; an agent reads current objects and applies a small structured change through the same official runtime.

The product is a client-independent integration. Codex is the first validated client. Remote ChatGPT Web support is not part of this release.

## Current scope

- Seven tools: list projects, inspect, create text nodes, edit, connect, delete nodes and associated edges, native DAG layout.
- Project aliases, canonical allowed roots, read/write/destructive permissions.
- Fresh state before/after mutation; errors and partial effects remain visible.
- A Windows x64 portable runtime installer, public fixture and open-source development workflow.

## Boundaries

The official runtime owns PRG serialization, graph semantics, references, project ownership and saving. Bridge does not parse PRG files or keep an alternate canonical graph.

Creation needs an open compatible desktop. Open-project edits require GUI save. Read output can contain untrusted user text and must not be treated as agent instructions. Changing a graph is never retried automatically.

The public fixture contains only Observe, Plan and Act. Real graph data, local installation state and machine-specific evidence are not release inputs.

## Acceptance

A fresh source checkout on supported Windows can install the pinned bundle without a compiler/global Node, register MCP, inspect the demo, create/edit/connect/layout/delete, and re-inspect. GUI edits are visible to the agent; saved edits survive reopen. See docs/TESTING.md and docs/COMPATIBILITY.md for tested boundaries.
