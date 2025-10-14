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

## Milestone 3: Tiled Map Integration with Collision

Add support for loading Tiled map editor (.tmj) files with multiple layers (Ground, Water, Obstacles, Decorations). Implement tile-based collision detection to prevent walking through walls and enforce map boundaries. Add tile properties system for gameplay mechanics - water tiles reduce movement speed to 50% (swimming), walls are non-walkable. Replace procedural grid generation with Tiled map rendering while maintaining multiplayer position synchronization.

**Related Proposal:** `spec/mew-world/proposals/t4m-tiled-maps/`

**Phases:**

### Phase 3a: Basic Map Loading
- Create example Tiled map (20×20 isometric) with terrain tileset
- Add map loading to Phaser (preload .tmj + tileset images)
- Render Ground and Obstacles layers
- Update camera bounds to match map dimensions
- Test single player map rendering

### Phase 3b: Collision Detection
- Implement tile-based collision checking (walkable property)
- Add map boundary enforcement (clamp to grid edges)
- Prevent movement onto non-walkable tiles
- Test collision with walls and boundaries

### Phase 3c: Tile Properties & Mechanics
- Add Water layer with speedModifier property (0.5 for swimming)
- Apply speed modifiers during movement
- Test water slowdown mechanics
- Add Decorations layer (visual-only)

### Phase 3d: Multiplayer & Documentation
- Test collision with multiple connected players
- Verify position synchronization works with maps
- Document map creation workflow (Tiled setup guide)
- Create 2-3 example maps with different layouts

## Milestone 4: Ship MCP Server

Build a new MCP server that represents a ship entity with tools for controlling movement (`set_sail_direction`, `set_sail_speed`) and querying state (`get_ship_position`, `get_passengers`). Ship publishes position updates to the same stream as players.

## Milestone 5: Platform Coordinate System

Implement the dual coordinate system (world vs platform-relative) and logic for detecting when players step onto a ship. Handle coordinate transformations and ensure players move correctly relative to the ship's deck when aboard.

## Milestone 6: Ship Movement & Collision

Add physics loop to ship server that updates ship position based on velocity, detects collisions with land boundaries, and adjusts passenger positions as the ship moves. Implement boarding/disembarking transitions.

## Milestone 7: GameAgent Base Class

Extend MEWAgent with a `GameAgent` superclass that adds navigation MCP tools (`get_player_info`, `move_to`, `get_position`). Implement basic AI decision loop that calls tools to move around the world, with pathfinding handled client-side initially.

## Milestone 8: Polish & Performance

Add client-side prediction for local player, implement dead reckoning for remote players, optimize network update rates, and add visual feedback for ship boarding. Test with multiple clients and AI agents simultaneously.

## Milestone 9: End-to-End Testing

Create comprehensive test scenarios with multiple humans, AI agents, and ships interacting. Document setup instructions, known limitations, and create demo video showing gameplay.
