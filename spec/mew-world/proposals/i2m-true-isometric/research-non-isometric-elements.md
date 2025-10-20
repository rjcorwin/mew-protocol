# Research: Complete Audit of Non-Isometric Elements

**Proposal:** i2m-true-isometric
**Date:** 2025-10-20
**Status:** Complete

## Summary

This document catalogs ALL non-isometric elements found in the MEW World codebase after thorough analysis of client rendering code.

## Methodology

1. Read all research documents:
   - `w3l-wheel-steering/isometric-coordinate-research.md`
   - `w3l-wheel-steering/isometric-rotation-industry-research.md`
   - `w3l-wheel-steering/future-improvements.md`

2. Searched codebase for:
   - All sprite creation and rendering
   - Rotation applications (`setRotation`)
   - Coordinate transforms (`rotatePoint`)
   - Collision detection
   - Player movement input

3. Analyzed each element for isometric conformance

## Elements Found

### ✅ ISOMETRIC (Correct)

#### 1. Tile Map Rendering
**File:** `clients/mew-world/src/game/GameScene.ts:151-194`
**Status:** ✅ Correct
**Details:**
- Tilemap uses isometric diamond tiles (32×16 pixels)
- Phaser's `worldToTileXY()` handles isometric transform correctly
- Tiles render as diamonds

**Action:** None - keep as-is

---

#### 2. Tile Collision Detection
**File:** `GameScene.ts:803-809`
**Status:** ✅ Correct
**Details:**
- Uses Phaser's `worldToTileXY()` for coordinate conversion
- Correctly transforms world coords to isometric tile coords

**Action:** None - keep as-is

---

### ❌ NON-ISOMETRIC (Needs Fixing)

#### 3. Player Movement Input (PHASE 1)
**File:** `GameScene.ts:552-563`
**Status:** ❌ Cartesian
**Problem:**
```typescript
if (this.cursors.left?.isDown) velocity.x -= 1;
if (this.cursors.right?.isDown) velocity.x += 1;
if (this.cursors.up?.isDown) velocity.y -= 1;
if (this.cursors.down?.isDown) velocity.y += 1;
```
- Arrow keys map to Cartesian X/Y axes
- Doesn't align with isometric tile grid diagonals

**Fix:** Phase 1 - Isometric arrow key mapping
**Effort:** 6-8 hours
**Priority:** HIGH

---

#### 4. Ship Sprite Rendering (PHASE 2 - DEFERRED)
**File:** `GameScene.ts:398-418`
**Status:** ❌ Cartesian rectangle
**Problem:**
```typescript
shipGraphics.fillRect(0, 0, width, height);
shipGraphics.strokeRect(0, 0, width, height);
shipSprite.setRotation(update.shipData.rotation);
```
- Ship is a flat rectangle
- Uses `setRotation()` which rotates in Cartesian screen space
- Industry research shows NO 2D isometric game uses runtime sprite rotation

**Fix:** Phase 2 - Pre-rendered rotation frames (32 angles)
**Effort:** 8-12 hours
**Priority:** MEDIUM (deferred to future milestone)
**Status:** Documented in `w3l-wheel-steering/future-improvements.md`

---

#### 5. Ship Rotation Application (PHASE 2 - DEFERRED)
**File:** `GameScene.ts:466, 484`
**Status:** ❌ Cartesian
**Problem:**
```typescript
shipSprite.setRotation(update.shipData.rotation);
```
- Applies Cartesian screen-space rotation

**Fix:** Phase 2 - Swap sprite frames instead
```typescript
const frameIndex = rotationToFrameIndex(rotation, 32);
shipSprite.setFrame(frameIndex);
```
**Effort:** Included in Phase 2
**Priority:** MEDIUM (deferred)

---

#### 6. Player-on-Ship Rotation (PHASE 3)
**File:** `GameScene.ts:487-507`
**Status:** ❌ Cartesian rotation matrix
**Problem:**
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
- Pure Cartesian 2D rotation
- Causes players to appear outside ship bounds

**Fix:** Phase 3 - Isometric rotation transform
**Effort:** 7-9 hours
**Priority:** HIGH

---

#### 7. Ship Relative Position Calculation (PHASE 3)
**File:** `GameScene.ts:640-645`
**Status:** ❌ Cartesian inverse rotation
**Problem:**
```typescript
const cos = Math.cos(-ship.rotation);
const sin = Math.sin(-ship.rotation);
this.shipRelativePosition = {
  x: dx * cos - dy * sin,
  y: dx * sin + dy * cos,
};
```
- Cartesian inverse rotation when boarding ship

