# Proposal: True Isometric Conversion (i2m-true-isometric)

**Proposal Code:** i2m-true-isometric
**Status:** Draft
**Created:** 2025-10-20
**Related Proposals:** w3l-wheel-steering, r8s-ship-rotation

## Summary

Convert Seacat from a "cosmetic isometric" system (isometric tiles + Cartesian physics/rendering) to a true isometric system where ALL game elements—player movement, ship rendering, rotation, collision detection, and coordinate transforms—conform to isometric projection principles.

## Problem Statement

### Current System: Mixed Coordinate System

Seacat currently uses **"cosmetic isometric"**:
- ✅ **Tiles:** Isometric diamond tiles (32×16 pixels)
- ❌ **Player Movement:** Cartesian (arrow keys map directly to X/Y)
- ❌ **Ship Rendering:** Cartesian rectangle with runtime 2D rotation
- ❌ **Ship Physics:** Cartesian velocity, rotation, collision
- ❌ **Player-on-Ship Rotation:** Cartesian rotation matrix
- ❌ **Control Points:** Positioned using Cartesian rotation
- ❌ **Collision Detection:** Cartesian OBB (Oriented Bounding Box)

### Visual Inconsistencies

Based on research documents (`isometric-coordinate-research.md`, `isometric-rotation-industry-research.md`):

1. **Ship appears as perfect rectangle** when rotated
   - Uses `sprite.setRotation()` which rotates in Cartesian screen space
   - Doesn't follow isometric projection rules
   - Industry research shows NO major 2D isometric game uses runtime sprite rotation

2. **Players rotate outside ship visual bounds**
   - Player position rotation is Cartesian
   - Ship visual bounds are Cartesian
   - Isometric rendering makes Cartesian distances look wrong

3. **Player movement feels disconnected from world**
   - Arrow keys move in screen-space Cartesian (up/down/left/right)
   - Tiles are rendered isometrically
   - Movement doesn't align with tile grid diagonals

4. **Control points don't rotate correctly with ship**
   - Positioned using Cartesian `rotatePoint()` helper
   - Visual position doesn't match isometric ship rotation

## Industry Standard Analysis

From `isometric-rotation-industry-research.md`:

### What Professional Games Do

**2D Isometric Games with Rotation:**
- **StarCraft:** 32 pre-rendered rotation frames (11.25° increments)
- **Age of Empires II:** 8-16 pre-rendered rotation frames
- **Command & Conquer:** 32-64 pre-rendered frames per unit
- **Physics:** ALL use Cartesian physics internally
- **Rendering:** Swap sprite frames, NEVER use runtime 2D rotation

**3D Isometric Games:**
- **Hades, Bastion:** Full 3D with isometric camera
- **Anno 1800:** 3D models, isometric camera angle
- **True 3D rotation** applied to geometry

**Games That Avoid Rotation:**
- **SimCity 2000:** No dynamic rotation
- **Into the Breach:** 4 cardinal directions only
- **Factorio:** 4 directional sprites (90° rotations)

### Key Industry Insight

**"No major 2D isometric game uses runtime sprite rotation."**

They either:
1. Pre-render rotation frames (8-64 angles)
2. Use full 3D with isometric camera
3. Don't rotate dynamically

## Goals

### Primary Goal
Make Seacat visually and mechanically consistent with isometric projection throughout ALL systems.

### Specific Objectives

1. **Player Movement:** Arrow keys move along isometric axes (tile diagonals)
2. **Ship Rendering:** Industry-standard pre-rendered rotation frames
3. **Ship Rotation:** Visual rotation using sprite frames (physics can stay Cartesian)
4. **Player-on-Ship:** Correct isometric rotation transforms
5. **Control Points:** Positioned correctly in isometric space
6. **Collision Detection:** Isometric-aware collision (or keep Cartesian if cosmetic only)

## Non-Isometric Elements Found

### 1. Player Movement (GameScene.ts:552-563)

**Current:** Cartesian arrow key mapping
```typescript
if (this.cursors.left?.isDown) velocity.x -= 1;
if (this.cursors.right?.isDown) velocity.x += 1;
if (this.cursors.up?.isDown) velocity.y -= 1;
if (this.cursors.down?.isDown) velocity.y += 1;
```

**Issue:**
- Up arrow = -Y (north in screen space)
- Right arrow = +X (east in screen space)
- Doesn't align with isometric tile grid

**Isometric Tiles Are:**
- Northeast/Southwest diagonals
- Northwest/Southeast diagonals

**What Should Happen:**
- Up arrow = move Northeast (along tile edge)
- Down arrow = move Southwest
- Left arrow = move Northwest
- Right arrow = move Southeast

### 2. Ship Sprite Rendering (GameScene.ts:398-418)

