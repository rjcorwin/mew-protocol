# Proposal s3h-transport-server: MEW World Ship Transport MCP Server

## Problem Statement

MEW World currently simulates players walking on terrain and synchronising positions via a shared movement stream, but it lacks any notion of mobile platforms such as ships. The implementation plan calls for a dedicated MCP participant that models a ship so that agents can control its movement and query its passengers. We need to formalise how that participant behaves, what tools it exposes, and how it interacts with the movement stream so that clients and tests can rely on a consistent lifecycle for boarding, travel, and disembarkation.

## Goals

- Define a stateful transport component that tracks ship heading, speed, world position, and passenger manifests.
- Provide MCP tools for steering (`set_sail_direction`), throttling (`set_sail_speed`), and querying (`get_ship_position`, `get_passengers`).
- Establish a passive tool for reporting nearby player positions so the ship can automatically detect boarding/disembarking transitions.
- Ensure the transport component publishes its own movement frames to the shared `mew-world/positions` stream using the compact format introduced in the previous milestone.
- Provide headless-friendly primitives so automated tests can validate the complete passenger lifecycle without rendering a Phaser scene.

## Non-Goals

- Implement full collision physics for ships against shorelines or other transports (deferred to the collision milestone).
- Introduce AI autonomy for ships—control remains entirely via MCP tools for now.
- Update client rendering to show bespoke ship sprites; the initial release can rely on existing position markers.

## Proposed Design

1. Create a reusable `TransportLifecycleManager` that encapsulates platform motion, heading, speed, passenger offsets, and deck bounds. The manager exposes:
   - `setHeading(degrees)` and `setSpeed(unitsPerSecond)` to control movement.
   - `update(deltaMs)` to advance world coordinates and automatically carry passengers.
   - `reportPlayerPosition(playerId, worldPosition)` to evaluate boarding/disembarking by comparing reported positions against the deck footprint with a configurable margin.
   - Query helpers (`getState()`, `getPassengers()`, `getPassengerWorldPosition(id)`).

2. Build a new MCP server entry point `mew-world-transport.ts` that hosts the manager for a ship configuration by default. The server responds to JSON-RPC with the following tool surface:
   - `set_sail_direction` `{ degrees: number }` → `{ heading: number }`
   - `set_sail_speed` `{ speed: number }` → `{ speed: number }`
   - `get_ship_position` → `{ position, heading, speed }`
   - `get_passengers` → `{ passengers: PassengerSummary[] }`
   - `report_player_position` `{ player_id, world }` → `{ event, passenger }`

3. Register a 100 ms physics loop that advances the manager and broadcasts the ship's updated position (including passenger world coordinates) through the shared movement stream using the `PositionStreamManager` helper.

4. Export the lifecycle manager so headless Vitest suites and future plane transports can reuse the implementation without invoking the MCP shell.

## Alternatives Considered

- **Ad-hoc ship server without shared lifecycle manager.** Rejected because we want identical logic for future transports (planes, trains) and dedicated tests around the lifecycle.
- **Relying on clients to report explicit boarding commands.** Automatic detection via position keeps the player protocol lightweight and consistent with the existing stream semantics.

## Risks

- Boarding detection depends on the correctness of reported positions; network jitter may cause brief exits. Mitigation: include a configurable margin in the deck footprint to avoid flapping.
- Publishing transport frames at 10 Hz may require throttling once multiple ships exist. We can reuse the same cadence as players initially and revisit the rate during the polish milestone.

## Success Metrics

- The MCP server advertises the new tools and responds with deterministic JSON payloads.
- Automated headless tests can simulate a player boarding, travelling with, and disembarking from the ship using the lifecycle manager.
- The ship participant appears in the MEW World template and can be started locally via `mew mcp ship`.
