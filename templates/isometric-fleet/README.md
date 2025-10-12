# Isometric Fleet Demo

This template provisions a MEW space that pairs four human participants, four MEW agents, and a demo ship that can be boarded. The template wires everything together with the isometric world simulation helpers defined in `src/game/isometric` so you can experiment with positional streaming logic without standing up a full Phaser or Electron client.

## Participants

The space boots with the following participants:

- `human-1` .. `human-4` – standard human explorers that connect through the gateway
- `agent-1` .. `agent-4` – MEW agents that pathfind using the patrol controller
- `aurora-skiff` – a simulated ship participant exposing MCP tools for helm control

The ship moves on a constant heading by default and keeps all boarded players in sync with its deck coordinates.

## Streaming Protocol

Participants publish their latest positions via MEW streams. Each client can subscribe to the `world-state` stream to keep their local Phaser scene up to date. The stream payload is the serialized snapshot exposed by `IsometricWorld#snapshot`.

## Extending

- Use `src/game/isometric/IsometricWorld.ts` as a foundation for wiring in Phaser sprites
- Replace `ConstantHeadingShipController` with an MCP-backed controller to accept helm commands
- Implement player-specific abilities by extending the `PlayerTypeConfig` and reacting to stream payloads in the client
