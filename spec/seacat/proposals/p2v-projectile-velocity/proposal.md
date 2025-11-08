# Proposal: True 3D Isometric Projectile Physics (p2v-projectile-velocity)

**Status:** Implemented
**Date:** 2025-11-08
**Code:** p2v

## Problem Statement

Cannon projectiles in Seacat exhibit directionally-dependent behavior that breaks game balance and player expectations:

- **Firing south** (bottom of diamond): Ball travels only 3 tiles, hits water immediately
- **Firing north** (top of diamond): Ball travels 20+ tiles, flies excessively far
- **Firing east/west** (sides of diamond): Ball travels ~10 tiles (expected/desired behavior)

### Root Cause

The server calculates projectile velocity mixing two incompatible coordinate systems:

```typescript
// Server (incorrect mixing of dimensions)
vel.x = cos(fireAngle) * horizontalSpeed
vel.y = sin(fireAngle) * horizontalSpeed - verticalComponent
```

The client interprets `vel.y` as pure vertical screen motion (up/down), but the server includes `sin(fireAngle)` which represents horizontal ground movement (north/south). This causes gravity to incorrectly affect horizontal map movement.

**The fundamental issue:** In isometric projection, screen Y conflates two physically separate dimensions:
1. Ground position (north/south on the map)
2. Height/elevation (up/down in 3D space)

## Solution: Separate Ground Position from Height

Implement true 3D ballistics by tracking projectiles in three separate dimensions:

1. **Ground position** (groundX, groundY) - horizontal movement on the map plane
2. **Height** (heightZ) - vertical elevation affected by gravity
3. **Screen rendering** - convert ground+height to screen coordinates

### Key Changes

**1. Server: Calculate 3D Velocity in Ground-Space**

```typescript
// Convert screen fire angle to ground azimuth (inverse isometric transform)
const cos_azimuth = (cos_fire + 2 * sin_fire) / norm;
const sin_azimuth = (2 * sin_fire - cos_fire) / norm;

// 3D velocity components
const vel = {
  groundVx: horizontalSpeed * cos_azimuth,
  groundVy: horizontalSpeed * sin_azimuth,
  heightVz: verticalComponent  // Positive = upward
};
```

**2. Client: Separate Physics Simulation**

```typescript
// Update ground position (no gravity)
proj.groundX += proj.groundVx * deltaS;
proj.groundY += proj.groundVy * deltaS;

// Update height (with gravity)
proj.heightVz -= GRAVITY * deltaS;  // Gravity only affects Z
proj.heightZ += proj.heightVz * deltaS;

// Convert to screen coordinates for rendering
proj.sprite.x = proj.groundX - proj.groundY;
proj.sprite.y = (proj.groundX + proj.groundY) / 2 - proj.heightZ;
```

**3. Server Hit Validation: Iterative Physics Replay**

To prevent client-server desync and exploits, the server validates hits by replaying the exact physics simulation:

```typescript
// Simulate frame-by-frame at 60 FPS using Euler integration (matches client)
for (let i = 0; i < numSteps; i++) {
  groundX += vel.groundVx * dt;
  groundY += vel.groundVy * dt;
  heightVz -= GRAVITY * dt;
  heightZ += heightVz * dt;
}

// Validate height threshold (prevents high-arc exploit)
if (Math.abs(heightZ) > DECK_HEIGHT_THRESHOLD) {
  return false;  // Too high/low to hit
}
```

## Benefits

✅ **Uniform distances** - All directions travel equal ground distance
✅ **Physically accurate** - Gravity only affects height, not ground movement
✅ **Consistent trajectories** - Same arc shape in all directions
✅ **Mental model alignment** - Cannons fire across the map as expected
✅ **Extensible** - Enables terrain elevation, jumping, flying projectiles
✅ **Cheat-resistant** - Server validates using same physics as client

## Implementation Status

- [x] Server 3D velocity calculation (ShipServer.ts:689-719)
- [x] Client 3D physics simulation (ProjectileManager.ts:163-172)
- [x] Protocol types updated (Velocity3D with groundVx, groundVy, heightVz)
- [x] Server hit validation with iterative physics (ShipServer.ts:784-870)
- [x] Height threshold validation (prevents high-arc exploits)
- [x] Unit tests for physics synchronization (ShipServer.test.ts)

## Technical Details

See:
- `decision-p2v-projectile-velocity.md` - Decision rationale and alternatives
- `research.md` - Isometric coordinate system research
- `implementation.md` - Step-by-step implementation details

## References

- Client physics: `clients/seacat/src/game/managers/ProjectileManager.ts:163-172`
- Server physics: `src/mcp-servers/ship-server/ShipServer.ts:689-719`
- Server validation: `src/mcp-servers/ship-server/ShipServer.ts:784-870`
- Original bug: "Cannon trajectory bug when ship moves north/south"
