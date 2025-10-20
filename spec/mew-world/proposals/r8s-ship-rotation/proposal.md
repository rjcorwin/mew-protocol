# Proposal r8s: Ship Rotation

**Status:** Proposed
**Created:** 2025-10-18
**Complexity:** High

## Problem Statement

Ships in MEW World currently have an 8-directional heading (N, NE, E, SE, S, SW, W, NW) but do not visually rotate when changing direction. This creates several issues:

1. **Visual Disconnect**: The ship sprite faces the same direction regardless of heading, breaking immersion
2. **Collision Accuracy**: The rectangular deck boundary doesn't rotate with the ship's heading, causing collision detection mismatches
3. **Player Positioning**: Players on deck maintain world-aligned positions rather than rotating with the ship
4. **Control Point Positions**: Wheel and sail positions don't move when the ship turns

When a player steers the ship from east to north, the ship should physically rotate 90° counter-clockwise, with all players on deck rotating around the ship's center point.

## Current Implementation

**Ship State (ShipServer.ts):**
- `heading`: One of 8 directions (stored as string)
- `position`: World coordinates of ship center
- `deckBoundary`: Fixed rectangular boundary (64×96 pixels)
- `controlPoints`: Fixed relative positions from ship center

**Rendering (GameScene.ts):**
- Ship sprite rendered as brown rectangle with fixed orientation
- Control points drawn at fixed offsets from ship position
- Deck boundary used for boarding detection (axis-aligned rectangle)

**Player on Ship:**
- `shipRelativePosition`: {x, y} offset from ship center
- Players move with ship translation but not rotation
- Positions stored in ship-local coordinates but never rotated

## Proposed Solution

Implement true 8-directional ship rotation affecting sprite rendering, collision detection, and player positioning.

### 1. Ship Sprite Rotation

**Add rotation angle to ship state:**
```typescript
interface ShipState {
  // ... existing fields
  rotation: number; // Angle in radians (0 = east, PI/2 = south, PI = west, etc.)
}
```

**Calculate rotation from heading:**
```typescript
function headingToRotation(heading: ShipHeading): number {
  const rotations: Record<ShipHeading, number> = {
    east: 0,
    southeast: Math.PI / 4,
    south: Math.PI / 2,
    southwest: (3 * Math.PI) / 4,
    west: Math.PI,
    northwest: -(3 * Math.PI) / 4,
    north: -Math.PI / 2,
    northeast: -Math.PI / 4,
  };
  return rotations[heading];
}
```

**Update ship rendering (GameScene.ts):**
```typescript
updateShip(update: PositionUpdate) {
  // ... existing ship creation/update

  // Set sprite rotation
  ship.sprite.setRotation(update.shipData.rotation);

  // Control points will auto-rotate with parent sprite if made children
}
```

### 2. Rotating Deck Boundary (Collision Detection)

The deck boundary needs to rotate with the ship for accurate boarding detection.

**Option A: Oriented Bounding Box (OBB)**

Use rotated rectangle collision:
```typescript
function isPointInRotatedRect(
  point: {x: number, y: number},
  rectCenter: {x: number, y: number},
  rectSize: {width: number, height: number},
  rotation: number
): boolean {
  // Transform point to rectangle's local space
  const dx = point.x - rectCenter.x;
  const dy = point.y - rectCenter.y;

  // Rotate point by -rotation to align with rect's axes
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // Check if point is inside axis-aligned rect
  const halfWidth = rectSize.width / 2;
  const halfHeight = rectSize.height / 2;

  return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
}
```

**Option B: Polygon Collision**

