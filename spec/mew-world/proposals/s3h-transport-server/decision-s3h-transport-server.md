# Decision Record: s3h-transport-server

**Status:** Accepted

## Summary

We will implement a reusable transport lifecycle manager and expose it through a new MCP server entry point so MEW World gains its first movable platform (a ship). The server provides tools for steering, throttling, querying state, and reporting nearby player positions to drive automatic boarding logic. Headless Vitest suites will exercise the lifecycle manager to guarantee deterministic behaviour for boarding, transport, and disembarkation.

## Rationale

- Centralising the logic in `TransportLifecycleManager` keeps the MCP wrapper thin and allows future transports (planes, trains) to reuse the same semantics.
- Exposing a `report_player_position` tool lets agents or the gateway forward observational data without inventing new envelope kinds.
- Publishing transport frames using the existing compact stream format preserves bandwidth and keeps the client pipeline unchanged.

## Consequences

- The MEW World template now includes a ship participant that runs `mew mcp ship` locally.
- Specs and documentation must describe the new tools and the lifecycle events emitted by the manager so clients can react to them.
- Future milestones can iterate on the shared manager to add collision detection or AI autonomy without rewriting the MCP layer.