**Current:** Generated rectangle with runtime rotation
```typescript
shipGraphics.fillRect(0, 0, width, height);
shipGraphics.strokeRect(0, 0, width, height);
// ...
shipSprite.setRotation(update.shipData.rotation);
```

**Issue:**
- Ship is a Cartesian rectangle
- `setRotation()` rotates in screen space (not isometric space)
- Looks wrong in isometric world

**Should Be:**
- Pre-rendered ship sprite sheet with 8, 16, or 32 angles
- Swap sprite frames based on rotation
- NO runtime 2D rotation

### 3. Ship Rotation Application (GameScene.ts:466, 484)

**Current:**
```typescript
shipSprite.setRotation(update.shipData.rotation);
```

**Issue:** Cartesian screen-space rotation

**Should Be:**
```typescript
const frameIndex = this.rotationToFrameIndex(rotation, ROTATION_FRAMES);
shipSprite.setFrame(frameIndex);
```

### 4. Player-on-Ship Rotation (GameScene.ts:487-507)

**Current:** Cartesian rotation matrix
```typescript
this.shipRelativePosition = this.rotatePoint(
  this.shipRelativePosition,
  rotationDelta
);

private rotatePoint(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
```

**Issue:** Cartesian rotation doesn't match isometric projection

**Should Be:** Isometric-aware rotation transform

### 5. Control Point Positioning (GameScene.ts:540-543)

**Current:** Cartesian rotation
```typescript
const rotatedPos = this.rotatePoint(controlPoint.relativePosition, shipSprite.rotation);
```

**Issue:** Uses Cartesian `rotatePoint()` helper

**Should Be:** Isometric transform

### 6. Collision Detection (GameScene.ts:701-722)

**Current:** Cartesian OBB
```typescript
private isPointInRotatedRect(point, rectCenter, rectSize, rotation) {
  const dx = point.x - rectCenter.x;
  const dy = point.y - rectCenter.y;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
}
```

**Issue:** Pure Cartesian OBB test

**Options:**
- Convert to isometric collision
- OR keep Cartesian (if using "cosmetic isometric" approach)

### 7. Camera/Viewport (GameScene.ts:64-69)

**Current:** Cartesian bounds calculation
```typescript
const minX = -(this.map.height - 1) * (TILE_WIDTH / 2);
const maxX = (this.map.width - 1) * (TILE_WIDTH / 2);
```

**Issue:** Calculates bounds in Cartesian space

**May Need:** Isometric-aware bounds (or keep as-is if cosmetic)

### 8. Tile Coordinate Conversion (GameScene.ts:803-809)

**Current:** Uses Phaser's `worldToTileXY()`
```typescript
const tile = this.groundLayer.worldToTileXY(x, y);
```

**Status:** ✅ Correct (Phaser handles isometric transform)

**Action:** Keep as-is

### 9. Animation Direction Calculation (GameScene.ts:289-307)

**Current:** Based on Cartesian velocity vector
```typescript
const angle = Math.atan2(velocity.y, velocity.x);
// Quantize to 8 directions (NE, E, SE, S, SW, W, NW, N)
```

**Issue:** Assumes Cartesian velocity

**Should Be:** Calculate from isometric movement vector

### 10. Remote Player Interpolation (GameScene.ts:664-675)

**Current:** Linear Cartesian interpolation
```typescript
const dx = player.targetPosition.x - player.sprite.x;
const dy = player.targetPosition.y - player.sprite.y;
player.sprite.x += dx * factor;
player.sprite.y += dy * factor;
```

**Status:** ✅ Probably fine (linear interp works in any space)

**Action:** Keep as-is

## Proposed Architecture Decision

### Option A: True Isometric Everything (COMPLEX)

**Changes:**
- Player movement uses isometric basis vectors
- Ship physics in isometric space
- Collision in isometric space
- Full coordinate transform layer

**Pros:**
- Mathematically correct
- Perfect visual consistency

**Cons:**
- Major refactor (server + client)
- Complex physics
- Breaking changes
- High development cost

### Option B: Cosmetic Isometric + Industry-Standard Rendering (RECOMMENDED)

**Changes:**
- ✅ Keep server physics Cartesian (simple, proven)
- ✅ Player movement: Isometric arrow key mapping (visual alignment)
- ✅ Ship rendering: Pre-rendered rotation frames (industry standard)
- ✅ Player-on-ship: Isometric-aware rotation (visual fix)
- ✅ Control points: Isometric positioning (visual fix)
- ✅ Collision: Keep Cartesian (physics accuracy)

**Pros:**
- Simpler implementation
- Follows industry patterns
- Server unchanged
- Visual consistency achieved
- Lower risk

**Cons:**
- Still mixing coordinate systems (but hidden from user)
- Not "pure" isometric

