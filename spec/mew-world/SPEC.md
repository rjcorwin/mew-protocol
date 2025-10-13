# MEW Protocol Isometric Multiplayer Game - Specification

## Overview

This game is a multiplayer isometric 2D world where participants (humans and AI agents) can move around, interact, and board ships. Built with Phaser 3 (v3.90.0) and TypeScript, it uses an Electron-based client that connects to a MEW protocol space. All participants communicate their positions and actions through MEW protocol streams, enabling real-time synchronization. The game features a space template with 4 human slots and 4 AI agent slots, where agents use an extended MEWAgent class with navigation capabilities. Ships act as movable platforms controlled through MCP tools, with players able to walk on them and be carried as the ship moves, requiring a relative coordinate system to handle movement on moving platforms.

## Client Architecture

The Electron application serves as the game client, presenting a connection form on launch where users enter the MEW gateway URL, port, username, and authentication token. Once connected, the client establishes a WebSocket connection to the MEW space using the MEW SDK client. The Phaser 3 game engine runs within the Electron window, rendering the isometric world and handling all game logic, input, and rendering. The client subscribes to MEW protocol streams to receive position updates from other participants and publishes its own position changes through the same mechanism. The client maintains a local game state synchronized with the MEW space, handling latency and reconciling any conflicts between local predictions and authoritative server state received via the protocol.

## Player System

All participants in the game are represented as players with a common base interface, though the system is designed to support different player types in the future with varying abilities and sprites. Each player has an MCP tool called `get_player_info` that returns their player type, current position, sprite identifier, movement speed, and any special abilities. For the initial implementation, all players share the same sprite and movement characteristics. Players interact with the world through MCP tools: `move_to` for pathfinding to a destination tile, `move_direction` for direct movement commands, and `get_position` for querying current location. The player system tracks whether a player is standing on solid ground or on a ship platform, which affects how their movement commands are interpreted and executed.

## Movement & Networking

Player movement is communicated through MEW protocol streams using a dedicated `player/position` stream that all participants subscribe to. Each position update message contains the player's participant ID, world coordinates (x, y), tile coordinates for the isometric grid, velocity vector, timestamp, and optional platform reference if standing on a ship. The game uses client-side prediction where local players see immediate movement feedback, while remote players' positions are interpolated smoothly based on received updates. The stream handler applies dead reckoning to estimate positions between updates and implements lag compensation to ensure fair gameplay despite network latency. Movement speed is measured in tiles per second, with the game loop updating positions at 60 FPS and broadcasting position updates at a configurable rate (default 10 Hz) to balance network efficiency with visual smoothness.

`PositionStreamManager` (renderer utility) wraps the handshake (`stream/request`, `stream/open`, `stream/close`) and parses incoming frames before handing `PositionUpdate` objects to the Phaser scene.

## AI Agent System

AI agents extend the base MEWAgent class with a new `GameAgent` superclass that adds spatial reasoning and autonomous navigation capabilities. This superclass provides MCP tools that wrap the core movement system, allowing the AI to call `decide_next_move` which returns available adjacent tiles with metadata about terrain, obstacles, and other players. The AI uses Claude's reasoning to select a destination tile based on goals, then calls `execute_move` to initiate pathfinding. The GameAgent implements an A* pathfinding algorithm to navigate around obstacles and other players, respecting the movement speed constraints of the player type. The AI decision loop runs at a slower cadence (1-2 Hz) to avoid excessive API calls, with the pathfinding system handling smooth execution of multi-tile movements. GameAgents can have high-level goals set through their system prompt, such as "explore the world," "follow other players," or "patrol an area," which guide their decision-making process.

## Ship System

Ships are movable platforms implemented as non-AI MEW participants backed by an MCP server that provides rule-based control tools. Each ship has an MCP tool interface including `set_sail_direction` to control heading, `set_sail_speed` to adjust velocity, `get_ship_position` for current location, and `get_passengers` to list players currently on the ship. The ship MCP server maintains the ship's position and broadcasts updates through the same `player/position` stream used by regular players, using a special participant ID. The ship has a defined collision boundary and walkable deck area represented as a set of relative tile coordinates. When a player moves to a tile that intersects with a ship's boundary, the game engine automatically registers them as "on ship" and changes their coordinate reference frame from world-absolute to ship-relative. The ship server runs a simple physics loop that updates the ship's world position based on its velocity vector, checking for collisions with land or other ships.

## Coordinate Systems & Relative Movement

The game implements a dual coordinate system to handle players moving on moving platforms. World coordinates are absolute positions in the game world, while platform coordinates are relative offsets from a platform's origin point (used when standing on a ship). Each player's state includes a `platform_ref` field that is null when on solid ground or references a ship participant ID when aboard. When a player is on a ship, their world position is calculated as `ship.world_position + player.platform_offset`, recalculated every frame as the ship moves. Movement commands from players on ships are interpreted as relative movements within the ship's coordinate frame, with collision detection checking against the ship's deck boundaries rather than world terrain. The rendering system transforms ship-relative coordinates to screen space by first applying the ship's world transform, then the player's relative offset, ensuring players appear to move correctly both when walking on a stationary ship and when walking on a moving ship.

## Current Client Implementation

The Electron-based game client (`clients/mew-world`) provides the complete player experience for MEW World. Built with Electron 28, Phaser 3.90, and TypeScript, the client handles connection management, game rendering, input processing, and network synchronization.

### Technology Stack

- **Electron 28**: Desktop application framework providing native windowing and Node.js integration
- **Phaser 3.90**: Game engine handling rendering, sprites, input, and game loop
- **TypeScript**: Type-safe development with ES modules
- **esbuild**: Fast bundling of renderer code with CommonJS output for Electron compatibility
- **MEW SDK Client**: WebSocket-based protocol client for real-time communication

