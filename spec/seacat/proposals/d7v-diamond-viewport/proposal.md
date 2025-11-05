# d7v-diamond-viewport

**Status:** Implemented ✅
**Created:** 2025-11-04
**Implemented:** 2025-01-04
**Related:** s7g-gamescene-refactor (rendering architecture)

## Problem

The current rendering system draws the entire visible game world without any distance-based culling, leading to:

1. **Performance concerns**: All tiles, ships, and entities are rendered regardless of distance from player
2. **No aesthetic framing**: The game world extends to screen edges without visual boundaries
3. **Scalability issues**: Large maps will impact performance as more content is added
4. **Missed artistic opportunity**: No separation between game world and background elements (sky, weather, time-of-day effects)

Players should experience a "diorama" aesthetic - like looking at a detailed model ship in a display case - where the visible game area has clear, attractive boundaries that enhance rather than limit the experience.

## Proposed Solution

Implement a **diamond-shaped viewport** (square rotated 45°) that defines the visible play area, with the following components:

### 1. Diamond-Shaped Render Boundary

**Shape**: A square rotated 45° centered on the player, creating a diamond/rhombus shape in screen space.

**Dimensions**: Configurable via single parameter (square diamond):
- `DIAMOND_SIZE_TILES`: Number of tiles for both width and height (creates perfect square diamond when rotated 45°)

**Culling behavior**:
- Tiles outside the diamond are not rendered
- Ships outside the diamond are not rendered
- Players outside the diamond are not rendered
- Projectiles outside the diamond are not rendered

**Visual boundary**: The edges of the diamond are visible as a clear border, contributing to the diorama aesthetic.

### 2. Border Padding

**Purpose**: Create space between the diamond edge and the window edge for background elements.

**Configuration**: Separate padding for each edge:
- `DIAMOND_BORDER_TOP_TILES` - Padding above diamond (for sky)
- `DIAMOND_BORDER_BOTTOM_TILES` - Padding below diamond (for sea)
- `DIAMOND_BORDER_LEFT_TILES` - Padding left of diamond
- `DIAMOND_BORDER_RIGHT_TILES` - Padding right of diamond

**Use cases**:
- Static background imagery (sky, sea)
- Future animated backgrounds (clouds, waves, weather)
- UI elements (minimaps, status displays)

### 3. Static Background Layer

**Implementation**: A static image rendered behind the game world

**Composition**:
- **Top half**: Sky (gradient or textured)
- **Bottom half**: Sea/water
- **Horizon line**: Aligned with the top edge of the diamond

**Aesthetic goal**: Create the sense that the diamond viewport is a "window" into the game world, floating above an ocean with sky above.

### 4. Aspect Ratio Targeting

**Initial target**: 16:9 widescreen (standard for modern displays)

**Window sizing**: Game window resolution is configurable/resizable, zoom adjusts to fit:
- Diamond dimensions (in pixels)
- Border padding (in pixels)
- Camera zoom calculated to frame world within window

**Key principle**: The "world size" (diamond + borders) is fixed in pixels, but the window resolution can vary. Zoom scales the world to fit the window.

**Configuration approach**:
```typescript
// Implemented configuration (as of 2025-01-04)
const DIAMOND_SIZE_TILES = 35;         // Square diamond (35×35 tiles) - larger for better visibility
const DIAMOND_BORDER_TOP_TILES = 7;    // More space for sky (diamond positioned lower)
const DIAMOND_BORDER_BOTTOM_TILES = 1; // Less space for sea (diamond closer to bottom)
const DIAMOND_BORDER_LEFT_TILES = 3;   // Symmetric sides
const DIAMOND_BORDER_RIGHT_TILES = 3;
const TILE_WIDTH = 32;                 // Isometric tile width
const TILE_HEIGHT = 16;                // Isometric tile height

// Calculate window size
const diamondWidthPx = DIAMOND_SIZE_TILES * TILE_WIDTH;
const diamondHeightPx = DIAMOND_SIZE_TILES * TILE_HEIGHT;
const borderTopPx = DIAMOND_BORDER_TOP_TILES * TILE_HEIGHT;
const borderBottomPx = DIAMOND_BORDER_BOTTOM_TILES * TILE_HEIGHT;
const borderLeftPx = DIAMOND_BORDER_LEFT_TILES * TILE_WIDTH;
const borderRightPx = DIAMOND_BORDER_RIGHT_TILES * TILE_WIDTH;
const windowWidth = diamondWidthPx + borderLeftPx + borderRightPx;
const windowHeight = diamondHeightPx + borderTopPx + borderBottomPx;
```

### 5. Camera Centering & Zoom

**Camera behavior**: Camera always centers on the local player

**Constraint**: Diamond viewport moves with player, keeping them at the center

**Dynamic zoom**: Camera zoom automatically adjusts based on window resolution to fit the diamond viewport + borders