**Industry Precedent:**
- **StarCraft, Age of Empires, C&C all use this approach**
- Cartesian physics, isometric visuals
- Works perfectly, proven at scale

### Option C: Move to 3D (FUTURE)

**Changes:**
- Replace Phaser with Three.js
- Full 3D models
- Isometric camera angle

**Pros:**
- Modern approach
- Perfectly smooth rotation
- Lighting, effects

**Cons:**
- Complete rewrite
- Requires 3D assets
- Out of scope for v1

## Recommended Approach

**Adopt Option B: Cosmetic Isometric + Industry-Standard Rendering**

### Phase 1: Player Movement (Isometric Controls)
Convert player arrow key input to isometric movement directions.

### Phase 2: Ship Pre-Rendered Sprites (Industry Standard)
Create 32-angle ship sprite sheet, implement frame-based rotation.

### Phase 3: Player-on-Ship Isometric Rotation
Fix player rotation on ship to use isometric transforms.

### Phase 4: Control Point Isometric Positioning
Update control point rendering to use isometric rotation.

### Phase 5: Polish & Testing
Verify all visuals align, test edge cases.

## Implementation Plan

See separate proposal files:
- **Phase 1:** `i2m-true-isometric/phase1-player-movement.md`
- **Phase 2:** `i2m-true-isometric/phase2-ship-sprites.md`
- **Phase 3:** `i2m-true-isometric/phase3-player-rotation.md`
- **Phase 4:** `i2m-true-isometric/phase4-control-points.md`

## Effort Estimate

### Phase 1 (Player Movement)
- Client code changes: 4-6 hours
- Testing: 2 hours
- **Total:** 6-8 hours

### Phase 2 (Ship Sprites - DEFERRED to future)
- Art creation (32 angles): 4-6 hours
- Code integration: 2-3 hours
- Testing: 2-3 hours
- **Total:** 8-12 hours
- **Status:** Documented in `w3l-wheel-steering/future-improvements.md`

### Phase 3 (Player-on-Ship Rotation)
- Isometric transform math: 3-4 hours
- Integration: 2-3 hours
- Testing: 2 hours
- **Total:** 7-9 hours

### Phase 4 (Control Points)
- Isometric positioning: 2-3 hours
- Testing: 1-2 hours
- **Total:** 3-5 hours

### Overall Estimate (Phase 1 + 3 + 4)
**Total:** 16-22 hours (excluding Phase 2 ship sprites)

## Success Criteria

### Visual
- [ ] Player movement aligns with isometric tile grid
- [ ] Ship appears correct in isometric space (using sprite frames)
- [ ] Players on rotating ship stay within visual bounds
- [ ] Control points stay attached to ship correctly

### Functional
- [ ] Player can walk in all 8 isometric directions
- [ ] Ship rotation looks smooth (32 frames)
- [ ] No visual "jumping" or "popping"
- [ ] Collision detection still works correctly

### Performance
- [ ] No FPS degradation
- [ ] Sprite sheet memory usage acceptable (<2MB)

## Risks & Mitigations

### Risk: Player movement feels different
**Mitigation:** Playtest extensively, may need to adjust speed/feel

### Risk: Isometric transforms are complex
**Mitigation:** Use proven formulas from industry research, test thoroughly

### Risk: Sprite sheet art takes time
**Mitigation:** Phase 2 is deferred, use simple rectangle for now (current)

## Open Questions

1. **Should we keep Cartesian collision or convert to isometric?**
   - Recommendation: Keep Cartesian (simpler, no functional change)

2. **How many rotation frames for ship?**
   - Recommendation: 32 (industry standard balance)
   - Deferred to Phase 2 implementation

3. **Should camera rotation be added later?**
   - Recommendation: No, keep fixed isometric view

4. **Do we want WASD as alternative to arrow keys?**
   - Recommendation: Yes, map same as arrows

## References

- Industry Research: `spec/seacat/proposals/w3l-wheel-steering/isometric-rotation-industry-research.md`
- Coordinate Analysis: `spec/seacat/proposals/w3l-wheel-steering/isometric-coordinate-research.md`
- Future Ship Sprites: `spec/seacat/proposals/w3l-wheel-steering/future-improvements.md`
- StarCraft sprite rotation: "32 frames, 11.25° increments, Cartesian physics"
- Age of Empires: "8-16 frames, pre-rendered from 3D models"

## Decision

**Status:** Awaiting approval

**Recommended Decision:**
1. Implement Option B (Cosmetic Isometric + Industry Rendering)
2. Execute Phases 1, 3, 4 (skip Phase 2 for now)
3. Defer ship sprite sheet to future milestone (already documented)

---

**Next Steps:**
1. Review this proposal
2. Create decision document
3. Implement Phase 1 (player movement)
4. Implement Phase 3 (player-on-ship rotation)
5. Implement Phase 4 (control points)
