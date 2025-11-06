# Diamond Viewport Implementation Plan

**Proposal:** d7v-diamond-viewport
**Status:** Draft - Ready for Implementation
**Estimated Effort:** 8-12 hours

## Overview

This implementation plan provides step-by-step instructions for adding diamond viewport culling and diorama framing to the seacat game client. The work is broken into 5 phases that build incrementally, allowing testing at each stage.

## ⚠️ Critical Implementation Gotchas

Before starting implementation, read these key issues that can cause confusion:

### 1. **Coordinate Systems: World vs Screen Space**

The implementation uses THREE coordinate systems:

- **Tile coordinates**: Grid positions (e.g., tile 10,5). Used for culling logic.
- **World coordinates**: Pixel positions in game world (e.g., 320px, 80px). Entities use this.
- **Screen coordinates**: Pixels on the actual window. Background uses this.

**Key difference:**
- Game entities (ships, players) are in **world space** (scroll with camera, affected by zoom)
- Background is in **screen space** (scrollFactor 0, fills window, NOT affected by zoom)

### 2. **Background Must Fill Window, Not World**

**WRONG:**
```typescript
const { width, height } = ViewportManager.getWindowDimensions(); // World size (832×416)
background.setDisplaySize(width, height); // Too small!
```

**CORRECT:**
```typescript
const width = this.scale.width;   // Actual window (1280×720)
const height = this.scale.height;
background.setDisplaySize(width, height); // Fills window ✅
```

### 3. **Tile Culling Performance**

Checking every tile every frame is SLOW on large maps:
- 30×30 map = ~15,000 checks/second (OK)
- 100×100 map = ~600,000 checks/second (BAD!)

**Solutions provided:**
- Option A: Update visibility every 5 frames instead of every frame (simple)
- Option B: Only check tiles in bounding box around player (optimal)

Start with Option A, upgrade to Option B if needed.

### 4. **Horizon Line Calculation**

Horizon alignment is tricky because:
- Background is screen space (fixed size)
- Diamond is world space (zoomed)
- Horizon needs to align with zoomed diamond top edge

**Simple approach:** Put horizon at ~40% down from top of window (adjust by eye)

**Precise approach:** Calculate based on zoom and border dimensions (see Phase 4.1)

### 5. **Camera Bounds**

Remove or enlarge camera bounds, otherwise camera won't be able to show background beyond map edges:

```typescript
// Default: camera.setBounds(0, 0, mapWidth, mapHeight); // BAD - restricts camera
// Fixed: camera.setBounds(undefined, undefined, undefined, undefined); // GOOD
```

### 6. **Phaser Scale Configuration**

Must set Phaser scale mode to RESIZE for window resizing to work:

```typescript
scale: {
  mode: Phaser.Scale.RESIZE,  // Required!
  width: 1280,
  height: 720,
}
```

### 7. **Resize Handling**

On window resize, you must update BOTH:
1. Camera zoom (to fit world in new window size)
2. Background size (to fill new window size)

See Phase 4.4 for complete resize handler.

## Prerequisites

- ✅ s7g-gamescene-refactor complete (manager architecture in place)
- ✅ Game currently running with basic rendering
- ✅ Development environment set up (`npm install && npm run build`)

## Phase 1: Core Viewport System (2-3 hours)

### 1.1 Add Configuration Constants

**File:** `clients/seacat/src/game/utils/Constants.ts`

**Action:** Add viewport configuration section

```typescript
// Add to Constants.ts
export const VIEWPORT = {
  // Square diamond viewport (rotated 45°)
  DIAMOND_SIZE_TILES: 20,  // 20×20 tile square = perfect diamond

  // Border padding (in tiles) - asymmetric for better aesthetics
  DIAMOND_BORDER_TOP_TILES: 4,    // More space for sky
  DIAMOND_BORDER_BOTTOM_TILES: 2, // Less space for sea
  DIAMOND_BORDER_LEFT_TILES: 3,   // Symmetric sides
  DIAMOND_BORDER_RIGHT_TILES: 3,

  // Aspect ratio (informational, not enforced)
  TARGET_ASPECT_RATIO: 16 / 9,
} as const;
```

**Testing:** Verify constants export correctly
```bash
npm run build
# Should compile without errors
```

### 1.2 Create ViewportManager Utility

