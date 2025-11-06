# ADR: Smooth Visibility Transitions at Diamond Viewport Edge

**Status:** Implemented
**Date:** 2025-01-04
**Deciders:** RJ
**Related:** d7v-diamond-viewport
**Implementation:** Animated fade in/out for tiles, hard cutoff for entities

## Context

The diamond viewport culling implementation works correctly, but creates a **visual jitter** when tiles/entities appear or disappear at the diamond edge. This happens because:

1. **Hard cutoff**: Entities instantly switch between visible/invisible
2. **Row-based popping**: Tiles appear/disappear in rectangular rows (due to tile grid)
3. **Update frequency**: Tile visibility updates every 5 frames (performance optimization)
4. **No transition**: Binary on/off with no fade or easing

### User Observation

> "When a row of tiles come in, it feels like jitter"

This is particularly noticeable when:
- Moving diagonally (tiles appear in diagonal strips)
- Moving at constant speed (regular popping rhythm)
- Near the edge of the viewport (attention is drawn to the boundary)

## Decision Options

We evaluated 5 approaches to smooth the visibility transitions:

### Option 1: Fade at Edges (Alpha Transition)

**Implementation:**
- Add a "fade zone" of 2-3 tiles inside the diamond edge
- Tiles in fade zone have alpha < 1.0 based on distance from edge
- Smoothly interpolate alpha from 1.0 (center) to 0.0 (edge)

```typescript
const distanceFromEdge = radiusTiles - Math.max(dx, dy);
const fadeZoneTiles = 3;
if (distanceFromEdge <= fadeZoneTiles) {
  const alpha = distanceFromEdge / fadeZoneTiles;
  tile.setAlpha(alpha);
} else {
  tile.setAlpha(1.0);
}
```

**Pros:**
- Smooth visual transition (no hard pop)
- Industry standard (used in many games)
- Works for all entity types (tiles, ships, players)
- Configurable fade zone size

**Cons:**
- Additional alpha calculations every update (~5-10% overhead)
- Fade zone reduces effective viewport size slightly
- May look "ghostly" or unclear at edges
- Phaser tile alpha support may vary by layer type

**Performance:** ~5-10% additional overhead for alpha calculations

---

### Option 2: Staggered Update Timing

**Implementation:**
- Update different quadrants of the viewport at different times
- Instead of updating all tiles every 5 frames, spread updates across frames
- Frame 0: NE quadrant, Frame 1: SE quadrant, Frame 2: SW quadrant, Frame 3: NW quadrant

```typescript
const quadrant = Math.floor((tileX + tileY) % 4);
if (this.frameCount % 4 === quadrant) {
  // Update this tile's visibility
}
```

**Pros:**
- Reduces "wave" effect of simultaneous updates
- Better distributes CPU load across frames
- No visual artifacts (tiles remain visible or hidden)
- Easy to implement

**Cons:**
- Doesn't eliminate popping, just staggers it
- May create diagonal "sweep" pattern instead
- Tiles may stay visible 1-4 frames longer than they should
- More complex update logic

**Performance:** Neutral (same total work, just distributed)

---

### Option 3: Larger Diamond + Hysteresis

**Implementation:**
- Use two diamond sizes: "show" threshold and "hide" threshold
- Tiles become visible when entering the larger diamond
- Tiles become hidden when leaving the smaller diamond
- Creates a "buffer zone" that reduces toggling

```typescript
const showRadiusTiles = DIAMOND_SIZE_TILES / 2 + 2; // Larger
const hideRadiusTiles = DIAMOND_SIZE_TILES / 2 - 2; // Smaller

if (!tile.visible) {
  // Check larger radius to show
  tile.setVisible((dx <= showRadiusTiles) && (dy <= showRadiusTiles));
} else {
  // Check smaller radius to hide
  if ((dx > hideRadiusTiles) || (dy > hideRadiusTiles)) {
    tile.setVisible(false);
  }
}
```

**Pros:**
- Reduces frequency of visibility changes
- No performance overhead (same checks)
- Tiles stay visible longer at edges (less aggressive culling)
- No visual artifacts (clean on/off)

**Cons:**
- Increases number of visible tiles (reduces performance benefit)
- Doesn't eliminate popping, just reduces frequency
- Requires tracking previous visibility state
- May show tiles outside the intended viewport

**Performance:** Slightly worse (more tiles rendered)

---

### Option 4: Update Every Frame (Remove 5-Frame Delay)

