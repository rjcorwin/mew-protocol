# s7g-gamescene-refactor: Proposal

**Status**: Implemented ✅
**Created**: 2025-11-02
**Completed**: 2025-11-03
**Area**: Seacat Game Client

## Problem Statement

The main game scene file (`clients/seacat/src/game/GameScene.ts`) has grown to 2603 lines with mixed concerns, making it difficult to maintain, test, and collaborate on. The file combines rendering, physics, networking, input handling, and state management in a monolithic structure.

### Key Issues

1. **Massive Methods**:
   - `update()` - 435 lines mixing player movement, ship updates, projectile physics, wave animation
   - `updateShip()` - 270 lines mixing state updates and rendering
   - `checkShipInteractions()` - 268 lines mixing detection and input handling

2. **Mixed Concerns**: No clear separation between:
   - Rendering (ship drawing, effects, water animation)
   - Physics (collision detection, projectile movement)
   - Networking (position updates, command sending)
   - Input handling (control point detection, keyboard input)
   - State management (players, ships, projectiles)

3. **Testing Challenges**: Impossible to unit test individual systems without loading entire scene

4. **Collaboration Friction**: Multiple developers can't work on different systems simultaneously

5. **Maintenance Burden**: Changes to one system (e.g., ship rendering) require navigating unrelated code

## Proposed Solution

Reorganize GameScene.ts into focused, single-responsibility modules using the manager pattern common in game development:

```
src/game/
├── GameScene.ts                    # Main scene orchestrator (~150-200 lines)
│
├── managers/
│   ├── PlayerManager.ts           # Remote player lifecycle & interpolation
│   ├── ShipManager.ts             # Ship state updates & lifecycle
│   ├── ProjectileManager.ts       # Projectile physics & collision
│   ├── CollisionManager.ts        # Tile & ship boundary collision
│   └── MapManager.ts              # Map loading & navigation data
│
├── rendering/
│   ├── ShipRenderer.ts            # All ship drawing
│   ├── WaterRenderer.ts           # Wave animation & effects
│   ├── EffectsRenderer.ts         # VFX (blasts, splashes, hits)
│   └── PlayerRenderer.ts          # Player animations
│
├── controls/
│   ├── ShipControls.ts            # Control point detection & interaction
│   └── ShipInputHandler.ts        # Keyboard input for ship controls
│
├── network/
│   ├── NetworkClient.ts           # Message subscriptions & updates
│   └── ShipCommands.ts            # All ship command sends
│
└── utils/
    ├── IsometricMath.ts           # Coordinate transforms & rotation
    ├── Constants.ts               # All constants (tile sizes, speeds)
    └── Types.ts                   # Local type definitions
```

### Design Principles

1. **Single Responsibility**: Each file handles one concern
2. **Manager Pattern**: Managers own lifecycle and updates for their domain
3. **Dependency Injection**: Managers receive dependencies via constructor
4. **Clear Interfaces**: Public APIs document what each manager provides
5. **Phaser Integration**: Work with Phaser's scene system, not against it

### GameScene as Orchestrator

The refactored GameScene.ts becomes a lightweight orchestrator:

```typescript
class GameScene extends Phaser.Scene {
  private managers: {
    player: PlayerManager;
    ship: ShipManager;
    projectile: ProjectileManager;
    collision: CollisionManager;
    map: MapManager;
  };

  private renderers: {
    ship: ShipRenderer;
    water: WaterRenderer;
    effects: EffectsRenderer;
    player: PlayerRenderer;
  };

  private controls: {
    ship: ShipControls;
    input: ShipInputHandler;
  };

  private network: {
    client: NetworkClient;
    commands: ShipCommands;
  };

  create() {
    // Initialize managers with dependencies
    this.managers.map = new MapManager(this);
    this.managers.collision = new CollisionManager(this.managers.map);
    // ... etc
  }

  update(time: number, delta: number) {
    // Delegate to managers in proper order
    this.network.client.update();
    this.managers.player.update(delta);
    this.managers.ship.update(delta);
    this.managers.projectile.update(delta);
    this.renderers.water.update(time);
    this.controls.ship.update();
  }
}
```

## Benefits

### Maintainability
- **Clear Boundaries**: Each file has a single, well-defined purpose
- **Reduced Cognitive Load**: Developers only need to understand one system at a time
- **Easier Navigation**: Finding ship rendering code? Check `ShipRenderer.ts`
- **File Size**: No file exceeds ~400 lines (vs. 2603 currently)

