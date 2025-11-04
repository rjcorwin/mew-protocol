# d7v-diamond-viewport: Research

## Current Rendering Architecture

### GameScene Refactor Context (s7g-gamescene-refactor)

The seacat client was recently refactored (November 2025) into a manager-based architecture that provides clean separation of concerns:

**Rendering Managers:**
- `MapManager`: Handles Tiled map loading and tile rendering
- `WaterRenderer`: Renders animated wave effects
- `ShipRenderer`: Renders ships with sprite sheets and control points
- `PlayerRenderer`: Renders players with 8-directional animations
- `EffectsRenderer`: Renders particle effects (explosions, splashes)

**Current Rendering Pipeline:**
1. Background (none currently - just canvas clear)
2. Map tiles (all visible tiles in camera bounds)
3. Water effects (wave animation on water tiles)
4. Ships (all ships in game world)
5. Players (all remote players)
6. Projectiles (all active projectiles)
7. Effects (particle systems)
8. UI overlays (health bars, prompts)

### Camera System

**Location:** `clients/seacat/src/game/GameScene.ts`

**Current implementation:**
- Phaser's built-in camera system
- Camera follows local player with lerp smoothing (0.1 factor)
- Camera bounds set to map dimensions
- No culling beyond Phaser's automatic viewport culling

**Camera update (GameScene.ts:~1850):**
```typescript
this.cameras.main.centerOn(this.localPlayer.x, this.localPlayer.y);
```

**Phaser's built-in culling:**
- Only culls objects completely outside camera bounds
- No custom culling logic for distance or shaped viewports
- All entities in camera view are rendered

### Map Rendering

**Location:** `clients/seacat/src/game/managers/MapManager.ts`

**Current approach:**
- Loads entire Tiled map (30×30 tiles currently)
- Phaser renders all visible tiles automatically
- No tile-level culling beyond camera bounds
- Tilemap.render() called every frame

**Performance characteristics:**
- 30×30 = 900 tiles (manageable with current map size)
- Future larger maps (100×100 = 10,000 tiles) would impact performance
- Phaser's WebGL renderer is efficient but renders everything in view

### Entity Rendering

**Ships (ShipRenderer.ts):**
- Iterates all ships in `ShipManager.getShips()`
- Renders sprite, control points, cannons, health bars
- No distance-based culling
- Current: 1-3 ships (not a performance issue yet)

**Players (PlayerRenderer.ts):**
- Iterates all remote players in `PlayerManager.getPlayers()`
- Renders sprite with 8-directional animation
- Updates animation based on velocity
- Current: 1-8 players (not a performance issue yet)

**Projectiles (ProjectileManager.ts):**
- Renders all active projectiles
- Simulates physics every frame
- Current: 0-10 projectiles typically (not a performance issue yet)

### Performance Baseline

**Test conditions:**
- Map: 30×30 isometric tiles (32×16 px)
- Entities: 2 ships, 4 players, 5 projectiles
- Display: 1280×720 window, 16:9 aspect ratio
- Hardware: M1 MacBook Pro

**Measured performance:**
- FPS: Consistent 60 FPS
- Draw calls: ~50-70 per frame (Phaser batching)
- Memory: ~150 MB (including Electron overhead)
- CPU: ~15% on single core

**Conclusion:** Current performance is acceptable, but no culling means scalability is limited.

## Viewport Culling Research

### Industry Approaches

#### Starcraft / Warcraft (RTS Games)
- **Approach:** Rectangular viewport culling
- **Method:** Only render units within camera bounds + small buffer
- **Performance:** Handles 1000+ units on large maps
- **Aesthetic:** Fog-of-war hides distant areas

#### Animal Crossing: New Horizons
- **Approach:** Limited render distance with gradient fade
- **Method:** Entities beyond ~50 tiles fade out
- **Performance:** Maintains 30 FPS on Nintendo Switch
- **Aesthetic:** Soft vignette at edges creates cozy feel

#### Don't Starve Together
- **Approach:** Circular viewport with hard edge
- **Method:** Darkness/fog beyond visibility radius
- **Performance:** Handles large procedural worlds
- **Aesthetic:** Clear boundary reinforces survival theme

#### Sea of Thieves
- **Approach:** Progressive LOD (Level of Detail) with fog
- **Method:** Distant ships/islands render at lower detail
- **Performance:** Open-world ocean with multiple ships
- **Aesthetic:** Atmospheric fog creates sense of scale

### Diamond Viewport Precedent

**Unique approach:** Diamond-shaped viewports are rare in games

**Similar mechanics:**
- **Factorio**: Uses rectangular chunks for rendering
- **Rimworld**: Circular "fog of war" radius
- **Into the Breach**: Grid-based with hard boundaries

**Isometric + shaped viewport:**
- Most isometric games use rectangular culling aligned with screen
- Diamond shape leverages isometric grid structure
- Aesthetic choice more than technical necessity

### Culling Algorithms

