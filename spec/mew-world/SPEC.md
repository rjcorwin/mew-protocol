# MEW Protocol Isometric Multiplayer Game - Specification

## Overview

This game is a multiplayer isometric 2D world where participants (humans and AI agents) can move around, interact, and board ships. Built with Phaser 3 (v3.90.0) and TypeScript, it uses an Electron-based client that connects to a MEW protocol space. All participants communicate their positions and actions through MEW protocol streams, enabling real-time synchronization. The game features a space template with 4 human slots and 4 AI agent slots, where agents use an extended MEWAgent class with navigation capabilities. Ships act as movable platforms controlled through MCP tools, with players able to walk on them and be carried as the ship moves, requiring a relative coordinate system to handle movement on moving platforms.

## Client Architecture

The Electron application serves as the game client, presenting a connection form on launch where users enter the MEW gateway URL, port, username, and authentication token. Once connected, the client establishes a WebSocket connection to the MEW space using the MEW SDK client. The Phaser 3 game engine runs within the Electron window, rendering the isometric world and handling all game logic, input, and rendering. The client subscribes to MEW protocol streams to receive position updates from other participants and publishes its own position changes through the same mechanism. The client maintains a local game state synchronized with the MEW space, handling latency and reconciling any conflicts between local predictions and authoritative server state received via the protocol.

## Player System

All participants in the game are represented as players with a common base interface, though the system is designed to support different player types in the future with varying abilities and sprites. Each player has an MCP tool called `get_player_info` that returns their player type, current position, sprite identifier, movement speed, and any special abilities. For the initial implementation, all players share the same sprite and movement characteristics. Players interact with the world through MCP tools: `move_to` for pathfinding to a destination tile, `move_direction` for direct movement commands, and `get_position` for querying current location. The player system tracks whether a player is standing on solid ground or on a ship platform, which affects how their movement commands are interpreted and executed.

## Movement & Networking

Player movement is communicated through MEW protocol streams using a dedicated `player/position` stream that all participants subscribe to. Each position update message contains the player's participant ID, world coordinates (x, y), tile coordinates for the isometric grid, velocity vector, timestamp, and optional platform reference if standing on a ship. The game uses client-side prediction where local players see immediate movement feedback, while remote players' positions are interpolated smoothly based on received updates. The stream handler applies dead reckoning to estimate positions between updates and implements lag compensation to ensure fair gameplay despite network latency. Movement speed is measured in tiles per second, with the game loop updating positions at 60 FPS and broadcasting position updates at a configurable rate (default 10 Hz) to balance network efficiency with visual smoothness.

## AI Agent System

AI agents extend the base MEWAgent class with a new `GameAgent` superclass that adds spatial reasoning and autonomous navigation capabilities. This superclass provides MCP tools that wrap the core movement system, allowing the AI to call `decide_next_move` which returns available adjacent tiles with metadata about terrain, obstacles, and other players. The AI uses Claude's reasoning to select a destination tile based on goals, then calls `execute_move` to initiate pathfinding. The GameAgent implements an A* pathfinding algorithm to navigate around obstacles and other players, respecting the movement speed constraints of the player type. The AI decision loop runs at a slower cadence (1-2 Hz) to avoid excessive API calls, with the pathfinding system handling smooth execution of multi-tile movements. GameAgents can have high-level goals set through their system prompt, such as "explore the world," "follow other players," or "patrol an area," which guide their decision-making process.

## Ship System

