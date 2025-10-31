# Research: Isometric Coordinate System Inconsistencies

**Date:** 2025-10-20
**Related to:** w3l-wheel-steering, r8s-ship-rotation
**Status:** Research

## Problem Summary

Seacat uses an isometric tile map, but the ship rotation and player positioning system operates in a Cartesian (orthogonal) coordinate space. This creates visual inconsistencies:

1. **Ship appears as perfect rectangle** when rotated (not diamond-shaped from isometric perspective)
2. **Players rotate outside ship bounds** even though they haven't moved
3. **Mixed coordinate systems** - tiles are isometric, ship physics are Cartesian

## Current Coordinate Systems

### 1. Isometric Tile Map (Client)

**File:** `clients/seacat/src/game/GameScene.ts`

The tilemap uses isometric diamond tiles:
- Tile dimensions: 32×16 pixels (TILE_WIDTH × TILE_HEIGHT)
- World to tile conversion: `GameScene.ts:387` uses Phaser's `worldToTileXY()`
- Tiles render as diamonds (isometric projection)

**Isometric Coordinate Transform:**
```
worldX = (tileX - tileY) * (TILE_WIDTH / 2)
worldY = (tileX + tileY) * (TILE_HEIGHT / 2)
```

**Reverse (Tile to World):**
```
tileX = floor((worldX / 16 + worldY / 8) / 2)
tileY = floor((worldY / 8 - worldX / 16) / 2)
```

### 2. Ship Physics (Server)

**File:** `src/mcp-servers/ship-server/ShipServer.ts`

Ship operates in **Cartesian world space**:
- Position: `{x, y}` in pixels
- Rotation: angle in radians (0 = east, π/2 = south)
- Velocity: `{x, y}` vector calculated from angle
- Collision: axis-aligned bounding box (AABB) → rotated OBB

**Key Code:**
```typescript
// ShipServer.ts:43-48
function calculateVelocity(heading: ShipHeading, speed: number): Velocity {
  const angle = headingToRotation(heading);
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed,
  };
}
```

**Collision Detection (Server Side):**
- `canMoveTo()` at line 217: Tests AABB corners
- Converts world coords to isometric tile coords
- BUT: Doesn't account for ship rotation in world space

### 3. Ship Rendering (Client)

**File:** `clients/seacat/src/game/GameScene.ts:397-418`

Ship is rendered as a **Cartesian rectangle sprite**:
```typescript
// Generate rectangular texture
shipGraphics.fillRect(0, 0, width, height);
shipGraphics.strokeRect(0, 0, width, height);

// Apply rotation
shipSprite.setRotation(update.shipData.rotation);
```

**Problem:** The rectangle rotates in screen space (Cartesian), not isometric space.

### 4. Player Rotation (Client)

**File:** `clients/seacat/src/game/GameScene.ts:485-517`

When ship rotates, players rotate using **Cartesian rotation**:
```typescript
// GameScene.ts:495-500
private rotatePoint(point: { x, y }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
```

**Problem:** This Cartesian rotation doesn't match the isometric tile projection.

## Visual Issues Observed

### Issue 1: Ship Rectangle Rotates in Wrong Space

**What Happens:**
- Ship is a 200×100 pixel rectangle
- When rotated 45°, it appears as rotated rectangle on screen
- In isometric view, this looks wrong (should skew/transform differently)

**Why:**
- Phaser sprite rotation is Cartesian screen-space rotation
- Isometric tiles are pre-rendered diamonds
- Ship should appear to rotate "with" the isometric projection

### Issue 2: Players Appear Outside Ship Bounds

**What Happens:**
- Player stands at relative position `{x: 50, y: 0}` on ship
- Ship rotates 90°
- Player's world position rotates: `{x: 0, y: 50}`
- **But visually** player appears to have moved beyond ship edge

**Why:**
- Player position rotation is Cartesian
- Ship visual bounds are Cartesian
- Isometric rendering makes Cartesian distances look different

**Example:**
```
Cartesian:        Isometric View:
   +----+            ◇
   | P  |           / \
   +----+          /P  \    ← Player appears outside!
                  ◇-----◇
```

### Issue 3: OBB Collision Doesn't Match Visual

**File:** `GameScene.ts:700-721`

```typescript
private isPointInRotatedRect(point, rectCenter, rectSize, rotation) {
  // Transform to rect's local space (Cartesian)
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // Check AABB (Cartesian bounds)
  return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
}
```

**Problem:** OBB is Cartesian but ship visual is in isometric view.

## Root Cause Analysis

### The Fundamental Issue

**Mixed Coordinate Systems:**

1. **Tile Map:** Isometric (diamond tiles, skewed coordinates)
2. **Ship Physics:** Cartesian (rectangular collision, straight-line velocity)
3. **Ship Visual:** Cartesian sprite with rotation
4. **Player Physics:** Cartesian positions and rotation
5. **Rendering:** Isometric projection (camera/world transform)

**Diagram:**
```
Server (Cartesian)           Client (Mixed)
┌──────────────────┐         ┌────────────────────┐
│ Ship Physics:    │  sync   │ Tile Map:          │
│ - Position (x,y) │────────>│ - Isometric        │
│ - Rotation (θ)   │         │ Ship Sprite:       │
│ - Velocity (x,y) │         │ - Cartesian + rot  │
│ - AABB collision │         │ Player Sprites:    │
└──────────────────┘         │ - Cartesian + rot  │
                             └────────────────────┘
```

## Potential Solutions