### Testability
- **Unit Testing**: Test managers independently with mocked dependencies
- **Integration Testing**: Test interactions between specific managers
- **Reduced Setup**: Don't need to bootstrap entire scene for focused tests

### Collaboration
- **Parallel Work**: Multiple developers can work on different managers simultaneously
- **Reduced Conflicts**: Changes to rendering don't conflict with networking changes
- **Clear Ownership**: Teams can own specific managers

### Performance
- **No Degradation**: Same code, better organization
- **Future Optimization**: Easier to profile and optimize individual systems
- **Optional Loading**: Could lazy-load systems if needed

### Reusability
- **Scene Independence**: Managers could be used in other scenes (menus, battles)
- **Composition**: New scenes can mix and match managers as needed
- **Library Potential**: Utilities and renderers could become shared libraries

## Non-Goals

- **Not changing functionality**: All game behavior remains identical
- **Not adding features**: Pure refactor, no new capabilities
- **Not changing architecture**: Still using Phaser scenes, just better organized
- **Not optimizing performance**: Same performance characteristics

## Risks & Mitigations

### Risk: Breaking Changes
- **Mitigation**: Incremental migration with tests at each step
- **Mitigation**: Keep old GameScene.ts until new structure is validated
- **Mitigation**: Use TypeScript to catch interface mismatches

### Risk: Phaser Integration Issues
- **Mitigation**: Managers hold references to scene, access Phaser APIs directly
- **Mitigation**: Follow Phaser patterns (managers like Phaser's own plugin system)
- **Mitigation**: Test with actual Phaser runtime, not just TypeScript

### Risk: Over-Abstraction
- **Mitigation**: Extract only when clear responsibility exists
- **Mitigation**: Prefer simple classes over complex hierarchies
- **Mitigation**: Keep utilities as pure functions when possible

### Risk: Increased File Count
- **Mitigation**: Clear naming convention makes files discoverable
- **Mitigation**: Folder structure provides logical grouping
- **Mitigation**: 15 focused files easier than 1 massive file

## Alternatives Considered

### Alternative 1: Split by Feature (Ships, Players, Projectiles)
- **Rejected**: Each feature still mixes rendering, physics, networking
- **Better Fit**: Current proposal with managers owning features

### Alternative 2: Keep GameScene, Add Helper Classes
- **Rejected**: Doesn't solve the monolithic update() method
- **Better Fit**: Full extraction ensures clean separation

### Alternative 3: Use Entity-Component-System (ECS)
- **Rejected**: Too large a change, conflicts with Phaser's scene model
- **Better Fit**: Manager pattern works naturally with Phaser

### Alternative 4: Extract Only the Largest Methods
- **Rejected**: Leaves mixed concerns in place
- **Better Fit**: Full reorganization provides lasting maintainability

## Success Criteria

1. **No Behavioral Changes**: All game features work identically
2. **File Size**: No file exceeds 500 lines
3. **Test Coverage**: Managers have unit tests with 80%+ coverage
4. **Build Success**: TypeScript builds without errors or warnings
5. **Performance**: No regression in frame rate or memory usage
6. **Documentation**: Each manager has clear JSDoc comments
7. **Migration Complete**: Old GameScene.ts removed

## Open Questions

1. Should managers handle their own Phaser object creation, or receive them?
   - **Proposal**: Managers create objects they own (ships, projectiles)

2. Should renderers hold sprite references, or query them from managers?
   - **Proposal**: Managers own sprites, renderers receive them for drawing

3. How to handle shared state (e.g., nearControlPoints)?
   - **Proposal**: ShipControls owns this state, exposes via getter

4. Should we extract Types.ts immediately, or wait for interfaces to stabilize?
   - **Proposal**: Extract early to document contracts between modules

## References

- Current GameScene.ts: `clients/seacat/src/game/GameScene.ts` (2603 lines)
- Phaser Scene Documentation: https://photonstorm.github.io/phaser3-docs/Phaser.Scene.html
- Game Programming Patterns - Component: https://gameprogrammingpatterns.com/component.html

## Related Proposals

- None (first major refactor of Seacat client)

## Implementation

See `IMPLEMENTATION_PLAN.md` for detailed migration strategy.