**Fix:** Phase 3 - Isometric inverse rotation
**Effort:** Included in Phase 3
**Priority:** HIGH

---

#### 8. Control Point Positioning (PHASE 4)
**File:** `GameScene.ts:540-543`
**Status:** ❌ Cartesian rotation
**Problem:**
```typescript
const rotatedPos = this.rotatePoint(controlPoint.relativePosition, shipSprite.rotation);
```
- Uses Cartesian `rotatePoint()` helper
- Control points may appear outside ship bounds

**Fix:** Phase 4 - Isometric rotation
**Effort:** 3-5 hours
**Priority:** MEDIUM

---

#### 9. Animation Direction Calculation
**File:** `GameScene.ts:289-307`
**Status:** ❓ May be OK
**Code:**
```typescript
private calculateDirection(velocity: Phaser.Math.Vector2): Direction {
  const angle = Math.atan2(velocity.y, velocity.x);
  const directions: Direction[] = [
    'east', 'southeast', 'south', 'southwest',
    'west', 'northwest', 'north', 'northeast',
  ];
  const index = Math.round(angle / (Math.PI / 4)) % 8;
  return directions[(index + 8) % 8];
}
```
**Analysis:**
- Calculates screen-space angle from velocity vector
- After Phase 1, velocity will be in isometric space
- `atan2()` should still give correct screen angle for animation selection

**Fix:** Likely none needed - test after Phase 1
**Priority:** LOW (verify during Phase 1 testing)

---

#### 10. Collision Detection OBB
**File:** `GameScene.ts:701-722`
**Status:** ❌ Cartesian OBB BUT may be acceptable
**Code:**
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
**Analysis:**
- Pure Cartesian OBB collision test
- Used for ship boundary detection (boarding)
- **Question:** Should this be isometric-aware?

**Recommendation:** Keep Cartesian
**Rationale:**
- Server physics are Cartesian
- Ship deck boundary is defined in Cartesian space
- Collision is a gameplay mechanic, not a visual concern
- "Cosmetic isometric" approach keeps physics Cartesian

**Fix:** None needed
**Priority:** N/A

---

### ✅ ACCEPTABLE (No Change Needed)

#### 11. Camera/Viewport Bounds
**File:** `GameScene.ts:64-69`
**Status:** ✅ Acceptable
**Code:**
```typescript
const minX = -(this.map.height - 1) * (TILE_WIDTH / 2);
const maxX = (this.map.width - 1) * (TILE_WIDTH / 2);
const maxY = (this.map.width + this.map.height - 1) * (TILE_HEIGHT / 2);
camera.setBounds(minX, 0, maxX - minX, maxY);
```
**Analysis:**
- Calculates bounds based on isometric tile dimensions
- Works correctly with isometric world

**Action:** None

---

#### 12. Remote Player Interpolation
**File:** `GameScene.ts:664-675`
**Status:** ✅ Acceptable
**Code:**
```typescript
const dx = player.targetPosition.x - player.sprite.x;
const dy = player.targetPosition.y - player.sprite.y;
player.sprite.x += dx * factor;
player.sprite.y += dy * factor;
```
**Analysis:**
- Linear interpolation in world space
- Works in any coordinate system

**Action:** None

---

#### 13. Ship Movement (Position Updates)
**File:** `GameScene.ts:614-629`
**Status:** ✅ Acceptable
**Code:**
```typescript
ship.sprite.x += shipDx;
ship.sprite.y += shipDy;
```
**Analysis:**
- Updates world position (Cartesian)
- Server physics are Cartesian (by design)
- This is correct for "cosmetic isometric" approach

**Action:** None

---

#### 14. Player Sprite Creation
**File:** `GameScene.ts:71-80`
**Status:** ✅ Acceptable
**Code:**
```typescript
this.localPlayer = this.add.sprite(centerX, centerY, 'player');
this.localPlayer.setOrigin(0.5, 0.8);
this.localPlayer.setDepth(1);
```
**Analysis:**
- Creates sprite at world coordinates
- Origin and depth are rendering concerns, not coordinate system
- Sprite sheet has 8-directional animations (correct for isometric)

**Action:** None

---

#### 15. Interaction Prompt UI
**File:** `GameScene.ts:87-95`
**Status:** ✅ Acceptable
**Code:**
```typescript
this.interactionPrompt = this.add.text(0, 0, '', {
  fontSize: '16px',
  color: '#ffffff',
  backgroundColor: '#000000aa',
  padding: { x: 10, y: 5 },
});
this.interactionPrompt.setDepth(1000);
```
**Analysis:**
- UI overlay, not part of game world
- Positioned above player in screen space

**Action:** None

---

## Summary Table

