# Client-Side Projectile Lifecycle: Data and Visual Representation

## Overview

This document provides an in-depth analysis of how projectiles are managed on the client side, covering both the data state and visual representation throughout their complete lifecycle from spawn to despawn.

## Data Structures

### Projectile Data Structure

**Definition:** `clients/seacat/src/types.ts:157-174`

```typescript
export interface Projectile {
  id: string;                          // Unique identifier (e.g., "ship1-port-0-1234567890")
  sprite: Phaser.GameObjects.Arc;      // Visual representation (Phaser circle object)

  // Ground position and velocity (horizontal movement on isometric map)
  groundX: number;      // Current ground X coordinate
  groundY: number;      // Current ground Y coordinate
  groundVx: number;     // Ground X velocity (px/s)
  groundVy: number;     // Ground Y velocity (px/s)

  // Height position and velocity (vertical elevation in 3D space)
  heightZ: number;      // Height above ground (0 = water/ground level)
  heightVz: number;     // Vertical velocity (positive = upward)

  spawnTime: number;    // Timestamp of spawn (for age calculation)
  sourceShip: string;   // ID of ship that fired this projectile
  minFlightTime: number; // Grace period before water collision (200ms)
}
```

**Storage:** Projectiles are stored in a `Map<string, Projectile>` in `GameScene.ts:40`

```typescript
private projectiles: Map<string, Projectile> = new Map();
```

**Key Design:**
- **Data and visual tightly coupled:** Each projectile data object contains a direct reference to its sprite
- **3D physics state:** Ground position/velocity and height position/velocity are stored separately
- **Self-contained:** All information needed to simulate the projectile is in one object

## Complete Lifecycle

### Phase 1: Network Event Reception

**Trigger:** Ship server broadcasts `game/projectile_spawn` message to all participants

**Location:** `clients/seacat/src/game/network/NetworkClient.ts:154-156`

```typescript
} else if (envelope.kind === 'game/projectile_spawn') {
  // c5x-ship-combat Phase 2: Handle projectile spawn
  this.projectileManager.spawnProjectile(envelope.payload);
}
```

**Payload Structure:**
```typescript
{
  id: string;              // "ship1-port-0-1234567890"
  position: { x, y };      // Screen coordinates of spawn point
  velocity: {              // 3D velocity components
    groundVx: number;
    groundVy: number;
    heightVz: number;
  };
  timestamp: number;       // Server spawn timestamp
  sourceShip: string;      // "ship1"
}
```

### Phase 2: Spawn - Creating Data and Visual

**Location:** `clients/seacat/src/game/managers/ProjectileManager.ts:79-143`

#### Step 2.1: Idempotency Check

```typescript
if (this.projectiles.has(id)) {
  console.log(`Projectile ${id} already exists, ignoring duplicate spawn`);
  return;
}
```

**Why:** Multiple clients may receive the same spawn event. Prevents duplicate projectiles.

#### Step 2.2: Coordinate Transformation

```typescript
// Convert spawn position to ground coordinates (inverse isometric transform)
const spawnHeightZ = 0; // Cannons fire from deck level
const spawnGroundX = position.x / 2 + position.y + spawnHeightZ;
const spawnGroundY = position.y - position.x / 2 + spawnHeightZ;
```

**Why:** Server sends screen coordinates, but physics simulation needs ground coordinates.

**Formula:**
- Forward: `screenX = groundX - groundY, screenY = (groundX + groundY) / 2 - heightZ`
- Inverse: `groundX = screenX/2 + screenY + heightZ, groundY = screenY - screenX/2 + heightZ`

#### Step 2.3: Create Visual Sprite

```typescript
const sprite = this.scene.add.circle(
  position.x,          // Initial screen X
  position.y,          // Initial screen Y
  4,                   // Radius = 4px (8px diameter)
  0x222222,            // Dark gray/black color
  1.0                  // Full opacity
);
sprite.setDepth(100);  // Render above ships and players
```

