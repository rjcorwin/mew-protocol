# MEW World Rendering System

This document explains how the map is rendered, how the camera works, and why you see certain visual behaviors in MEW World.

## Map Rendering

### Isometric Grid Generation

The map is a **20x20 tile grid** rendered in **isometric projection** using Phaser's Graphics API. The grid is drawn once at game start and remains static (no dynamic terrain yet).

**Key constants** (`GameScene.ts:5-8`):
```typescript
const TILE_WIDTH = 64;   // Width of each diamond tile (pixels)
const TILE_HEIGHT = 32;  // Height of each diamond tile (pixels)
const WORLD_WIDTH = 20;  // Number of tiles horizontally
const WORLD_HEIGHT = 20; // Number of tiles vertically
```

**Grid drawing code** (`GameScene.ts:66-88`):
```typescript
private createIsometricGround() {
  const graphics = this.add.graphics();

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      // Isometric projection formula
      const screenX = (x - y) * (TILE_WIDTH / 2);
      const screenY = (x + y) * (TILE_HEIGHT / 2);

      // Draw diamond-shaped tile
      graphics.lineStyle(1, 0x333333, 0.5);
      graphics.fillStyle((x + y) % 2 === 0 ? 0x3a6e2f : 0x4a7e3f, 1);

      graphics.beginPath();
      graphics.moveTo(screenX, screenY);                              // Top corner
      graphics.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2); // Right corner
      graphics.lineTo(screenX, screenY + TILE_HEIGHT);                // Bottom corner
      graphics.lineTo(screenX - TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2); // Left corner
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }
  }
}
```

### Isometric Projection Math

Isometric projection converts grid coordinates (x, y) to screen coordinates using these formulas:

```
screenX = (x - y) × (TILE_WIDTH / 2)
screenY = (x + y) × (TILE_HEIGHT / 2)
```

**Example:**
- Tile (0, 0) → screen (0, 0)
- Tile (1, 0) → screen (32, 16)
- Tile (0, 1) → screen (-32, 16)
- Tile (1, 1) → screen (0, 32)

This creates the diamond/rhombus pattern you see on screen.

### Visual Grid Properties