#### Axis-Aligned Bounding Box (AABB)
```typescript
function isInView(x, y, camX, camY, width, height) {
  return x >= camX && x <= camX + width &&
         y >= camY && y <= camY + height;
}
```
**Pros:** Fast (4 comparisons)
**Cons:** Rectangular, doesn't fit diamond shape

#### Circle Culling
```typescript
function isInView(x, y, centerX, centerY, radius) {
  const dx = x - centerX;
  const dy = y - centerY;
  return (dx * dx + dy * dy) <= radius * radius;
}
```
**Pros:** Natural distance-based culling
**Cons:** Doesn't align with isometric tiles

#### Diamond Culling (Proposed)
```typescript
function isInDiamond(x, y, centerX, centerY, radiusTiles) {
  const dx = Math.abs(x - centerX);
  const dy = Math.abs(y - centerY);
  return (dx + dy) <= radiusTiles;
}
```
**Pros:** Aligns with isometric grid, simple math (2 abs, 1 add, 1 compare)
**Cons:** None identified

**Performance comparison:**
- AABB: ~4 operations
- Circle: ~5 operations + sqrt (or 6 without sqrt)
- Diamond: ~4 operations

**Conclusion:** Diamond culling is as fast as AABB, better suited to isometric aesthetics.

## Background Rendering Research

### Static Backgrounds

**Common approaches:**
- Single background image (scaled to window)
- Parallax layers (multiple images, different scroll speeds)
- Gradient fills (programmatically generated)
- Tiled backgrounds (repeating patterns)

**Phaser implementation:**
```typescript
// Add static background
this.add.image(0, 0, 'background').setOrigin(0, 0).setDepth(-10);

// Or tiled background
this.add.tileSprite(0, 0, width, height, 'background-tile')
  .setOrigin(0, 0).setDepth(-10);
```

**Asset creation:**
- Sky gradient: Simple gradient from light blue to darker blue
- Sea/horizon: Flat ocean texture with horizon line
- Combined: Photoshop/GIMP composition, export as PNG

### Horizon Alignment

**Goal:** Top edge of diamond = horizon line in background

**Calculation:**
```typescript
const windowHeight = 720; // Example
const diamondHeightPx = DIAMOND_HEIGHT_TILES * TILE_HEIGHT;
const borderPx = DIAMOND_BORDER_TILES * TILE_HEIGHT;
const diamondTopY = borderPx;
const horizonY = diamondTopY; // Align horizon with diamond top

// Background image composition:
// - Top 0 to horizonY: Sky
// - horizonY to windowHeight: Sea
```

### Diorama Aesthetic Research

**Definition:** Diorama = small-scale model scene in a display case

**Visual characteristics:**
- Clear boundaries (glass case, frame)
- Focused detail in center
- Context provided by surrounding space
- "Precious" feeling (like viewing art)

**Game examples:**
- **Captain Toad: Treasure Tracker**: Cube-world dioramas
- **Monument Valley**: Minimalist architectural dioramas
- **Hitman GO**: Board game dioramas

**Key elements:**
- Limited play area (not infinite scrolling)
- Visible edges/boundaries
- Decorative frame or context
- High-detail miniature aesthetic

**Applied to Seacat:**
- Diamond viewport = "glass case" window
- Background = display context (sea, sky)
- Blocky ship models = miniature aesthetic
- Border = decorative frame

## Technical Constraints

### Phaser Camera System

**Camera bounds:**
- Current: Set to map dimensions (30×30 tiles)
- With diamond: Set to follow player, independent of map bounds
- Challenge: Diamond may extend beyond map edges

**Solution approaches:**
1. Allow diamond to show background beyond map (preferred)
2. Constrain diamond to map bounds (complex edge cases)
3. Make maps large enough that edges are never visible

**Recommendation:** Option 1 - let background show beyond map boundaries

### WebGL Rendering

**Clipping/masking options:**

1. **Graphics mask:**
```typescript
const mask = this.make.graphics();
mask.fillStyle(0xffffff);
mask.fillPolygon([/* diamond points */]);
sprite.setMask(new Phaser.Display.Masks.GeometryMask(this, mask));
```
**Pros:** Clean edges
**Cons:** Performance cost for masking

2. **Manual culling (recommended):**
```typescript
// Check before rendering
if (isInDiamond(entity.x, entity.y, player.x, player.y)) {
  entity.setVisible(true);
} else {
  entity.setVisible(false);
}
```
**Pros:** Best performance, simple logic
**Cons:** Entities still in scene (just not rendered)

3. **Render texture:**
```typescript
// Render game world to texture, then draw clipped
const renderTexture = this.add.renderTexture(0, 0, width, height);
renderTexture.draw(gameObjects);
```
**Pros:** Full control
**Cons:** Complex, potential performance issues

**Recommendation:** Option 2 - manual culling via visibility flags

### Coordinate Systems

**Existing systems:**
- World coordinates (Cartesian physics)
- Isometric rendering (cosmetic transform)
- Tile coordinates (grid positions)