Convert deck boundary to 4 corner points and use polygon containment:
```typescript
function getDeckCorners(ship: Ship): Array<{x: number, y: number}> {
  const hw = ship.deckBoundary.width / 2;
  const hh = ship.deckBoundary.height / 2;
  const cos = Math.cos(ship.rotation);
  const sin = Math.sin(ship.rotation);

  const corners = [
    {x: -hw, y: -hh}, // Top-left
    {x: hw, y: -hh},  // Top-right
    {x: hw, y: hh},   // Bottom-right
    {x: -hw, y: hh},  // Bottom-left
  ];

  // Rotate each corner and translate to world position
  return corners.map(c => ({
    x: ship.position.x + (c.x * cos - c.y * sin),
    y: ship.position.y + (c.x * sin + c.y * cos),
  }));
}

function isPointInPolygon(point: {x: number, y: number}, polygon: Array<{x: number, y: number}>): boolean {
  // Ray casting algorithm
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
```

**Recommended:** Option A (OBB) - simpler and more efficient for rectangular boundaries.

### 3. Rotating Player Positions on Deck

Players standing on the ship deck must rotate around the ship's center when the ship turns.

**Track rotation angle change:**
```typescript
// In ShipServer.ts
private lastRotation: number = 0;

public steer(playerId: string, direction: 'left' | 'right') {
  // ... existing heading change logic

  const oldRotation = this.lastRotation;
  const newRotation = headingToRotation(this.state.heading);
  const rotationDelta = newRotation - oldRotation;

  this.lastRotation = newRotation;
  this.state.rotation = newRotation;

  // Broadcast rotation delta so clients can update player positions
  this.onRotationChange?.(rotationDelta);
}
```

**Broadcast rotation in position updates:**
```typescript
interface ShipData {
  // ... existing fields
  rotation: number; // Current rotation in radians
  rotationDelta?: number; // Change since last update (for smooth interpolation)
}
```

**Rotate players on deck (GameScene.ts):**
```typescript
updateShip(update: PositionUpdate) {
  // ... existing ship update logic

  if (update.shipData.rotationDelta && Math.abs(update.shipData.rotationDelta) > 0.001) {
    // Ship rotated - update all players on deck
    // IMPORTANT: Use ship.rotation (final angle), NOT rotationDelta
    // Accumulating rotationDelta causes floating-point drift over time

    // Rotate local player if on this ship
    if (this.onShip === ship.id && this.shipRelativePosition) {
      // Calculate world position using final ship rotation
      // This matches how ship boundary corners are calculated (no accumulated error)
      const rotatedWorldPos = rotatePoint(
        this.shipRelativePosition,
        ship.rotation  // Use final rotation, not delta
      );
      this.localPlayer.x = ship.sprite.x + rotatedWorldPos.x;
      this.localPlayer.y = ship.sprite.y + rotatedWorldPos.y;
    }

    // Rotate remote players on this ship
    this.remotePlayers.forEach((player) => {
      if (player.onShip === ship.id && player.shipRelativePosition) {
        const rotatedWorldPos = rotatePoint(
          player.shipRelativePosition,
          ship.rotation  // Use final rotation, not delta
        );
        player.sprite.x = ship.sprite.x + rotatedWorldPos.x;
        player.sprite.y = ship.sprite.y + rotatedWorldPos.y;
      }
    });
  }
}

function rotatePoint(point: {x: number, y: number}, angle: number): {x: number, y: number} {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
```

### 4. Control Point Rotation

Control points (wheel and sails) should rotate with the ship.

**Option A: Sprite Children (Recommended)**

Make control point graphics children of the ship sprite:
```typescript
// In GameScene.ts updateShip()
const wheelGraphics = this.add.graphics();
const sailsGraphics = this.add.graphics();

// Make them children of ship sprite - they'll auto-rotate
shipSprite.add(wheelGraphics);
shipSprite.add(sailsGraphics);

// Position relative to ship sprite origin (0,0)
wheelGraphics.setPosition(
  update.shipData.controlPoints.wheel.relativePosition.x,
  update.shipData.controlPoints.wheel.relativePosition.y
);
```

**Option B: Manual Rotation**

Rotate control point positions each frame:
```typescript
const rotatedWheel = rotatePoint(
  ship.controlPoints.wheel.relativePosition,
  ship.rotation
);
const wheelWorldPos = {
  x: ship.sprite.x + rotatedWheel.x,
  y: ship.sprite.y + rotatedWheel.y,
};
```