**Visual Properties:**
- Type: `Phaser.GameObjects.Arc` (circle shape)
- Size: 8px diameter (4px radius)
- Color: Dark gray (#222222)
- Depth: 100 (above ships at depth 0-10)
- Created immediately at spawn position

#### Step 2.4: Create Data Object

```typescript
const projectile: Projectile = {
  id,
  sprite,                // Direct reference to visual

  // Initialize ground position and velocity
  groundX: spawnGroundX,
  groundY: spawnGroundY,
  groundVx: velocity.groundVx,
  groundVy: velocity.groundVy,

  // Initialize height position and velocity
  heightZ: spawnHeightZ,   // 0 at spawn
  heightVz: velocity.heightVz,

  spawnTime: timestamp,
  sourceShip,
  minFlightTime: 200,      // 200ms grace period
};

this.projectiles.set(id, projectile);
```

**Data-Visual Link:** The `sprite` property creates a direct reference from data to visual representation.

#### Step 2.5: Spawn Effects and Audio

```typescript
// Play cannon fire sound
this.sounds?.cannonFire?.play();

// Camera shake if local player on firing ship
if (sourceShip === this.getOnShip()) {
  this.scene.cameras.main.shake(100, 0.005);
}

// Show cannon blast effect at spawn position
this.effectsRenderer.createCannonBlast(position.x, position.y);
```

**Blast Effect Details** (`EffectsRenderer.ts:40-77`):
- Orange flash circle (15px radius, fades to alpha 0, scales to 2x over 150ms)
- 5 smoke puffs expanding radially (gray circles, fade over 500ms)
- All effect sprites auto-destroy after animation completes

### Phase 3: Active Simulation Loop

**Trigger:** this.projectileManager.updateProjectiles(delta, this.ships) Called every frame from `GameScene.update()`

**Location:** `clients/seacat/src/game/managers/ProjectileManager.ts:150-283`

#### Step 3.1: Lifetime Check

```typescript
const age = Date.now() - proj.spawnTime;
if (age > this.LIFETIME) {  // 2000ms
  proj.sprite.destroy();
  this.projectiles.delete(id);
  return;
}
```

**Safety Net:** Ensures projectiles don't persist forever (max 2 seconds).

#### Step 3.2: Physics Simulation (3D)

```typescript
const deltaS = delta / 1000; // Convert ms to seconds

// Update ground position (no gravity - only horizontal movement)
proj.groundX += proj.groundVx * deltaS;
proj.groundY += proj.groundVy * deltaS;

// Update height (with gravity - only affects vertical component)
proj.heightVz -= this.GRAVITY * deltaS;  // Gravity = 150 px/s²
proj.heightZ += proj.heightVz * deltaS;
```

**Physics Model:**
- **Ground:** Simple linear motion (velocity constant)
- **Height:** Ballistic motion with gravity
  - Sign convention: `heightVz > 0` = upward
  - Gravity subtracts from `heightVz` (decelerates upward, accelerates downward)
  - Standard Euler integration

**Why Separate?**
- Eliminates direction-dependent trajectory bugs
- Allows independent ground movement and vertical arc
- Matches real-world ballistics

#### Step 3.3: Visual Update (Screen Projection)

```typescript
// Convert ground position + height to screen coordinates
const screenX = proj.groundX - proj.groundY;
const screenY = (proj.groundX + proj.groundY) / 2 - proj.heightZ;

proj.sprite.x = screenX;
proj.sprite.y = screenY;
```

**Data → Visual Flow:**
1. Physics updates data state (groundX, groundY, heightZ)
2. Isometric projection converts 3D → 2D screen coords
3. Sprite position directly updated
4. Phaser renders sprite at new position

**Frame Rate:** Updates at game loop rate (~60 FPS)

#### Step 3.4: Trail Effect Rendering

```typescript
if (Math.random() < 0.3) {  // 30% chance per frame (~18 puffs/sec at 60fps)
  const trail = this.scene.add.circle(
    proj.sprite.x,
    proj.sprite.y,
    3,            // 3px radius
    0x888888,     // Medium gray
    0.5           // 50% opacity
  );
  trail.setDepth(100);

  this.scene.tweens.add({
    targets: trail,
    alpha: 0,
    scale: 1.5,
    duration: 300,  // 300ms fade
    ease: 'Cubic.easeOut',
    onComplete: () => trail.destroy()
  });
}
```

**Trail Lifecycle:**
- Created as separate sprite (not part of projectile data)
- Left behind at current projectile position
- Fades out over 300ms then auto-destroys
- No data tracking - purely visual effect managed by Phaser tween

### Phase 4: Collision Detection

#### Collision Type A: Ship Hit

**Location:** `ProjectileManager.ts:203-253`

**Conditions:**
1. Not source ship: `ship.id !== proj.sourceShip`
2. At deck height: `abs(proj.heightZ) <= 30px`
3. Inside ship OBB: `isPointInRotatedRect()` with 20% padding

**On Hit:**

```typescript
// 1. Create visual effect (client prediction)
this.effectsRenderer.createHitEffect(proj.sprite.x, proj.sprite.y);

// 2. Play sound
this.sounds?.hitImpact?.play();

// 3. Send hit claim to server
this.shipCommands.sendProjectileHitClaim(
  ship.id, proj.id, Date.now(),
  ship.sprite.x, ship.sprite.y,
  ship.rotation, ship.deckBoundary
);

// 4. Despawn projectile
proj.sprite.destroy();           // Destroy visual
this.projectiles.delete(id);     // Remove data
```

**Hit Effect Details** (`EffectsRenderer.ts:167-187`):
- 30 brown particles (wood splinters)
- Radial burst pattern
- Each particle flies outward with rotation
- Fades over 800ms then auto-destroys

**Despawn Flow:**
1. **Visual first:** `proj.sprite.destroy()` removes from Phaser scene
2. **Data second:** `this.projectiles.delete(id)` removes from map
3. No cleanup needed - Phaser handles sprite memory

#### Collision Type B: Water Impact

**Location:** `ProjectileManager.ts:257-281`

**Conditions:**
1. Past grace period: `age > 200ms`
2. Descending: `heightVz < 0`
3. Over water tile: `tile.properties.navigable === true`
4. At/below surface: `heightZ <= 0`

**On Impact:**

```typescript
// 1. Create water splash effect
this.effectsRenderer.createWaterSplash(proj.sprite.x, proj.sprite.y);

// 2. Play sound
this.sounds?.waterSplash?.play();

// 3. Despawn projectile
proj.sprite.destroy();
this.projectiles.delete(id);
```

**Splash Effect Details** (`EffectsRenderer.ts:83-120`):
- 8 blue particles (water droplets)
- Fountain/radial pattern
- Particles fly outward and upward
- Fade over 800ms then auto-destroy

**Grace Period Why:**
- Prevents instant despawn from deck-level shots
- Cannonballs spawn at heightZ=0 (water level)
- Without grace period, downward shots would immediately trigger water collision

### Phase 5: Despawn Scenarios

#### Scenario 1: Ship Hit (Active Collision)

```
Data State:     [TRACKED] → [DELETED]
Visual State:   [RENDERED] → sprite.destroy() → [REMOVED FROM SCENE]
Effects:        Hit effect created (30 wood particles)
Sound:          Hit impact sound plays
Network:        Hit claim sent to server
Reason:         Collision with ship detected
```

#### Scenario 2: Water Impact (Active Collision)

```
Data State:     [TRACKED] → [DELETED]
Visual State:   [RENDERED] → sprite.destroy() → [REMOVED FROM SCENE]
Effects:        Water splash created (8 blue particles)
Sound:          Water splash sound plays
Network:        No message (client-only detection)
Reason:         Hit water surface
```

#### Scenario 3: Lifetime Expiry (Safety Net)

```
Data State:     [TRACKED] → [DELETED]
Visual State:   [RENDERED] → sprite.destroy() → [REMOVED FROM SCENE]
Effects:        None
Sound:          None
Network:        None
Reason:         Age > 2000ms (safety timeout)
```

## Data-Visual Relationship

### Coupling

**Tight Coupling:**
- Each `Projectile` data object has a `sprite` property
- Direct reference to visual representation
- No lookup needed - data → visual is O(1)

**Lifecycle Synchronization:**
- Created together in `spawnProjectile()`
- Updated together in `updateProjectiles()` (data physics → sprite position)
- Destroyed together in despawn scenarios

### State Flow

```
SERVER SPAWN EVENT
       ↓
[NetworkClient receives]
       ↓
[ProjectileManager.spawnProjectile()]
       ↓
   ┌───────────────────────┐
   │  CREATE DATA OBJECT   │
   │  - groundX, groundY   │
   │  - groundVx, groundVy │
   │  - heightZ, heightVz  │
   └───────────────────────┘
       ↓
   ┌───────────────────────┐
   │  CREATE VISUAL SPRITE │
   │  - Phaser.Arc circle  │
   │  - 8px diameter       │
   │  - depth 100          │
   └───────────────────────┘
       ↓
   [Link: data.sprite = visual]
       ↓
   [Add to projectiles map]
       ↓
───────────────────────────────
   EVERY FRAME (60 FPS)
───────────────────────────────
       ↓
[ProjectileManager.updateProjectiles()]
       ↓
[For each projectile in map:]
       ↓
   ┌───────────────────────┐
   │  UPDATE DATA STATE    │
   │  - groundX += groundVx*dt  │
   │  - groundY += groundVy*dt  │
   │  - heightVz -= GRAVITY*dt  │
   │  - heightZ += heightVz*dt  │
   └───────────────────────┘
       ↓
   ┌───────────────────────┐
   │  PROJECT TO SCREEN    │
   │  screenX = groundX - groundY    │
   │  screenY = (gX+gY)/2 - heightZ  │
   └───────────────────────┘
       ↓
   ┌───────────────────────┐
   │  UPDATE VISUAL        │
   │  sprite.x = screenX   │
   │  sprite.y = screenY   │
   └───────────────────────┘
       ↓
   [Phaser renders sprite]
       ↓
───────────────────────────────
   COLLISION OR TIMEOUT
───────────────────────────────
       ↓
   ┌───────────────────────┐
   │  DESTROY VISUAL       │
   │  sprite.destroy()     │
   └───────────────────────┘
       ↓
   ┌───────────────────────┐
   │  REMOVE DATA          │
   │  projectiles.delete() │
   └───────────────────────┘
       ↓
   [Lifecycle complete]
```

## Visual Effects Management

### Projectile Sprite

**Ownership:** ProjectileManager via `projectile.sprite`
**Lifecycle:** Created at spawn, destroyed at despawn
**Updates:** Every frame (position updated based on physics)

### Transient Effects (Blast, Impact, Splash, Trail)

**Ownership:** EffectsRenderer creates, Phaser tweens manage
**Lifecycle:**
- Created on-demand
- No data structure tracking
- Self-destruct via tween `onComplete` callback
- Typically 150-800ms lifespan

**Memory Management:**
- Phaser handles sprite pooling/cleanup
- `destroy()` removes from scene and frees resources
- No manual memory management needed

### Trail Puffs

**Special Case:**
- Created probabilistically (30% chance per frame)
- Independent sprites, not linked to projectile data
- Left behind as projectile moves (create-and-forget)
- Auto-cleanup via tween

## Performance Considerations

### Data Structure Choice

**Map<string, Projectile>:**
- ✅ O(1) lookup by ID (for idempotency checks)
- ✅ O(1) deletion (for despawn)
- ✅ Efficient iteration (forEach in update loop)
- ✅ No array shifting on deletion

### Update Loop Optimization

**Current:** Iterates all projectiles every frame
**Scalability:**
- 10 projectiles = negligible
- 100 projectiles = 6000 updates/second at 60fps (still fine)
- Projectiles typically last < 2 seconds

**No Optimization Needed:**
- Projectile count stays low (1-10 active typically)
- Physics math is simple (add/multiply)
- No spatial partitioning needed

### Visual Memory

**Sprite Creation:**
- Each projectile = 1 sprite (8px circle)
- Trail puffs = transient (300ms lifespan)
- Effects = transient (150-800ms lifespan)

**No Pooling:**
- Simple create/destroy pattern
- Phaser handles WebGL batching
- Short-lived objects (GC handles cleanup)

## Summary

The client-side projectile lifecycle demonstrates a **tight data-visual coupling** with **simple, direct state management**:

1. **Spawn:** Server event → create data object + sprite simultaneously
2. **Simulate:** Update data physics → project to screen → update sprite position
3. **Despawn:** Destroy sprite → delete data → effects cleanup automatic

**Key Strengths:**
- Simple mental model (data contains sprite reference)
- No synchronization bugs (updated together)
- Efficient performance (Map for storage, direct updates)
- Clean lifecycle (create together, destroy together)

**Design Pattern:** Active Record with embedded visual state
- Data object actively manages its own visual representation
- No separation of concerns needed (lifecycle is identical)
- Works well for short-lived, independent entities