- **Colors**: Alternating tiles use two shades of green (#3a6e2f and #4a7e3f)
- **Border**: Each tile has a dark gray outline (0x333333, 50% opacity)
- **Grid size**: 20×20 tiles = 1280×640 pixel world
- **Rendering**: Single Phaser Graphics object (efficient, no individual sprites)

## Camera System

### Camera Configuration

The camera is configured at game start (`GameScene.ts:30-32` and `GameScene.ts:52`):

```typescript
// Set camera bounds to match world size
const camera = this.cameras.main;
camera.setBounds(0, 0, WORLD_WIDTH * TILE_WIDTH, WORLD_HEIGHT * TILE_HEIGHT);
// Results in: camera.setBounds(0, 0, 1280, 640)

// Camera follows player with smooth lerp
camera.startFollow(this.localPlayer, true, 0.1, 0.1);
```

### Camera Bounds

**What are bounds?**
Camera bounds define the area the camera can view. The camera will never show pixels outside these bounds.

**Important: Isometric grids extend into negative X coordinates!**

Because of the isometric projection formula `screenX = (x - y) × 32`, tiles on the left side of the grid have negative X positions:

```
Tile (0, 0):  screenX = 0
Tile (0, 19): screenX = -608  ← Leftmost edge
Tile (19, 0): screenX = 608   ← Rightmost edge
```

**Correct camera bounds** (`GameScene.ts:36-39`):
```typescript
const minX = -(WORLD_HEIGHT - 1) * (TILE_WIDTH / 2);  // -608
const maxX = (WORLD_WIDTH - 1) * (TILE_WIDTH / 2);    // 608
const maxY = (WORLD_WIDTH + WORLD_HEIGHT - 1) * (TILE_HEIGHT / 2); // 624
camera.setBounds(minX, 0, maxX - minX, maxY);
// Results in: camera.setBounds(-608, 0, 1216, 624)
```

**Grid dimensions:**
- **X range**: -608 to 608 pixels (1216 pixels wide, centered at X=0)
- **Y range**: 0 to 624 pixels
- **Player starts at**: (0, 320) - the center tile (10, 10)

### Camera Following

The camera uses **smooth following** (also called "lerp" - linear interpolation):

```typescript
camera.startFollow(this.localPlayer, true, 0.1, 0.1);
//                                   |     |     |
//                                   |     |     └─ Y lerp speed (10%)
//                                   |     └─────── X lerp speed (10%)
//                                   └──────────── roundPixels (true)
```

**How it works:**
- Every frame, the camera moves 10% of the distance toward the player
- This creates a smooth "lag" effect rather than instant snapping
- `roundPixels: true` prevents subpixel rendering artifacts

**Example:**
```
Frame 1: Player at (400, 300), Camera at (300, 250)
         Distance = (100, 50)
         Camera moves to (300 + 10, 250 + 5) = (310, 255)

Frame 2: Player at (400, 300), Camera at (310, 255)
         Distance = (90, 45)
         Camera moves to (310 + 9, 255 + 4.5) = (319, 259.5)
```

Over a few frames, the camera "catches up" to the player's position.

## Window Resizing Behavior

### Responsive Game Canvas

The game canvas resizes to match the window (`renderer.ts:87-90`):

```typescript
scale: {
  mode: Phaser.Scale.RESIZE,
  autoCenter: Phaser.Scale.CENTER_BOTH,
}
```

**What happens when you resize:**

1. **Window narrows**: Viewport width decreases
2. **Camera follows player**: Camera tries to keep player centered
3. **Bounds prevent overflow**: Camera can't show areas outside (0, 0, 1280, 640)

### Why the Map Seems "Out of Bounds"

The map has **fixed dimensions** (1280×640 pixels), but your **window viewport is dynamic**.

**Scenario 1: Large window (1920×1080)**
```
┌────────────────────────────────────┐
│                                    │
│         ┌──────────────┐           │
│         │   Game Map   │           │ ← Black bars visible
│         │  1280 × 640  │           │
│         └──────────────┘           │
│                                    │
└────────────────────────────────────┘
```

**Scenario 2: Narrow window (800×600)**
```
┌──────────┐
│          │
│  ┌────┐  │ ← Camera shows only part of map
│  │Map │  │   Player can move off-screen edges
│  └────┘  │
│          │
└──────────┘
```

### Character Movement vs. Viewport

**Important distinction:**
- **Player sprite position**: Unrestricted (can move infinitely)
- **Camera bounds**: Restricted to (0, 0, 1280, 640)
- **Visible map**: Only where tiles were drawn

**What you observe:**

1. **Player can move beyond visible tiles** because there's no collision detection
2. **Camera follows player** but stops at bounds
3. **When window is narrow**, camera can't show full map width, so edges feel "cut off"

### Current Limitations

From the spec (`SPEC.md:176-184`):
- ✗ No collision detection (players can overlap)
- ✗ No terrain boundaries (players can move infinitely)
- ✗ Camera doesn't constrain player movement
- ✗ No indicators when player moves off-grid

## Visual Coordinate Systems

MEW World uses three coordinate systems:

### 1. Grid Coordinates
Logical tile positions (integers):
- Range: (0, 0) to (19, 19)
- Used for: Pathfinding (future), tile logic

### 2. World Coordinates
Pixel positions in game space:
- Range: Technically unlimited, but map drawn from (0, 0) to (~1280, ~640)
- Used for: Sprite positions, physics
- Player position is in world coordinates

### 3. Screen Coordinates
Pixel positions on your monitor:
- Range: (0, 0) to (window width, window height)
- Used for: Rendering what camera sees
- Changes when you resize window

**Conversion:**
```
Grid → World: Use isometric projection formula
World → Screen: Camera applies translation and zoom
```

## Example: Following the Player

Let's trace what happens when you press the right arrow key:

1. **Input** (`GameScene.ts:132-133`):
   ```typescript
   if (this.cursors.right?.isDown) velocity.x += 1;
   ```

2. **Movement** (`GameScene.ts:147-148`):
   ```typescript
   this.localPlayer.x += velocity.x; // Updates world coordinates
   this.localPlayer.y += velocity.y;
   ```

3. **Camera follows** (automatic, every frame):
   ```typescript
   // Phaser internally does:
   camera.x = lerp(camera.x, player.x - viewport.width/2, 0.1);
   camera.y = lerp(camera.y, player.y - viewport.height/2, 0.1);
   ```

4. **Bounds check** (automatic):
   ```typescript
   camera.x = clamp(camera.x, 0, 1280 - viewport.width);
   camera.y = clamp(camera.y, 0, 640 - viewport.height);
   ```

5. **Render** (automatic):
   - Phaser draws all game objects relative to camera position
   - If player moves off-map, they're still drawn (no sprites are culled)
   - Map tiles stay where they were drawn

## Comparison: Narrow vs. Wide Window

### Wide Window (1920px)
```
Camera can show entire map width
Player always visible on-screen
Map feels "small" in viewport
```

### Narrow Window (800px)
```
Camera shows only portion of map
Player can be off-screen if near edges
Map feels "larger" because you see less
Camera follows more aggressively
```

## Common Issues

### Camera Not Following to Left Edge (Fixed)

**The Problem:**
Originally, the camera bounds were set to `(0, 0, 1280, 640)`, which prevented the camera from following the player to the left side of the map. This happened because:

1. Isometric grids have negative X coordinates on the left side
2. Camera bounds starting at X=0 cannot show negative coordinates
3. The left half of the map (tiles with high Y values) was invisible

**The Solution:**
Calculate the actual extent of the isometric grid including negative coordinates:
```typescript
// OLD (incorrect):
camera.setBounds(0, 0, WORLD_WIDTH * TILE_WIDTH, WORLD_HEIGHT * TILE_HEIGHT);
// Camera couldn't see left side of map!

// NEW (correct):
const minX = -(WORLD_HEIGHT - 1) * (TILE_WIDTH / 2);  // -608
const maxX = (WORLD_WIDTH - 1) * (TILE_WIDTH / 2);    // 608
camera.setBounds(minX, 0, maxX - minX, maxY);
// Camera can now follow player across entire grid
```

**Visual explanation:**
```
OLD bounds:               NEW bounds:
┌────────────┐           ┌────────────┐
│ 0          │           │ -608    608│
│  ####      │           │    ####    │
│  ####      │           │    ####    │  ← Full grid visible
│  (half)    │           │  (full)    │
└────────────┘           └────────────┘
   Can't see left           Can see all
```

## Future Enhancements

Planned improvements from the implementation plan:

### Milestone 3-5: Collision & Boundaries
- Add tile collision detection
- Prevent player from moving outside grid bounds
- Camera constraints based on player position

### Milestone 7: Polish
- Minimap showing full grid
- Indicators when player is off-screen
- Smooth camera zoom
- Better edge handling

## Testing Camera Behavior

Try these experiments:

1. **Resize window while playing**: Notice how camera reveals more/less of map
2. **Move to edge of tiles**: Notice you can keep moving beyond visible grid
3. **Move back to center**: Camera smoothly follows back
4. **Multiple players**: Each client has independent camera following their player

## Technical Reference

- **Phaser Camera Docs**: https://photonstorm.github.io/phaser3-docs/Phaser.Cameras.Scene2D.Camera.html
- **Isometric Projection**: Classic 2:1 ratio (width:height)
- **Lerp Factor**: 0.1 means camera closes 10% of gap per frame (~6 frames to "catch up")
- **Camera bounds** (`GameScene.ts:32`): `camera.setBounds(0, 0, 1280, 640)`
- **Follow config** (`GameScene.ts:52`): `camera.startFollow(sprite, roundPixels, lerpX, lerpY)`