| Element | File:Line | Status | Phase | Priority | Effort |
|---------|-----------|--------|-------|----------|--------|
| Tile Map | GameScene.ts:151 | ✅ Isometric | - | - | - |
| Tile Collision | GameScene.ts:803 | ✅ Isometric | - | - | - |
| Player Movement | GameScene.ts:552 | ❌ Cartesian | 1 | HIGH | 6-8h |
| Ship Sprite | GameScene.ts:398 | ❌ Cartesian | 2* | MED | 8-12h |
| Ship Rotation | GameScene.ts:466 | ❌ Cartesian | 2* | MED | (incl) |
| Player-on-Ship Rotation | GameScene.ts:487 | ❌ Cartesian | 3 | HIGH | 7-9h |
| Ship Relative Position | GameScene.ts:640 | ❌ Cartesian | 3 | HIGH | (incl) |
| Control Points | GameScene.ts:540 | ❌ Cartesian | 4 | MED | 3-5h |
| Animation Direction | GameScene.ts:289 | ❓ Unknown | - | LOW | 0-2h |
| OBB Collision | GameScene.ts:701 | ✅ Cartesian OK | - | - | - |
| Camera Bounds | GameScene.ts:64 | ✅ OK | - | - | - |
| Player Interpolation | GameScene.ts:664 | ✅ OK | - | - | - |
| Ship Movement | GameScene.ts:614 | ✅ OK | - | - | - |
| Player Sprite | GameScene.ts:71 | ✅ OK | - | - | - |
| UI Prompt | GameScene.ts:87 | ✅ OK | - | - | - |

**Legend:**
- ✅ = Correct / Acceptable
- ❌ = Needs fixing
- ❓ = Verify during testing
- (*) = Deferred to future milestone

## Total Effort

**Immediate (Phases 1, 3, 4):**
- Phase 1: 6-8 hours
- Phase 3: 7-9 hours
- Phase 4: 3-5 hours
- **Total: 16-22 hours**

**Deferred (Phase 2):**
- Phase 2: 8-12 hours (documented in future-improvements.md)

## Architectural Decision

### Current System: "Cosmetic Isometric"

MEW World uses **cosmetic isometric**:
- ✅ Tiles: Isometric rendering
- ❌ Physics: Cartesian (server-side)
- ❌ Rendering: Mixed (being fixed)

### Target System: "Isometric Rendering with Cartesian Physics"

After i2m-true-isometric:
- ✅ Tiles: Isometric
- ✅ Player Movement: Isometric input mapping
- ✅ Ship Rendering: Pre-rendered isometric frames (Phase 2, deferred)
- ✅ Player Rotation: Isometric transforms
- ✅ Control Points: Isometric positioning
- ✅ Physics: Cartesian (unchanged - by design)

This matches **industry standard** (StarCraft, Age of Empires, C&C).

## Industry Precedent

From `isometric-rotation-industry-research.md`:

**All major 2D isometric games use this approach:**
- StarCraft: Cartesian physics, 32 pre-rendered rotation frames
- Age of Empires: Cartesian physics, 8-16 pre-rendered frames
- Command & Conquer: Cartesian physics, 32-64 frames

**Key Insight:** "No major 2D isometric game uses runtime sprite rotation."

## Files Affected

### Client Changes Only
- `clients/mew-world/src/game/GameScene.ts` (all changes)

### Server Changes
- **None** - server physics stay Cartesian (by design)

## Recommendations

### Execute Immediately
1. **Phase 1:** Player Movement (6-8 hours)
2. **Phase 3:** Player-on-Ship Rotation (7-9 hours)
3. **Phase 4:** Control Point Positioning (3-5 hours)

**Total:** 16-22 hours

### Defer to Future
4. **Phase 2:** Ship Pre-Rendered Sprites (8-12 hours)
   - Already documented in `w3l-wheel-steering/future-improvements.md`
   - Can be done as polish pass after core mechanics proven

## Success Criteria

After Phases 1, 3, 4:
- [ ] Player movement aligns with isometric tile grid
- [ ] Players stay within ship visual bounds when ship rotates
- [ ] Control points stay correctly positioned on ship
- [ ] No visual "jumping" or artifacts
- [ ] All gameplay mechanics still work correctly

## References

- Coordinate System Analysis: `w3l-wheel-steering/isometric-coordinate-research.md`
- Industry Standards: `w3l-wheel-steering/isometric-rotation-industry-research.md`
- Future Ship Sprites: `w3l-wheel-steering/future-improvements.md`
- Main Proposal: `i2m-true-isometric/proposal.md`

---

**Audit Complete:** All non-isometric elements identified and categorized.