**Zoom calculation**:
```typescript
// Calculate required world dimensions (in pixels)
const worldWidth = diamondWidthPx + borderLeftPx + borderRightPx;
const worldHeight = diamondHeightPx + borderTopPx + borderBottomPx;

// Get actual window/canvas dimensions
const windowWidth = game.canvas.width;
const windowHeight = game.canvas.height;

// Calculate zoom to fit world in window (best fit)
const zoomX = windowWidth / worldWidth;
const zoomY = windowHeight / worldHeight;
const zoom = Math.min(zoomX, zoomY);  // Fit without clipping

// Apply zoom to camera
camera.setZoom(zoom);
```

**Edge cases**:
- Handle map edges gracefully (diamond can extend beyond map bounds, showing background)
- If window is resized, recalculate zoom to maintain framing
- Letterboxing/pillarboxing if aspect ratio doesn't match perfectly

## Technical Implementation

### Rendering Pipeline Changes

**New rendering order**:
1. **Background layer** (static image, full window size)
2. **Diamond mask setup** (clip region or stencil buffer)
3. **World rendering** (tiles, water, ships, players - only within diamond)
4. **Diamond border** (optional visual edge indicator)
5. **UI overlay** (HUD, health bars - rendered outside diamond if needed)

### Culling Algorithm

**Tile culling**:
```typescript
function isInDiamond(tileX: number, tileY: number, centerX: number, centerY: number): boolean {
  // Convert tile coordinates to diamond space
  const dx = Math.abs(tileX - centerX);
  const dy = Math.abs(tileY - centerY);

  // Diamond equation: |x| + |y| <= radius
  const diamondRadius = DIAMOND_WIDTH_TILES / 2;
  return (dx + dy) <= diamondRadius;
}
```

**Entity culling**: Check entity position against diamond bounds before rendering

### Configuration System

**Location**: Add to `clients/seacat/src/game/utils/Constants.ts`

```typescript
export const VIEWPORT = {
  // Square diamond viewport (rotated 45°)
  DIAMOND_SIZE_TILES: 35,  // 35×35 tile square = larger diamond for better visibility

  // Asymmetric borders for aesthetic balance (diamond positioned lower in window)
  DIAMOND_BORDER_TOP_TILES: 7,    // More space for sky (diamond pulled down)
  DIAMOND_BORDER_BOTTOM_TILES: 1, // Less space for sea (diamond closer to bottom)
  DIAMOND_BORDER_LEFT_TILES: 3,   // Symmetric sides
  DIAMOND_BORDER_RIGHT_TILES: 3,

  // Fade zone for smooth visibility transitions
  FADE_ZONE_TILES: 3,  // Border frame system with motion-reactive visibility

  TARGET_ASPECT_RATIO: 16 / 9,  // Informational only
} as const;
```

**Rationale for square diamond**:
- Simpler configuration (single size parameter)
- Perfect geometric symmetry when rotated 45°
- Equal visibility in all diagonal directions
- Easier to reason about (radius = size / 2)

**Rationale for asymmetric borders**:
- Top border (sky): More space to show clouds, atmospheric effects
- Bottom border (sea): Less space needed, focus on gameplay
- Left/Right borders: Usually symmetric for balance

**Tuning approach**: Start with conservative values, iterate based on gameplay testing

### Manager Integration

**Affected managers** (from s7g refactor):
- `MapManager`: Add culling to tile rendering
- `ShipManager`: Add culling to ship rendering
- `PlayerManager`: Add culling to remote player rendering
- `ProjectileManager`: Add culling to projectile rendering

**New utility**: Add `ViewportManager` to handle:
- Diamond culling calculations
- Window dimension calculations
- Camera zoom calculations (best fit)

## Benefits

### Performance
- Reduced draw calls (only render visible entities)
- Scalable to larger maps
- Consistent frame rate regardless of map size

### Aesthetics
- Professional "game in a frame" presentation
- Clear visual separation between world and background
- Foundation for dynamic backgrounds (day/night, weather)

### Gameplay
- Configurable view distance for balancing
- Fair play (all players see same distance)
- Future: view distance could vary by ship type or weather conditions

### Future-Proofing
- Easy to add animated backgrounds
- Supports dynamic weather/time effects
- Enables fog-of-war mechanics if desired

## Alternatives Considered

### Circular Viewport
**Pros**: More natural "radar" feel
**Cons**: Harder to align with isometric tiles, less diorama aesthetic
**Rejected**: Diamond shape works better with isometric grid

### Rectangular Viewport with Fade
**Pros**: Simpler culling math, familiar UI pattern
**Cons**: Less visually interesting, doesn't leverage isometric aesthetic
**Rejected**: Diamond provides better visual identity

### No Culling (Current Implementation)
**Pros**: Simplest to implement
**Cons**: Performance issues on large maps, no aesthetic framing
**Rejected**: Need performance optimization and better presentation

