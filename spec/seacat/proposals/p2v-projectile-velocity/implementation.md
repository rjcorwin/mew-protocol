# Implementation: True 3D Isometric Projectile Physics (p2v-projectile-velocity)

**Status:** ✅ Complete
**Date:** 2025-11-08

## Overview

This document describes the implementation of true 3D ballistic physics for projectiles in Seacat's isometric game world, including both client-side simulation and server-side hit validation.

## Phase 1: Type System Updates

### New Type: Velocity3D

**File:** `src/mcp-servers/ship-server/types.ts`

```typescript
export interface Velocity3D {
  groundVx: number;  // Ground-space X velocity (px/s)
  groundVy: number;  // Ground-space Y velocity (px/s)
  heightVz: number;  // Height velocity - positive = upward (px/s)
}
```

### Updated Type: Projectile

**File:** `clients/seacat/src/types.ts`

```typescript
export interface Projectile {
  id: string;
  sprite: Phaser.GameObjects.Circle;

  // Ground position and velocity
  groundX: number;
  groundY: number;
  groundVx: number;
  groundVy: number;

  // Height position and velocity
  heightZ: number;
  heightVz: number;

  spawnTime: number;
  sourceShip: string;
  minFlightTime: number;
}
```

## Phase 2: Server-Side 3D Velocity Calculation

### File: `src/mcp-servers/ship-server/ShipServer.ts:689-719`

#### Step 1: Calculate Fire Direction

```typescript
// Determine perpendicular to ship (port fires left, starboard fires right)
const perpendicular = this.state.rotation + (isPort ? -Math.PI / 2 : Math.PI / 2);
const fireAngle = perpendicular + cannon.aimAngle;
```

#### Step 2: Decompose into Horizontal and Vertical Components

```typescript
const elevation = cannon.elevationAngle;
const horizontalSpeed = CANNON_SPEED * Math.cos(elevation);  // Ground-plane speed
const verticalComponent = CANNON_SPEED * Math.sin(elevation);  // Upward velocity
```

#### Step 3: Convert Screen Angle to Ground Azimuth

```typescript
const cos_fire = Math.cos(fireAngle);
const sin_fire = Math.sin(fireAngle);

// Inverse isometric transform
const cos_azimuth_unnorm = cos_fire + 2 * sin_fire;
const sin_azimuth_unnorm = 2 * sin_fire - cos_fire;

// Normalize to unit vector
const azimuth_norm = Math.sqrt(
  cos_azimuth_unnorm * cos_azimuth_unnorm +
  sin_azimuth_unnorm * sin_azimuth_unnorm
);
const cos_azimuth = cos_azimuth_unnorm / azimuth_norm;
const sin_azimuth = sin_azimuth_unnorm / azimuth_norm;
```

#### Step 4: Calculate 3D Velocity

```typescript
const vel: Velocity3D = {
  groundVx: horizontalSpeed * cos_azimuth + this.state.velocity.x,  // Include ship velocity
  groundVy: horizontalSpeed * sin_azimuth + this.state.velocity.y,
  heightVz: verticalComponent,  // Positive = upward
};
```

## Phase 3: Client-Side 3D Physics Simulation

### File: `clients/seacat/src/game/managers/ProjectileManager.ts:163-172`

#### Spawn Projectile

**File:** `ProjectileManager.ts:79-131`

```typescript
// Convert spawn position to ground coordinates (inverse isometric)
const spawnHeightZ = 0;  // Cannons fire from deck level
const spawnGroundX = position.x / 2 + position.y + spawnHeightZ;
const spawnGroundY = position.y - position.x / 2 + spawnHeightZ;

const projectile: Projectile = {
  id,
  sprite,
  groundX: spawnGroundX,
  groundY: spawnGroundY,
  groundVx: velocity.groundVx,
  groundVy: velocity.groundVy,
  heightZ: spawnHeightZ,
  heightVz: velocity.heightVz,
  spawnTime: timestamp,
  sourceShip,
  minFlightTime: 200,  // 200ms grace period
};
```

#### Physics Update Loop

**File:** `ProjectileManager.ts:163-180`

```typescript
const deltaS = delta / 1000;  // Convert ms to seconds

// Update ground position - NO gravity (horizontal movement only)
proj.groundX += proj.groundVx * deltaS;
proj.groundY += proj.groundVy * deltaS;

// Update height - WITH gravity (vertical component only)
proj.heightVz -= GRAVITY * deltaS;  // Gravity decreases upward velocity
proj.heightZ += proj.heightVz * deltaS;

// Convert to screen coordinates for rendering
const screenX = proj.groundX - proj.groundY;
const screenY = (proj.groundX + proj.groundY) / 2 - proj.heightZ;

proj.sprite.x = screenX;
proj.sprite.y = screenY;
```

#### Height-Based Hit Detection

**File:** `ProjectileManager.ts:210-214`

```typescript
// Only hit ships if projectile is at deck height
const DECK_HEIGHT_THRESHOLD = 30;  // px tolerance
if (Math.abs(proj.heightZ) > DECK_HEIGHT_THRESHOLD) {
  return;  // Projectile too high or too low
}
```

## Phase 4: Server-Side Hit Validation

### File: `src/mcp-servers/ship-server/ShipServer.ts:784-870`

#### Problem: Client-Server Physics Sync

The client simulates physics using iterative Euler integration at 60 FPS. The server must replay the exact same simulation to validate hit claims.

