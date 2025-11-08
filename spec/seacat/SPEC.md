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

Ships are movable platforms implemented as MEW participants backed by a ship server that manages physics and state. Each ship is controlled interactively by players who can grab two control points: the **steering wheel** (continuous rotation via wheel angle) and **sail ropes** (adjust speed 0-3 with up/down arrows). Ships use realistic wheel-based steering where holding left/right turns the wheel continuously, and releasing the wheel **locks** it at the current position (ship keeps turning). The wheel angle determines the turn rate, creating smooth, realistic ship rotation. Ships broadcast their position and rotation through the same `game/position` message stream as players, using a special participant ID (e.g., `ship1`). The ship server runs a 60 Hz physics loop that updates position and rotation, and implements tile-based collision detection to prevent sailing onto land. Ships have a defined rectangular deck boundary (128×48 pixels - length × beam in ship-local coordinates, where the ship faces east at rotation=0) that players can board by walking onto the ship. The default heading is **south**, which orients the ship's length (128px) vertically on screen for proper forward movement. When a player enters a ship's deck boundary, they automatically transition to ship-relative coordinates and "ride along" as the ship moves and rotates. Players can walk around the deck while the ship is moving and turning, with the client using isometric coordinate transformations to keep players positioned correctly relative to the rotating platform.

## Coordinate Systems & Relative Movement

The game implements a hybrid coordinate system combining Cartesian physics with isometric rendering. **Server-side physics** use Cartesian coordinates (simple, proven approach used by industry-standard isometric games like StarCraft and Age of Empires). **Client-side rendering** uses isometric transforms for all visual elements, collision detection, and player movement input. This "cosmetic isometric" approach provides visual consistency while keeping physics simple.

**Projectile Physics (p2v-projectile-velocity):** Cannon projectiles use a **3D coordinate system** that separates ground movement (groundX, groundY) from height (heightZ). This ensures gravity only affects vertical elevation, not horizontal ground movement, producing uniform trajectories in all directions. The server calculates 3D velocity using inverse isometric transforms to convert screen-space fire angles to ground-space azimuth angles. Both client and server simulate physics using identical iterative Euler integration to prevent desync. See Milestone 9 Phase 2 for detailed implementation.

**Platform Coordinates:** The game also implements platform-relative coordinates to handle players on moving ships. World coordinates are absolute positions in the game world, while platform coordinates are relative offsets from a platform's origin point (used when standing on a ship). Each player's state includes a `platform_ref` field that is null when on solid ground or references a ship participant ID when aboard. When a player is on a ship, their world position is calculated as `ship.world_position + player.platform_offset` (using isometric rotation), recalculated every frame as the ship moves and rotates. Movement commands from players on ships are interpreted as relative movements within the ship's coordinate frame, with collision detection checking against the ship's deck boundaries (using isometric OBB) rather than world terrain. The rendering system uses isometric transforms to position players correctly on rotating platforms, ensuring players stay within visual ship bounds during rotation.

## Current Client Implementation

The Electron-based game client (`clients/seacat`) provides the complete player experience for Seacat. Built with Electron 28, Phaser 3.90, and TypeScript, the client handles connection management, game rendering, input processing, and network synchronization.

### Technology Stack

- **Electron 28**: Desktop application framework providing native windowing and Node.js integration
- **Phaser 3.90**: Game engine handling rendering, sprites, input, and game loop
- **Howler.js 2.2.3**: Audio library for cross-platform sound effects (replaces Phaser audio for Electron compatibility)
- **TypeScript**: Type-safe development with ES modules
- **esbuild**: Fast bundling of renderer code with CommonJS output for Electron compatibility
- **MEW SDK Client**: WebSocket-based protocol client for real-time communication

### Code Architecture

The game code uses a **manager pattern** with clear separation of concerns, implemented in the s7g-gamescene-refactor (2025-11-03).

**Directory Structure:**
```
clients/seacat/src/game/
├── GameScene.ts              # Main orchestrator (~500 lines)
│
├── managers/                 # State management
│   ├── CollisionManager.ts  # Tile & OBB collision detection
│   ├── MapManager.ts         # Tiled map loading & navigation
│   ├── PlayerManager.ts      # Remote player lifecycle & interpolation
│   ├── ProjectileManager.ts  # Cannonball physics & collision
│   └── ShipManager.ts        # Ship state updates & lifecycle
│
├── rendering/                # Visual systems
│   ├── EffectsRenderer.ts   # VFX (cannon blasts, splashes, particles)
│   ├── PlayerRenderer.ts     # 8-directional player animations
│   ├── ShipRenderer.ts       # Ship sprites, control points, boundaries
│   ├── ViewportRenderer.ts   # Diamond border & gradient background (d7v)
│   └── WaterRenderer.ts      # Wave animation & height calculation
│
├── input/                    # Input handling
│   ├── PlayerInputHandler.ts  # Keyboard movement, collision, wave bobbing
│   └── ShipInputHandler.ts    # Ship control interaction & commands
│
├── network/                  # Multiplayer communication
│   ├── NetworkClient.ts      # Position updates & message routing
│   └── ShipCommands.ts       # Ship control protocol messages
│
└── utils/                    # Shared utilities
    ├── Constants.ts          # Game constants (speeds, dimensions, viewport config)
    ├── IsometricMath.ts      # Coordinate transforms & rotation
    └── ViewportManager.ts    # Diamond culling & camera calculations (d7v)
```

**Design Principles:**
- **Single Responsibility**: Each file handles one concern (rendering, physics, input, etc.)
- **Manager Pattern**: Managers own lifecycle and updates for their domain
- **Dependency Injection**: Managers receive dependencies via constructor
- **Clear Interfaces**: Public APIs documented with comprehensive JSDoc
- **Phaser Integration**: Works with Phaser's scene system, not against it

**GameScene as Orchestrator:**

GameScene.ts acts as a lightweight orchestrator that initializes managers and delegates updates:

```typescript
export class GameScene extends Phaser.Scene {
  // Managers
  private mapManager!: MapManager;
  private collisionManager!: CollisionManager;
  private playerManager!: PlayerManager;
  private shipManager!: ShipManager;
  private projectileManager!: ProjectileManager;

  // Renderers
  private effectsRenderer!: EffectsRenderer;
  private playerRenderer!: PlayerRenderer;
  private shipRenderer!: ShipRenderer;
  private waterRenderer!: WaterRenderer;

  // Input handlers
  private playerInputHandler!: PlayerInputHandler;
  private shipInputHandler!: ShipInputHandler;

  // Network
  private networkClient!: NetworkClient;
  private shipCommands!: ShipCommands;

  create() {
    // Initialize managers in dependency order
    this.initializeUtilities();
    this.initializeManagers();
    this.initializeRenderers();
    this.initializeInput();
    this.initializeNetwork();
  }

  update(time: number, delta: number) {
    // Delegate to managers
    this.networkClient.update(time, velocity);
    const velocity = this.playerInputHandler.handleMovement(delta, controllingShip, onShip);
    this.playerManager.update(delta, time);
    this.shipManager.update(delta, time);
    this.projectileManager.update(delta);
    this.waterRenderer.update(time);
    // ... etc
  }
}
```