**File:** `clients/seacat/src/game/utils/ViewportManager.ts` (new file)

**Action:** Implement diamond culling utility

```typescript
import { VIEWPORT, TILE_WIDTH, TILE_HEIGHT } from './Constants';

/**
 * Manages diamond viewport culling and coordinate calculations
 */
export class ViewportManager {
  /**
   * Checks if a world position is within the diamond viewport
   * centered on the given player position.
   *
   * @param worldX - Entity's world X coordinate (pixels)
   * @param worldY - Entity's world Y coordinate (pixels)
   * @param centerWorldX - Center point world X (typically player position)
   * @param centerWorldY - Center point world Y (typically player position)
   * @returns true if entity is within diamond viewport
   */
  static isInDiamond(
    worldX: number,
    worldY: number,
    centerWorldX: number,
    centerWorldY: number
  ): boolean {
    // Convert world coordinates to tile coordinates
    const entityTileX = Math.floor(worldX / TILE_WIDTH);
    const entityTileY = Math.floor(worldY / TILE_HEIGHT);
    const centerTileX = Math.floor(centerWorldX / TILE_WIDTH);
    const centerTileY = Math.floor(centerWorldY / TILE_HEIGHT);

    // Calculate Manhattan distance in tile space
    const dx = Math.abs(entityTileX - centerTileX);
    const dy = Math.abs(entityTileY - centerTileY);

    // Diamond equation: |x| + |y| <= radius
    // For a square diamond, radius is half the size
    const radiusTiles = VIEWPORT.DIAMOND_SIZE_TILES / 2;

    return (dx + dy) <= radiusTiles;
  }

  /**
   * Calculates the pixel dimensions of the diamond viewport
   * (square diamond: width and height are equal in tile count)
   */
  static getDiamondDimensions(): { width: number; height: number } {
    return {
      width: VIEWPORT.DIAMOND_SIZE_TILES * TILE_WIDTH,
      height: VIEWPORT.DIAMOND_SIZE_TILES * TILE_HEIGHT,
    };
  }

  /**
   * Calculates the total window dimensions including border padding
   */
  static getWindowDimensions(): { width: number; height: number } {
    const diamond = this.getDiamondDimensions();

    // Use separate border values for each edge
    const borderTopPx = VIEWPORT.DIAMOND_BORDER_TOP_TILES * TILE_HEIGHT;
    const borderBottomPx = VIEWPORT.DIAMOND_BORDER_BOTTOM_TILES * TILE_HEIGHT;
    const borderLeftPx = VIEWPORT.DIAMOND_BORDER_LEFT_TILES * TILE_WIDTH;
    const borderRightPx = VIEWPORT.DIAMOND_BORDER_RIGHT_TILES * TILE_WIDTH;

    return {
      width: diamond.width + borderLeftPx + borderRightPx,
      height: diamond.height + borderTopPx + borderBottomPx,
    };
  }

  /**
   * Gets the border dimensions in pixels
   */
  static getBorderDimensions(): {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } {
    return {
      top: VIEWPORT.DIAMOND_BORDER_TOP_TILES * TILE_HEIGHT,
      bottom: VIEWPORT.DIAMOND_BORDER_BOTTOM_TILES * TILE_HEIGHT,
      left: VIEWPORT.DIAMOND_BORDER_LEFT_TILES * TILE_WIDTH,
      right: VIEWPORT.DIAMOND_BORDER_RIGHT_TILES * TILE_WIDTH,
    };
  }

  /**
   * Calculates the appropriate camera zoom to fit the world view in the window
   *
   * @param windowWidth - Actual window/canvas width in pixels
   * @param windowHeight - Actual window/canvas height in pixels
   * @returns Zoom factor to apply to camera
   */
  static calculateZoom(windowWidth: number, windowHeight: number): number {
    const worldDimensions = this.getWindowDimensions();

    // Calculate zoom to fit world in window (best fit, no clipping)
    const zoomX = windowWidth / worldDimensions.width;
    const zoomY = windowHeight / worldDimensions.height;

    // Use minimum to ensure entire world fits
    return Math.min(zoomX, zoomY);
  }

  /**
   * Gets the diamond corner points in screen space (for rendering border)
   * Assumes diamond is centered at (centerX, centerY)
   */
  static getDiamondCorners(centerX: number, centerY: number): Array<{ x: number; y: number }> {
    const { width, height } = this.getDiamondDimensions();
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    return [
      { x: centerX, y: centerY - halfHeight },        // Top
      { x: centerX + halfWidth, y: centerY },         // Right
      { x: centerX, y: centerY + halfHeight },        // Bottom
      { x: centerX - halfWidth, y: centerY },         // Left
    ];
  }
}
```

