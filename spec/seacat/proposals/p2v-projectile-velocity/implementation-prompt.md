# Implementation Prompt: True 3D Isometric Projectile Physics

## Context

You are implementing a refactor to fix cannon trajectory bugs in the seacat game (an isometric multiplayer sailing game). Currently, cannons fire inconsistently: south-facing shots travel 3 tiles while north-facing shots travel 20+ tiles. This is caused by mixing 2D screen coordinates with 3D ballistic physics.

**Read the full problem analysis and decision here:**
`spec/seacat/proposals/p2v-projectile-velocity/decision-p2v-projectile-velocity.md`

**Decision:** Implement Option 2 (True 3D Isometric Physics) - Separate ground position from height in the physics simulation.

---

## Goal

Refactor projectile physics to properly separate:
1. **Ground position** (groundX, groundY) - horizontal movement on the isometric map
2. **Height** (heightZ) - vertical elevation affected by gravity

This ensures cannons fire with equal ground distances in all directions (north/south/east/west), with consistent ballistic arcs.

---

## Mathematical Foundation

### Isometric Coordinate Conversion

**Isometric to Screen:**
```
screenX = groundX - groundY
screenY = (groundX + groundY) / 2 - heightZ
```

**Screen to Isometric (inverse):**
```
groundX = screenX + 2 * screenY
groundY = -screenX + 2 * screenY
```

### Screen Angle to Ground Azimuth

Given a screen-space `fireAngle` (0°=east, 90°=south, 180°=west, 270°=north), convert to ground-space azimuth:

```typescript
const cos_fire = Math.cos(fireAngle);
const sin_fire = Math.sin(fireAngle);

// Unnormalized ground direction
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

### 3D Ballistic Velocity

```typescript
// Given elevation angle (e.g., 30°)
const CANNON_SPEED = 300; // px/s total muzzle velocity
const elevation = cannon.elevationAngle;

// Split into horizontal and vertical components
const horizontalSpeed = CANNON_SPEED * Math.cos(elevation);
const verticalSpeed = CANNON_SPEED * Math.sin(elevation);

// Calculate 3D velocity in ground-space
const groundVx = horizontalSpeed * cos_azimuth;
const groundVy = horizontalSpeed * sin_azimuth;
const heightVz = -verticalSpeed;  // Negative = upward (screen Y increases downward)
```

---

## Implementation Steps

### Step 1: Update Server - Velocity Calculation

**File:** `src/mcp-servers/ship-server/ShipServer.ts`
**Location:** `fireCannon()` method, around line 689

**Current code (WRONG):**
```typescript
const vel: Velocity = {
  x: Math.cos(fireAngle) * horizontalSpeed + this.state.velocity.x,
  y: Math.sin(fireAngle) * horizontalSpeed * ISO_Y_SCALE - verticalComponent + this.state.velocity.y,
};
```

**New code:**
```typescript
// Convert screen-space fireAngle to ground-space azimuth
const cos_fire = Math.cos(fireAngle);
const sin_fire = Math.sin(fireAngle);
const cos_azimuth_unnorm = cos_fire + 2 * sin_fire;
const sin_azimuth_unnorm = 2 * sin_fire - cos_fire;
const azimuth_norm = Math.sqrt(
  cos_azimuth_unnorm * cos_azimuth_unnorm +
  sin_azimuth_unnorm * sin_azimuth_unnorm
);
const cos_azimuth = cos_azimuth_unnorm / azimuth_norm;
const sin_azimuth = sin_azimuth_unnorm / azimuth_norm;

// Calculate 3D velocity in ground-space
const groundVx = horizontalSpeed * cos_azimuth;
const groundVy = horizontalSpeed * sin_azimuth;
const heightVz = -verticalComponent;  // Negative = upward in screen space

// Inherit ship's ground velocity (moving platform physics)
const vel = {
  groundVx: groundVx + this.state.velocity.x,
  groundVy: groundVy + this.state.velocity.y,
  heightVz: heightVz,
};

console.log(`[CANNON DEBUG] ========== 3D BALLISTIC VELOCITY ==========`);
console.log(`[CANNON DEBUG] Fire angle (screen): ${(fireAngle * 180 / Math.PI).toFixed(1)}°`);
console.log(`[CANNON DEBUG] Ground azimuth: ${Math.atan2(sin_azimuth, cos_azimuth) * 180 / Math.PI}°`);
console.log(`[CANNON DEBUG] Ground velocity: (${groundVx.toFixed(1)}, ${groundVy.toFixed(1)})`);
console.log(`[CANNON DEBUG] Height velocity: ${heightVz.toFixed(1)}`);
console.log(`[CANNON DEBUG] Final 3D velocity: ground(${vel.groundVx.toFixed(1)}, ${vel.groundVy.toFixed(1)}), height ${vel.heightVz.toFixed(1)}`);
```

**Note:** Remove or update ship velocity inheritance. The `this.state.velocity.x` and `.y` currently represent 2D screen velocity. You may need to refactor ship velocity to also use 3D ground coordinates. For now, you can set them to 0 if the ship is stationary during testing.

### Step 2: Update Types - Projectile Velocity

**File:** `src/mcp-servers/ship-server/types.ts`

**Current type (WRONG):**
```typescript
export interface Projectile {
  id: string;
  sourceShip: string;
  spawnTime: number;
  spawnPosition: Position;
  initialVelocity: Velocity;  // { x: number, y: number }
}
```

**New type:**
```typescript
export interface Velocity3D {
  groundVx: number;  // Ground X velocity (east/west)
  groundVy: number;  // Ground Y velocity (north/south)
  heightVz: number;  // Height velocity (up/down)
}