**Benefits:**
- Reduced GameScene.ts from 2603 lines to ~500 lines
- 15 focused modules with clear responsibilities
- Easier to understand, test, and modify individual systems
- Enables parallel development (multiple devs can work on different managers)
- No file exceeds 500 lines

See `spec/seacat/proposals/s7g-gamescene-refactor/` for full refactor specification and implementation plan.

### Rendering System: Diamond Viewport & Diorama Framing (d7v-diamond-viewport)

The game uses a **diamond-shaped viewport** (square rotated 45°) that defines the visible play area, creating a distinctive "diorama" aesthetic with visible boundaries and static background layers. This system provides performance optimization through distance-based culling while establishing a unique visual identity.

**Core Architecture:**

**Diamond Viewport Configuration:**
```typescript
DIAMOND_SIZE_TILES: 35         // Square diamond (35×35 tiles)
DIAMOND_BORDER_TOP_TILES: 7    // More space for sky (diamond positioned lower)
DIAMOND_BORDER_BOTTOM_TILES: 1 // Less space for sea (diamond closer to bottom)
DIAMOND_BORDER_LEFT_TILES: 3   // Symmetric sides
DIAMOND_BORDER_RIGHT_TILES: 3
```

**Camera Positioning:**
- Diamond positioned **below window center** for expanded sky area
- Camera follow offset: `(topBorder - bottomBorder) / 2` pixels downward
- Creates more visual space for atmospheric backgrounds
- Player appears in lower portion of window with sky above

**Background Layers (depth ordering):**
1. **Gradient background** (depth -2000): Sky-to-sea gradient, horizon at 50% down
2. **Custom background image** (depth -1000): PNG overlay, camera-fixed (scrollFactor 0)
3. **Shimmer particles** (depth -900): Animated underwater light effects (s8m-shimmer-particles)
4. **Game world** (depth 0+): Tiles, ships, players, projectiles
5. **Diamond border** (depth 100): Visual frame (rendered by ViewportRenderer)
6. **UI elements** (depth 1000+): Health bars, interaction prompts

**Shimmer Particle System (s8m-shimmer-particles):**

Animated white particles that create underwater light shimmer effects in the water area:

- **Particle Count**: 200 particles distributed across viewport width
- **Boundary**: Constrained to water area (y >= 190px, below horizon line)
- **Animation**: Time-based sine wave fading for smooth, frame-rate-independent twinkling
- **Size**: Random 1-3 pixel radius per particle
- **Speed**: Random 0.00015-0.0006 multiplier (slow, subtle twinkling)
- **Opacity**: Random 0.2-0.9 maximum alpha (never fully opaque)
- **Rendering**: Phaser Graphics, camera-fixed (scrollFactor 0)
- **Glow Effect**: Particles > 2px include subtle glow for depth
- **Responsive**: Automatically repositions on window resize

The shimmer system replaces static dots from the background image, enabling dynamic animation that enhances the underwater atmosphere while respecting the horizon boundary.

See `spec/seacat/proposals/s8m-shimmer-particles/` for complete specification.

**Visibility System - Border Frame with Motion Detection:**

Instead of static fade zones, the viewport uses a **motion-reactive border frame system**:

- **Core area** (inside diamond): Always fully visible (alpha 1.0)
- **Border rows** (outside diamond): 3 rows with fixed opacity levels
  - Row 1 (distance 1): 88% opacity
  - Row 2 (distance 2): 45% opacity
  - Row 3 (distance 3): 10% opacity
- **Motion detection**: Border appears when player is moving
- **Auto-fade**: Border fades out after ~1 second (60 frames) of no movement
- **Smooth animation**: Tiles animate using 0.05 lerp factor (~20 frames at 60fps)

**Performance Optimization:**
- Only checks tiles within viewport + 3-tile margin (not entire map)
- ~85% reduction in tile visibility checks on large maps
- Entities use hard cutoff (no fade) to avoid ghostly appearance
- Maintains 60 FPS with typical entity counts

**Culling Implementation:**
- **Tiles**: Animated fade with state tracking (MapManager)
- **Ships**: Hard cutoff (ShipManager)
- **Players**: Hard cutoff (PlayerManager)
- **Projectiles**: Hard cutoff (ProjectileManager)

**Files:**
- `clients/seacat/src/game/utils/Constants.ts` - Viewport configuration
- `clients/seacat/src/game/utils/ViewportManager.ts` - Diamond culling utilities
- `clients/seacat/src/game/GameScene.ts` - Camera offset setup, shimmer integration
- `clients/seacat/src/game/rendering/ViewportRenderer.ts` - Border and gradient rendering
- `clients/seacat/src/game/rendering/ShimmerRenderer.ts` - Animated shimmer particles (s8m)
- `clients/seacat/src/game/managers/MapManager.ts` - Border frame system implementation

**Benefits:**
- **Performance**: 50-70% reduction in tile rendering on large maps
- **Visual Identity**: Unique "model ship in a box" diorama aesthetic
- **Smooth Transitions**: No visual jitter from tile popping
- **Future-Ready**: Foundation for dynamic backgrounds (weather, day/night cycle)

See `spec/seacat/proposals/d7v-diamond-viewport/` for full specification and implementation details.

### Audio System

The game uses **Howler.js** instead of Phaser's built-in audio system due to Electron compatibility issues.

**Problem**: Phaser's `this.load.audio()` uses an XHR-based loader that is fundamentally incompatible with Electron's `file://` protocol. Even with absolute file paths, Phaser's audio loader crashes the Electron renderer process.

**Solution**: Howler.js provides HTML5 Audio and Web Audio API support that works correctly in Electron:

```typescript
// Create Howl instances with absolute paths
const basePath = window.location.href.replace('index.html', '');
this.sounds = {
  cannonFire: new Howl({
    src: [basePath + 'assets/sounds/cannon-fire.mp3'],
    volume: 0.5,
    html5: true,      // Use HTML5 Audio for Electron compatibility
    preload: true     // Load files immediately
  })
};
```

**Key Implementation Details**:
- **Absolute paths**: Use `window.location.href` to construct full `file://` URLs (relative paths fail in Electron)
- **html5: true**: Forces HTML5 `<audio>` elements instead of Web Audio API's XHR loader
- **preload: true**: Loads audio files on scene creation for instant playback
- **Playback API**: `.play()` and `.stop()` methods are compatible with Phaser's sound interface