**Implementation:**
- Remove the 5-frame update throttle
- Update tile visibility every frame (60 times/sec instead of 12)
- Makes transitions smoother by reducing the delay between position change and visibility update

```typescript
// Remove this:
// this.visibilityUpdateCounter++;
// if (this.visibilityUpdateCounter < 5) return;

// Update every frame instead
this.updateVisibleTiles(centerX, centerY);
```

**Pros:**
- Tiles respond immediately to movement
- No accumulated "jumps" from delayed updates
- Simplest code (remove optimization)
- Better responsiveness

**Cons:**
- Higher CPU usage (5x more visibility checks)
- May impact performance on large maps (100×100 tiles)
- Doesn't eliminate popping, just makes it more frequent
- Defeats purpose of performance optimization

**Performance:** 5x overhead for tile visibility checks (~2-5ms on large maps)

---

### Option 5: Fade + Stagger (Hybrid Approach)

**Implementation:**
- Combine fade zone (Option 1) with staggered updates (Option 2)
- Use fade zone of 2 tiles at diamond edge
- Stagger updates across 4 frames to reduce CPU spikes

```typescript
const quadrant = Math.floor((tileX + tileY) % 4);
if (this.frameCount % 4 === quadrant) {
  const distanceFromEdge = radiusTiles - Math.max(dx, dy);
  const fadeZoneTiles = 2;

  if (distanceFromEdge > fadeZoneTiles) {
    tile.setVisible(true);
    tile.setAlpha(1.0);
  } else if (distanceFromEdge > 0) {
    tile.setVisible(true);
    tile.setAlpha(distanceFromEdge / fadeZoneTiles);
  } else {
    tile.setVisible(false);
  }
}
```

**Pros:**
- Best visual smoothness (fade effect)
- Best performance distribution (staggered updates)
- Professional AAA game appearance
- Configurable fade zone

**Cons:**
- Most complex implementation
- Highest total overhead (~10-15%)
- May introduce subtle visual inconsistencies
- Requires careful tuning

**Performance:** ~10-15% overhead (fade + stagger complexity)

---

## Decision Matrix

| Option | Visual Quality | Performance | Complexity | AAA Standard |
|--------|---------------|-------------|------------|--------------|
| 1. Fade at Edges | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Yes |
| 2. Staggered Updates | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ No |
| 3. Hysteresis | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ No |
| 4. Update Every Frame | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ No |
| 5. Fade + Stagger | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ✅ Yes |

---

## Recommendation

**Choose Option 1: Fade at Edges** as the primary solution, with Option 5 as a fallback if performance allows.

### Rationale

1. **Industry Standard**: Fade transitions are used in AAA games (Civilization, Total War, RTS games)
2. **Best Visual Quality**: Smooth, professional appearance with no hard popping
3. **Acceptable Performance**: 5-10% overhead is reasonable for visual improvement
4. **Simple Implementation**: Single concept, easy to tune and debug
5. **User Expectation**: Players expect smooth fades, not hard cutoffs

### Implementation Plan

**Phase 1: Basic Fade (2 hours)**
- Add fade zone calculation to `ViewportManager`
- Update `MapManager.updateLayerVisibility()` to set alpha based on edge distance
- Test with different fade zone sizes (2, 3, 4 tiles)

**Phase 2: Entity Fade (1 hour)**
- Apply fade logic to ships, players, projectiles
- Ensure alpha transitions are smooth

**Phase 3: Optimization (1 hour)**
- Profile performance impact on large maps
- If overhead > 10%, consider staggered updates (Option 5)

**Phase 4: Tuning (1 hour)**
- Playtest with different fade zones
- Adjust based on visual quality vs performance trade-off

---

## Alternative: Conditional Implementation

If performance is critical, implement **tiered fade**:

- **Small maps (< 30×30)**: Full fade with 3-tile zone (best visuals)
- **Medium maps (30-60)**: 2-tile fade zone (balanced)
- **Large maps (> 60)**: Option 2 (staggered updates, no fade)

This ensures smooth visuals on typical maps while maintaining performance on large maps.

---

## Open Questions

1. **Fade zone size**: What looks best? (Test 2, 3, 4 tiles)
2. **Layer-specific fade**: Should ground tiles fade differently than objects?
3. **Entity fade**: Should ships/players fade or hard-cut? (Entities may look better with hard cut)
4. **Performance threshold**: What's acceptable overhead? (5%? 10%? 15%?)

---

## Implementation Code Snippet

