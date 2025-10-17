# MEW World Implementation Plan

## Milestone 1: Space Template ✅

Create the `mew-world` space template with 4 human participants and 4 MEW agent participants configured. Include necessary capabilities for streams and chat so spaces can be spun up for testing.

**Status:** Complete
- Template created at `templates/mew-world/`
- 4 human participants (player1-4) with full capabilities
- 4 AI agents (agent1-4) with stream and MCP capabilities
- Stream capabilities configured (dynamic stream creation via stream/request)
- README and documentation included
- Template tested and working

## Milestone 2: Electron Client with Multi-Player Sync ✅

Create Electron app with connection form (URL, port, username, token) that connects to MEW space using the SDK client. Set up Phaser 3 (v3.90.0) game engine with isometric rendering and player sprites. Define position message TypeScript types (world coords, tile coords, velocity, platform reference) and implement full multi-player synchronization - publish local player position updates, subscribe to remote player positions, implement interpolation for smooth remote player movement, and handle player join/leave events.

**Status:** Complete
- Electron client created at `clients/mew-world/`
- Connection form with gateway URL, space name, username, token
- MEW SDK client integration for WebSocket connection
- Phaser 3 game scene with isometric grid rendering
- Position message types defined (PositionUpdate, Player)
- Stream-based position publishing (10 Hz update rate)
- Remote player rendering with smooth interpolation
- Arrow key movement controls
- README with setup and usage instructions

## Milestone 3: Tiled Map Integration with Collision ✅

Add support for loading Tiled map editor (.tmj) files with multiple layers (Ground, Water, Obstacles, Decorations). Implement tile-based collision detection to prevent walking through walls and enforce map boundaries. Add tile properties system for gameplay mechanics - water tiles reduce movement speed to 50% (swimming), walls are non-walkable. Replace procedural grid generation with Tiled map rendering while maintaining multiplayer position synchronization.

**Related Proposal:** `spec/mew-world/proposals/t4m-tiled-maps/`

**Status:** Complete

- Tiled map loading implemented (JSON format .tmj)
- Procedural tileset generation (5 terrain types with colors)
- Three-layer rendering: Ground, Obstacles, Water
- Tile-based collision detection (O(1) lookups)
- Map boundary enforcement
- Water speed modification (50% in water)
- Example map with walls and water features
- Map creation guide (assets/maps/README.md)

**Phases:**

### Phase 3a: Basic Map Loading ✅

- ✅ Create example Tiled map (20×20 isometric) with terrain tileset
- ✅ Add map loading to Phaser (preload .tmj + tileset images)
- ✅ Render Ground and Obstacles layers
- ✅ Update camera bounds to match map dimensions
- ✅ Test single player map rendering

### Phase 3b: Collision Detection ✅

- ✅ Implement tile-based collision checking (walkable property)
- ✅ Add map boundary enforcement (clamp to grid edges)
- ✅ Prevent movement onto non-walkable tiles
- ✅ Test collision with walls and boundaries

### Phase 3c: Tile Properties & Mechanics ✅

- ✅ Add Water layer with speedModifier property (0.5 for swimming)
- ✅ Apply speed modifiers during movement
- ✅ Test water slowdown mechanics
- ✅ Decorations layer support (deferred - not needed yet)

### Phase 3d: Multiplayer & Documentation (Testing)

- Test collision with multiple connected players
- Verify position synchronization works with maps
- Document map creation workflow (Tiled setup guide)
- Create 2-3 example maps with different layouts

## Milestone 4: Directional Player Sprites with 8-Way Animation ✅

Replace placeholder circle sprites with animated character sprites supporting 8-directional movement (N, NE, E, SE, S, SW, W, NW). Implement sprite sheet system with direction calculation from velocity vectors, animation state management, and network synchronization of facing direction. Design system to be future-proof for game controller analog stick input.

**Related Proposal:** See `spec/mew-world/SPEC.md` Milestone 4 section

**Status:** Complete (Phases 4a & 4b)