**Audio Files**:
All combat sound effects are stored in `assets/sounds/` as MP3 files (38-104KB each):
- `cannon-fire.mp3` - Deep cannon boom (60KB)
- `hit-impact.mp3` - Wood crack when cannonball hits ship (104KB)
- `water-splash.mp3` - Splash when cannonball misses (38KB)
- `ship-sinking.mp3` - Creaking/bubbling loop (91KB)
- `ship-respawn.mp3` - Triumphant chime (74KB)

See `spec/seacat/proposals/c5x-ship-combat/implementation.md` for detailed troubleshooting history.

### Connection Flow

1. **Launch**: Application displays a connection form with four fields:
   - Gateway URL (default: `ws://localhost:8080`)
   - Space name (e.g., `seacat`)
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

**Phase 5a - Ship MCP Server Foundation:**
- ✅ Ship MCP server foundation with physics simulation (60 Hz)
- ✅ Ship state management (position, heading, speed, control points)
- ✅ Ship position broadcasting via `game/position` messages (10 Hz)
- ✅ 8-directional ship heading (N, NE, E, SE, S, SW, W, NW)
- ✅ 4 speed levels (0=stopped, 1=slow, 2=medium, 3=fast)
- ✅ Ship added to seacat template as `ship1` participant

**Phase 5b - Ship Rendering & Interactive Controls:**
- ✅ Ship rendering in Phaser client (brown rectangle sprite)
- ✅ Control point visualization (green circles when available, red when controlled)
- ✅ E key binding for interaction with control points
- ✅ Interaction zone detection (30 pixel radius around control points)
- ✅ UI prompts when near control points ("Press E to grab wheel")
- ✅ Interactive control points (wheel for steering, sails for speed)
- ✅ Player-to-ship message protocol (`ship/grab_control`, `ship/release_control`, `ship/steer`, `ship/adjust_sails`)
- ✅ Message handlers on ship server for all control messages
- ✅ Arrow key steering (left/right when controlling wheel)
- ✅ Arrow key sail adjustment (up/down when controlling sails)
- ✅ Control state tracking (which player controls which point)
- ✅ Immediate state broadcast on control changes
- ✅ Player movement disabled when controlling ship

**Phase 5c - Ship Collision Detection:**
- ✅ Tile-based collision detection for ships
- ✅ Map data broadcasting from client to ships (`ship/map_data` messages)
- ✅ Isometric coordinate conversion for navigation
- ✅ Ships stop automatically when hitting land boundaries
- ✅ Collision detection checks ship center + 4 deck corners
- ✅ Support for both orthogonal and isometric maps

**Milestone 6 - Platform Coordinate System:**
- ✅ Platform coordinate system (players "ride along" on ships)
- ✅ Ship boundary detection (automatic boarding when entering deck area)
- ✅ Local and remote players move with ship
- ✅ Dual coordinate system (world vs platform-relative)

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

## Milestone 7: Ship Rotation & Isometric Coordinate System

### Overview

Implement realistic ship rotation physics with wheel-based steering and convert the coordinate system to true isometric throughout all game systems. Ships now rotate continuously using wheel angle instead of discrete heading changes, and all rendering, collision detection, and player movement uses isometric transforms.

### Ship Rotation (r8s-ship-rotation, w3l-wheel-steering)

**Continuous Rotation Physics:**
- Ships rotate based on wheel angle, not discrete headings
- Turn rate calculated as: `turnRate = wheelAngle * RUDDER_EFFICIENCY`
- Wheel angle ranges from -π to +π radians (180° left/right)
- Physics update at 60 Hz for smooth rotation

**Wheel Steering Controls:**
- Hold left/right arrow to continuously turn the wheel
- Wheel position **locks** when released (ship keeps turning at constant rate)
- Maximum wheel turn rate: π/2 radians per second (90°/sec)
- Rudder efficiency: 0.1 (ship turn rate = 10% of wheel angle)

**State Tracking:**
- `wheelAngle`: Current wheel position in radians
- `turnRate`: Current ship rotation rate in radians/second
- `wheelTurningDirection`: 'left' | 'right' | null (player input)
- `rotationDelta`: Change in rotation since last update (for rotating players on deck)

**Player-on-Ship Rotation (Phase C/D):**
- Players rotate with the ship when it turns
- Control points (wheel/sails) rotate with the ship
- All rotation uses isometric transforms (not Cartesian)
- Players stay within ship visual bounds during rotation

### Isometric Coordinate System (i2m-true-isometric)

**Architecture Decision:**
- **Physics:** Cartesian (server-side, simple and proven)
- **Rendering:** Isometric (client-side, visual consistency)
- **Industry Standard:** StarCraft, Age of Empires, Command & Conquer use this approach

**Phase 1: Isometric Player Movement**
- Arrow keys move along isometric tile axes (NE, SE, SW, NW)
- Basis vectors calculated from tile dimensions (32×16 pixels)
- Player movement aligns with isometric tile grid
- Normalized vectors ensure consistent movement speed

**Phase 3: Isometric Player-on-Ship Rotation**
- `isometricToCartesian()` and `cartesianToIsometric()` transform helpers
- `rotatePointIsometric()` rotates points in isometric space
- Players stay within ship bounds during rotation
- OBB collision detection uses isometric rotation
- Boarding position calculation uses isometric rotation

**Phase 4: Isometric Control Point Positioning**
- Wheel and sails control points use isometric rotation
- Control point interaction detection uses isometric transforms
- Visual position matches interaction hotspot

**Ship Boundary Visualization:**
- Ships rendered as 4 colored corner dots (not filled rectangle)
- Dots rotate using isometric transforms every frame
- Colors: Red (top-left), Green (top-right), Blue (bottom-right), Yellow (bottom-left)
- Boundaries match exactly what collision detection uses
- No sprite rotation - dots redrawn dynamically like control points

**Coordinate Transform Formulas:**
```typescript
// Isometric to Cartesian
cartesian.x = (iso.x + iso.y * 2) / 2
cartesian.y = (iso.y * 2 - iso.x) / 2

// Cartesian to Isometric
iso.x = cart.x - cart.y
iso.y = (cart.x + cart.y) / 2

// Isometric Rotation
1. Convert point from isometric to Cartesian
2. Apply standard 2D rotation matrix
3. Convert result back to isometric
```

**Implementation Status:**
- ✅ Phase 1: Isometric player movement
- ✅ Phase 3: Isometric player-on-ship rotation
- ✅ Phase 4: Isometric control point positioning
- ✅ Isometric OBB collision detection
- ✅ Isometric ship boundary visualization
- ✅ Phase 2: Pre-rendered ship sprites (64 angles) - see Milestone 8

### Related Proposals

- `r8s-ship-rotation`: Continuous rotation physics system
- `w3l-wheel-steering`: Wheel-based steering with position locking
- `i2m-true-isometric`: Complete isometric coordinate system implementation

See detailed specifications in:
- `spec/seacat/proposals/w3l-wheel-steering/`
- `spec/seacat/proposals/i2m-true-isometric/`

---

## Milestone 8: Ship Sprite Rendering (s6r-ship-sprite-rendering)