**Recommended:** Option A - cleaner and leverages Phaser's scene graph.

### 5. Ship-Relative Player Movement

When players walk on a rotating ship deck, their movement should be relative to the ship's orientation.

**Transform input to ship-local space:**
```typescript
// In GameScene.ts update() - when player is on ship
if (this.onShip && velocity.length() > 0) {
  const ship = this.ships.get(this.onShip);
  if (ship) {
    // Rotate input velocity by ship's rotation to get ship-local movement
    const shipRotation = ship.rotation || 0;
    const localVelocity = rotatePoint(velocity, -shipRotation);

    // Apply movement in ship-local space
    this.shipRelativePosition.x += localVelocity.x;
    this.shipRelativePosition.y += localVelocity.y;

    // Transform back to world space for rendering
    const worldOffset = rotatePoint(this.shipRelativePosition, shipRotation);
    this.localPlayer.x = ship.sprite.x + worldOffset.x;
    this.localPlayer.y = ship.sprite.y + worldOffset.y;
  }
}
```

**Alternative:** Keep movement world-aligned (simpler, but less realistic)

Players could continue moving in world directions even on rotating ships. This is simpler but may feel unnatural - walking "forward" on the deck would result in diagonal movement relative to the ship.

### 6. Smooth Rotation Interpolation

Ships shouldn't snap instantly to new rotations - use smooth interpolation.

**Add rotation target to ship state:**
```typescript
interface Ship {
  // ... existing fields
  targetRotation: number;
  rotationSpeed: number; // Radians per second
}
```

**Interpolate in update loop:**
```typescript
// In GameScene.ts update()
ships.forEach((ship) => {
  // Interpolate rotation
  const rotationDiff = ship.targetRotation - ship.sprite.rotation;
  if (Math.abs(rotationDiff) > 0.01) {
    const rotationDelta = Math.sign(rotationDiff) * Math.min(
      Math.abs(rotationDiff),
      ship.rotationSpeed * (delta / 1000)
    );
    ship.sprite.rotation += rotationDelta;

    // Rotate players on deck during interpolation
    if (Math.abs(rotationDelta) > 0.001) {
      this.rotatePlayersOnShip(ship.id, rotationDelta);
    }
  }
});
```

**Ship server configuration:**
```typescript
const ROTATION_SPEED = Math.PI / 2; // 90° per second (slow turn)
// or Math.PI for instant 180° turn in 1 second
```

## Implementation Phases

### Phase A: Basic Ship Rotation (Visual Only)

1. Add `rotation` field to ShipState
2. Calculate rotation from heading in ShipServer
3. Include rotation in position broadcasts
4. Render ship sprite with rotation in GameScene
5. Test: Ship sprite rotates visually when steering

**Complexity:** Low
**Risk:** Low
**Testing:** Visual verification only

### Phase B: Rotating Deck Boundary

1. Implement oriented bounding box (OBB) collision
2. Update `checkShipBoundary()` to use OBB test
3. Test boarding detection on rotated ships
4. Verify players can board from any angle

**Complexity:** Medium
**Risk:** Medium (may affect existing boarding behavior)
**Testing:** Board ship from all 8 directions, verify correct detection

### Phase C: Rotating Players on Deck

1. Add `rotationDelta` to ship position broadcasts
2. Implement point rotation helper function
3. Rotate `shipRelativePosition` when ship turns
4. Update world position calculation to include rotation
5. Test: Stand on ship, steer, verify player rotates correctly

**Complexity:** High
**Risk:** High (affects all players on ship)
**Testing:** Multiple players on ship, verify all rotate together

### Phase D: Control Point Rotation

1. Make control point graphics children of ship sprite
2. Remove manual position calculations
3. Test: Control points rotate with ship, stay accessible

**Complexity:** Low
**Risk:** Low
**Testing:** Grab wheel, steer, verify wheel stays in correct position

### Phase E: Ship-Relative Movement (Optional)

1. Transform player input velocity to ship-local space
2. Apply movement in rotated coordinates
3. Test walking around on rotating ship deck