- 8-direction sprite sheet system (128×256, 32×32 frames)
- Placeholder sprite generation script with colored circles and arrows
- Direction calculation using atan2 and 45° quantization
- Animation system with 8 walk animations (10 FPS, looping)
- `Direction` type and `facing` field added to position updates
- Local and remote player animation synchronization
- Idle state handling (animation stops when not moving)
- Future-proof architecture for game controllers

**Phases:**

### Phase 4a: Sprite System Foundation ✅

- ✅ Create `assets/sprites/` directory structure
- ✅ Generate placeholder 8-direction sprite sheet for testing
- ✅ Update `GameScene.ts` to load sprite sheet instead of procedural circle
- ✅ Implement 8-direction animation system
- ✅ Add direction calculation from velocity
- ✅ Test with keyboard input (diagonal movement with simultaneous arrow keys)

### Phase 4b: Animation State Management ✅

- ✅ Add `facing` field to `PositionUpdate` type
- ✅ Update local position publishing to include facing direction
- ✅ Implement remote player animation synchronization
- ✅ Add idle state handling (stop animation when velocity = 0)
- ✅ Test with multiple clients to verify animation sync

### Phase 4c: Sprite Artwork (Optional - Deferred)

- Create or commission proper character sprites
- Design walk cycle animations (4 frames per direction)
- Export as 128×256 PNG sprite sheet
- Replace placeholder sprites
- Test visual quality and performance

## Milestone 5: Ship MCP Server & Interactive Controls

Build a new MCP server that represents a ship entity with interactive control points. Ships have two interaction zones: a **steering wheel** (player presses interact to grab, then left/right arrows control direction) and **sail ropes** (player presses interact to adjust sails up/down, controlling speed 0-3). Ship publishes position updates to the same stream as players. Add `navigable` tile property so ships can only sail on water tiles, not land.

**Phases:**

### Phase 5a: Ship MCP Server Foundation ✅

**Status:** Complete

- ✅ Created ship MCP server at `src/mcp-servers/ship-server/`
- ✅ Defined ship state types (position, velocity, heading, speed level, control points)
- ✅ Implemented ShipServer class with physics simulation (60 Hz update loop)
- ✅ Implemented ShipParticipant class for MEW protocol integration
- ✅ Ship tracks position, heading (8 directions), speed level (0-3)
- ✅ Control points defined: wheel and sails with relative positions
- ✅ Added ship1 participant to mew-world template
- ✅ Ship broadcasts position at 10 Hz on `game/position` stream
- ✅ Ship data includes deck boundary and control point world positions
- ✅ Comprehensive testing: initialization, physics, broadcasting, error handling

**Implementation Details:**

- `types.ts`: Ship state types, heading enum, control point interfaces
- `ShipServer.ts`: Core ship logic, physics loop, state management
- `ShipParticipant.ts`: MEW client integration, position broadcasting
- `index.ts`: Entry point with environment variable configuration
- Template integration with full capabilities and environment setup

### Phase 5b: Ship Rendering & Basic Interaction

**Client-side (Phaser):**

- Render ship sprite at position from `game/position` messages with `shipData`
- Display ship control points (wheel and sails) on deck
- Add interact key binding (E key) to client input
- Implement interaction zone detection (check distance to control points)
- Add UI prompts when near control points ("Press E to grab wheel")

**Ship Server:**

- Add message handlers for `ship/grab_control` and `ship/release_control`
- Track which player controls each control point (wheel/sails)
- Add message handlers for `ship/steer` (adjust heading) and `ship/adjust_sails` (adjust speed)
- Call internal `setHeading()` and `setSpeed()` methods from message handlers
- Broadcast updated state when controls change

**Message Types:**

- `ship/grab_control`: {controlPoint: 'wheel' | 'sails', playerId: string}
- `ship/release_control`: {controlPoint: 'wheel' | 'sails', playerId: string}
- `ship/steer`: {direction: 'left' | 'right', playerId: string}
- `ship/adjust_sails`: {adjustment: 'up' | 'down', playerId: string}