**Testing:** Add basic unit test
```typescript
// In ViewportManager.ts (bottom of file, temporary)
if (require.main === module) {
  // Test cases
  console.log('Diamond at (0,0), entity at (0,0):', ViewportManager.isInDiamond(0, 0, 0, 0)); // true
  console.log('Diamond at (0,0), entity at (1000,1000):', ViewportManager.isInDiamond(1000, 1000, 0, 0)); // false
  console.log('Window dimensions:', ViewportManager.getWindowDimensions());
  console.log('Diamond dimensions:', ViewportManager.getDiamondDimensions());
}
```

Run test:
```bash
npm run build
node dist/game/utils/ViewportManager.js
```

### 1.3 Update Constants Export

**File:** `clients/seacat/src/game/utils/Constants.ts`

**Action:** Export TILE_WIDTH and TILE_HEIGHT if not already exported

```typescript
// Ensure these are exported
export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 16;
```

**Testing zoom calculation**:
```typescript
// Test zoom at different window sizes
console.log('1280x720 zoom:', ViewportManager.calculateZoom(1280, 720));
console.log('1920x1080 zoom:', ViewportManager.calculateZoom(1920, 1080));
console.log('800x600 zoom:', ViewportManager.calculateZoom(800, 600));
```

**Checkpoint:**
- ✅ Constants defined
- ✅ ViewportManager compiles
- ✅ Basic culling logic works in isolation
- ✅ Zoom calculation returns sensible values

---

## Phase 2: Manager Integration (3-4 hours)

### 2.1 Integrate with MapManager

**File:** `clients/seacat/src/game/managers/MapManager.ts`

**Action:** Add tile culling to map rendering

```typescript
import { ViewportManager } from '../utils/ViewportManager';

export class MapManager {
  // ... existing code ...

  /**
   * Updates visible tiles based on viewport culling
   * Call this every frame before rendering
   */
  public updateVisibleTiles(centerX: number, centerY: number): void {
    if (!this.tilemap) return;

    const layers = this.tilemap.layers;
    for (const layer of layers) {
      const tilemapLayer = layer.tilemapLayer;
      if (!tilemapLayer) continue;

      // Iterate all tiles in the layer
      for (let tileY = 0; tileY < this.tilemap.height; tileY++) {
        for (let tileX = 0; tileX < this.tilemap.width; tileX++) {
          const tile = tilemapLayer.getTileAt(tileX, tileY);
          if (!tile) continue;

          // Convert tile position to world coordinates
          const worldX = tileX * this.tilemap.tileWidth;
          const worldY = tileY * this.tilemap.tileHeight;

          // Check if tile is in diamond viewport
          const isVisible = ViewportManager.isInDiamond(worldX, worldY, centerX, centerY);
          tile.setVisible(isVisible);
        }
      }
    }
  }
}
```

**⚠️ PERFORMANCE WARNING:** This naive implementation iterates ALL tiles every frame:
- 30×30 map = 900 tiles checked/frame = ~15,000 checks/second at 60 FPS
- 100×100 map = 10,000 tiles checked/frame = ~600,000 checks/second at 60 FPS

**CRITICAL:** This WILL cause performance issues on large maps. Two options:

**Option A (Simple, for initial implementation):**
Only update visibility every N frames instead of every frame:
```typescript
private visibilityUpdateCounter = 0;

public update(delta: number): void {
  // Only update visibility every 5 frames (12 times per second instead of 60)
  this.visibilityUpdateCounter++;
  if (this.visibilityUpdateCounter >= 5) {
    this.visibilityUpdateCounter = 0;
    this.updateVisibleTiles(centerX, centerY);
  }
}
```

**Option B (Optimized, recommended for Phase 5.1):**
Only check tiles in a bounding box around the player (see Phase 5.1 for full implementation).

**Recommendation:** Use Option A initially, upgrade to Option B if performance testing shows issues.

