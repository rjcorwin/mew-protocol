# STDIO Transition Plan

## Goal
Finish migrating the MEW CLI, space lifecycle, and test suite to a pure STDIO transport so developers can start, inspect, and interact with local spaces without WebSocket or PM2 dependencies.

## ✅ Completed
- Transport abstraction and FIFO-based gateway (`cli/src/gateway/*`, `cli/src/commands/gateway.js`).
- Adapter shim for STDIO participants (`cli/bin/mew-stdio-adapter.js`).
- `mew space up/down/status/clean` rewritten to spawn/manage gateway + adapters directly (`cli/src/commands/space.js`).
- All regression scenarios (1–12) converted to STDIO drivers and agents; `tests/run-all-tests.sh` passes end-to-end.
- `mew` command defaults updated to auto-run `space up` and reuse `.mew/space.yaml` in new spaces.
- Human interactive CLI wired via `mew space connect` and `mew --interactive` defaults, using an Ink-powered terminal UI (with `/simple` fallback) on top of STDIO FIFOs.
- Configurable transports so spaces can mix local STDIO adapters with WebSocket participants (`space.transport`, per-participant overrides, optional gateway listener).
- TypeScript SDK `@mew-protocol/client` refactored with pluggable transports (STDIO + WebSocket) enabling agents to run under the new CLI adapter.

## 🚧 In Progress / Next
1. **Interactive UX polish** – Upgrade the terminal experience (slash commands, better message formatting, optional TUI/Ink front-end) and capture transcripts/logging options.
2. **Template polish** – Ensure `mew init` templates install cleanly (package name templating, dependency bootstrap) and document the STDIO workflow in generated READMEs.
3. **Gateway lifecycle UX** – Surface `space status` summaries and logs (e.g., `mew space status --follow`) to make it easy to observe running adapters.
4. **Remote participant docs/tooling** – Document WebSocket setup, token distribution, ship helper scripts for remote participants, and update agent scaffolding to nudge remote configuration.

## 📌 Stretch Ideas
- Space inspector TUI driven by the new STDIO channel.
- Scriptable hooks for adapters (auto-tail logs, health summaries).
- Capability-grant UX built on the STDIO approval flow once the human client exists.

---
*Last updated: 2025-09-19*
