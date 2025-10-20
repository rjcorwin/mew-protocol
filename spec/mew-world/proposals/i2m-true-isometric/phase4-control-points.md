# Phase 4: Isometric Control Point Positioning

**Proposal:** i2m-true-isometric
**Phase:** 4 of 4
**Status:** Draft
**Estimated Effort:** 3-5 hours
**Depends On:** Phase 3 (player rotation helpers)

## Goal

Fix control point rendering (wheel and sails) to use isometric rotation transforms, ensuring they stay correctly positioned on the ship when it rotates.

## Current Behavior

**File:** `clients/mew-world/src/game/GameScene.ts:540-543`

```typescript
const rotatedPos = this.rotatePoint(controlPoint.relativePosition, shipSprite.rotation);
const worldX = shipSprite.x + rotatedPos.x;
const worldY = shipSprite.y + rotatedPos.y;

const color = controlPoint.controlledBy ? 0xff0000 : 0x00ff00;
graphics.fillStyle(color, 0.5);
graphics.fillCircle(worldX, worldY, 8);
graphics.lineStyle(2, 0xffffff, 1);
graphics.strokeCircle(worldX, worldY, 8);
```

**Problem:**
- Uses Cartesian `rotatePoint()` helper
- Control points may appear outside ship bounds (same issue as players)
- Doesn't match isometric projection

## Control Point Data Structure

**File:** `src/mcp-servers/ship-server/types.ts:48-56`

```typescript
export interface ControlPoint {
  id: string;
  relativePosition: { x: number; y: number }; // Relative to ship center
  controlledBy: string | null;
}
```

**Server provides Cartesian relative positions:**
- Wheel: `{ x: 0, y: 0 }` (center of ship)
- Sails: `{ x: 0, y: -30 }` (30px north of center)

## Visual Issue

Similar to player rotation issue:

```
Cartesian (Current):           Isometric (How it looks):
Ship with control points       Ship sprite (diamond)
    S (sails)                       S  ← Sails control point
     |                             / \
┌────W────┐                       W   \ ← Wheel appears offset
│         │                      /     \
└─────────┘                     ◇───────◇

When ship rotates 90°:
     ┌─S                            ◇
     │                             / S ← Sails outside ship!
     │                            /  /
     W                           ◇ W
     │                            \ \
     └─                            \ \
                                    ◇─◇
```

## Proposed Solution

Use isometric rotation transform (from Phase 3) to position control points.

### Implementation

**File:** `GameScene.ts:540-543`

**Before:**
```typescript
const rotatedPos = this.rotatePoint(controlPoint.relativePosition, shipSprite.rotation);
```

**After:**
```typescript
const rotatedPos = this.rotatePointIsometric(controlPoint.relativePosition, shipSprite.rotation);
```

That's it! The `rotatePointIsometric()` helper from Phase 3 handles the isometric transform.

## Full Context

### Where Control Points Are Rendered

**File:** `GameScene.ts:527-546`

```typescript
private updateShipControlPoints(ship: Ship, shipSprite: Phaser.GameObjects.Sprite) {
  // Clear previous graphics
  ship.controlPoints.wheel.sprite.clear();
  ship.controlPoints.sails.sprite.clear();

  // Render each control point
  ['wheel', 'sails'].forEach((pointName) => {
    const controlPoint = ship.controlPoints[pointName as 'wheel' | 'sails'];
    const graphics = controlPoint.sprite;

    // Rotate relative position by ship rotation (CURRENTLY CARTESIAN)
    const rotatedPos = this.rotatePoint(controlPoint.relativePosition, shipSprite.rotation);
    const worldX = shipSprite.x + rotatedPos.x;
    const worldY = shipSprite.y + rotatedPos.y;

    // Draw control point
    const color = controlPoint.controlledBy ? 0xff0000 : 0x00ff00;
    graphics.fillStyle(color, 0.5);
    graphics.fillCircle(worldX, worldY, 8);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(worldX, worldY, 8);
  });
}
```

This is called every frame in the `update()` loop.

### Control Point Relative Positions (Server)

**File:** `src/mcp-servers/ship-server/ShipServer.ts:79-87`

```typescript
// Initialize control points
this.state.controlPoints = {
  wheel: {
    id: 'wheel',
    relativePosition: { x: 0, y: 0 }, // Center
    controlledBy: null,
  },
  sails: {
    id: 'sails',
    relativePosition: { x: 0, y: -30 }, // Forward
    controlledBy: null,
  },
};
```

**Note:** These are Cartesian offsets from ship center.

## Implementation Steps

### Step 1: Update Control Point Rotation

**File:** `clients/mew-world/src/game/GameScene.ts:540`

**Change:**
```typescript
// Before
const rotatedPos = this.rotatePoint(controlPoint.relativePosition, shipSprite.rotation);

// After
const rotatedPos = this.rotatePointIsometric(controlPoint.relativePosition, shipSprite.rotation);
```

### Step 2: Verify Phase 3 Helpers Exist

Ensure `rotatePointIsometric()` is implemented (from Phase 3):

```typescript
private rotatePointIsometric(point: {x: number, y: number}, angle: number): {x: number, y: number} {
  const cart = this.isometricToCartesian(point);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedCart = {
    x: cart.x * cos - cart.y * sin,
    y: cart.x * sin + cart.y * cos,
  };
  return this.cartesianToIsometric(rotatedCart);
}
```