### 2.2 Integrate with ShipManager

**File:** `clients/seacat/src/game/managers/ShipManager.ts`

**Action:** Add ship culling

```typescript
import { ViewportManager } from '../utils/ViewportManager';

export class ShipManager {
  // ... existing code ...

  /**
   * Updates visibility of ships based on viewport culling
   */
  public updateVisibility(centerX: number, centerY: number): void {
    for (const ship of this.ships.values()) {
      const isVisible = ViewportManager.isInDiamond(
        ship.worldCoords.x,
        ship.worldCoords.y,
        centerX,
        centerY
      );

      // Note: ship.sprite may be undefined if ship hasn't been rendered yet
      if (ship.sprite) {
        ship.sprite.setVisible(isVisible);
      }
    }
  }
}
```

### 2.3 Integrate with PlayerManager

**File:** `clients/seacat/src/game/managers/PlayerManager.ts`

**Action:** Add player culling

```typescript
import { ViewportManager } from '../utils/ViewportManager';

export class PlayerManager {
  // ... existing code ...

  /**
   * Updates visibility of remote players based on viewport culling
   */
  public updateVisibility(centerX: number, centerY: number): void {
    for (const player of this.players.values()) {
      const isVisible = ViewportManager.isInDiamond(
        player.sprite.x,
        player.sprite.y,
        centerX,
        centerY
      );

      player.sprite.setVisible(isVisible);
    }
  }
}
```

### 2.4 Integrate with ProjectileManager

**File:** `clients/seacat/src/game/managers/ProjectileManager.ts`

**Action:** Add projectile culling

```typescript
import { ViewportManager } from '../utils/ViewportManager';

export class ProjectileManager {
  // ... existing code ...

  /**
   * Updates visibility of projectiles based on viewport culling
   */
  public updateVisibility(centerX: number, centerY: number): void {
    for (const projectile of this.projectiles.values()) {
      const isVisible = ViewportManager.isInDiamond(
        projectile.sprite.x,
        projectile.sprite.y,
        centerX,
        centerY
      );

      projectile.sprite.setVisible(isVisible);
    }
  }
}
```

### 2.5 Update GameScene Orchestrator

**File:** `clients/seacat/src/game/GameScene.ts`

**Action:** Call visibility updates in main update loop

```typescript
update(time: number, delta: number) {
  // ... existing update code ...

  // Get local player position (center of viewport)
  const centerX = this.localPlayer.x;
  const centerY = this.localPlayer.y;

  // Update visibility for all managers (NEW)
  this.mapManager.updateVisibleTiles(centerX, centerY);
  this.shipManager.updateVisibility(centerX, centerY);
  this.playerManager.updateVisibility(centerX, centerY);
  this.projectileManager.updateVisibility(centerX, centerY);

  // ... rest of update code ...
}
```

**Checkpoint:**
- ✅ All managers have visibility methods
- ✅ GameScene calls visibility updates every frame
- ✅ Game compiles and runs

**Testing:**
1. Build and run game: `npm run build && npm start`
2. Move player around map
3. Observe: Distant tiles/entities should disappear when outside diamond
4. Check console for errors

---

## Phase 3: Visual Boundaries (2 hours)

### 3.1 Add Diamond Border Rendering

**File:** `clients/seacat/src/game/rendering/ViewportRenderer.ts` (new file)

**Action:** Create renderer for diamond border

```typescript
import Phaser from 'phaser';
import { ViewportManager } from '../utils/ViewportManager';

/**
 * Renders the diamond viewport border and background elements
 */
export class ViewportRenderer {
  private scene: Phaser.Scene;
  private borderGraphics?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initializes the viewport renderer
   * Call this once in GameScene.create()
   */
  public initialize(): void {
    this.borderGraphics = this.scene.add.graphics();
    this.borderGraphics.setDepth(100); // Render above game world
  }

  /**
   * Renders the diamond border
   * Call this every frame in GameScene.update()
   */
  public renderBorder(centerX: number, centerY: number): void {
    if (!this.borderGraphics) return;

    this.borderGraphics.clear();

    // Get diamond corner points
    const corners = ViewportManager.getDiamondCorners(centerX, centerY);

    // Draw diamond border
    this.borderGraphics.lineStyle(2, 0xffffff, 0.5); // White, 50% opacity
    this.borderGraphics.beginPath();
    this.borderGraphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.borderGraphics.lineTo(corners[i].x, corners[i].y);
    }
    this.borderGraphics.closePath();
    this.borderGraphics.strokePath();
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.borderGraphics?.destroy();
  }
}
```

