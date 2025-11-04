# ADR: Diamond Viewport & Diorama Framing

**Status:** Proposed
**Date:** 2025-11-04
**Deciders:** RJ
**Related:** s7g-gamescene-refactor, r8s-ship-rotation, c5x-ship-combat

## Context

The seacat game currently renders the entire visible game world without distance-based culling. As we scale to larger maps and more entities, we need:

1. **Performance optimization**: Reduce rendering load by culling distant entities
2. **Visual identity**: Create a distinctive "diorama" aesthetic that sets seacat apart
3. **Future-proofing**: Enable dynamic backgrounds (weather, time-of-day) without affecting world rendering
4. **Gameplay balance**: Provide consistent, fair visibility for all players

The recent GameScene refactor (s7g) created a clean manager architecture that makes viewport changes easier to implement across rendering systems.

## Decision

We will implement a **diamond-shaped viewport** (square rotated 45°) that defines the visible play area, with the following characteristics:

### 1. Shape: Diamond (Rotated Square)

**Rationale:**
- Aligns naturally with isometric tile grid
- Creates unique visual identity (different from typical rectangular viewports)
- Simple math (Manhattan distance: `|dx| + |dy| <= radius`)
- As performant as rectangular culling

**Alternatives considered:**
- **Circular viewport**: More complex math (sqrt), doesn't align with isometric tiles
- **Rectangular viewport**: Less visually interesting, doesn't leverage isometric aesthetic
- **No culling**: Simple but not scalable, misses aesthetic opportunity

### 2. Culling Method: Manual Visibility Flags

**Rationale:**
- Best performance (no GPU masking overhead)
- Simple implementation (just set `.setVisible(false)`)
- Integrates cleanly with Phaser scene graph
- Entities remain in scene (can be toggled back on instantly)

**Alternatives considered:**
- **WebGL masking**: Clean edges but performance cost
- **Render texture clipping**: Complex, potential performance issues
- **Physically removing entities**: More complex lifecycle management

### 3. Configuration: Tile-Based Dimensions

**Parameters:**
```typescript
DIAMOND_WIDTH_TILES: 20   // Horizontal diagonal
DIAMOND_HEIGHT_TILES: 15  // Vertical diagonal
DIAMOND_BORDER_TILES: 3   // Padding around diamond
```

**Rationale:**
- Tile-based math easier to reason about than pixel values
- Scales with different tile sizes if needed
- Clear semantic meaning for gameplay tuning

**Initial values:**
- 20×15 tiles provides ~10-tile visibility in each cardinal direction
- 3-tile border provides space for background imagery
- Values tunable based on playtesting

### 4. Background: Static Image Layer

**Initial implementation:** Single static image with sky/sea split

**Rationale:**
- Simplest to implement (single Phaser sprite)
- Provides immediate visual improvement
- Foundation for future animated backgrounds
- Horizon line at top of diamond creates clear context

**Alternatives considered:**
- **Animated backgrounds immediately**: Too complex for initial implementation
- **No background**: Misses aesthetic opportunity
- **Gradient fill**: Less visually interesting than image

### 5. Aspect Ratio: Flexible (Not Forced 16:9)

**Decision:** Let diamond dimensions dictate window size, don't force standard aspect ratios

**Rationale:**
- Isometric tiles (32×16) create non-standard aspect ratios naturally
- Forcing 16:9 requires complex math and may not align with gameplay needs
- Modern displays handle arbitrary window sizes well
- Consistent viewport size more important than aspect ratio for gameplay

**Alternative considered:**
- **Force 16:9**: Adds complexity, may compromise visibility or aesthetics

### 6. Camera Behavior: Always Center on Player

**Decision:** Diamond viewport always centered on local player, moving with them

**Rationale:**
- Consistent visibility in all directions
- Familiar FPS/action game pattern
- Simplifies culling math (player is always at origin)
- Fair for multiplayer (all players have same visibility)

**Alternatives considered:**
- **Edge scrolling**: RTS-style, but doesn't fit action-focused gameplay
- **Fixed viewport**: Limits exploration, feels restrictive

### 7. Fairness: Fixed Viewport Size for All Players

**Decision:** All players see the same diamond size (server could configure, but not per-player)

**Rationale:**
- Multiplayer fairness (no advantage from larger viewport)
- Consistent gameplay experience
- Simpler to balance game mechanics
- Server can configure for different game modes if needed

**Alternatives considered:**
- **Player-configurable**: Creates unfair advantage
- **Hardware-adaptive**: Different players see different distances (unfair)

### 8. Dynamic Zoom: Best-Fit Scaling

**Decision:** Camera zoom automatically adjusts to fit diamond viewport + borders in window

**Rationale:**
- Supports resizable windows (better UX)
- Works across different screen resolutions
- Ensures world is always properly framed
- Simple calculation (min of horizontal/vertical fit)

**Implementation:**
```typescript
zoom = Math.min(windowWidth / worldWidth, windowHeight / worldHeight)
```

**Alternatives considered:**
- **Fixed zoom**: Doesn't work with resizable windows
- **Fill instead of fit**: Would clip parts of viewport (unacceptable)
- **No zoom adjustment**: World would be wrong size at different resolutions

### 8. Entity Culling: All-or-Nothing

**Decision:** Entities either fully visible or fully hidden (no partial rendering or fade)

**Rationale:**
- Simplest implementation
- Best performance (binary visibility check)
- Clean visual boundary
- Fade effects can be added later if desired