### Overview

Replace placeholder ship visualization (4 colored corner dots) with high-quality pre-rendered 3D sprite sheets. Ships now display as blocky voxel-style vessels with 64 rotation frames for smooth visual turning that matches the continuous rotation physics from Milestone 7.

### Rendering Pipeline

**Tool:** Blender 3D (free, cross-platform, scriptable)

**Process:**
1. Model ship in Blender using cube primitives (Minecraft-style blocks)
2. Set up orthographic isometric camera (60° pitch, 45° yaw)
3. Run automated Python script to render 64 rotation frames (5.625° per frame)
4. Assemble frames into 8×8 sprite sheet using ImageMagick
5. Load sprite sheet in Phaser client and map rotation to frame index

### Sprite Sheet Format

**File:** `assets/sprites/ship1.png`
**Dimensions:** 2048×2048 pixels (8 columns × 8 rows)
**Frame size:** 256×256 pixels per frame (high resolution to avoid blur when scaled)
**Frame count:** 64 frames covering 360° rotation
**Rotation increment:** 5.625° per frame (360° / 64)

**Frame ordering:**
- Frame 0: 0° (East, default heading)
- Frame 16: 90° (South)
- Frame 32: 180° (West)
- Frame 48: 270° (North)
- Frame 63: 354.375°

### Visual Style

**Aesthetic:** Minecraft-style isometric blocks (voxel-based)

**Rationale:**
- Matches existing tile artwork (isometric cubes from terrain.png)
- Simple, recognizable silhouettes at low resolution
- Easy to create additional ship types
- Consistent with game's blocky aesthetic

**Ship structure (example sailing ship):**
- Hull: Rectangular voxel blocks (dark wood)
- Deck: Flat planks (lighter wood)
- Mast: Vertical column
- Sails: Rectangular cloth blocks (white/cream)
- Details: Railings, crow's nest, rudder (optional)

### Blender Workflow

**Camera settings:**
- Type: Orthographic (matches isometric tiles)
- Position: X=10, Y=-10, Z=8.5 (adjusted for proper framing)
- Rotation: X=60°, Y=0°, Z=45°
- Orthographic Scale: 7.0 (adjusted to fit ship in frame)

**Render settings:**
- Resolution: 256×256 pixels per frame (high res to avoid blur when scaled)
- Background: Transparent (PNG with alpha channel)
- Samples: 32 (good quality for blocky geometry)
- Shading: Flat (no smooth interpolation)

**Automated rendering script:**
```python
# scripts/render-ship-frames.py
# Renders 64 rotation frames automatically
# Usage: blender ship1.blend --background --python render-ship-frames.py
```

### Sprite Sheet Assembly

```bash
# scripts/assemble-sprite-sheet.sh
# Combines 64 frames into 8×8 grid using ImageMagick
montage ship_frames/ship_*.png \
  -tile 8x8 \
  -geometry 256x256+0+0 \
  -background none \
  ship1.png
```

### Client Integration

**Loading sprite sheet (GameScene.ts):**
```typescript
preload() {
  this.load.spritesheet('ship1', 'assets/sprites/ship1.png', {
    frameWidth: 256,
    frameHeight: 256
  });
}
```

**Creating ship sprite:**
```typescript
const shipSprite = this.add.sprite(x, y, 'ship1', 0);
// Origin at (0.5, 0.7) aligns hull/deck at center, mast extends upward
shipSprite.setOrigin(0.5, 0.7);
shipSprite.setDepth(1); // Above ground tiles
// Scale to 0.75 (256px frames scaled to fit 128px deck width, then 1.5x for visibility)
shipSprite.setScale(0.75);
```

**Updating sprite frame from rotation:**
```typescript
private calculateShipSpriteFrame(rotation: number): number {
  // Apply -45° offset to align Blender camera orientation with game coordinates
  const offset = Math.PI / 4; // 45 degrees
  const offsetRotation = rotation - offset;

  // Normalize rotation to 0-2π range
  const normalizedRotation = ((offsetRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Convert to frame index (0-63)
  // Reverse direction: Blender rendered counter-clockwise, game rotates clockwise
  const frameIndex = Math.round(((Math.PI * 2 - normalizedRotation) / (Math.PI * 2)) * 64) % 64;

  return frameIndex;
}

// In update loop
ship.sprite.setFrame(this.calculateShipSpriteFrame(ship.rotation));
// Note: Do NOT call ship.sprite.setRotation() - rotation is shown via frames
```

### Implementation Files

**Assets:**
- `clients/seacat/assets/blender/ship1.blend` - Blender source file
- `clients/seacat/assets/sprites/ship_frames/` - Individual 64 PNGs (temp)
- `clients/seacat/assets/sprites/ship1.png` - Final sprite sheet

**Scripts:**
- `clients/seacat/scripts/render-ship-frames.py` - Blender automation
- `clients/seacat/scripts/assemble-sprite-sheet.sh` - ImageMagick assembly

**Documentation:**
- `spec/seacat/proposals/s6r-ship-sprite-rendering/proposal.md`
- `spec/seacat/proposals/s6r-ship-sprite-rendering/BLENDER_GUIDE.md`
- `spec/seacat/proposals/s6r-ship-sprite-rendering/IMPLEMENTATION_PLAN.md`
- `spec/seacat/proposals/s6r-ship-sprite-rendering/TESTING.md`

### Performance

**File size:** ~1.1 MB per ship type (higher res sprites, acceptable for web delivery)
**Loading time:** ~100-150ms for PNG decode
**Frame switching:** <1ms (O(1) in Phaser)
**GPU memory:** ~16 MB (uncompressed RGBA at 2048×2048)

No performance degradation from placeholder rendering.

### Creating New Ship Types

To add `ship2`, `ship3`, etc.:
1. Model new ship in Blender (save as `ship2.blend`)
2. Run `render-ship-frames.py` (update config for ship2)
3. Run `assemble-sprite-sheet.sh` to create `ship2.png`
4. Load in GameScene: `this.load.spritesheet('ship2', 'assets/sprites/ship2.png', ...)`
5. Use different sprite key based on ship type in ship server config

### Implementation Status

- ✅ Proposal and research completed
- ✅ Blender rendering pipeline created
- ✅ Sprite sheet assembly script created
- ✅ Client integration (GameScene.ts updated)
- ✅ Documentation and guides completed
- ✅ Ship model created in Blender (ship1.blend)
- ✅ Sprite sheet generated and tested (ship1.png)
- ✅ In-game rendering working with smooth rotation
- ✅ Control point rotation fixed
- ✅ Sprite origin and scaling adjusted for proper alignment
- ✅ Resolution increased to 256×256 to eliminate blur

### Related Proposals

- `s6r-ship-sprite-rendering`: Full specification and decision record

See detailed documentation in:
- `spec/seacat/proposals/s6r-ship-sprite-rendering/`

### Future Enhancements