Ships are movable platforms implemented as MEW participants backed by a ship server that manages physics and state. Each ship is controlled interactively by players who can grab two control points: the **steering wheel** (steer left/right with arrow keys) and **sail ropes** (adjust speed 0-3 with up/down arrows). Ships broadcast their position through the same `game/position` message stream as players, using a special participant ID (e.g., `ship1`). The ship server runs a 60 Hz physics loop that updates position based on heading and speed, and implements tile-based collision detection to prevent sailing onto land. Ships have a defined rectangular deck boundary (64×96 pixels) that players can board by walking onto the ship. When a player enters a ship's deck boundary, they automatically transition to ship-relative coordinates and "ride along" as the ship moves. Players can walk around the deck while the ship is moving, with the client handling coordinate transformations to keep players positioned correctly relative to the moving platform.

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
   - Tiled map loaded from `assets/maps/map1.tmj` (30×30 tiles, 32×16 tile dimensions)
   - Tileset image loaded from `assets/maps/terrain.png`
   - Local player sprite (green circle at center of map)
   - Arrow key input binding
   - Position update subscription
   - Tile-based collision detection active

### Position Synchronization Protocol

Position updates use custom MEW protocol messages rather than dedicated streams, ensuring all participants receive broadcasts regardless of join order.

**Message Format:**
```typescript
{
  kind: "game/position",
  to: [],  // Broadcast to all participants
  payload: {
    participantId: string,
    worldCoords: { x: number, y: number },
    tileCoords: { x: number, y: number },
    velocity: { x: number, y: number },
    timestamp: number,
    platformRef: string | null
  }
}
```

**Publishing:**
- Local player position published every 100ms (10 Hz)
- Only publishes when position data is available (no throttling on movement)
- Updates include current world coordinates, tile coordinates, velocity, and timestamp

**Subscribing:**
- Client listens for all `game/position` messages via `onMessage` handler
- Filters out own updates by comparing `participantId`
- Creates or updates remote player sprites based on received positions

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

### Tiled Map Integration

