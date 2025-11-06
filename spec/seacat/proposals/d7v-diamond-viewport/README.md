# Diamond Viewport & Diorama Framing (d7v)

**Status:** Implemented ✅
**Created:** 2025-11-04
**Implemented:** 2025-01-04
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

Implemented values (as of 2025-01-04):
```typescript
DIAMOND_SIZE_TILES: 35         // Square diamond (35×35) - larger for better visibility
DIAMOND_BORDER_TOP_TILES: 7    // More sky space (diamond positioned lower)
DIAMOND_BORDER_BOTTOM_TILES: 1 // Less sea space (diamond closer to bottom)
DIAMOND_BORDER_LEFT_TILES: 3   // Symmetric sides
DIAMOND_BORDER_RIGHT_TILES: 3
FADE_ZONE_TILES: 3            // Border frame with motion-reactive visibility
```

**Why square?** A square diamond (equal width/height) creates perfect geometric symmetry when rotated 45° and provides equal visibility in all diagonal directions.

**Why asymmetric borders?** More sky space (top=7) positions the diamond lower in the window, creating expanded sky area while keeping the gameplay focused near the bottom. Camera offset further enhances this positioning.

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
**Implementation Status:** ✅ Implemented (2025-01-04)

## Implementation Highlights

- **Diamond viewport culling**: 35×35 tile square with performance optimization
- **Lower positioning**: Camera offset positions player below window center (7 top / 1 bottom borders)
- **Border frame system**: Motion-reactive visibility with 3 opacity levels (88%, 45%, 10%)
- **Background layers**: Gradient at -2000, custom image at -1000, camera-fixed
- **Smooth transitions**: Animated fade in/out (~20 frames at 60fps)

See `proposal.md` Implementation Notes section for details.

---

For questions or feedback, see the main proposal document or open an issue referencing proposal code **d7v**.