### 3.2 Integrate ViewportRenderer with GameScene

**File:** `clients/seacat/src/game/GameScene.ts`

**Action:** Add viewport renderer to scene

```typescript
import { ViewportRenderer } from './rendering/ViewportRenderer';

export class GameScene extends Phaser.Scene {
  // ... existing properties ...
  private viewportRenderer!: ViewportRenderer;

  create() {
    // ... existing initialization ...

    // Initialize viewport renderer (NEW)
    this.viewportRenderer = new ViewportRenderer(this);
    this.viewportRenderer.initialize();

    // ... rest of create ...
  }

  update(time: number, delta: number) {
    // ... existing update code ...

    const centerX = this.localPlayer.x;
    const centerY = this.localPlayer.y;

    // Update visibility
    this.mapManager.updateVisibleTiles(centerX, centerY);
    this.shipManager.updateVisibility(centerX, centerY);
    this.playerManager.updateVisibility(centerX, centerY);
    this.projectileManager.updateVisibility(centerX, centerY);

    // Render diamond border (NEW)
    this.viewportRenderer.renderBorder(centerX, centerY);

    // ... rest of update ...
  }
}
```

**Checkpoint:**
- ✅ Diamond border renders on screen
- ✅ Border moves with player
- ✅ Border is diamond-shaped

**Testing:**
1. Build and run: `npm run build && npm start`
2. Observe white diamond border around player
3. Move player - border should follow
4. Verify entities outside border are hidden

---

## Phase 4: Background Layer (2-3 hours)

### 4.1 Create Background Asset

**Tool:** Image editor (Photoshop, GIMP, or online tool)

**Action:** Create simple gradient background