**Map Editor:**
- Maps created in [Tiled Map Editor](https://www.mapeditor.org/) and exported as JSON (.tmj)
- Embedded tilesets (Phaser doesn't support external .tsx files)
- Isometric orientation with customizable tile dimensions
- Current implementation: 32×16 pixel tiles for lower-resolution aesthetic

**Map Structure:**
- Multiple layers supported: Ground, Obstacles, Water, Decorations
- Current maps use single "Tile Layer 1" with all terrain data
- Tileset image loaded from `assets/maps/terrain.png`
- Tile properties define gameplay behavior:
  - `walkable` (bool): Can player move onto this tile?
  - `speedModifier` (float): Movement speed multiplier (0.5 for water, 0.0 for walls, 1.0 for normal)
  - `terrain` (string): Semantic type (grass, sand, water, wall, concrete, etc.)

**Collision Detection:**
- Tile-based collision with O(1) lookups
- `checkTileCollision()` converts world coordinates to tile coordinates
- Non-walkable tiles (`walkable: false`) block movement
- Speed modifiers applied during movement (e.g., 50% speed in water)
- Map boundaries enforced (players cannot walk off grid edges)

**Current Map (map1.tmj):**
- 30×30 isometric grid
- 4 tile types with isometric cube artwork:
  - Tile 0 (sand): walkable, speedModifier 0.8, tan cube
  - Tile 1 (grass): walkable, speedModifier 1.0, green cube
  - Tile 2 (water): walkable, speedModifier 0.5, blue cube
  - Tile 3 (concrete): non-walkable, dark cube (walls)

**Coordinate Conversion:**
- World coordinates: Pixel positions in game space
- Tile coordinates: Grid positions (calculated from world coords via `worldToTileXY`)
- Coordinates floored to integers before tile lookups to prevent precision errors
- Both included in position updates for future pathfinding use

**Rendering:**
- Phaser loads tilemap from JSON via `tilemapTiledJSON`
- Tileset image loaded separately via `load.image`
- Layers rendered in order: Ground → Water → Obstacles → Decorations
- Camera bounds calculated from map dimensions to handle isometric projection
- Isometric projection formula:
  ```
  screenX = (x - y) * (tileWidth / 2)
  screenY = (x + y) * (tileHeight / 2)
  ```

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

### Known Limitations (Current Implementation)

- Placeholder sprites (colored circles with arrows, not final artwork)
- Players can overlap each other (no player-to-player collision)
- No AI agents yet (requires GameAgent implementation)
- Position updates sent continuously at 10 Hz (could optimize to only send when moving)
- Single layer maps (no multi-layer terrain support yet)
- No game controller support yet (keyboard only)
- Ships use simplified rectangular collision (only checks 5 points)

### Completed Features (Milestone 3)

- ✅ Tiled Map Editor integration with JSON export
- ✅ Embedded tileset support with custom artwork
- ✅ Tile-based collision detection (walls block movement)
- ✅ Map boundary enforcement (cannot walk off grid)
- ✅ Tile properties system (walkable, speedModifier, terrain)
- ✅ Water tiles with speed reduction (50% movement speed)
- ✅ Custom isometric cube artwork (sand, grass, water, concrete)
- ✅ Multi-player position synchronization with collision

### Completed Features (Milestone 4)

- ✅ 8-directional sprite sheet system (128×256, 32×32 frames)
- ✅ Direction calculation from velocity vector (atan2 + 45° quantization)
- ✅ Walk animations for all 8 directions (N, NE, E, SE, S, SW, W, NW)
- ✅ Local player animation updates based on movement
- ✅ Idle state handling (animation stops when not moving)
- ✅ `facing` field in position updates for animation sync
- ✅ Remote player animation synchronization
- ✅ Placeholder sprite generation script for testing
- ✅ Future-proof architecture for game controller support

### Completed Features (Milestone 5)

- ✅ Ship MCP server foundation with physics simulation (60 Hz)
- ✅ Ship state management (position, heading, speed, control points)
- ✅ Ship position broadcasting via `game/position` messages
- ✅ Interactive control points (wheel for steering, sails for speed)
- ✅ Player-to-ship message protocol (`ship/grab_control`, `ship/steer`, `ship/adjust_sails`)
- ✅ Ship rendering in Phaser client (brown rectangle sprite)
- ✅ Control point visualization (green circles when available, red when controlled)
- ✅ Interaction UI prompts ("Press E to grab wheel")
- ✅ Platform coordinate system (players "ride along" on ships)
- ✅ Ship boundary detection (automatic boarding when entering deck area)
- ✅ Tile-based collision detection for ships
- ✅ Map data broadcasting from client to ships
- ✅ Isometric coordinate conversion for navigation
- ✅ Ships stop automatically when hitting land boundaries
- ✅ 8-directional ship heading (N, NE, E, SE, S, SW, W, NW)
- ✅ 4 speed levels (0=stopped, 1=slow, 2=medium, 3=fast)

## Milestone 4: Directional Player Sprites with 8-Way Animation

### Overview

Replace the current placeholder circle sprites with animated character sprites that support 8-directional movement. This system is designed to prepare for future game controller support (analog stick input), where players can move in any direction, not just the 4 cardinal directions currently supported by arrow keys.

### Problem Statement

The current implementation uses simple colored circles (green for local player, red for remote players) that provide no visual feedback about:
- Which direction a player is facing
- Whether a player is moving or stationary
- The character's identity or appearance

For a compelling multiplayer experience, players need animated sprites that:
1. Face the direction they're moving (8 directions: N, NE, E, SE, S, SW, W, NW)
2. Animate smoothly when walking
3. Show idle animations when stationary
4. Support future input methods (game controllers with analog sticks)

### Proposed Solution

#### Sprite Sheet Format

Use a **single sprite sheet per character** with a standard 8-direction layout:

```
File: player.png (128×256 pixels)
Format: 4 columns × 8 rows = 32 frames total

Row 0 (frames 0-3):   Walk South (down)
Row 1 (frames 4-7):   Walk Southwest
Row 2 (frames 8-11):  Walk West (left)
Row 3 (frames 12-15): Walk Northwest
Row 4 (frames 16-19): Walk North (up)
Row 5 (frames 20-23): Walk Northeast
Row 6 (frames 24-27): Walk East (right)
Row 7 (frames 28-31): Walk Southeast
```

**Frame dimensions:** 32×32 pixels per frame (fits on 32×16 isometric tiles)
**Animation:** 4 frames per direction (simple walk cycle)

#### Direction Calculation

Convert velocity vector to one of 8 directions using angle quantization:

```typescript
// Calculate angle from velocity vector
const angle = Math.atan2(velocity.y, velocity.x);

// Quantize to nearest 45° increment (8 directions)
const directionIndex = Math.round(angle / (Math.PI / 4)) % 8;

// Map to direction names
const directions = [
  'east',      // 0°
  'southeast', // 45°
  'south',     // 90°
  'southwest', // 135°
  'west',      // 180°
  'northwest', // 225°
  'north',     // 270°
  'northeast'  // 315°
];

// Play corresponding animation
player.play(`walk-${directions[directionIndex]}`, true);
```

#### Animation System

**Walk Animations:**
- 8 animations (one per direction)
- 4 frames each, looping at 10 FPS
- Only play when velocity magnitude > 0

**Idle State:**
- Use first frame of last walking direction
- No animation loop (static sprite)

**Implementation in GameScene.ts:**

```typescript
export class GameScene extends Phaser.Scene {
  private lastFacing: Direction = 'south'; // Track facing direction
  private localPlayer!: Phaser.GameObjects.Sprite;

  preload() {
    // Load player sprite sheet (8 directions, 4 frames each)
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32,
      frameHeight: 32
    });
  }

  create() {
    // Create 8 directional walk animations
    const directions = ['south', 'southwest', 'west', 'northwest',
                        'north', 'northeast', 'east', 'southeast'];

    directions.forEach((dir, i) => {
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers('player', {
          start: i * 4,  // First frame of row i
          end: i * 4 + 3 // Last frame of row i (4 frames per direction)
        }),
        frameRate: 10,
        repeat: -1 // Loop indefinitely
      });
    });
  }

  update(time: number, delta: number) {
    // Update local player animation based on velocity
    if (velocity.length() > 0) {
      // Player is moving - update animation and track facing
      this.lastFacing = this.updatePlayerAnimation(this.localPlayer, velocity);
    } else {
      // Player is idle - stop animation
      this.localPlayer.anims.stop();
    }
  }

  private updatePlayerAnimation(sprite: Phaser.GameObjects.Sprite, velocity: Phaser.Math.Vector2): Direction {
    const direction = this.calculateDirection(velocity);
    sprite.play(`walk-${direction}`, true); // true = ignore if already playing
    return direction;
  }

  private calculateDirection(velocity: Phaser.Math.Vector2): Direction {
    const angle = Math.atan2(velocity.y, velocity.x);
    const dirIndex = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
    const directions: Direction[] = ['east', 'southeast', 'south', 'southwest',
                                      'west', 'northwest', 'north', 'northeast'];
    return directions[dirIndex];
  }
}
```

#### Position Update Protocol Enhancement

Add `facing` field to position updates to synchronize animation state:

```typescript
{
  kind: "game/position",
  to: [],
  payload: {
    participantId: string,
    worldCoords: { x: number, y: number },
    tileCoords: { x: number, y: number },
    velocity: { x: number, y: number },
    facing: 'north' | 'northeast' | 'east' | 'southeast' |
            'south' | 'southwest' | 'west' | 'northwest',  // NEW
    timestamp: number,
    platformRef: string | null
  }
}
```

Remote players will play the animation corresponding to the `facing` direction received in position updates.

#### Future Controller Support

This 8-direction system is **future-proof for game controllers**:

```typescript
// Gamepad analog stick (future milestone)
const gamepad = navigator.getGamepads()[0];
if (gamepad) {
  const leftStickX = gamepad.axes[0];  // -1 to 1
  const leftStickY = gamepad.axes[1];  // -1 to 1

  // Dead zone filtering
  const deadZone = 0.15;
  const magnitude = Math.sqrt(leftStickX**2 + leftStickY**2);

  if (magnitude > deadZone) {
    // Angle calculation works identically for analog input
    const angle = Math.atan2(leftStickY, leftStickX);
    const dirIndex = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
    // ... same direction mapping
  }
}
```

The same angle-to-direction logic works for:
- Arrow keys (4 directions + diagonals)
- WASD keys (4 directions + diagonals)
- Analog sticks (360° input quantized to 8 directions)
- Touch controls (swipe gestures)

### Implementation Plan

#### Phase 4a: Sprite System Foundation ✅ COMPLETED
1. ✅ Create `assets/sprites/` directory structure
2. ✅ Generate placeholder 8-direction sprite sheet for testing
3. ✅ Update `GameScene.ts` to load sprite sheet instead of procedural circle
4. ✅ Implement 8-direction animation system
5. ✅ Add direction calculation from velocity
6. ✅ Test with keyboard input (diagonal movement with simultaneous arrow keys)

#### Phase 4b: Animation State Management ✅ COMPLETED
1. ✅ Add `facing` field to `PositionUpdate` type
2. ✅ Update local position publishing to include facing direction
3. ✅ Implement remote player animation synchronization
4. ✅ Add idle state handling (stop animation when velocity = 0)
5. ✅ Test with multiple clients to verify animation sync

#### Phase 4c: Sprite Artwork (Optional) - NOT STARTED
1. Create or commission proper character sprites
2. Design walk cycle animations (4 frames per direction)
3. Export as 128×256 PNG sprite sheet
4. Replace placeholder sprites
5. Test visual quality and performance

### Technical Considerations

**Why 8 Directions (Not 16)?**
- 8 directions provide good visual fidelity without excessive sprite work
- Each additional direction doubles sprite sheet size
- 16 directions (22.5° increments) rarely justify the cost
- Industry standard: most isometric games use 8 directions

**Why Single Sprite Sheet?**
- Single HTTP request (faster loading)
- Standard Phaser workflow (`load.spritesheet`)
- Easier for artists (all animations in one file)
- Simpler animation management

**Why 32×32 Frame Size?**
- Matches tile-based grid (32×16 tiles)
- Large enough for detail, small enough for performance
- Standard retro game resolution

**Performance:**
- 32 frames × 32×32px = 32KB uncompressed (negligible)
- Animation switching is O(1) in Phaser
- No impact on network (only facing string changes)

### Alternatives Considered

**4 Directions Only:**
- Simpler sprite work (only 16 frames)
- Works for keyboard, but breaks with analog input
- Visually jarring diagonal movement (character faces wrong way)
- **Rejected:** Not future-proof for controllers

**16 Directions:**
- More accurate facing (22.5° increments)
- Requires 64 frames (double sprite work)
- Minimal visual improvement over 8 directions
- **Rejected:** Diminishing returns

**Separate Files per Direction:**
- 8 HTTP requests instead of 1
- More file management complexity
- Slightly easier to edit individual directions
- **Rejected:** Single sprite sheet is industry standard

**Texture Atlas:**
- Most memory-efficient format
- Requires build tooling (TexturePacker)
- Overkill for single character sprite
- **Rejected:** Unnecessary complexity for now (can migrate later)

### Success Criteria

- ✅ Players face the direction they're moving (8 directions)
- ✅ Walk animations play smoothly during movement
- ✅ Players show idle frame when stationary
- ✅ Remote players' animations synchronize correctly
- ✅ No visual glitches during direction changes
- ✅ System is extensible to future controller input

### Future Milestones Enabled

- **Milestone 5+**: Game Controller Support (analog stick input)
- **Milestone N**: Multiple character types with different sprites
- **Milestone N**: Character customization (swap sprite sheets)
- **Milestone N**: Advanced animations (attack, jump, emote)
