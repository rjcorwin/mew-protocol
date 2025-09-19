# STDIO Gateway Refactor Plan

## Goal
Replace the CLI gateway runtime with a pure STDIO transport (using FIFO pairs) while keeping the design modular enough to add WebSocket support later. Tests (scenarios 1–7) should pass in this transport without relying on PM2 or Unix domain sockets.

## Tasks
1. **Transport abstraction** – Refactor the CLI gateway to use a pluggable connection layer. Implement a FIFO-based transport (paired FIFOs per participant) that the gateway can attach to.
2. **Participant adapters** – Implement an adapter process that bridges each participant’s STDIO to the FIFO pair, framing messages as MCP-style envelopes.
3. **CLI orchestration** – Update `mew space up/down/status/clean` to manage processes directly (spawn, track PIDs, tear down) and create/remove FIFOs under `space/.mew/fifos/`.
4. **Test agents** – Convert the core test agents (echo, driver, etc.) to speak framed STDIO so they can run under the new transport. Remove dependencies on WebSocket/HTTP in the scenarios up through test 7.
5. **Test scenarios** – Adjust `tests/scenario-1` through `scenario-7` to use the new flow (space configs, setup/teardown scripts, expectations). Run the tests locally and ensure they pass.
6. **Optional future work** – Leave the gateway transport abstraction ready for a WebSocket backend that can be toggled via config later.