### Option A: Keep Cartesian Physics, Fake Isometric Visuals

**Approach:** Continue using Cartesian physics but transform ship/player rendering to match isometric perspective.

**Changes Needed:**
1. Transform ship sprite to isometric projection
2. Adjust player relative positions for isometric skew
3. Keep server physics unchanged

**Pros:**
- Physics stay simple (AABB, straight lines)
- Server unchanged
- Easier to implement

**Cons:**
- Visual-only fix (doesn't address coordinate mismatch)
- Complex sprite transforms
- Still "faking" isometric

### Option B: True Isometric Physics

**Approach:** Convert ship physics to operate in isometric space.

**Changes Needed:**
1. Transform ship velocity to isometric basis vectors
2. Collision detection in isometric space
3. Player positions in isometric coordinates
4. Server needs isometric transform logic

**Pros:**
- Mathematically correct
- No visual-physical mismatch

**Cons:**
- Major refactor (server + client)
- More complex collision math
- Breaking change

### Option C: Orthogonal Mode (Abandon Isometric)

**Approach:** Switch tile map to orthogonal, abandon isometric projection.

**Changes Needed:**
1. Replace tilemap with orthogonal tiles
2. Remove isometric transforms
3. Everything becomes Cartesian

**Pros:**
- Simplest solution
- No coordinate confusion
- Physics match visuals

**Cons:**
- Loses isometric aesthetic
- New tilemap assets needed
- Different game feel

### Option D: Hybrid - Isometric Tiles, Cartesian Objects (Current + Fixes)

**Approach:** Keep current system but fix visual artifacts.

**Specific Fixes:**
1. **Ship Sprite:** Use isometric-projected ship texture (diamond shape)
2. **Player Bounds:** Adjust OBB to account for isometric skew
3. **Rotation Center:** Keep Cartesian rotation but adjust visual anchor
4. **Depth Sorting:** Use isometric Y-axis for sprite depth

**Changes Needed:**

#### Fix 1: Isometric Ship Sprite
```typescript
// Instead of rectangle, draw isometric diamond
const shipGraphics = this.add.graphics();
// Draw diamond (isometric quad)
shipGraphics.beginPath();
shipGraphics.moveTo(width/2, 0);               // Top
shipGraphics.lineTo(width, height/2);          // Right
shipGraphics.lineTo(width/2, height);          // Bottom
shipGraphics.lineTo(0, height/2);              // Left
shipGraphics.closePath();
```

#### Fix 2: Isometric-Aware Player Rotation
```typescript
// Apply isometric skew matrix to rotation
private rotatePointIsometric(point, angle) {
  // Standard rotation
  const rotated = this.rotatePoint(point, angle);

  // Apply isometric projection
  return {
    x: rotated.x - rotated.y * 0.5,  // Isometric skew
    y: (rotated.x + rotated.y) * 0.5 // Isometric depth
  };
}
```

#### Fix 3: Isometric OBB Collision
```typescript
// Transform OBB to isometric space before testing
private isPointInRotatedRectIsometric(point, rectCenter, rectSize, rotation) {
  // 1. Transform point to isometric coords
  const isoPoint = this.cartesianToIsometric(point);
  const isoCenter = this.cartesianToIsometric(rectCenter);

  // 2. Perform OBB test in isometric space
  // ... (OBB logic)
}
```

## Recommendations

### Short Term (Fix Current Issues)

**Recommended:** **Option D - Hybrid with Fixes**

**Priority Fixes:**
1. ✅ **Fix ship sprite to diamond shape** (isometric projection)
2. ✅ **Adjust player rotation to isometric basis**
3. ✅ **Fix OBB collision for isometric coordinates**

**Implementation:**
- Create new proposal: `i9m-isometric-rendering`
- Scope: Client-side visual fixes only
- Estimate: 4-6 hours

### Long Term (Architecture Decision)

**Decision Point:** Do we want true isometric physics or cosmetic isometric?

**If Cosmetic (Recommended):**
- Tile map is isometric (visuals only)
- All physics remain Cartesian
- Visual transforms bridge the gap
- Simpler, less bugs

**If True Isometric:**
- Full isometric coordinate system
- Complex but "correct"
- Requires major refactor
- Consider for Seacat v2.0

## Open Questions

1. **Do we want ships to visually appear as isometric quads (diamond-shaped)?**
   - Or keep rectangular sprites and accept the mismatch?

2. **Should player movement on rotating ships use isometric or Cartesian coordinates?**
   - Current: Cartesian (simpler)
   - Alternative: Isometric (visually correct)

3. **Is the isometric aesthetic worth the coordinate system complexity?**
   - Could simplify by switching to orthogonal tiles

4. **Should collision detection be isometric-aware?**
   - Currently: Cartesian AABB/OBB
   - Alternative: Isometric-space collision

## Next Steps

1. Review this research with team
2. Decide: cosmetic isometric vs true isometric
3. Create implementation proposal (`i9m-isometric-rendering`)
4. Prioritize fixes for current visual bugs
5. Document coordinate system conventions

## References

- **Phaser Isometric Docs:** https://photonstorm.github.io/phaser3-docs/Phaser.Tilemaps.Tilemap.html
- **Isometric Math:** https://en.wikipedia.org/wiki/Isometric_projection
- **Current Implementation:**
  - Ship rotation: `r8s-ship-rotation`
  - Wheel steering: `w3l-wheel-steering`
  - Tilemap setup: `GameScene.ts:151-194`
