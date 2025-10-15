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

### Phase 5c: Ship Movement & Navigation

**Movement Activation:**

- Verify physics loop correctly moves ship when speed > 0 (already implemented in Phase 5a)
- Test ship movement: set speed to 1-3 and verify position updates
- Test heading changes: set all 8 directions and verify velocity calculations

**Tile-Based Navigation:**

- Add `navigable: boolean` property to tile type definitions in Tiled
- Update map1.tmj: mark water tiles as navigable=true, land tiles as navigable=false
- Implement ship collision detection: check tiles ahead, stop at non-navigable boundaries
- Test: ship sails freely on water but stops at grass/sand boundaries

**End-to-End Testing:**

- Test: player walks to ship, grabs wheel, steers with left/right arrows
- Test: player grabs sails, adjusts speed with up/down arrows (0→1→2→3→2→1→0)
- Test: ship navigates around islands, stops at land boundaries
- Test: multiple players can control different control points simultaneously

## Milestone 6: Platform Coordinate System

Implement the dual coordinate system (world vs platform-relative) and logic for detecting when players step onto a ship. Handle coordinate transformations and ensure players move correctly relative to the ship's deck when aboard.

**Phases:**

### Phase 6a: Ship Boundary Detection

- Define ship collision boundary (rectangular area)
- Define ship deck walkable area (relative tile coordinates)
- Detect when player enters ship boundary
- Add `onShip: string | null` state to player (ship participant ID)

### Phase 6b: Coordinate Transformation

- Implement world-to-platform coordinate conversion
- Implement platform-to-world coordinate conversion
- Update player rendering to use ship-relative coords when aboard
- Test player position updates while standing still on moving ship

### Phase 6c: Platform Movement

- Update collision detection to use ship deck boundaries when aboard
- Adjust player movement to be relative to ship's coordinate frame
- Ensure players "ride along" as ship moves
- Test walking around ship deck while ship is moving

### Phase 6d: Visual Feedback & Polish

- Add visual indicators for interaction zones (glowing outline when player near wheel/sails)
- Show "Press E to grab wheel" / "Press E to adjust sails" UI prompt
- Add grab animation or visual feedback (player sprite changes, particles, etc.)
- Display ship heading and speed on HUD when controlling
- Add visual for sail state (0 = furled, 1-3 = progressively more unfurled)

## Milestone 7: Ship Movement & Collision

Add physics loop to ship server that updates ship position based on velocity, detects collisions with land boundaries, and adjusts passenger positions as the ship moves. Implement boarding/disembarking transitions.

## Milestone 8: GameAgent Base Class

Extend MEWAgent with a `GameAgent` superclass that adds navigation MCP tools (`get_player_info`, `move_to`, `get_position`). Implement basic AI decision loop that calls tools to move around the world, with pathfinding handled client-side initially.

## Milestone 9: Polish & Performance

Add client-side prediction for local player, implement dead reckoning for remote players, optimize network update rates, and add visual feedback for ship boarding. Test with multiple clients and AI agents simultaneously.

## Milestone 10: End-to-End Testing

Create comprehensive test scenarios with multiple humans, AI agents, and ships interacting. Document setup instructions, known limitations, and create demo video showing gameplay.
