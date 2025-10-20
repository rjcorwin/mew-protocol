# Phase 3: Isometric Player-on-Ship Rotation

**Proposal:** i2m-true-isometric
**Phase:** 3 of 4
**Status:** Draft
**Estimated Effort:** 7-9 hours
**Depends On:** Phase 1 (player movement)

## Goal

Fix the visual issue where players appear to rotate outside ship bounds when the ship turns. Players should rotate correctly in isometric space, staying within the ship's visual boundaries.

## Current Behavior

**File:** `clients/mew-world/src/game/GameScene.ts:487-507`

```typescript
if (update.shipData.rotationDelta && Math.abs(update.shipData.rotationDelta) > 0.001) {
  const rotationDelta = update.shipData.rotationDelta;

  this.applyingShipRotation = true;
  this.shipRelativePosition = this.rotatePoint(
    this.shipRelativePosition,
    rotationDelta
  );

  const rotatedWorldPos = this.rotatePoint(this.shipRelativePosition, ship.rotation);
  this.localPlayer.x = ship.sprite.x + rotatedWorldPos.x;
  this.localPlayer.y = ship.sprite.y + rotatedWorldPos.y;
}

// Helper (GameScene.ts:684-691)
private rotatePoint(point, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
```

**Problem:**
- Uses **Cartesian rotation matrix**
- Players appear to move outside ship visual bounds
- Ship is rendered in isometric space (will use sprite frames in Phase 2)
- Player rotation doesn't match isometric projection

## Visual Issue Example

```
Cartesian Rotation (Current):          Isometric View (How it looks):
Ship at 0° (facing east)               Ship sprite (diamond shape)
┌─────────┐                                  ◇
│    P    │                                 /P\
└─────────┘                                ◇───◇

Ship rotates 90° (facing south)        Ship sprite rotated
   ┌─────┐                                   ◇
   │     │                                  / \
   │     │                                 /   \
   │  P  │  ← P is at correct           P◇     ◇  ← P appears OUTSIDE!
   │     │    Cartesian position          \   /
   │     │                                  \ /
   └─────┘                                   ◇
```

Player `P` is at correct Cartesian position but **appears outside ship visually** because the ship is rendered isometrically.

## Root Cause

### Coordinate System Mismatch

1. **Server (ShipServer.ts):** Ship physics are Cartesian
   - Ship rotation is in radians (Cartesian)
   - Player relative position is Cartesian offset from ship center

2. **Client Rendering:** Ship will use isometric sprite frames (Phase 2)
   - Ship sprite is pre-rendered in isometric view
   - Ship "rotation" is actually frame swapping (no runtime rotation)
   - BUT players still rotate using Cartesian math

3. **Current Player Rotation:** Cartesian 2D rotation matrix
   - Rotates point around origin in Cartesian space
   - Doesn't account for isometric projection skew

## Isometric Rotation Transform

### Mathematical Background

**Isometric Projection Matrix:**
```
| 1   -1  |     | cos(30°)  -cos(30°) |
| 0.5  0.5 |  =  | sin(30°)   sin(30°) |
```

This transforms 2D Cartesian coordinates to isometric screen coordinates.

**To rotate in isometric space:**
1. Transform point FROM isometric TO Cartesian
2. Apply Cartesian rotation
3. Transform point FROM Cartesian BACK TO isometric

### Isometric Rotation Formula

**Inverse Isometric Transform:**
```typescript
function isometricToCartesian(isoPoint: {x, y}): {x, y} {
  return {
    x: (isoPoint.x + isoPoint.y * 2) / 2,
    y: (isoPoint.y * 2 - isoPoint.x) / 2,
  };
}
```

**Forward Isometric Transform:**
```typescript
function cartesianToIsometric(cartPoint: {x, y}): {x, y} {
  return {
    x: cartPoint.x - cartPoint.y,
    y: (cartPoint.x + cartPoint.y) / 2,
  };
}
```

**Isometric Rotation:**
```typescript
function rotatePointIsometric(point: {x, y}, angle: number): {x, y} {
  // 1. Convert from isometric to Cartesian
  const cart = isometricToCartesian(point);

  // 2. Rotate in Cartesian space
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedCart = {
    x: cart.x * cos - cart.y * sin,
    y: cart.x * sin + cart.y * cos,
  };

  // 3. Convert back to isometric
  return cartesianToIsometric(rotatedCart);
}
```

## Proposed Solution