1. **Multiple ship types:** Merchant ships, warships, fishing boats
2. **Damaged states:** Battle damage sprite variants
3. **Sail states:** Different sprites for unfurled/furled sails
4. **Wake effects:** Animated water trails
5. **Player customization:** Choose ship appearance from gallery

---

## Milestone 9: Ship-to-Ship Combat (c5x-ship-combat)

### Overview

Add cannon-based ship combat enabling multiplayer PvP and cooperative multi-crew gameplay. Ships have port and starboard cannons that players can control, aim, and fire to damage other ships. Damaged ships sink when health reaches 0 and respawn after a delay at their spawn point.

### Combat System Architecture

**Core Principles:**
- **Client prediction:** Instant visual feedback for aiming and firing
- **Server authority:** Ship server validates hits and manages damage
- **Deterministic physics:** All clients simulate identical projectile trajectories
- **OBB collision:** Rotation-aware collision detection for projectile hits

**Protocol Flow:**
1. Player fires cannon → Ship server spawns projectile → Broadcasts to all clients
2. Client detects hit → Sends hit claim to SOURCE ship (owns projectile)
3. Source ship validates physics replay → Forwards damage to TARGET ship
4. Target ship applies damage → Broadcasts updated health/sinking state

### Phase 1: Control Points & Aiming ✅ COMPLETE

**Cannon Configuration:**
- 2 port cannons at relative positions `{x: -10, y: -24}` and `{x: 20, y: -24}`
- 2 starboard cannons at `{x: -10, y: 24}` and `{x: 20, y: 24}`
- Horizontal aim range: ±45° from perpendicular
- Elevation range: 15-60° (prevents deck/sky shots)
- Fire cooldown: 4 seconds (4000ms)

**Controls:**
- **E key:** Grab/release nearest cannon
- **Left/Right arrows:** Horizontal aiming (±45° arc)
- **Up/Down arrows:** Elevation adjustment (15-60°)
- **Space bar:** Fire cannon

**Visual Feedback:**
- Cannons rendered as yellow circles (12px radius)
- Yellow when available, red when controlled
- Aim lines show current aim angle when controlling
- Cooldown indicator (gray circle shrinks as cooldown expires)

**Implementation:**
- `ShipServer.ts` - Cannon state management, grab/release/aim/fire handlers
- `ShipParticipant.ts` - Message handlers for player control messages
- `GameScene.ts` - Cannon rendering, input handling, visual feedback

### Phase 2: Projectile Physics (p2v-projectile-velocity) ✅ COMPLETE

**True 3D Isometric Ballistics:**

Projectiles use a **3D coordinate system** that separates ground movement from height, ensuring uniform trajectories in all directions regardless of isometric projection.

**Coordinate Separation:**
- **Ground position** (groundX, groundY): Horizontal movement on the map plane
- **Height** (heightZ): Vertical elevation affected by gravity
- **Screen rendering**: Converts ground + height to isometric coordinates

**Physics Constants:**
- Gravity: 150 px/s² (only affects heightVz, not ground movement)
- Initial speed: 300 px/s (before decomposition into horizontal/vertical components)
- Deck height threshold: 30px (projectiles only hit ships at deck level)

**Velocity Calculation (Server):**

Server calculates 3D velocity in ground-space coordinates:

```typescript
// 1. Calculate fire direction (perpendicular to ship)
const perpendicular = shipRotation + (isPort ? -π/2 : π/2);
const fireAngle = perpendicular + cannon.aimAngle;

// 2. Decompose into horizontal and vertical components
const elevation = cannon.elevationAngle;
const horizontalSpeed = CANNON_SPEED * cos(elevation);  // Ground-plane speed
const verticalComponent = CANNON_SPEED * sin(elevation);  // Upward velocity

// 3. Convert screen angle to ground azimuth (inverse isometric transform)
const cos_fire = cos(fireAngle);
const sin_fire = sin(fireAngle);
const cos_azimuth = (cos_fire + 2 * sin_fire) / norm;
const sin_azimuth = (2 * sin_fire - cos_fire) / norm;

// 4. Calculate 3D velocity (includes ship velocity inheritance)
velocity = {
  groundVx: horizontalSpeed * cos_azimuth + ship.velocity.x,
  groundVy: horizontalSpeed * sin_azimuth + ship.velocity.y,
  heightVz: verticalComponent  // Positive = upward
};
```

**Physics Simulation (Client):**

Client simulates projectiles frame-by-frame at 60 FPS using iterative Euler integration:

```typescript
// Update ground position (NO gravity - horizontal only)
proj.groundX += proj.groundVx * deltaS;
proj.groundY += proj.groundVy * deltaS;

// Update height (WITH gravity - vertical only)
proj.heightVz -= GRAVITY * deltaS;  // Gravity decreases upward velocity
proj.heightZ += proj.heightVz * deltaS;

// Convert to screen coordinates for rendering
proj.sprite.x = proj.groundX - proj.groundY;
proj.sprite.y = (proj.groundX + proj.groundY) / 2 - proj.heightZ;
```

**Hit Validation (Server):**

Server validates hits by replaying the exact physics simulation:

```typescript
// Iterative Euler integration (matches client's frame-by-frame simulation)
const FRAME_TIME = 1 / 60;  // 60 FPS
const numSteps = ceil(elapsed / FRAME_TIME);
const dt = elapsed / numSteps;

for (let i = 0; i < numSteps; i++) {
  groundX += velocity.groundVx * dt;
  groundY += velocity.groundVy * dt;
  heightVz -= GRAVITY * dt;
  heightZ += heightVz * dt;
}

// Height threshold check (prevents high-arc exploits)
if (abs(heightZ) > DECK_HEIGHT_THRESHOLD) {
  return false;  // Projectile too high or too low
}
```

**Key Benefits:**
- ✅ Uniform distances: All directions travel equal ground distance (~10-12 tiles)
- ✅ Physically accurate: Gravity only affects height, not ground movement
- ✅ Consistent trajectories: Same arc shape in all directions
- ✅ Cheat-resistant: Server validates using same physics as client
- ✅ Extensible: Enables future terrain elevation, multi-level maps

**Why Iterative Integration (Not Analytical)?**

Using the analytical ballistic formula `h = h₀ + v₀t - ½gt²` would diverge from the client's iterative Euler integration over time due to numerical precision differences. Server MUST use frame-by-frame simulation to match client exactly, preventing false hit rejections.

**Constants Synchronization:**

Critical that these constants stay synchronized between client and server:

| Constant | Value | Client Location | Server Location |
|----------|-------|-----------------|-----------------|
| GRAVITY | 150 px/s² | ProjectileManager.ts:54 | ShipServer.ts:805 |
| DECK_HEIGHT_THRESHOLD | 30 px | ProjectileManager.ts:211 | ShipServer.ts:806 |
| CANNON_SPEED | 300 px/s | - | ShipServer.ts:680 |