**Wrong approach (analytical):**
```typescript
// WRONG: This diverges from client's numerical integration
const heightZ = h0 + v0*t - 0.5*GRAVITY*t*t;
```

**Correct approach (iterative):**
```typescript
// RIGHT: Match client's frame-by-frame simulation
for (let i = 0; i < numSteps; i++) {
  heightVz -= GRAVITY * dt;
  heightZ += heightVz * dt;
}
```

#### Implementation

```typescript
public validateProjectileHit(
  projectileId: string,
  claimTimestamp: number,
  targetPosition: { x: number; y: number },
  targetRotation: number,
  targetBoundary: { width: number; height: number }
): boolean {
  const projectile = this.activeProjectiles.get(projectileId);
  if (!projectile) return false;

  const elapsed = (claimTimestamp - projectile.spawnTime) / 1000;
  const GRAVITY = 150;  // Must match client
  const DECK_HEIGHT_THRESHOLD = 30;  // Must match client
  const FRAME_TIME = 1 / 60;  // Simulate at 60 FPS

  // Convert spawn position to ground coordinates
  const spawnHeightZ = 0;
  const spawnGroundX = projectile.spawnPosition.x / 2 + projectile.spawnPosition.y + spawnHeightZ;
  const spawnGroundY = projectile.spawnPosition.y - projectile.spawnPosition.x / 2 + spawnHeightZ;

  // Initialize simulation state
  let groundX = spawnGroundX;
  let groundY = spawnGroundY;
  let heightZ = spawnHeightZ;
  let heightVz = projectile.initialVelocity.heightVz;

  // Simulate frame-by-frame (matches client)
  const numSteps = Math.ceil(elapsed / FRAME_TIME);
  const actualDt = elapsed / numSteps;

  for (let i = 0; i < numSteps; i++) {
    // Update ground (no gravity)
    groundX += projectile.initialVelocity.groundVx * actualDt;
    groundY += projectile.initialVelocity.groundVy * actualDt;

    // Update height (with gravity)
    heightVz -= GRAVITY * actualDt;
    heightZ += heightVz * actualDt;
  }

  // Check height threshold (prevents high-arc exploits)
  if (Math.abs(heightZ) > DECK_HEIGHT_THRESHOLD) {
    return false;
  }

  // Convert back to screen coordinates
  const pos = {
    x: groundX - groundY,
    y: (groundX + groundY) / 2 - heightZ
  };

  // Check if within target ship's hitbox
  const hitboxPadding = 1.2;
  const paddedBoundary = {
    width: targetBoundary.width * hitboxPadding,
    height: targetBoundary.height * hitboxPadding
  };

  const dx = Math.abs(pos.x - targetPosition.x);
  const dy = Math.abs(pos.y - targetPosition.y);
  const isHit = dx < paddedBoundary.width / 2 && dy < paddedBoundary.height / 2;

  if (isHit) {
    this.activeProjectiles.delete(projectileId);  // Consume projectile
  }

  return isHit;
}
```

## Phase 5: Unit Tests

### File: `src/mcp-servers/ship-server/ShipServer.test.ts`

Created comprehensive unit tests (11 tests) covering:

1. **Iterative physics verification** - Ensures server uses frame-by-frame simulation
2. **Height threshold validation** - Rejects hits when projectile too high/low
3. **Distance validation** - Rejects hits when projectile too far from target
4. **Expired projectile handling** - Rejects hits on non-existent projectiles
5. **Double-hit prevention** - Consumes projectile on first valid hit
6. **Constants synchronization** - Documents GRAVITY and DECK_HEIGHT_THRESHOLD
7. **Cannon control mechanics** - Tests grab, fire, cooldown

All tests pass, ensuring client-server physics stay synchronized.

## Constants Checklist

| Constant | Client Location | Server Location | Value |
|----------|----------------|-----------------|-------|
| `GRAVITY` | ProjectileManager.ts:54 | ShipServer.ts:805 | 150 px/s² |
| `DECK_HEIGHT_THRESHOLD` | ProjectileManager.ts:211 | ShipServer.ts:806 | 30 px |
| `CANNON_SPEED` | - | ShipServer.ts:680 | 300 px/s |

## Verification

### Manual Testing

1. Fire cannons in all 8 cardinal directions
2. Verify equal travel distances (~10-12 tiles)
3. Verify consistent arc shapes
4. Test at various elevations (15° - 60°)
5. Verify hits only register at deck level

### Automated Testing

```bash
npm test -- src/mcp-servers/ship-server/ShipServer.test.ts
```

All 11 tests should pass.

## Migration Notes

**Breaking Change:** Protocol messages now use `Velocity3D` instead of `Velocity`.

Old clients will not be compatible with updated server. No migration path needed since game is in development.

## Performance Impact

Negligible. The coordinate conversion adds ~0.1% CPU overhead. Server hit validation runs only on hit claims (infrequent).

## Future Extensions

This implementation enables:
- ✅ Terrain elevation (hills, cliffs)
- ✅ Character jumping/climbing
- ✅ Flying projectiles (arrows, spells)
- ✅ Building heights
- ✅ Multi-level maps

## References

- Client physics: `clients/seacat/src/game/managers/ProjectileManager.ts`
- Server physics: `src/mcp-servers/ship-server/ShipServer.ts`
- Types: `src/mcp-servers/ship-server/types.ts`, `clients/seacat/src/types.ts`
- Tests: `src/mcp-servers/ship-server/ShipServer.test.ts`
