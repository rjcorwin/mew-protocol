# Bug Fix: Ship Movement Direction Disconnected from Rotation

**Date:** 2025-10-20
**Issue:** Ship rotation via wheel did not affect movement direction
**Status:** Fixed

## Problem

After implementing the w3l-wheel-steering proposal, the ship would rotate visually when the wheel was turned, but continued moving in the original direction. The ship's visual rotation was completely disconnected from its actual movement.

## Root Cause

In `ShipServer.ts`, the velocity calculation was still tied to the discrete 8-direction `heading` enum rather than the continuous `rotation` angle:

```typescript
// OLD: Velocity calculated from discrete heading
private updateVelocity() {
  const speed = this.config.speedValues[this.state.speedLevel];
  this.state.velocity = calculateVelocity(this.state.heading, speed);
}
```

The `updateWheelPhysics()` method was updating `this.state.rotation` continuously, but the velocity was only recalculated when `setHeading()` or `setSpeed()` was called. This meant:

1. Wheel turns → `rotation` changes
2. Ship moves → uses old `velocity` (calculated from old `heading`)
3. Result: Ship faces one direction but moves in another

## Solution

Updated `updatePhysics()` to recalculate velocity every frame based on the current continuous `rotation` angle:

```typescript
// ShipServer.ts:290-297
private updatePhysics(deltaTime: number) {
  // Update wheel and ship rotation (w3l-wheel-steering)
  this.updateWheelPhysics(deltaTime);

  // Update velocity to match current rotation angle (not discrete heading)
  if (this.state.speedLevel > 0) {
    const speed = this.config.speedValues[this.state.speedLevel];
    this.state.velocity = {
      x: Math.cos(this.state.rotation) * speed,
      y: Math.sin(this.state.rotation) * speed,
    };
  }

  // Update position based on velocity
  // ...
}
```

Now the velocity vector is synchronized with the ship's visual rotation every physics tick.

## Impact

- Ship now moves in the direction it's facing
- Wheel-based steering works as intended
- No breaking changes to API or protocol
- Server-side fix only, no client changes needed

## Testing

- Start ship with speed > 0
- Grab wheel and turn continuously
- Verify ship trajectory curves in the direction of rotation
- Verify ship continues on rotated heading after releasing wheel

## Related

- **w3l-wheel-steering proposal:** Original implementation
- **r8s-ship-rotation:** Foundation for rotation mechanics
- **Milestone 7:** Ship rotation and isometric coordinate system