### Phase 5c: Ship Collision Detection (In Progress)

**Goal:** Prevent ships from sailing onto land tiles using tile-based collision detection.

**Implementation Steps:**

1. **Add MapDataPayload type** (`src/mcp-servers/ship-server/types.ts`)
   - Add interface with: tileWidth, tileHeight, mapWidth, mapHeight, navigableTiles[][], orientation
   - Document that navigable=true means water (ships can sail), navigable=false means land

2. **Client extracts and sends map data** (`clients/mew-world/src/game/GameScene.ts`)
   - In `loadTiledMap()`, after map loads, extract navigable property from each tile
   - Build 2D boolean array: `navigableTiles[y][x] = tile.properties.navigable === true`
   - Detect map orientation (Phaser uses numeric: 0=orthogonal, 1=isometric)
   - Send `ship/map_data` message as broadcast to all ships
   - Also send map data when new ship joins (in `updateShip()` when ship created)

3. **Ship receives map data** (`src/mcp-servers/ship-server/ShipParticipant.ts` + `ShipServer.ts`)
   - Add `ship/map_data` handler in ShipParticipant that accepts broadcasts (not just addressed messages)
   - Pass payload to `ShipServer.setMapData(mapData)`
   - Store as `private mapData: MapDataPayload | null = null` in ShipServer

4. **Ship checks collision before moving** (`src/mcp-servers/ship-server/ShipServer.ts`)
   - Add `worldToTile(worldX, worldY)` method with isometric coordinate conversion:
     - `tileX = floor((worldX / (tileWidth/2) + worldY / (tileHeight/2)) / 2)`
     - `tileY = floor((worldY / (tileHeight/2) - worldX / (tileWidth/2)) / 2)`
   - Add `isNavigable(worldX, worldY)` method that converts to tile coords and checks `navigableTiles[y][x]`
   - Add `canMoveTo(newX, newY)` method that checks ship center + 4 deck corners
   - In `updatePhysics()`, calculate newX/newY, check `canMoveTo()` before updating position
   - If collision detected, stop ship (set speed to 0, log message)

**Testing:**

- Use map2.tmj (has navigable:true water tiles in center, navigable:false land around edges)
- Ship should start on water at (0, 320) and be able to move
- Ship should stop when it hits land boundaries
- Test all 8 heading directions
- Test multiple speed levels

**Current Status:**
- Map data exists in map1.tmj and map2.tmj (navigable property already defined)
- Need to implement 4 changes above

## Milestone 6: Platform Coordinate System ✅

**Status:** Complete (implemented alongside Phase 5b)

Implemented the dual coordinate system (world vs platform-relative) and logic for detecting when players step onto a ship. Players correctly "ride along" as ships move.

**Implementation Details:**

- `onShip: string | null` tracks which ship player is on (GameScene.ts:30)
- `shipRelativePosition: {x, y}` stores position relative to ship center (GameScene.ts:31)
- `checkShipBoundary()` detects ship boarding via rectangular deck boundary (GameScene.ts:554-587)
- Local and remote players move with ship in `update()` loop (GameScene.ts:520-534)
- Ship deck boundary defined in ship state (width: 64px, height: 96px)

**Note:** This milestone was completed during Phase 5b implementation and doesn't require separate work.

## Milestone 7: GameAgent Base Class

Extend MEWAgent with a `GameAgent` superclass that adds navigation MCP tools (`get_player_info`, `move_to`, `get_position`). Implement basic AI decision loop that calls tools to move around the world, with pathfinding handled client-side initially.

## Milestone 8: Polish & Performance

Add client-side prediction for local player, implement dead reckoning for remote players, optimize network update rates, and add visual feedback for ship boarding. Test with multiple clients and AI agents simultaneously.

## Milestone 9: End-to-End Testing

Create comprehensive test scenarios with multiple humans, AI agents, and ships interacting. Document setup instructions, known limitations, and create demo video showing gameplay.