```typescript
// ViewportManager: Add method to calculate fade alpha
static getFadeAlpha(
  tileX: number,
  tileY: number,
  centerTileX: number,
  centerTileY: number,
  radiusTiles: number,
  fadeZoneTiles: number = 3
): number {
  const dx = Math.abs(tileX - centerTileX);
  const dy = Math.abs(tileY - centerTileY);
  const maxDist = Math.max(dx, dy); // Chebyshev distance for square

  const distanceFromEdge = radiusTiles - maxDist;

  if (distanceFromEdge <= 0) {
    return 0.0; // Outside diamond
  } else if (distanceFromEdge >= fadeZoneTiles) {
    return 1.0; // Inside fade zone
  } else {
    // Linear interpolation in fade zone
    return distanceFromEdge / fadeZoneTiles;
  }
}

// MapManager: Apply fade alpha to tiles
private updateLayerVisibility(
  layer: Phaser.Tilemaps.TilemapLayer,
  centerX: number,
  centerY: number
): void {
  const centerTilePos = this.map.worldToTileXY(centerX, centerY);
  if (!centerTilePos) return;

  const radiusTiles = ViewportManager.getDiamondRadiusTiles();
  const fadeZoneTiles = 3; // Configurable

  for (let tileY = 0; tileY < this.map.height; tileY++) {
    for (let tileX = 0; tileX < this.map.width; tileX++) {
      const tile = layer.getTileAt(tileX, tileY);
      if (!tile) continue;

      const alpha = ViewportManager.getFadeAlpha(
        tileX, tileY,
        centerTilePos.x, centerTilePos.y,
        radiusTiles,
        fadeZoneTiles
      );

      if (alpha > 0) {
        tile.setVisible(true);
        tile.setAlpha(alpha);
      } else {
        tile.setVisible(false);
      }
    }
  }
}
```

---

## Success Criteria

Implementation is successful when:

1. ✅ No visible "row popping" when moving
2. ✅ Smooth fade transitions at diamond edges
3. ✅ Performance overhead < 10% on typical maps
4. ✅ Maintains 60 FPS with 10+ ships
5. ✅ Visually professional appearance
6. ✅ Configurable fade zone for tuning

---

## References

- **Civilization VI**: Uses fade zones for fog of war
- **Total War series**: Fade transitions for unit visibility
- **StarCraft II**: Smooth visibility transitions in fog of war
- **Don't Starve**: Hard cutoff (acceptable for stylized art)

---

## Implementation Notes

**What Was Implemented:**

We implemented a **hybrid approach**:
- **Tiles**: Animated fade in/out (0.0 → 1.0 over ~3 frames at 60fps)
- **Entities**: Hard cutoff (instant visibility change)

**Why This Approach:**

1. **Tiles animate smoothly**: Solves the "row popping" jitter without ghostly partial transparency
2. **Entities stay solid**: Ships, players, and projectiles use hard cutoff to avoid looking like ghosts
3. **Fast animation**: Uses 0.3 lerp factor per frame = ~3 frames to complete transition
4. **State tracking**: MapManager tracks current alpha for each tile/sprite to enable smooth animation

**Performance:**

- Updates run every frame (not throttled) to ensure smooth animation
- **OPTIMIZED**: Only checks tiles within viewport + 2-tile margin (not entire map!)
  - Before: 100×100 map = 10,000 tiles checked per frame
  - After: ~40×40 viewport area = ~1,600 tiles checked per frame
  - **Result**: ~85% reduction in tile checks!
- Overhead is minimal: simple lerp calculation per visible tile
- Most tiles quickly reach target alpha (0 or 1) and stop animating

**Files Modified:**

- `clients/seacat/src/game/utils/Constants.ts` - Added FADE_ZONE_TILES constant (unused but kept for future tuning)
- `clients/seacat/src/game/utils/ViewportManager.ts` - Added fade calculation methods (kept for reference)
- `clients/seacat/src/game/managers/MapManager.ts` - **Implemented animated fade for tiles**
- `clients/seacat/src/game/managers/ShipManager.ts` - Uses hard cutoff
- `clients/seacat/src/game/managers/PlayerManager.ts` - Uses hard cutoff
- `clients/seacat/src/game/managers/ProjectileManager.ts` - Uses hard cutoff

---

## Revision History

- 2025-01-04: Initial decision document
- 2025-01-04: Implemented animated fade for tiles, hard cutoff for entities
- 2025-01-04: Performance optimization - only check tiles in viewport area, not entire map (~85% reduction)