### Connection Flow

1. **Launch**: Application displays a connection form with four fields:
   - Gateway URL (default: `ws://localhost:8080`)
   - Space name (e.g., `mew-world`)
   - Username (must match a participant ID: `player1`, `player2`, etc.)
   - Token (from `.mew/tokens/<username>.token` in the space directory)

2. **Connection**: On form submission, the client:
   - Creates a `MEWClient` instance with the provided credentials
   - Establishes WebSocket connection to the gateway
   - Waits for `system/welcome` message confirming successful join
   - Transitions from connection screen to game view

3. **Game Start**: Once connected, Phaser game initializes with:
   - 1280x720 window with resizable viewport
   - Isometric grid (20x20 tiles, 64x32 tile dimensions)
   - Local player sprite (green circle at center)
   - Arrow key input binding
   - Position update subscription

### Position Synchronization Protocol

All movement is synchronized over MEW protocol streams. Each participant negotiates a stream once per session using `PositionStreamManager`:

1. **Request** – send `stream/request` with `description: "mew-world/positions"` and `direction: "bidirectional"`.
2. **Open** – the gateway broadcasts `stream/open` and everyone records the `stream_id` owner.
3. **Frames** – send raw frames formatted as `#<stream_id>#<json>` at 10 Hz.
4. **Close** – optional `stream/close` when disconnecting or pausing.

**Stream Request Envelope:**
```json
{
  "kind": "stream/request",
  "to": ["gateway"],
  "payload": {
    "direction": "bidirectional",
    "description": "mew-world/positions"
  }
}
```

**Frame Payload (stringified JSON):**
```json
{
  "participantId": "player1",
  "worldCoords": { "x": 412.5, "y": 296.3 },
  "tileCoords": { "x": 6, "y": 9 },
  "velocity": { "x": 42.1, "y": -17.6 },
  "timestamp": 1736202000123,
  "platformRef": null
}
```

**Publishing:**
- Local player position published every 100ms (10 Hz) via `MEWClient.sendStreamData`.
- Payload matches `PositionUpdate` but travels without extra envelope metadata.
- Stream ID cached by `PositionStreamManager` so the render loop can skip sending until ready.

**Subscribing:**
- `MEWClient.onStreamData` feeds frames into `PositionStreamManager.parseFrame`.
- Manager validates the owner and returns a typed `PositionUpdate`.
- Game scene ignores updates originating from the local participant ID.

### Remote Player Rendering

When a remote player's position update arrives:

1. **Player Creation** (first update):
   - Creates new Phaser sprite at received world coordinates
   - Sets red tint to distinguish from local player (green)
   - Stores player in `remotePlayers` Map indexed by participant ID
   - Logs join event to console

2. **Position Updates** (subsequent):
   - Sets target position from received coordinates
   - Stores timestamp and velocity for interpolation

3. **Interpolation** (every frame):
   - Calculates distance between sprite and target position
   - Smoothly moves sprite toward target at 5x speed factor
   - Prevents jittery movement from network latency
   - Only interpolates if distance > 1 pixel (reduces unnecessary calculations)

### Local Player Movement

**Input Processing:**
- Arrow keys control movement in 4 directions
- Diagonal movement automatically normalized
- Movement speed: 100 pixels/second
- Delta-time based for frame-rate independence

**Rendering:**
- Local player sprite rendered as green circle (12px radius)
- Camera follows player with smooth lerp (0.1 factor)
- Sprite anchored at (0.5, 0.8) for proper isometric positioning

### Isometric Grid System

**Grid Rendering:**
- 20x20 tile grid with diamond-shaped tiles
- Tile dimensions: 64px wide, 32px tall
- Alternating tile colors for visual clarity (#3a6e2f, #4a7e3f)
- Screen position calculated via isometric projection:
  ```
  screenX = (x - y) * (tileWidth / 2)
  screenY = (x + y) * (tileHeight / 2)
  ```

**Coordinate Conversion:**
- World coordinates: Pixel positions in game space
- Tile coordinates: Grid positions (calculated from world coords)
- Both included in position updates for future pathfinding use

### Build Process

The client uses a two-stage build:

1. **TypeScript Compilation**: Compiles `.ts` files to `.js` with ES module format
2. **esbuild Bundling**: Bundles renderer code with dependencies
   - Format: CommonJS (for Electron renderer compatibility)
   - Platform: Node.js (to preserve Node built-ins like `events`, `ws`)
   - Externals: `electron`, `phaser3spectorjs` (loaded at runtime)
   - Output: `dist/renderer.bundle.js` (~6.5MB including Phaser)

**Key Configuration:**
```json
{
  "type": "module",
  "main": "dist/main.js",
  "nodeIntegration": true,
  "contextIsolation": false
}
```

### Multi-Instance Testing

To test with multiple players:

1. Build once: `npm run build`
2. Launch multiple Electron instances: `npm start` (in separate terminals)
3. Each instance connects with different player credentials
4. All players see each other's movements in real-time
5. Movement is smooth thanks to client-side interpolation
6. Headless option: `npm run headless -- --gateway ws://localhost:8080 --space mew-world --participant player1 --token <token>`

### Known Limitations (Current Implementation)

- No collision detection (players can overlap)
- No terrain boundaries (players can move infinitely)
- Simple circle sprites (no animations)
- No AI agents yet (requires GameAgent implementation)
- No ships yet (requires ship MCP server)
- No platform coordinate system yet (required for ships)
- Position updates sent continuously at 10 Hz (could optimize to only send when moving)