**Projectile Lifecycle:**
1. Spawn at cannon muzzle position (rotated with ship, converted to ground coordinates)
2. Server calculates 3D velocity from aim/elevation angles using inverse isometric transform
3. Server broadcasts `game/projectile_spawn` to all clients with Velocity3D
4. All clients simulate identical physics using iterative Euler integration
5. Lifetime: 2 seconds client-side, 5 seconds server-side (3s grace for validation)

**Visual Effects:**
- Cannonballs: Black circles (8px diameter, 4px radius)
- Smoke trail: Gray particles fade over 300ms
- Cannon blast: Orange explosion at spawn (10 particles)
- Water splash: Blue particles on water impact (8 particles)

**Implementation:**
- Server velocity calculation: `ShipServer.ts:689-719`
- Server hit validation with physics replay: `ShipServer.ts:784-870`
- Client physics simulation: `ProjectileManager.ts:163-172`
- Client hit detection with height threshold: `ProjectileManager.ts:210-214`
- Unit tests (11 tests verifying physics sync): `ShipServer.test.ts`
- Visual effects: `EffectsRenderer.ts`

**Related Proposals:**
- `spec/seacat/proposals/p2v-projectile-velocity/` - Full specification and implementation details

### Phase 3: Damage & Health ✅ COMPLETE

**Hit Detection:**
- Client-side OBB collision (rotation-aware hitboxes)
- 20% generous hitbox padding for fair hits
- Hit claims sent to source ship for validation
- Server validates via physics replay (prevents cheating)

**Hit Validation Architecture:**
1. Client detects projectile overlap with ship OBB
2. Client sends hit claim to **source ship** (not target) with target's position/rotation
3. Source ship replays projectile physics to claim timestamp
4. If replayed position matches target's hitbox → valid hit
5. Source ship sends `ship/apply_damage` message to target
6. Target applies damage and broadcasts updated state

**Damage System:**
- Standard cannonball damage: 25 HP per hit
- Ship max health: 100 HP
- 4 hits to sink: 100 → 75 → 50 → 25 → 0
- Health synchronized via position updates

**Health Visualization:**
- Health bars rendered 40px above ships
- Colors: Green (>75%), Yellow (50-75%), Red (<50%)
- Width: 60px, Height: 8px
- Border: 2px black outline

**Implementation:**
- `ShipServer.ts:744-788` - Physics replay validation with target position
- `ShipParticipant.ts:232-265` - Hit claim and damage message handlers
- `GameScene.ts:1644-1676` - Client-side hit detection
- `GameScene.ts:891-923, 1507-1508` - Health bar rendering

### Phase 4: Sinking & Respawn ✅ COMPLETE

**Sinking Mechanics:**
- Ships sink when health reaches 0
- Server sets `sinking: true` flag
- Ship stops moving (velocity = 0, speedLevel = 0)
- All control points released (wheel, sails, cannons)
- Players on sinking ship teleported to water

**Sinking Animation (5 seconds):**
- Ship sprite moves downward 100 pixels
- Alpha fades from 1.0 → 0.2
- Control points fade out after 50% progress
- Players automatically ejected to water (bob in waves)

**Respawn System:**
- Timer: 10 seconds from sinking (configurable)
- Resets: position (spawn point), health (100), velocity (0), rotation (initial heading)
- Server manages respawn timer (prevents client manipulation)
- State broadcast includes `sinking: false` on respawn

**Respawn Detection:**
- Client detects transition: `sinking: true` → `sinking: false`
- Resets all visual state (alpha, control points, cannons)
- Ship appears instantly at spawn point
- Health bar shows green at 100%

**Implementation:**
- `ShipServer.ts:791-812` - Death detection, sinking state, control release
- `ShipServer.ts:818-840` - Respawn logic (position/health reset)
- `ShipServer.ts:845-854` - Cleanup method (clear respawn timer)
- `GameScene.ts:651-671` - Sinking detection (client-side)
- `GameScene.ts:1510-1534` - Sinking animation
- `GameScene.ts:673-689` - Respawn detection and visual reset
- `types.ts:149-150` - Sinking state fields (`sinking`, `sinkStartTime`)

### Protocol Messages

**New message types:**
1. `ship/grab_cannon` - Player grabs cannon control
2. `ship/release_cannon` - Player releases cannon
3. `ship/aim_cannon` - Update cannon horizontal aim angle
4. `ship/adjust_elevation` - Update cannon elevation angle
5. `ship/fire_cannon` - Fire cannon (spawn projectile)
6. `game/projectile_spawn` - Broadcast projectile spawn to all clients
7. `game/projectile_hit_claim` - Client claims hit, sent to source ship for validation
8. `ship/apply_damage` - Source ship forwards validated damage to target

### Combat Statistics

**Time to Kill:** ~16-20 seconds (4 hits × 4s cooldown)
**Projectile Travel Time:** ~0.5-1.5 seconds (depends on range and elevation)
**Effective Range:** ~150-250 pixels (optimal elevation 30-45°)
**Respawn Cycle:** 10 seconds (configurable, reduced from 30s for testing)

### Testing Checklist

- ✅ Players can grab cannons and see visual feedback
- ✅ Aim controls work (horizontal ±45°, elevation 15-60°)
- ✅ Fire cooldown prevents rapid firing (4 second intervals)
- ✅ Projectiles spawn and fly with realistic physics
- ✅ Projectiles detect hits on ships (OBB collision)
- ✅ Server validates hits via physics replay
- ✅ Damage applies correctly (25 HP per hit)
- ✅ Health bars update and change color
- ✅ Ships sink at 0 HP (5 second animation)
- ✅ Ships respawn after 10 seconds with full health
- ✅ Players teleported off sinking ships
- ✅ Multiple ships can engage in combat simultaneously

### Known Limitations

- No combat UI (kill messages, respawn timer countdown)
- No sound effects (cannon boom, hit crack, water splash)
- No damage smoke from heavily damaged ships
- Projectile hit detection uses AABB (not full OBB with rotation)
- Ship sprite rotation disabled (awaiting sprite sheet generation)

### Related Proposals

- `c5x-ship-combat`: Full specification with 5 implementation phases
- `p2v-projectile-velocity`: True 3D isometric projectile physics (Phase 2 implementation)
- See detailed documentation in:
  - `spec/seacat/proposals/c5x-ship-combat/` - Overall combat system
  - `spec/seacat/proposals/p2v-projectile-velocity/` - Physics implementation details

### Phase 5: Polish & Sound Effects ⚠️ PARTIAL

**Implementation:** `clients/seacat/src/game/GameScene.ts`

1. **Enhanced Visual Effects:** ✅ WORKING
   - ✅ Camera shake on cannon fire (100ms, 0.005 intensity) - local player only - `GameScene.ts:824-827`
   - ✅ Larger explosion effects (30 splinter particles, up from 20) - `GameScene.ts:964-984`
   - ✅ Rotating splinters (360° animation during flight)
   - ⏳ Damage smoke emitters on ships <50% health (planned for future)

