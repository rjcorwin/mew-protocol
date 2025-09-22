# MEW Protocol Progress Log

_Last updated: 2025-09-19_

## Current Status
The CLI, gateway, and regression suite now run entirely over the new STDIO transport. All scenarios (1–12) succeed under `tests/run-all-tests.sh`, the `mew` command boots a fresh space using `.mew/space.yaml` without PM2 or WebSockets, `mew space connect` launches an Ink-based interactive terminal (with `/simple` fallback), spaces can optionally expose a WebSocket listener for remote participants via `space.transport` overrides, and the TypeScript SDK/agent now speak STDIO by default while retaining optional WebSocket support.

## Recent Highlights
- **STDIO Gateway & CLI lifecycle**: Gateway core + FIFO transport landed, with adapters spawned by `mew space up`. State is persisted via `.mew/run/state.json`.
- **Scenario conversions**: Every regression scenario now uses STDIO drivers (`multi-*`, `streaming-*`, `batch-*`, etc.), eliminating HTTP hacks and PM2 wrappers.
- **`mew` UX fixes**: `mew` auto-starts a stopped space, warns if already running, and now launches the interactive session automatically (or via `mew space connect`). Template package names are templated correctly, avoiding npm errors.
- **Interactive CLI**: Human participants attach with `mew space connect`, defaulting to the Ink experience (history, proposals, commands) with a `/simple` readline fallback for debugging.
- **Hybrid transports**: `space.yaml` now supports per-participant `transport` selection, spinning up STDIO adapters locally while offering optional WebSocket endpoints for remote processes with the same token model.
- **SDK parity**: `@mew-protocol/client` exposes pluggable STDIO/WebSocket transports; `@mew-protocol/agent` defaults to STDIO so template agents run under the new adapter out of the box.

## Remaining Focus Areas
1. **Interactive UX polish** – refine the Ink interface (history search, transcript export, richer capability dialogs) and keep `/simple` parity.
2. **Template bootstrap polish** – smooth out `npm install` failures by templating names earlier or bundling dependencies; document the STDIO workflow in generated projects.
3. **Observability** – richer `space status` output (pid/log summary, follow mode) plus remote participant visibility.

## Key Metrics
- Regression scenarios passing: **12 / 12**
- Templates supported: `coder-agent`, `note-taker` (both STDIO-ready)
- STDIO adapters provided: **17** shared drivers/participants under `tests/agents/`

## Next Steps
- Layer richer CLI affordances (history search, transcript export, capability approvals) on top of the new Ink default.
- Tidy template package metadata and retry logic for dependency install.
- Capture the STDIO design decisions in finalized ADRs and document remote/WebSocket configuration patterns.

---
Contributions welcome! Prioritize the human-interaction tooling and template polish to round out the STDIO experience.