### Dynamic View Distance Based on Performance
**Pros**: Automatically adapts to player hardware
**Cons**: Unfair in multiplayer (players see different distances), complex to implement
**Rejected**: Fairness is more important than adaptive performance

## Success Criteria

1. ✅ Diamond viewport renders correctly centered on player
2. ✅ Tiles outside diamond are not rendered (performance improvement measurable)
3. ✅ Ships/players outside diamond are not rendered
4. ✅ Border padding creates space for background
5. ✅ Static background image renders behind game world
6. ✅ Horizon aligns with top of diamond
7. ✅ Configuration parameters work as expected
8. ✅ No visual glitches at diamond edges
9. ✅ Game window maintains 16:9 aspect ratio
10. ✅ Camera follows player smoothly within diamond

## Implementation Phases

### Phase 1: Core Viewport System
- Add configuration constants
- Implement diamond culling math
- Add ViewportManager utility
- Test culling with simple shapes

### Phase 2: Rendering Integration
- Integrate culling with MapManager
- Integrate culling with ShipManager
- Integrate culling with PlayerManager
- Integrate culling with ProjectileManager

### Phase 3: Visual Boundaries
- Add diamond border rendering
- Test edge cases (map boundaries)
- Verify performance improvements

### Phase 4: Background Layer
- Create static background image asset
- Implement background rendering layer
- Align horizon with diamond top edge
- Test window sizing and aspect ratio

### Phase 5: Polish & Configuration
- Tune diamond dimensions for gameplay
- Add configuration UI (optional)
- Performance profiling
- Documentation updates

## Open Questions

1. **Diamond size**: What tile size provides best gameplay experience?
   - Start with 20×20 tiles (square diamond), tune based on playtesting
   - Larger values (25, 30) for more visibility
   - Smaller values (15, 12) for tighter framing

2. **Border sizes**: How much padding is needed for backgrounds?
   - Start with top=4, bottom=2, left/right=3 tiles
   - More sky space (top) for atmospheric effects
   - Adjust based on visual testing

3. **Border rendering**: Should the diamond edge be a hard line, gradient, or decorative frame?
   - Start with subtle line, iterate based on aesthetic feedback

4. **Performance target**: What FPS should we target with culling enabled?
   - Maintain 60 FPS with 10+ ships and 8+ players

5. **Configurability**: Should players be able to adjust viewport size?
   - Not initially - keep consistent for fairness
   - Future: could be server-configured per-game-mode

6. **Window resizing**: Should window be resizable, or fixed size?
   - Resizable preferred (better user experience)
   - Zoom recalculates on resize to maintain framing
   - Background stretches/scales to fit new window size

## Related Work

- **s7g-gamescene-refactor**: Manager pattern architecture makes this integration clean
- **r8s-ship-rotation**: Ships may rotate in/out of viewport
- **c5x-ship-combat**: Projectiles must be culled correctly
- **i2m-true-isometric**: Diamond shape complements isometric perspective

## Implementation Notes (2025-01-04)

### Camera Offset for Lower Positioning

To achieve more sky space, the diamond is positioned lower in the window using camera follow offset:

```typescript
// In GameScene.create()
const borders = ViewportManager.getBorderDimensions();
const verticalOffset = (borders.top - borders.bottom) / 2;
camera.setFollowOffset(0, verticalOffset);
```

This shifts the camera down, making the player appear lower in the viewport with expanded sky area above.

### Border Frame System with Motion-Reactive Visibility

Instead of static fade zones, the implementation uses a **border frame system**:

- **3 border rows** with fixed opacity levels (88%, 45%, 10%)
- **Motion detection**: Border appears when player is moving
- **Auto-fade**: Border fades out after ~1 second of no movement
- **Smooth animation**: Tiles animate in/out using 0.05 lerp factor (~20 frames at 60fps)

See `decision-smooth-visibility-transitions.md` for full details.

### Background Positioning

- **Gradient background**: Positioned at depth -2000, horizon at 50% down
- **Custom background image**: Positioned at depth -1000, camera-fixed (scrollFactor 0)
- **Proper layering**: Gradient → Custom background → Diamond viewport → Border → UI

### Key Files

- `clients/seacat/src/game/utils/Constants.ts` - Viewport configuration
- `clients/seacat/src/game/utils/ViewportManager.ts` - Diamond culling utilities
- `clients/seacat/src/game/GameScene.ts` - Camera offset implementation
- `clients/seacat/src/game/rendering/ViewportRenderer.ts` - Gradient background
- `clients/seacat/src/game/managers/MapManager.ts` - Border frame system

## Future Enhancements

1. **Animated backgrounds**: Dynamic clouds, waves, weather effects
2. **Day/night cycle**: Background changes based on game time
3. **Fog effects**: Reduce visibility in certain weather conditions
4. **Minimap integration**: Show full map with diamond overlay
5. **Dynamic zoom**: Allow players to zoom in/out (change diamond size)
6. **Decorative frame**: Add ornate border around diamond viewport