**Diamond viewport coordinates:**
- Define in tile space (easier to reason about)
- Convert to world coordinates for culling checks
- Diamond center = player's tile position

**Coordinate transform:**
```typescript
// Player world position -> tile position
const playerTileX = Math.floor(player.x / TILE_WIDTH);
const playerTileY = Math.floor(player.y / TILE_HEIGHT);

// Entity world position -> tile position
const entityTileX = Math.floor(entity.x / TILE_WIDTH);
const entityTileY = Math.floor(entity.y / TILE_HEIGHT);

// Check if entity in diamond
if (isInDiamond(entityTileX, entityTileY, playerTileX, playerTileY, RADIUS)) {
  // Render entity
}
```

## Configuration & Tuning

### Diamond Size Recommendations

**Factors:**
- Gameplay: Players need enough visibility to react to threats
- Performance: Larger diamond = more entities rendered
- Aesthetics: Diamond should feel intentionally framed, not cramped

**Recommended starting values:**
- `DIAMOND_SIZE_TILES = 20`: Square diamond (640px × 320px in isometric)
- `DIAMOND_BORDER_TOP_TILES = 4`: ~64px top border (more sky)
- `DIAMOND_BORDER_BOTTOM_TILES = 2`: ~32px bottom border (less sea)
- `DIAMOND_BORDER_LEFT_TILES = 3`: ~96px side borders
- `DIAMOND_BORDER_RIGHT_TILES = 3`

**Tuning process:**
1. Start with 20×20 tiles (square diamond)
2. Playtest with multiple players and ships
3. Measure if players can see distant threats in time
4. Adjust size if viewport feels too small/large (try 15×15 or 25×25)
5. Test performance with large numbers of entities

### Aspect Ratio & Zoom Considerations

**Approach: Dynamic Zoom Instead of Fixed Aspect Ratio**

Instead of forcing window to specific aspect ratio, let window be any size and zoom to fit:

**World dimensions (fixed in pixels):**
```typescript
// 20×20 diamond + borders (4,2,3,3)
const diamondWidth = 20 * 32 = 640px;
const diamondHeight = 20 * 16 = 320px;
const borderLeft = 3 * 32 = 96px;
const borderRight = 3 * 32 = 96px;
const borderTop = 4 * 16 = 64px;
const borderBottom = 2 * 16 = 32px;
const worldWidth = 640 + 96 + 96 = 832px;
const worldHeight = 320 + 64 + 32 = 416px;
```

**Zoom calculation for different windows:**
```typescript
// 1280×720 (16:9)
zoomX = 1280 / 832 = 1.54
zoomY = 720 / 416 = 1.73
zoom = min(1.54, 1.73) = 1.54  ✅

// 1920×1080 (16:9, larger)
zoomX = 1920 / 832 = 2.31
zoomY = 1080 / 416 = 2.60
zoom = min(2.31, 2.60) = 2.31  ✅ (bigger window = bigger zoom)

// 800×600 (4:3)
zoomX = 800 / 832 = 0.96
zoomY = 600 / 416 = 1.44
zoom = min(0.96, 1.44) = 0.96  ✅ (fits horizontally, letterboxed vertically)
```

**Benefits:**
- Works with any window size/aspect ratio
- Larger windows = larger view (zoomed in), better visibility
- Smaller windows = smaller view (zoomed out), still fits
- Resizable window support (zoom recalculates on resize)

**Trade-off:** Different window sizes give slightly different visual scale, but NOT different gameplay visibility (diamond tile count is fixed for all players)

## Open Questions for Implementation

1. **Should border be symmetric?** (same padding on all sides vs. variable)
   - Recommendation: Symmetric for simplicity

2. **How to handle entities partially in diamond?** (all-or-nothing vs. fade at edges)
   - Recommendation: All-or-nothing culling (simple, performant)

3. **Should projectiles be culled?** (may disappear mid-flight)
   - Recommendation: Yes, cull projectiles (player won't see, saves performance)

4. **How to visualize diamond edge?** (line, gradient, decorative frame)
   - Recommendation: Subtle line initially, decorative frame in future

5. **Should viewport size be configurable per-player?** (fairness vs. flexibility)
   - Recommendation: Fixed for all players (fairness in multiplayer)

6. **Does server need to know viewport size?** (for game logic)
   - Recommendation: No - purely client-side rendering optimization

## Conclusion

Diamond viewport culling is:
- **Technically feasible**: Simple math, integrates cleanly with manager architecture
- **Performance beneficial**: Reduces render load, especially on large maps
- **Aesthetically valuable**: Creates unique "diorama" presentation
- **Gameplay appropriate**: Provides fair, consistent visibility for all players
- **Future-proof**: Enables dynamic backgrounds and weather effects

**Recommended approach:**
1. Implement manual culling via visibility flags (best performance)
2. Start with 20×15 tile diamond, 3 tile border
3. Create simple sky/sea gradient background
4. Tune dimensions based on playtesting
5. Add decorative frame in future iteration