2. **Sound Effects System:** ⚠️ IMPLEMENTED BUT DISABLED
   - ⚠️ Cannon fire boom (`cannon-fire.mp3`) - hook ready at `GameScene.ts:837`
   - ⚠️ Wood crack on hit impact (`hit-impact.mp3`) - hook ready at `GameScene.ts:1722`
   - ⚠️ Water splash on miss (`water-splash.mp3`) - hook ready at `GameScene.ts:1768`
   - ⚠️ Creaking wood during sinking (`ship-sinking.mp3`) - hook ready at `GameScene.ts:693`
   - ⚠️ Magical chime on respawn (`ship-respawn.mp3`) - hook ready at `GameScene.ts:718`
   - All audio loading code commented out due to Electron/Phaser compatibility issue
   - MP3 files present and valid in `clients/seacat/assets/sounds/`
   - Phaser audio loader crashes Electron on startup (file:// protocol issue suspected)

**Status - Audio Working:**
Audio system implemented with Howler.js (replacing Phaser audio). All combat sounds working in Electron. See `spec/seacat/proposals/c5x-ship-combat/implementation.md` Phase 5 for troubleshooting history and solution details.

---

## Combat Protocol Messages

All ship combat messages use MEW protocol v0.4 envelope format. Messages are sent via the MEW gateway using WebSocket connections.

### Control Messages

#### `ship/grab_cannon`
Player requests control of a specific cannon.

```typescript
{
  kind: 'ship/grab_cannon',
  to: ['ship1'],           // Ship participant ID
  payload: {
    playerId: string,      // Player requesting control
    side: 'port' | 'starboard',
    index: number          // Cannon index (0, 1, 2, ...)
  }
}
```

**Response:** Ship broadcasts updated `game/position` with cannon `controlledBy` field set.

#### `ship/release_cannon`
Player releases cannon control.

```typescript
{
  kind: 'ship/release_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number
  }
}
```

#### `ship/aim_cannon`
Player adjusts cannon horizontal aim angle.

```typescript
{
  kind: 'ship/aim_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number,
    aimAngle: number       // Radians, clamped to ±π/4 (±45°)
  }
}
```

**Update Rate:** Sent continuously while aiming (throttled client-side).

#### `ship/adjust_elevation`
Player adjusts cannon elevation angle.

```typescript
{
  kind: 'ship/adjust_elevation',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number,
    adjustment: number     // Delta in radians (e.g., 0.05)
  }
}
```

**Constraints:** Server clamps elevation to 15-60° range.

#### `ship/fire_cannon`
Player fires cannon.

```typescript
{
  kind: 'ship/fire_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number
  }
}
```

**Server Response:** If valid (not on cooldown, player controls cannon), ship broadcasts `game/projectile_spawn`.

### Projectile Messages

#### `game/projectile_spawn`
Ship broadcasts projectile creation after cannon fires.

```typescript
{
  kind: 'game/projectile_spawn',
  to: [],                  // Broadcast to all participants
  payload: {
    id: string,            // Unique ID: "shipId-side-index-timestamp"
    type: 'cannonball',
    sourceShip: string,    // Ship ID that fired
    position: { x: number, y: number },      // World coordinates
    velocity: { x: number, y: number },      // px/s (includes ship velocity)
    timestamp: number      // Server time (for physics replay)
  }
}
```

**Physics:** All clients simulate identical trajectories using deterministic physics (gravity = 150 px/s²).

#### `game/projectile_hit_claim`
Client claims projectile hit for server validation.

```typescript
{
  kind: 'game/projectile_hit_claim',
  to: ['sourceShipId'],    // Send to ship that FIRED the projectile
  payload: {
    projectileId: string,
    targetShipId: string,  // Ship that was hit
    targetPosition: { x: number, y: number },   // For OBB validation
    targetRotation: number,
    targetBoundary: { width: number, height: number },
    claimedDamage: number, // Always 25 for cannonballs
    timestamp: number      // Client time of collision
  }
}
```

**Validation:** Source ship replays projectile physics and checks OBB collision with target boundary. If valid, forwards damage.

#### `ship/apply_damage`
Source ship forwards validated damage to target.

```typescript
{
  kind: 'ship/apply_damage',
  to: ['targetShipId'],
  payload: {
    amount: number,        // Validated damage amount
    sourceProjectile: string
  }
}
```

**Server Action:** Target ship reduces health, broadcasts updated state, triggers sinking if health ≤ 0.

### Ship State Messages

#### `game/position` (Ship Extension)
Ships broadcast extended position updates including combat state.

```typescript
{
  kind: 'game/position',
  to: [],                  // Broadcast
  payload: {
    participantId: string, // Ship ID
    worldCoords: { x: number, y: number },
    velocity: { x: number, y: number },
    facing: number,
    timestamp: number,
    shipData: {
      rotation: number,
      speedLevel: number,
      deckBoundary: { width: number, height: number },

      // Combat state (c5x-ship-combat)
      cannons: {
        port: [{
          worldPosition: { x: number, y: number },
          controlledBy: string | null,
          aimAngle: number,          // Radians
          elevationAngle: number,     // Radians (15-60°)
          cooldownRemaining: number   // Milliseconds
        }],
        starboard: [/* same structure */]
      },

      // Health state (Phase 3-4)
      health: number,
      maxHealth: number,
      sinking: boolean
    }
  }
}
```

**Update Rate:** 10 Hz (every 100ms) for smooth interpolation.

### Wheel Steering Messages

#### `ship/grab_control`
Player grabs wheel or sails control point.

```typescript
{
  kind: 'ship/grab_control',
  to: ['ship1'],
  payload: {
    playerId: string,
    controlPoint: 'wheel' | 'sails'
  }
}
```

#### `ship/release_control`
Player releases control point.

```typescript
{
  kind: 'ship/release_control',
  to: ['ship1'],
  payload: {
    playerId: string
  }
}
```

#### `ship/wheel_turn_start` / `ship/wheel_turn_stop`
Player starts/stops turning wheel.

```typescript
{
  kind: 'ship/wheel_turn_start',
  to: ['ship1'],
  payload: {
    playerId: string,
    direction: 'left' | 'right'
  }
}
```

#### `ship/adjust_sails`
Player adjusts sail state.

```typescript
{
  kind: 'ship/adjust_sails',
  to: ['ship1'],
  payload: {
    playerId: string,
    adjustment: number      // -1 = lower, +1 = raise
  }
}
```

**Server Action:** Ship clamps `speedLevel` to 0-3 range, adjusts velocity accordingly.

### Map Data Messages

#### `ship/map_data`
Client sends map navigation data to ship server.

```typescript
{
  kind: 'ship/map_data',
  to: ['ship1'],
  payload: {
    mapWidth: number,
    mapHeight: number,
    tileWidth: number,
    tileHeight: number,
    navigableTiles: Array<{ x: number, y: number }>,
    orientation: 'isometric' | 'orthogonal'
  }
}
```

**Purpose:** Allows ship server to perform collision detection for obstacles/boundaries.

---

### Future Enhancements (Phase 6+)

3. **Combat UI:**
   - "You sank [ShipName]!" kill messages
   - "Your ship was sunk!" death message
   - Respawn timer countdown UI
   - Combat log (damage dealt/received)

4. **Advanced Features:**
   - Different projectile types (chain shot, grapeshot)
   - Crew count affects reload speed
   - Wind direction affects projectile trajectory
   - Boarding actions (grappling hooks)

---

## Planned: Gamepad/Controller Support (g4p-controller-support)

### Status
**Proposal:** `spec/seacat/proposals/g4p-controller-support/`
**Status:** Research Complete, Awaiting Review
**Created:** 2025-11-03

### Overview

Add comprehensive gamepad/controller support to Seacat, enabling players to use Xbox, PlayStation, Nintendo Switch, and generic USB controllers across all deployment platforms (browsers, Electron desktop, Steam/Steam Deck). Implementation uses Phaser 3's Gamepad API, which wraps the W3C Gamepad API standard.

### Current State

The game currently supports keyboard-only input:
- **Arrow keys** for character movement
- **WASD** alternate movement (not yet implemented)
- **E key** for interactions (board ship, grab controls)
- **Space bar** for firing cannons
- **Arrow keys** for ship steering and sail adjustment when controlling

The 8-directional character movement system (from milestone 7) was **designed with controller support in mind**, using angle-based direction calculation that works identically for both digital (keyboard) and analog (gamepad stick) input sources.

### Motivation

**Player Experience:**
- Controllers provide superior analog control for sailing and cannon aiming
- Essential for Steam Deck compatibility
- More comfortable for extended play sessions
- Expected feature for couch gaming and console-like experiences

**Platform Requirements:**
- Steam Deck players expect native controller support
- Many players prefer gamepad over keyboard/mouse for action games
- Foundation for eventual Steam release

**Technical Preparation:**
- Movement system already supports 360° input quantized to 8 directions
- Input handlers are modular and abstraction-ready
- Phaser 3 provides excellent built-in gamepad support

### Planned Features

1. **Full Gameplay with Controller**
   - All actions accessible without keyboard/mouse
   - Character movement via left analog stick
   - Ship steering via analog stick or D-pad
   - Cannon aiming via right analog stick
   - Face button interactions (A/Cross = interact, B/Circle = cancel)

2. **Analog Control**
   - Smooth stick-based movement (deadzone handling)
   - Right stick cannon aiming (replaces mouse)
   - Trigger buttons for firing cannons
   - Bumpers for switching cannons

3. **Platform Support**
   - Web browsers (Chrome, Firefox, Edge)
   - Electron desktop (Windows, macOS, Linux)
   - Steam / Steam Deck
   - Works with multiple controller types simultaneously

4. **User Experience**
   - Controller-specific button prompts ("Press [A]" vs "Press [✕]")
   - Seamless keyboard ↔ controller switching
   - Connect/disconnect handling
   - Support for multiple controllers (local multiplayer foundation)

### Control Mapping

#### On Foot
| Action | Keyboard | Controller |
|--------|----------|-----------|
| Move | Arrow Keys | Left Stick |
| Interact | E | A (Xbox) / Cross (PS) |
| Cancel | Escape | B (Xbox) / Circle (PS) |
| Menu | M | Start |

#### Ship Controls
| Action | Keyboard | Controller |
|--------|----------|-----------|
| Steer Ship | A/D | Left Stick Horizontal |
| Sails Up/Down | W/S | D-Pad Up/Down |
| Walk on Deck | Arrow Keys | Left Stick |
| Interact | E | A Button |

#### Cannons
| Action | Keyboard | Controller |
|--------|----------|-----------|
| Aim Cannon | Mouse | Right Stick |
| Fire | Space | R2 Trigger |
| Next/Prev Cannon | [ / ] | L1/R1 Bumpers |
| Exit | Escape | B Button |

### Implementation Phases

See detailed proposal at `spec/seacat/proposals/g4p-controller-support/proposal.md`

1. **Phase 1: Foundation** - Basic character movement with left stick
2. **Phase 2: Ship Controls** - Steering, sails, and cannon controls
3. **Phase 3: Input Abstraction** - Unified keyboard + gamepad system
4. **Phase 4: Polish** - Button prompts, settings, multi-controller testing
5. **Phase 5: Multi-Controller** (Optional) - Local multiplayer support
6. **Phase 6: Steam Integration** (Optional) - Steam Input API

**Estimated Effort:** 2-3 weeks (Phases 1-4)

### Technical Approach

**Core Technology:** W3C Gamepad API via Phaser 3 Input.Gamepad Plugin

**Key Components:**
- `InputManager.ts` - Unified input abstraction for keyboard + gamepad
- `GamepadProvider.ts` - Gamepad state tracking and event handling
- `KeyboardProvider.ts` - Keyboard input (refactored to use abstraction)
- `ButtonPrompts.ts` - Controller-specific UI prompts

**Deadzone Handling:**
- Inner deadzone: 0.15 (ignore stick drift)
- Outer deadzone: 0.95 (smooth to maximum)
- Radial deadzone calculation (check magnitude, not per-axis)

**State Tracking:**
- Manual "just pressed" detection (Phaser gamepads don't provide it)
- Per-frame button state comparison
- Connection/disconnection event handling

### Platform Compatibility

| Platform | Technology | Status |
|----------|-----------|--------|
| Browser | W3C Gamepad API | ✅ Fully supported |
| Electron | Chromium Gamepad API | ✅ Fully supported |
| Steam | W3C Gamepad API | ✅ Basic support |
| Steam (Enhanced) | Steam Input API | ⏳ Optional future |

### Supported Controllers

- Xbox One / Series X|S controllers
- PlayStation DualShock 4 / DualSense
- Nintendo Switch Pro Controller
- Generic USB gamepads
- Steam Deck built-in controls

All controllers work via the W3C standard gamepad mapping.

### Future Enhancements

- **Controller rebinding** - Player-configurable button mappings
- **Vibration/rumble** - Haptic feedback for cannon fire, impacts
- **Steam Input API** - Enhanced Steam Deck features (gyro, trackpads, back buttons)
- **Local multiplayer** - Multiple players with individual controllers

### References

- **Proposal:** `spec/seacat/proposals/g4p-controller-support/proposal.md`
- **Research:** `spec/seacat/proposals/g4p-controller-support/research.md`
- **CHANGELOG Entry:** See "Unreleased" section
- **Phaser 3 Gamepad API:** https://docs.phaser.io/api-documentation/class/input-gamepad-gamepadplugin
- **W3C Gamepad Spec:** https://w3c.github.io/gamepad/