If Phase 3 not implemented yet, add helpers first (see Phase 3 spec).

## Testing Plan

### Test Cases

1. **Control Points at Rest**
   - [ ] Ship at 0° rotation
   - [ ] Wheel at center
   - [ ] Sails 30px forward
   - [ ] Both points within ship bounds

2. **Ship Rotates 90°**
   - [ ] Turn wheel to rotate ship 90°
   - [ ] Control points rotate with ship
   - [ ] Both points stay within ship visual bounds
   - [ ] Wheel stays at center
   - [ ] Sails stay 30px forward (relative to ship)

3. **Ship Rotates 180°**
   - [ ] Continue rotation to 180°
   - [ ] Sails now 30px behind (in world space)
   - [ ] Still within ship bounds

4. **Ship Rotates 360°**
   - [ ] Full rotation
   - [ ] Control points return to original positions
   - [ ] No accumulated error

5. **Player Controls Control Point**
   - [ ] Player boards ship
   - [ ] Player interacts with wheel (control point turns red)
   - [ ] Ship rotates while player controls wheel
   - [ ] Control point stays in correct position

6. **Multiple Control Points**
   - [ ] Both wheel and sails visible
   - [ ] Ship rotates
   - [ ] Both rotate correctly
   - [ ] Neither overlaps or goes outside bounds

### Visual Debugging

Add debug rendering to verify positions:

```typescript
// Draw ship center (for reference)
graphics.fillStyle(0xffff00, 1);
graphics.fillCircle(shipSprite.x, shipSprite.y, 4);

// Draw relative position vector (before rotation)
graphics.lineStyle(2, 0x00ffff, 0.5);
graphics.lineBetween(
  shipSprite.x,
  shipSprite.y,
  shipSprite.x + controlPoint.relativePosition.x,
  shipSprite.y + controlPoint.relativePosition.y
);

// Draw rotated position vector (after rotation)
graphics.lineStyle(2, 0xff00ff, 0.5);
graphics.lineBetween(
  shipSprite.x,
  shipSprite.y,
  worldX,
  worldY
);
```

## Edge Cases

### Edge Case 1: Control Point Interaction During Rotation

**Scenario:** Player controls wheel, ship is rotating

**Expected:** Control point position updates each frame, stays under player

**Test:** Control wheel, verify visual feedback stays correct

### Edge Case 2: Multiple Ships

**Scenario:** Two ships, both rotating, each with control points

**Expected:** Each ship's control points rotate independently

**Test:** Create two ships, rotate both, verify no cross-contamination

### Edge Case 3: Ship at Extreme Rotation Angle

**Scenario:** Ship at 359.9° (nearly 360°)

**Expected:** Control points positioned correctly (no wraparound issues)

**Test:** Rotate ship many times, check for accumulated error

## Performance Considerations

**Current:** Control points rendered every frame

**After Phase 4:** Same, but with isometric rotation

**Cost per frame:**
- 2 control points × isometric transform
- Isometric transform = ~10 arithmetic operations

**Impact:** Negligible (rendering is already per-frame)

## Alternative Approaches

### Alternative A: Server-Side Isometric Positions

**Idea:** Have server provide isometric-rotated positions

**Problem:** Server doesn't know about isometric rendering

**Verdict:** Not recommended (client-side concern)

### Alternative B: Pre-calculate All Rotation Angles

**Idea:** Pre-calculate control point positions for all 32 ship rotations

**Problem:** Overkill, rotation is cheap

**Verdict:** Not needed

### Alternative C: Attach Control Points to Ship Sprite

**Idea:** Make control points child objects of ship sprite

**Problem:** Phaser sprite rotation is Cartesian (same issue)

**Verdict:** Doesn't solve problem

## Success Criteria

- [ ] Control points stay within ship visual bounds at all rotations
- [ ] Wheel stays at ship center (relative to ship)
- [ ] Sails stay 30px forward (relative to ship)
- [ ] No visual "jumping" or "popping" during rotation
- [ ] Control point interaction still works correctly

## Files Changed

- `clients/mew-world/src/game/GameScene.ts`
  - Update `updateShipControlPoints()` method (~1 line changed)

**Total Changes:** 1 line (plus helpers from Phase 3 if not already added)

## Dependencies

**Depends On:**
- Phase 3 (player rotation helpers) - `rotatePointIsometric()` must exist

**Blocks:**
- None (this is the final phase)

## Integration with Other Features

### w3l-wheel-steering

**Interaction:** Wheel control point visual must stay correct during steering

**Test:** Turn wheel, verify control point stays at ship center

### r8s-ship-rotation (Phase C/D)

**Interaction:** Players rotate with ship, control points must also rotate

**Test:** Player on deck while ship turns, verify control points align with ship

### Future: Phase 2 Ship Sprites

**When ship gets pre-rendered rotation frames:**
- Control points will align with sprite frames
- Isometric rotation ensures control points match sprite orientation

## Rollback Plan

If control points don't render correctly:

1. Revert to Cartesian `rotatePoint()`
2. Document as known issue
3. Investigate if server-side positions need adjustment

## Next Steps

After Phase 4 complete:
- Test entire isometric system end-to-end
- Create integration test scenario
- Document coordinate system conventions
- Consider Phase 2 (ship sprites) for future milestone

---

**Phase 4 is the final phase of i2m-true-isometric proposal (excluding deferred Phase 2).**