**Alternatives considered:**
- **Fade at edges**: More complex, potential performance cost
- **Partial rendering**: Complex clipping logic

## Architecture Integration

### Manager Changes

**Affected modules** (from s7g refactor):
- `MapManager`: Add tile culling to render loop
- `ShipManager`: Add ship culling before rendering
- `PlayerManager`: Add player culling before rendering
- `ProjectileManager`: Add projectile culling before rendering

**New module:**
- `ViewportManager`: Central utility for diamond calculations and culling checks

**Pattern:**
```typescript
// In each manager's update/render method
for (const entity of entities) {
  if (ViewportManager.isInDiamond(entity.x, entity.y)) {
    entity.setVisible(true);
    // ... render entity
  } else {
    entity.setVisible(false);
  }
}
```

### Rendering Order

**Updated pipeline:**
1. **Background layer** (static image, depth -100)
2. **Diamond culling** (visibility updates for all entities)
3. **World rendering** (tiles, water, entities - only visible ones)
4. **Diamond border** (optional visual edge, depth 100)
5. **UI overlays** (HUD, health bars - always visible)

## Performance Impact

**Expected improvements:**
- **Tile rendering**: 50-70% reduction on large maps (only render ~300 tiles vs ~1000+)
- **Entity rendering**: 30-50% reduction (depends on entity distribution)
- **Frame time**: Estimated 2-5ms improvement (60 FPS → more headroom for complex scenes)

**Trade-offs:**
- Culling checks add minimal overhead (~0.1ms for 100 entities)
- Background rendering adds 1 draw call (negligible)

**Net result:** Significant performance improvement, especially on larger maps

## Consequences

### Positive

1. **Scalability**: Can support much larger maps without performance degradation
2. **Visual identity**: Unique diorama aesthetic sets seacat apart from typical isometric games
3. **Future features**: Background layer enables weather, day/night cycle, atmospheric effects
4. **Fair gameplay**: All players have consistent visibility
5. **Clean architecture**: Integrates naturally with manager pattern from s7g refactor

### Negative

1. **Reduced visibility**: Players see less of the world at once
   - *Mitigation*: Tunable dimensions, start conservatively large
2. **Edge cases**: Entities may pop in/out at diamond boundary
   - *Mitigation*: Proper border size reduces jarring transitions
3. **Minimap need**: Players may want to see full world
   - *Future enhancement*: Add minimap with diamond overlay
4. **Background asset**: Need to create background artwork
   - *Mitigation*: Start with simple gradient, iterate

### Neutral

1. **Different from typical isometric games**: May surprise players (could be positive or negative)
2. **Aspect ratio**: Non-standard window sizes may feel unusual
3. **Configuration tuning**: Will require playtesting to find optimal values

## Implementation Plan

### Phase 1: Core Viewport System (Foundation)
- Add configuration constants to `Constants.ts`
- Implement `ViewportManager` utility class
- Add diamond culling math
- Write unit tests for culling logic

### Phase 2: Manager Integration (Rendering)
- Integrate culling with `MapManager`
- Integrate culling with `ShipManager`
- Integrate culling with `PlayerManager`
- Integrate culling with `ProjectileManager`
- Verify no regressions in existing functionality

### Phase 3: Visual Boundaries (Polish)
- Add diamond border rendering (subtle line)
- Handle map edge cases (diamond extends beyond map)
- Performance profiling and optimization
- Test with multiple clients

### Phase 4: Background Layer (Aesthetics)
- Create background asset (sky/sea gradient)
- Implement background rendering (depth -100)
- Align horizon with diamond top edge
- Test window sizing and aspect ratio

### Phase 5: Configuration Tuning (Gameplay)
- Playtest with different diamond sizes
- Measure performance with large entity counts
- Tune border padding for visual balance
- Update documentation

## Monitoring & Success Metrics

**Performance metrics:**
- Target: Maintain 60 FPS with 10+ ships, 8+ players, 20+ projectiles
- Measure: Frame time reduction on large maps
- Monitor: Draw call reduction

**Gameplay metrics:**
- Playtest: Do players feel visibility is adequate?
- Measure: Can players react to threats in time?
- Monitor: Complaints about "can't see far enough"

**Aesthetic feedback:**
- Test: Does diorama aesthetic resonate with players?
- Measure: Community feedback on visual style
- Monitor: Screenshots/videos players share

## Future Enhancements

1. **Animated backgrounds**: Dynamic clouds, waves, weather
2. **Day/night cycle**: Background changes based on game time
3. **Minimap**: Show full map with diamond overlay
4. **Fog of war**: Reduce visibility in weather conditions
5. **Decorative frame**: Ornate border around diamond
6. **Dynamic zoom**: Allow players to zoom in/out (change diamond size)
7. **Server configuration**: Different game modes with different viewport sizes

## References

- **s7g-gamescene-refactor**: Manager architecture foundation
- **Industry research**: Don't Starve Together (circular culling), Animal Crossing (distance fade)
- **Phaser docs**: Camera system, visibility flags, depth sorting
- **Isometric games**: Starcraft (rectangular culling), Factorio (chunk-based rendering)

## Decision Review

This decision should be reviewed after:
1. ✅ Phase 1-2 implementation complete (core system working)
2. ✅ Phase 3-4 implementation complete (visual polish done)
3. ✅ Initial playtesting with 4+ players
4. ✅ Performance profiling on large maps

If the decision needs revision, update this document and create a new decision record for the changes.
