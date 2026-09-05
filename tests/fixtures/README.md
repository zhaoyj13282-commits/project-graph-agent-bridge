# Public fixture

`public.prg` is an original synthetic graph created from a **new empty project** through the official GUI and CLI. It contains three TextNodes (Observe, Plan, Act) and two directed edges (informs, guides). It is not derived from a private graph. The fixture is distributed under this repository's GPL-3.0-only license.

The source fixture is immutable in tests. Copy it into `.bridge-data/` for mutations. The installer creates `.bridge-data/demo.prg` and registers the original as `example-readonly`.

`cli-process.mjs` is a subprocess protocol double. It tests quoting, timeouts, cancellation and errors; it is never counted as PRG runtime acceptance.

Real tests require the pinned runtime and a disposable demo open in its desktop. M0 uses an explicit Playwright GUI session to save and then asks the official CLI to read a separate saved copy. M1 uses the standard MCP SDK client. Missing prerequisites fail the tests rather than producing skipped success.