**Specifications:**
- Dimensions: Use `ViewportManager.getWindowDimensions()` for exact size
- Top portion: Sky gradient (light blue #87CEEB to darker blue #4682B4)
- Bottom portion: Sea gradient (dark blue #2E5A88 to darker #1B3A5C)
- Horizon line: Align with top of diamond (y = BORDER_TOP_TILES * TILE_HEIGHT)

**Save as:** `clients/seacat/assets/images/background.png`

**Alternative:** Use simple code-generated gradient:

```typescript
// In ViewportRenderer.initialize()
// IMPORTANT: Background fills WINDOW, not world
const windowWidth = this.scene.scale.width;
const windowHeight = this.scene.scale.height;
const rt = this.scene.add.renderTexture(0, 0, windowWidth, windowHeight);
const borders = ViewportManager.getBorderDimensions();

// Horizon line aligns with top of diamond viewport
// Since background fills window and is in screen space (scrollFactor 0),
// we need to calculate where diamond top appears in screen space
const zoom = this.scene.cameras.main.zoom;
const horizonY = (windowHeight / 2) - ((ViewportManager.getDiamondDimensions().height / 2) * zoom) - (borders.top * zoom);

// Simplified approach: Put horizon at 40% down from top (roughly where diamond top will be)
// You can fine-tune this based on your border settings
// const horizonY = windowHeight * 0.4;

// Draw sky gradient (top to horizon)
const skyGradient = rt.context.createLinearGradient(0, 0, 0, horizonY);
skyGradient.addColorStop(0, '#87CEEB');
skyGradient.addColorStop(1, '#4682B4');
rt.context.fillStyle = skyGradient;
rt.context.fillRect(0, 0, windowWidth, horizonY);

// Draw sea gradient (horizon to bottom)
const seaGradient = rt.context.createLinearGradient(0, horizonY, 0, windowHeight);
seaGradient.addColorStop(0, '#2E5A88');
seaGradient.addColorStop(1, '#1B3A5C');
rt.context.fillStyle = seaGradient;
rt.context.fillRect(0, horizonY, windowWidth, windowHeight - horizonY);

rt.setDepth(-100); // Render behind everything
```

### 4.2 Load Background Asset

**File:** `clients/seacat/src/game/GameScene.ts`

**Action:** Load background in preload()

```typescript
preload() {
  // ... existing asset loading ...

  // Load background image (NEW)
  this.load.image('background', 'assets/images/background.png');
}
```

### 4.3 Render Background

**File:** `clients/seacat/src/game/rendering/ViewportRenderer.ts`

**Action:** Add background rendering

```typescript
export class ViewportRenderer {
  private scene: Phaser.Scene;
  private borderGraphics?: Phaser.GameObjects.Graphics;
  private backgroundSprite?: Phaser.GameObjects.Image; // NEW

  public initialize(): void {
    // Add background sprite (NEW)
    // IMPORTANT: Background fills entire window (screen space), not world space
    const windowWidth = this.scene.scale.width;
    const windowHeight = this.scene.scale.height;
    this.backgroundSprite = this.scene.add.image(windowWidth / 2, windowHeight / 2, 'background');
    this.backgroundSprite.setDepth(-100); // Behind everything
    this.backgroundSprite.setScrollFactor(0); // Fixed to camera (doesn't scroll)
    this.backgroundSprite.setDisplaySize(windowWidth, windowHeight); // Fill window

    // Store reference for resize handling
    this.updateBackgroundOnResize();

    // ... existing border graphics initialization ...
  }

  /**
   * Updates background size on window resize
   * Call when window dimensions change
   */
  public updateBackgroundOnResize(): void {
    if (!this.backgroundSprite) return;

    const windowWidth = this.scene.scale.width;
    const windowHeight = this.scene.scale.height;

    // Reposition and resize background to fill new window size
    this.backgroundSprite.setPosition(windowWidth / 2, windowHeight / 2);
    this.backgroundSprite.setDisplaySize(windowWidth, windowHeight);
  }

  public destroy(): void {
    this.backgroundSprite?.destroy();
    this.borderGraphics?.destroy();
  }
}
```

### 4.4 Update Window Size & Camera Zoom

**File:** `clients/seacat/src/main.ts` (Electron main process)

**Action:** Configure Electron window for resizing

```typescript
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,   // Default window size (16:9)
    height: 720,
    resizable: true,      // Allow user to resize
    minWidth: 800,        // Minimum playable size
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // ... rest of window creation ...
}
```

**File:** `clients/seacat/src/game/GameScene.ts`

**Action:** Configure Phaser scale mode and set camera zoom

**Add to game config** (wherever Phaser.Game is created):
```typescript
const config: Phaser.Types.Core.GameConfig = {
  // ... existing config ...
  scale: {
    mode: Phaser.Scale.RESIZE,  // Allow window resize
    width: 1280,
    height: 720,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

**Add to GameScene:**
```typescript
create() {
  // ... existing initialization ...

  // IMPORTANT: Remove camera bounds (or set very large)
  // Default bounds limit camera to map size, but we want freedom to show background
  this.cameras.main.setBounds(undefined, undefined, undefined, undefined);
  // Or: this.cameras.main.setBounds(-10000, -10000, 20000, 20000);

  // Calculate and apply initial camera zoom (NEW)
  this.updateCameraZoom();

  // Listen for window resize events (NEW)
  this.scale.on('resize', this.updateCameraZoom, this);

  // ... rest of create ...
}

/**
 * Updates camera zoom to fit viewport in window
 * Called on init and when window is resized
 */
private updateCameraZoom(): void {
  const windowWidth = this.scale.width;
  const windowHeight = this.scale.height;

  const zoom = ViewportManager.calculateZoom(windowWidth, windowHeight);
  this.cameras.main.setZoom(zoom);

  // Also update background size on resize
  this.viewportRenderer.updateBackgroundOnResize();

  console.log(`Window: ${windowWidth}x${windowHeight}, Zoom: ${zoom.toFixed(2)}`);
}
```

**Checkpoint:**
- ✅ Background renders behind game world
- ✅ Background doesn't scroll with camera
- ✅ Camera zoom calculated correctly
- ✅ Diamond viewport fits in window
- ✅ Horizon line aligns with top of diamond (visual check)

**Testing:**
1. Build and run: `npm run build && npm start`
2. Verify background is visible
3. Move player - background should stay fixed
4. Check horizon alignment with diamond top edge
5. Resize window - zoom should recalculate, world should stay framed
6. Try different window sizes (small/large) - world should always fit

---

## Phase 5: Configuration Tuning (1-2 hours)

### 5.1 Performance Profiling

**Tool:** Browser DevTools Performance tab

**Action:** Measure frame time before and after culling

**Steps:**
1. Open game in Electron (with DevTools)
2. Start performance recording
3. Move player around map for 10 seconds
4. Stop recording
5. Analyze frame times

**Metrics to check:**
- Average FPS (should be 60)
- Frame time (should be <16.67ms)
- Draw calls (should be reduced from baseline)

**Optimization (if needed):**

If tile culling is slow, cache visible tiles:

```typescript
// In MapManager
private visibleTiles: Set<string> = new Set();

public updateVisibleTiles(centerX: number, centerY: number): void {
  const newVisibleTiles = new Set<string>();

  // Calculate which tiles are visible
  const centerTileX = Math.floor(centerX / this.tilemap.tileWidth);
  const centerTileY = Math.floor(centerY / this.tilemap.tileHeight);
  const radius = (VIEWPORT.DIAMOND_WIDTH_TILES + VIEWPORT.DIAMOND_HEIGHT_TILES) / 4;

  // Only check tiles in a reasonable range
  const minTileX = Math.max(0, centerTileX - radius);
  const maxTileX = Math.min(this.tilemap.width, centerTileX + radius);
  const minTileY = Math.max(0, centerTileY - radius);
  const maxTileY = Math.min(this.tilemap.height, centerTileY + radius);

  for (let tileY = minTileY; tileY < maxTileY; tileY++) {
    for (let tileX = minTileX; tileX < maxTileX; tileX++) {
      const worldX = tileX * this.tilemap.tileWidth;
      const worldY = tileY * this.tilemap.tileHeight;

      if (ViewportManager.isInDiamond(worldX, worldY, centerX, centerY)) {
        newVisibleTiles.add(`${tileX},${tileY}`);
      }
    }
  }

  // Update visibility only for tiles that changed
  // ... (compare newVisibleTiles with this.visibleTiles)
}
```

### 5.2 Gameplay Tuning

**Action:** Playtest with different diamond sizes

**Test configurations:**
1. Small: 15×15 tiles, borders (5,2,3,3) - more framed, less visibility
2. Medium: 20×20 tiles, borders (4,2,3,3) - balanced, current recommendation
3. Large: 25×25 tiles, borders (3,1,2,2) - more visibility, less diorama feel

**Playtesting questions:**
- Can players see incoming ships in time to react?
- Do cannons fire from visible range or outside viewport?
- Does viewport feel cramped or comfortable?
- Is the diorama aesthetic pleasing?

**Adjustment:** Update `VIEWPORT.DIAMOND_WIDTH_TILES` and `DIAMOND_HEIGHT_TILES` in Constants.ts

### 5.3 Border Aesthetics

**Action:** Experiment with border rendering styles

**Options:**
1. Subtle line (current): `lineStyle(2, 0xffffff, 0.5)`
2. Thicker border: `lineStyle(4, 0xffffff, 0.8)`
3. Decorative frame: Load ornate border image
4. Gradient fade: Render gradient at edges
5. No visible border: Remove border rendering entirely

**Testing:** Try each option, gather feedback

### 5.4 Documentation Updates

**Action:** Update relevant documentation

**Files to update:**
1. `spec/seacat/SPEC.md` - Add section on diamond viewport
2. `clients/seacat/README.md` - Document configuration options
3. `CHANGELOG.md` - Mark d7v-diamond-viewport as implemented

**Content to add:**
```markdown
## Diamond Viewport

The game uses a diamond-shaped viewport (rotated square) to limit rendering distance and create a "diorama" aesthetic. Only entities within the diamond are rendered.

**Configuration:**
- `VIEWPORT.DIAMOND_SIZE_TILES`: Square diamond size (default: 20×20)
- `VIEWPORT.DIAMOND_BORDER_TOP_TILES`: Top padding for sky (default: 4)
- `VIEWPORT.DIAMOND_BORDER_BOTTOM_TILES`: Bottom padding for sea (default: 2)
- `VIEWPORT.DIAMOND_BORDER_LEFT_TILES`: Left padding (default: 3)
- `VIEWPORT.DIAMOND_BORDER_RIGHT_TILES`: Right padding (default: 3)

**Performance:**
- Reduces tile rendering by 50-70% on large maps
- Culls distant ships, players, projectiles
- Maintains 60 FPS with 10+ ships

**Aesthetics:**
- Static background with sky/sea gradient
- Diamond border provides visual framing
- "Model ship in a display case" presentation
```

---

## Verification Checklist

Before marking implementation complete, verify:

- [ ] Diamond viewport renders correctly centered on player
- [ ] Tiles outside diamond are hidden
- [ ] Ships outside diamond are hidden
- [ ] Players outside diamond are hidden
- [ ] Projectiles outside diamond are hidden
- [ ] Diamond border renders (if enabled)
- [ ] Background renders behind game world
- [ ] Background doesn't scroll with camera
- [ ] Camera zoom adjusts to fit viewport in window
- [ ] Window resize recalculates zoom correctly
- [ ] No console errors or warnings
- [ ] Performance is 60 FPS with typical entity counts
- [ ] Configuration changes (diamond size) work as expected
- [ ] Game compiles and runs on development machine
- [ ] Multi-client testing shows consistent behavior

---

## Troubleshooting

### Issue: Tiles not culling properly

**Symptom:** All tiles still visible

**Debug:**
1. Check `ViewportManager.isInDiamond()` is being called
2. Verify `centerX` and `centerY` are correct (player position)
3. Add console.log in `isInDiamond()` to see calculations
4. Check tile.setVisible() is actually changing tile visibility

**Solution:** Phaser may batch tile visibility. Try forcing layer refresh:
```typescript
tilemapLayer.setVisible(true); // Force refresh
```

### Issue: Border not visible

**Symptom:** No diamond border renders

**Debug:**
1. Check `ViewportRenderer.initialize()` was called
2. Verify `renderBorder()` is called every frame
3. Check depth is correct (100 = above game world)
4. Try changing lineStyle to bright color: `lineStyle(4, 0xff0000, 1.0)` (red, opaque)

**Solution:** Graphics may not be in camera view. Ensure camera is following player.

### Issue: Background not showing

**Symptom:** No background, or background scrolls with camera

**Debug:**
1. Check `background.png` exists in assets folder
2. Verify `load.image()` was called in preload()
3. Check `setScrollFactor(0)` was set (prevents scrolling)
4. Verify depth is -100 (behind everything)

**Solution:** Background may be covered by map. Ensure map layers have depth > -100.

### Issue: Poor performance

**Symptom:** FPS drops below 60

**Debug:**
1. Profile with DevTools to find bottleneck
2. Check if `updateVisibleTiles()` is slow (too many tiles)
3. Verify culling is actually hiding entities (check Phaser inspector)

**Solution:** Implement caching (see Phase 5.1 optimization) or increase tile culling interval:
```typescript
// Only update visibility every 5 frames instead of every frame
if (this.frameCount % 5 === 0) {
  this.mapManager.updateVisibleTiles(centerX, centerY);
}
```

---

## Completion Criteria

Implementation is complete when:

1. ✅ All 5 phases implemented
2. ✅ All verification checklist items pass
3. ✅ No regressions in existing functionality
4. ✅ Performance meets 60 FPS target
5. ✅ Playtesting confirms acceptable visibility
6. ✅ Documentation updated
7. ✅ CHANGELOG updated to mark as "Implemented"

---

## Next Steps After Implementation

1. **Gather feedback**: Share screenshots/videos, get community input
2. **Iterate on aesthetics**: Try decorative frame, better background art
3. **Performance optimization**: Profile on large maps, optimize if needed
4. **Future enhancements**: Animated backgrounds, weather effects, minimap
5. **Update spec**: Incorporate implementation details into `spec/seacat/SPEC.md`

---

## Estimated Timeline

| Phase | Estimated Time | Cumulative |
|-------|----------------|------------|
| Phase 1: Core Viewport System | 2-3 hours | 2-3 hours |
| Phase 2: Manager Integration | 3-4 hours | 5-7 hours |
| Phase 3: Visual Boundaries | 2 hours | 7-9 hours |
| Phase 4: Background Layer | 2-3 hours | 9-12 hours |
| Phase 5: Configuration Tuning | 1-2 hours | 10-14 hours |

**Total: 10-14 hours** (including testing and iteration)

For an experienced developer familiar with the seacat codebase, expect closer to the lower end. For someone new to the project, expect closer to the upper end.