export interface Projectile {
  id: string;
  sourceShip: string;
  spawnTime: number;
  spawnPosition: Position;
  initialVelocity: Velocity3D;  // Changed from 2D to 3D
}
```

**Also check:** `src/types/protocol.ts` if velocity is defined there.

### Step 3: Update Client Types

**File:** `clients/seacat/src/types.ts`

**Current type (WRONG):**
```typescript
export interface Projectile {
  id: string;
  sprite: Phaser.GameObjects.GameObject;
  velocity: { x: number; y: number };
  spawnTime: number;
  sourceShip: string;
  minFlightTime: number;
}
```

**New type:**
```typescript
export interface Projectile {
  id: string;
  sprite: Phaser.GameObjects.GameObject;

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

### Step 4: Update Client - Projectile Spawning

**File:** `clients/seacat/src/game/managers/ProjectileManager.ts`
**Location:** `spawnProjectile()` method, around line 79

**Current code (WRONG):**
```typescript
const projectile: Projectile = {
  id,
  sprite,
  velocity: { ...velocity }, // Copy velocity
  spawnTime: timestamp,
  sourceShip,
  minFlightTime: 200,
};
```

**New code:**
```typescript
// Convert spawn position to ground coordinates
const spawnGroundX = (position.x + 2 * position.y);
const spawnGroundY = (-position.x + 2 * position.y);
const spawnHeightZ = 0; // Cannons fire from deck level

const projectile: Projectile = {
  id,
  sprite,

  // Initialize ground position and velocity
  groundX: spawnGroundX,
  groundY: spawnGroundY,
  groundVx: velocity.groundVx,
  groundVy: velocity.groundVy,

  // Initialize height position and velocity
  heightZ: spawnHeightZ,
  heightVz: velocity.heightVz,

  spawnTime: timestamp,
  sourceShip,
  minFlightTime: 200,
};

// Set sprite position
sprite.x = position.x;
sprite.y = position.y;

console.log(`[GameScene] Spawning projectile ${id} at ground(${spawnGroundX.toFixed(1)}, ${spawnGroundY.toFixed(1)}), height ${spawnHeightZ.toFixed(1)}`);
console.log(`  Ground velocity: (${velocity.groundVx.toFixed(1)}, ${velocity.groundVy.toFixed(1)}) px/s`);
console.log(`  Height velocity: ${velocity.heightVz.toFixed(1)} px/s`);
```

### Step 5: Update Client - Projectile Physics

**File:** `clients/seacat/src/game/managers/ProjectileManager.ts`
**Location:** `updateProjectiles()` method, around line 144

**Current code (WRONG):**
```typescript
// Apply gravity (downward acceleration)
proj.velocity.y += this.GRAVITY * deltaS;

// Update position (Euler integration)
proj.sprite.x += proj.velocity.x * deltaS;
proj.sprite.y += proj.velocity.y * deltaS;
```

**New code:**
```typescript
// Update ground position (no gravity affects ground movement!)
proj.groundX += proj.groundVx * deltaS;
proj.groundY += proj.groundVy * deltaS;

// Update height (gravity only affects height)
proj.heightVz += this.GRAVITY * deltaS;  // Gravity accelerates downward
proj.heightZ += proj.heightVz * deltaS;

// Convert ground position + height to screen coordinates for rendering
const screenX = proj.groundX - proj.groundY;
const screenY = (proj.groundX + proj.groundY) / 2 - proj.heightZ;

proj.sprite.x = screenX;
proj.sprite.y = screenY;
```

### Step 6: Update Client - Water Collision Detection

**File:** `clients/seacat/src/game/managers/ProjectileManager.ts`
**Location:** `updateProjectiles()` method, water collision check around line 219

**Current code references `proj.sprite.y` and `waterSurfaceY`. This should now use `proj.heightZ` instead:**

**New code:**
```typescript
// Check if projectile has hit the water (height <= 0)
if (age > proj.minFlightTime && proj.heightVz > 0) {  // descending
  const tilePos = this.map.worldToTileXY(proj.sprite.x, proj.sprite.y);
  if (tilePos) {
    const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));

    if (tile && tile.properties?.navigable === true) {
      // Over water - check if height has reached water surface (heightZ = 0)
      if (proj.heightZ <= 0) {
        // HIT WATER! Show splash and despawn
        this.effectsRenderer.createWaterSplash(proj.sprite.x, proj.sprite.y);
        this.sounds?.waterSplash?.play();

        proj.sprite.destroy();
        this.projectiles.delete(id);
        console.log(`[GameScene] Projectile ${id} hit water at ground(${proj.groundX.toFixed(1)}, ${proj.groundY.toFixed(1)}). Total: ${this.projectiles.size}`);
        return;
      }
    }
  }
}
```

### Step 7: Update Client - Ship Collision Detection

**File:** `clients/seacat/src/game/managers/ProjectileManager.ts`
**Location:** `updateProjectiles()` method, ship collision check around line 172

**Current code checks `proj.sprite.x/y` against ship boundaries. This should still work since `sprite.x/y` are updated to screen coordinates. However, you may want to add a height check to ensure projectiles only hit ships when at deck level (heightZ near 0):**

**Optional enhancement:**
```typescript
// Only hit ships if projectile is at deck height (within ±20px)
const DECK_HEIGHT_THRESHOLD = 20;
if (Math.abs(proj.heightZ) > DECK_HEIGHT_THRESHOLD) {
  return; // Projectile is too high or too low to hit ship
}

// Existing OBB collision check...
if (this.collisionManager.isPointInRotatedRect(...)) {
  // HIT!
  ...
}
```

---

## Testing Plan

### Test 1: Equal Distances
1. Position ship facing **east**
2. Fire **starboard** cannon (fires south)
3. Measure distance traveled before hitting water
4. Rotate ship 90° to face **north**
5. Fire **starboard** cannon (fires east)
6. **Expected:** Both shots travel approximately the same ground distance (10-12 tiles)

### Test 2: All Directions
1. Test firing in all 8 compass directions
2. **Expected:** All shots travel 10-12 tiles regardless of direction

### Test 3: Consistent Arcs
1. Fire in all directions
2. **Expected:** All trajectories have the same arc shape (rise time ≈ fall time)

### Test 4: Visual Verification
1. Fire south (bottom of diamond)
2. **Expected:** Ball arcs upward, then falls to water (NOT diving immediately)
3. Fire north (top of diamond)
4. **Expected:** Ball arcs upward, then falls to water (NOT flying off screen)

### Test 5: Ship Velocity Inheritance
1. Move ship at full speed
2. Fire cannon perpendicular to ship direction
3. **Expected:** Projectile inherits ship's ground velocity (appears to curve with ship motion)

---

## Debugging Tips

### Enable Verbose Logging
Add console logs in both server and client to trace:
- Ground position: `(groundX, groundY)`
- Height: `heightZ`
- Screen position: `(screenX, screenY)`
- Velocities at each frame

### Verify Coordinate Conversion
Add a test function to verify isometric ↔ ground conversion:
```typescript
function testCoordinateConversion() {
  const ground = { x: 100, y: 50 };
  const screen = {
    x: ground.x - ground.y,  // = 50
    y: (ground.x + ground.y) / 2  // = 75
  };

  const groundBack = {
    x: screen.x + 2 * screen.y,  // = 50 + 150 = 200? WRONG!
    y: -screen.x + 2 * screen.y  // = -50 + 150 = 100
  };

  console.assert(groundBack.x === ground.x, "X mismatch");
  console.assert(groundBack.y === ground.y, "Y mismatch");
}
```

**IMPORTANT:** Check if my inverse formula is correct! The conversion formulas may need adjustment.

### Watch for Edge Cases
- Projectiles spawning below water (heightZ < 0)
- Projectiles with NaN velocities (division by zero in normalization)
- Screen positions going out of map bounds

---

## Files to Modify

**Server:**
- `src/mcp-servers/ship-server/ShipServer.ts` (velocity calculation)
- `src/mcp-servers/ship-server/types.ts` (Projectile type)
- `src/types/protocol.ts` (if velocity is defined there)

**Client:**
- `clients/seacat/src/types.ts` (Projectile type)
- `clients/seacat/src/game/managers/ProjectileManager.ts` (spawn, update, collision)

**Optional:**
- `src/mcp-servers/ship-server/ShipServer.ts` (ship velocity to also use 3D coords)

---

## Acceptance Criteria

✅ Cannons fire equal ground distances in all directions (±10% tolerance)
✅ All trajectories have consistent arc shapes
✅ Firing south no longer immediately hits water
✅ Firing north no longer flies off screen
✅ Ship collision detection still works
✅ Water collision detection still works
✅ No console errors or NaN values
✅ Game performance is unchanged (no noticeable lag)

---

## Rollback Plan

If implementation fails or causes regressions:
1. Revert all changes
2. Implement Option 1 (Simplified 2D Ballistics) as interim fix:
   ```typescript
   const vel: Velocity = {
     x: Math.cos(fireAngle) * horizontalSpeed,
     y: -verticalComponent,  // Elevation only
   };
   ```
3. Document as known limitation
4. Revisit 3D physics in future sprint

---

## Questions Before Starting?

- Do you understand the coordinate system conversion?
- Do you have access to both server and client codebases?
- Can you test the game locally after making changes?
- Are there any existing unit tests for projectile physics?

Good luck! This is a significant refactor but will eliminate a major class of bugs. Take your time and test thoroughly at each step.