### Option A: Isometric Rotation Transform (RECOMMENDED)

Apply isometric-aware rotation when ship turns.

**Changes to:** `GameScene.ts:487-507`

**Before:**
```typescript
this.shipRelativePosition = this.rotatePoint(
  this.shipRelativePosition,
  rotationDelta
);
```

**After:**
```typescript
this.shipRelativePosition = this.rotatePointIsometric(
  this.shipRelativePosition,
  rotationDelta
);
```

Add new helper method:
```typescript
private rotatePointIsometric(point: {x: number, y: number}, angle: number) {
  // Convert from isometric to Cartesian
  const cartX = (point.x + point.y * 2) / 2;
  const cartY = (point.y * 2 - point.x) / 2;

  // Rotate in Cartesian space
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedCartX = cartX * cos - cartY * sin;
  const rotatedCartY = cartX * sin + cartY * cos;

  // Convert back to isometric
  return {
    x: rotatedCartX - rotatedCartY,
    y: (rotatedCartX + rotatedCartY) / 2,
  };
}
```

### Option B: Keep Cartesian, Adjust Visual Only (SIMPLER)

Don't change rotation math, just adjust where player sprite is rendered.

**Problem:** This is a band-aid fix and doesn't address root cause.

**Not Recommended.**

### Option C: Server-Side Isometric (COMPLEX)

Move all rotation to isometric space on server.

**Problem:** Requires server refactor, breaks existing physics.

**Not Recommended.**

## Implementation

### Step 1: Add Isometric Transform Helpers

**File:** `clients/mew-world/src/game/GameScene.ts`

Add helper methods (around line 690):

```typescript
/**
 * Convert isometric coordinates to Cartesian coordinates
 */
private isometricToCartesian(isoPoint: {x: number, y: number}): {x: number, y: number} {
  return {
    x: (isoPoint.x + isoPoint.y * 2) / 2,
    y: (isoPoint.y * 2 - isoPoint.x) / 2,
  };
}

/**
 * Convert Cartesian coordinates to isometric coordinates
 */
private cartesianToIsometric(cartPoint: {x: number, y: number}): {x: number, y: number} {
  return {
    x: cartPoint.x - cartPoint.y,
    y: (cartPoint.x + cartPoint.y) / 2,
  };
}

/**
 * Rotate a point in isometric space
 * This ensures rotation appears correct in isometric projection
 */
private rotatePointIsometric(point: {x: number, y: number}, angle: number): {x: number, y: number} {
  // Transform to Cartesian
  const cart = this.isometricToCartesian(point);

  // Apply Cartesian rotation
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedCart = {
    x: cart.x * cos - cart.y * sin,
    y: cart.x * sin + cart.y * cos,
  };

  // Transform back to isometric
  return this.cartesianToIsometric(rotatedCart);
}
```

### Step 2: Update Player Rotation on Ship

**File:** `GameScene.ts:487-507`

**Before:**
```typescript
if (update.shipData.rotationDelta && Math.abs(update.shipData.rotationDelta) > 0.001) {
  const rotationDelta = update.shipData.rotationDelta;

  this.applyingShipRotation = true;
  this.shipRelativePosition = this.rotatePoint(
    this.shipRelativePosition,
    rotationDelta
  );

  const rotatedWorldPos = this.rotatePoint(this.shipRelativePosition, ship.rotation);
  this.localPlayer.x = ship.sprite.x + rotatedWorldPos.x;
  this.localPlayer.y = ship.sprite.y + rotatedWorldPos.y;
}
```

**After:**
```typescript
if (update.shipData.rotationDelta && Math.abs(update.shipData.rotationDelta) > 0.001) {
  const rotationDelta = update.shipData.rotationDelta;

  this.applyingShipRotation = true;

  // Use isometric rotation to keep player within ship visual bounds
  this.shipRelativePosition = this.rotatePointIsometric(
    this.shipRelativePosition,
    rotationDelta
  );

  // Apply total ship rotation (also isometric)
  const rotatedWorldPos = this.rotatePointIsometric(this.shipRelativePosition, ship.rotation);
  this.localPlayer.x = ship.sprite.x + rotatedWorldPos.x;
  this.localPlayer.y = ship.sprite.y + rotatedWorldPos.y;
}
```

### Step 3: Update Ship Relative Position Calculation

**File:** `GameScene.ts:640-645`

When player boards ship, calculate relative position:

**Before:**
```typescript
const cos = Math.cos(-ship.rotation);
const sin = Math.sin(-ship.rotation);
this.shipRelativePosition = {
  x: dx * cos - dy * sin,
  y: dx * sin + dy * cos,
};
```

**After:**
```typescript
// Calculate offset from ship center
const offset = { x: dx, y: dy };

// Inverse rotate in isometric space
this.shipRelativePosition = this.rotatePointIsometric(offset, -ship.rotation);
```

### Step 4: Keep Cartesian Helper (for other uses)

**Keep:** `rotatePoint()` method for non-isometric uses

**Rename (optional):** `rotatePointCartesian()` to be explicit

## Testing Plan

### Test Cases

1. **Player Stays Within Ship Bounds**
   - [ ] Player stands at center of ship
   - [ ] Ship rotates 90° (wheel turn)
   - [ ] Player stays at center (visually)

2. **Player at Ship Edge**
   - [ ] Player walks to front edge of ship
   - [ ] Ship rotates 180°
   - [ ] Player ends up at back edge (visually within ship)

3. **Player at Corner**
   - [ ] Player walks to corner of ship deck
   - [ ] Ship rotates 45°
   - [ ] Player stays within ship visual bounds

4. **Continuous Rotation**
   - [ ] Player on ship, ship turns continuously
   - [ ] Player orbit path stays within ship bounds
   - [ ] No visual "jumping" or "popping"

5. **Multiple Rotations**
   - [ ] Ship rotates 360° (full circle)
   - [ ] Player returns to same relative position
   - [ ] No accumulated error

### Debugging

Add console logging to verify rotation:

```typescript
console.log('Rotation delta:', rotationDelta);
console.log('Before rotation:', this.shipRelativePosition);
const rotated = this.rotatePointIsometric(this.shipRelativePosition, rotationDelta);
console.log('After rotation:', rotated);
```

Visual debug: Draw circle at player's ship-relative position to verify bounds.

## Edge Cases

### Edge Case 1: Player Movement While Ship Rotates

**Scenario:** Player walks on deck while ship turns

**Current Behavior:** Player movement is local to ship

**Impact:** Isometric rotation should not affect player's ability to walk

**Test:** Walk forward while ship turns - should work normally

### Edge Case 2: Boarding/Disembarking During Rotation

**Scenario:** Player boards ship while it's turning

**Expected:** Player relative position calculated correctly

**Test:** Board ship mid-turn, verify position is correct

### Edge Case 3: Remote Players on Ship

**File:** `GameScene.ts:614-629`

Remote players also use ship movement:

```typescript
this.remotePlayers.forEach((player) => {
  if (player.onShip === ship.id) {
    player.sprite.x += shipDx;
    player.sprite.y += shipDy;
  }
});
```

**Question:** Do remote players also need isometric rotation?

**Answer:** **No** - server sends world coordinates. Remote players' positions are already world-space, no rotation needed.

**Action:** No change to remote player code.

## Performance Considerations

**Isometric transform adds:**
- 2 additions
- 2 subtractions
- 2 multiplications
- 2 divisions

Per player per rotation update (only when ship is turning).

**Impact:** Negligible (runs once per frame, only for local player on rotating ship)

## Rollback Plan

If isometric rotation causes issues:

1. Revert to Cartesian `rotatePoint()`
2. Keep current behavior (document as known issue)
3. Wait for Phase 2 (ship sprites) to reassess

## Success Criteria

- [ ] Players stay within ship visual bounds during rotation
- [ ] No visual "jumping" when ship rotates
- [ ] Player relative position preserved correctly
- [ ] Works with wheel steering (w3l-wheel-steering)
- [ ] No regression in boarding/disembarking

## Files Changed

- `clients/mew-world/src/game/GameScene.ts`
  - Add `isometricToCartesian()` helper (~6 lines)
  - Add `cartesianToIsometric()` helper (~6 lines)
  - Add `rotatePointIsometric()` helper (~15 lines)
  - Update rotation application (~5 lines changed)
  - Update relative position calculation (~5 lines changed)

**Total Changes:** ~40-50 lines

## Dependencies

**Depends On:**
- Phase 1 (player movement) - not strictly required but recommended for consistency

**Blocks:**
- None (Phase 2 is independent, Phase 4 can be done in parallel)

## Next Phase

After Phase 3 complete:
- Phase 4: Control Point Isometric Positioning