**Complexity:** Medium
**Risk:** Medium (may confuse players)
**Testing:** Walk on ship while steering, verify natural feel

### Phase F: Smooth Rotation Interpolation (Polish)

1. Add rotation interpolation to client
2. Gradually rotate sprite over time
3. Continuously update player positions during rotation
4. Test: Smooth visual rotation, no player position glitches

**Complexity:** Medium
**Risk:** Low (purely visual)
**Testing:** Watch ship rotate smoothly, verify players stay planted on deck

## Alternatives Considered

### Alternative 1: No Rotation (Current State)

**Pros:**
- Simple implementation
- No collision complexity
- No player position updates needed

**Cons:**
- Visually incorrect
- Breaks immersion
- Collision boundary doesn't match visual
- Unrealistic ship behavior

**Decision:** Rejected - rotation is essential for realistic ship simulation

### Alternative 2: 4-Direction Rotation Only

Rotate ship only for cardinal directions (N, E, S, W), skip diagonals.

**Pros:**
- Simpler sprite artwork (only 4 angles)
- Fewer edge cases
- 90° rotations easier to calculate

**Cons:**
- Still need rotation logic
- Doesn't solve diagonal heading problem
- Inconsistent behavior (some headings rotate, others don't)

**Decision:** Rejected - if implementing rotation, do it properly for all 8 directions

### Alternative 3: Separate Ship Facing and Movement Direction

Ship could have a "facing" (visual rotation) separate from "heading" (movement direction), like a car drifting.

**Pros:**
- More realistic sailing physics (ships can face different direction than movement)
- Could add wind mechanics later

**Cons:**
- Much more complex
- Confusing for players
- Requires additional input controls
- Doesn't match current steering model

**Decision:** Rejected - overly complex for current scope, could revisit in future sailing physics milestone

## Technical Risks

1. **Floating Point Precision**: Repeated rotations may accumulate error
   - **Mitigation:** Recalculate from canonical heading each frame, don't accumulate deltas

2. **Player Position Desync**: Rotation timing differences between clients
   - **Mitigation:** Always rotate relative positions on ship turn, not every frame

3. **Collision Edge Cases**: Players may clip through rotated deck boundary
   - **Mitigation:** Test thoroughly with all 8 rotations, add safety margins

4. **Performance**: Rotating many players on ship every frame
   - **Mitigation:** Only rotate when `rotationDelta` is significant, cache rotated positions

5. **Control Point Accessibility**: Wheel/sails may rotate out of reach during turn
   - **Mitigation:** Prevent grabbing controls during active rotation, or allow control throughout

## Success Criteria

- ✅ Ship sprite visually rotates to match heading (8 directions)
- ✅ Deck boundary rotates with ship (accurate boarding detection)
- ✅ Players on deck rotate around ship center when ship turns
- ✅ Multiple players on ship all rotate together correctly
- ✅ Control points (wheel/sails) stay in correct rotated positions
- ✅ No visual glitches during rotation
- ✅ Players can board rotating ships from any angle
- ✅ Position synchronization works correctly for rotated ships
- ✅ Players walking on deck move naturally (bonus: ship-relative movement)

## Future Extensions

1. **Rotation Animation**: Smooth interpolation over 0.5-1 second per turn
2. **Ship-Relative Movement**: Walk controls relative to ship facing
3. **Deck Fixtures**: Masts, cargo, decorations that rotate with ship
4. **Multi-Deck Ships**: Multiple levels with rotated collision boundaries
5. **Collision Response**: Ships bump into each other and rotate on impact
6. **Wind Direction**: Ship speed affected by wind angle relative to heading
7. **16-Direction Rotation**: Finer rotation granularity (if 8-direction sprites created)

## References

- Phaser sprite rotation: https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Sprite.html#rotation
- Rotating rectangle collision: https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/2d-rotated-rectangle-collision-r2604/
- Point rotation math: https://en.wikipedia.org/wiki/Rotation_matrix
- Isometric rotation considerations: https://stackoverflow.com/questions/24840202/isometric-rotated-rectangle-collision-detection
