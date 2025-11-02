# s7g-gamescene-refactor: GameScene Refactor

**Status**: Proposal Draft 📝
**Created**: 2025-11-02
**Area**: Seacat Game Client

## Quick Links

- **[Proposal Document](./proposal.md)** - Problem statement, solution design, benefits, risks
- **[Implementation Plan](./IMPLEMENTATION_PLAN.md)** - Step-by-step migration guide (7 phases)
- **[CHANGELOG Entry](../../../../CHANGELOG.md)** - Summary and status tracking

## Overview

Refactor the monolithic `GameScene.ts` (2603 lines) into focused, maintainable modules using the manager pattern common in game development.

## Problem

GameScene.ts has grown too large with mixed concerns:
- **2603 lines** in a single file
- **update()**: 435 lines mixing player movement, ship updates, projectile physics, wave animation
- **updateShip()**: 270 lines mixing state updates and rendering
- **checkShipInteractions()**: 268 lines mixing detection and input handling
- **Mixed concerns**: Rendering, physics, networking, input handling all intertwined
- **Difficult to test**: Can't unit test individual systems
- **Collaboration friction**: Multiple developers can't work on different systems simultaneously

## Solution

Reorganize into focused modules:

```
src/game/
├── GameScene.ts                    # Orchestrator (~200 lines)
├── managers/                       # State management
│   ├── PlayerManager.ts
│   ├── ShipManager.ts
│   ├── ProjectileManager.ts
│   ├── CollisionManager.ts
│   └── MapManager.ts
├── rendering/                      # Visual systems
│   ├── ShipRenderer.ts
│   ├── WaterRenderer.ts
│   ├── EffectsRenderer.ts
│   └── PlayerRenderer.ts
├── controls/                       # Input handling
│   ├── ShipControls.ts
│   └── ShipInputHandler.ts
├── network/                        # Communication
│   ├── NetworkClient.ts
│   └── ShipCommands.ts
└── utils/                          # Utilities
    ├── IsometricMath.ts
    ├── Constants.ts
    └── Types.ts
```

## Benefits

- **Maintainability**: GameScene reduced from 2603 → ~200 lines
- **Clarity**: Each file has a single, clear purpose
- **Testability**: Unit test managers independently
- **Collaboration**: Multiple developers work in parallel
- **File Size**: No file exceeds 500 lines

## Implementation Timeline

**Estimated**: 33-44 hours (1-2 weeks for single developer)

**7 Phases**:
1. **Foundation** (2-3 hrs) - Extract utils and constants
2. **Collision & Map** (3-4 hrs) - Low-dependency managers
3. **Rendering** (6-8 hrs) - Visual systems
4. **Game Logic** (8-10 hrs) - Core managers
5. **Input & Network** (6-8 hrs) - Controls and communication
6. **GameScene Refactor** (4-5 hrs) - Simplify to orchestrator
7. **Validation** (4-6 hrs) - Testing and documentation

Each phase is a separate commit for easy rollback if needed.

## Current Status

**📝 Proposal Draft** - Awaiting review and approval before implementation.

## Next Steps

1. **Review** - Stakeholders review proposal and implementation plan
2. **Approval** - Decide to proceed, modify, or reject
3. **Implementation** - Follow 7-phase plan incrementally
4. **Testing** - Verify no regressions at each phase
5. **Completion** - Update CHANGELOG to "Implemented" status

## References

- Current GameScene.ts: `clients/seacat/src/game/GameScene.ts` (2603 lines)
- Phaser Scene Documentation: https://photonstorm.github.io/phaser3-docs/Phaser.Scene.html
- Game Programming Patterns - Component: https://gameprogrammingpatterns.com/component.html

## Questions?

See `proposal.md` for detailed design decisions, alternatives considered, and open questions.
