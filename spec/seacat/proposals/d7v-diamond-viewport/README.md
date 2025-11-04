# Diamond Viewport & Diorama Framing (d7v)

**Status:** Draft 📝
**Created:** 2025-11-04
**Proposal Code:** d7v-diamond-viewport

## Quick Summary

Add a diamond-shaped viewport (rotated square) that defines the visible play area, creating a "diorama" aesthetic with visible boundaries and a static background. This improves performance through distance-based culling and enables future dynamic backgrounds (weather, day/night cycle).

## Problem

Current rendering system:
- No distance-based culling (performance concerns on large maps)
- No visual framing (world extends to screen edges)
- No separation between game world and background elements
- Limited scalability as maps grow

## Solution

Implement a **diamond viewport** with:
- ✅ Diamond-shaped render boundary (configurable X×Y tiles)
- ✅ Visible edges for diorama aesthetic
- ✅ Border padding for background integration
- ✅ Static background layer (sky/sea gradient)
- ✅ Performance culling (only render entities in diamond)

## Key Benefits

### Performance
- 50-70% reduction in tile rendering on large maps
- Scalable to much larger worlds
- Maintains 60 FPS with many entities

### Aesthetics
- Unique "model ship in a box" presentation
- Clear visual identity (different from typical isometric games)
- Foundation for animated backgrounds

### Gameplay
- Configurable view distance for balance
- Fair play (all players see same distance)
- Future: weather/fog effects, dynamic visibility

## Documents

- **[proposal.md](./proposal.md)** - Full specification with technical details
- **[research.md](./research.md)** - Current rendering system analysis and industry research
- **[decision-d7v-diamond-viewport.md](./decision-d7v-diamond-viewport.md)** - Architectural Decision Record
- **[implementation.md](./implementation.md)** - Step-by-step implementation guide (10-14 hours)

## Quick Start (For Implementers)

1. Read [proposal.md](./proposal.md) for full specification
2. Review [research.md](./research.md) to understand current system
3. Follow [implementation.md](./implementation.md) phase-by-phase
4. Start with Phase 1 (Core Viewport System) - creates ViewportManager utility
5. Test incrementally after each phase

## Configuration

Default values (tunable):
```typescript
DIAMOND_SIZE_TILES: 20         // Square diamond (20×20)
DIAMOND_BORDER_TOP_TILES: 4    // More sky space
DIAMOND_BORDER_BOTTOM_TILES: 2 // Less sea space
DIAMOND_BORDER_LEFT_TILES: 3   // Symmetric sides
DIAMOND_BORDER_RIGHT_TILES: 3
```

**Why square?** A square diamond (equal width/height) creates perfect geometric symmetry when rotated 45° and provides equal visibility in all diagonal directions.

**Why asymmetric borders?** More sky space (top) for atmospheric effects while keeping sea space (bottom) minimal for gameplay focus.

## Implementation Phases

1. **Core Viewport System** (2-3 hours) - ViewportManager utility, culling math
2. **Manager Integration** (3-4 hours) - Add culling to Map/Ship/Player/Projectile managers
3. **Visual Boundaries** (2 hours) - Render diamond border
4. **Background Layer** (2-3 hours) - Static sky/sea background
5. **Configuration Tuning** (1-2 hours) - Performance profiling, gameplay testing

**Total:** 10-14 hours

## Success Criteria

- ✅ Diamond viewport renders centered on player
- ✅ Entities outside diamond are hidden (performance improvement measurable)
- ✅ Background renders behind world with horizon at diamond top
- ✅ Configuration parameters work as expected
- ✅ 60 FPS maintained with typical entity counts
- ✅ No visual glitches or regressions

## Related Proposals

- **s7g-gamescene-refactor** - Manager architecture enables clean integration
- **r8s-ship-rotation** - Ships rotate in/out of viewport smoothly
- **c5x-ship-combat** - Projectiles culled correctly

## Visualizations

### Diamond Shape
```
        ◆ (top)
       / \
      /   \
    ◆      ◆ (left/right)
      \   /
       \ /
        ◆ (bottom)
```

### Rendering Pipeline
```
Background Layer (depth -100)
    ↓
Diamond Viewport Culling (visibility updates)
    ↓
World Rendering (tiles, entities)
    ↓
Diamond Border (depth 100)
    ↓
UI Overlays (HUD, health bars)
```

## Status Tracking

**CHANGELOG Entry:** `CHANGELOG.md` line 102-121
**Proposal Directory:** `spec/seacat/proposals/d7v-diamond-viewport/`
**Implementation Status:** Draft (awaiting implementation)

---

For questions or feedback, see the main proposal document or open an issue referencing proposal code **d7v**.
