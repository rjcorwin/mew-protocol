# Isometric Fleet Demo

This template provisions a MEW space that pairs four human participants, four MEW agents, and a controllable ship backed by the built-in `isometric-fleet` MCP server. It lets you exercise the isometric world simulation helpers in `src/game/isometric` and stream coordinated player movement to prototype Phaser/Electron clients before the renderer is ready.

## Participants

The space boots with the following participants:

- `human-1` .. `human-4` – standard human explorers that connect through the gateway
- `agent-1` .. `agent-4` – MEW agents that pathfind using patrol controllers
- `aurora-skiff` – MCP bridge that exposes helm and crew tools through the `isometric-fleet` server

When the MCP bridge starts it spins up the isometric world simulation, seeds the eight default crew members, and keeps a `world-snapshot` notification stream open so clients can mirror the scene.

## Available MCP Tools

The `isometric-fleet` MCP server advertises a small set of tools so humans or AI agents can help coordinate the crew:

- `get_world_state` – return the current list of players and ships with positions and velocities
- `request_player_movement` – enqueue a player to walk toward a tile at the maximum speed for their type
- `set_ship_heading` – steer the Aurora Skiff by supplying a desired velocity vector
- `board_ship` – place a player on the ship deck with optional relative coordinates
- `disembark` – remove a player from whichever ship they are currently on

Each tool response includes structured data plus a short text summary so the results are easy to inspect from the MEW terminal.

## Streaming Protocol

Participants publish their latest positions via MEW streams. Each client can subscribe to the `world-state` stream or listen for the `isometric/*` MCP notifications to keep their local Phaser scene up to date. The stream payload matches `IsometricWorld#snapshot`, providing player, ship, and timestamp information.

## Extending

- Use `src/game/isometric/IsometricWorld.ts` as the core for wiring in Phaser sprites
- Add new patrol patterns or movement planners by extending `SimplePatrolAgent`
- Introduce additional ships by calling `world.spawnShip` inside a custom MCP server and advertising new helm tools
