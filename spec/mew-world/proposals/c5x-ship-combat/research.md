# Ship Combat Research (c5x-ship-combat)

## Technical Deep Dives

### 1. Projectile Physics Simulation

#### Deterministic Client-Side Simulation

For multiplayer consistency, all clients must simulate identical physics:

```typescript
class Cannonball {
  position: {x: number, y: number};
  velocity: {x: number, y: number};
  spawnTime: number;
  sourceShip: string;

  update(deltaMs: number) {
    const deltaSec = deltaMs / 1000;

    // Apply gravity
    this.velocity.y += PROJECTILE_GRAVITY * deltaSec;

    // Update position
    this.position.x += this.velocity.x * deltaSec;
    this.position.y += this.velocity.y * deltaSec;
  }

  shouldDespawn(currentTime: number): boolean {
    return (currentTime - this.spawnTime) > PROJECTILE_LIFETIME;
  }
}
```

**Key insight**: Using fixed constants (gravity, speed) ensures all clients see same trajectory given same spawn parameters.

#### Spawn Parameters Calculation

When firing, ship server calculates:

```typescript
function calculateProjectileSpawn(
  shipState: ShipState,
  cannon: CannonState
): ProjectileSpawn {
  // 1. Get cannon world position (rotated by ship angle)
  const cannonWorld = rotatePointIsometric(
    cannon.relativePosition,
    shipState.rotation
  );
  const spawnPos = {
    x: shipState.position.x + cannonWorld.x,
    y: shipState.position.y + cannonWorld.y
  };

  // 2. Calculate fire direction (ship rotation + cannon aim)
  const fireAngle = shipState.rotation + cannon.aimAngle;

  // 3. Add ship velocity to projectile (inherit momentum)
  const projectileVel = {
    x: Math.cos(fireAngle) * PROJECTILE_SPEED + shipState.velocity.x,
    y: Math.sin(fireAngle) * PROJECTILE_SPEED + shipState.velocity.y
  };

  return {
    position: spawnPos,
    velocity: projectileVel,
    timestamp: Date.now()
  };
}
```

**Key insight**: Inheriting ship velocity makes physics feel realistic (moving platforms).

### 2. Hit Detection System

#### Client-Side Prediction

Each client checks for hits locally:

```typescript
function checkProjectileHit(
  projectile: Cannonball,
  ships: Map<string, Ship>
): {ship: Ship, hitPos: {x, y}} | null {
  for (const [shipId, ship] of ships) {
    // Skip source ship (can't hit yourself)
    if (shipId === projectile.sourceShip) continue;

    // Use OBB collision with padding
    const hitboxSize = {
      width: ship.deckBoundary.width * HITBOX_PADDING,
      height: ship.deckBoundary.height * HITBOX_PADDING
    };

    if (isPointInRotatedRect(
      projectile.position,
      ship.sprite.position,
      hitboxSize,
      ship.rotation
    )) {
      return {ship, hitPos: {...projectile.position}};
    }
  }
  return null;
}
```

**Key insight**: Clients predict hits for instant visual feedback, but ship server validates.

#### Server-Side Validation

Ship server receives hit claims from clients:

```typescript
// Client sends:
{
  kind: 'game/projectile_hit_claim',
  to: ['targetShip'],
  payload: {
    projectileId: string,
    claimedDamage: number,
    timestamp: number
  }
}

// Ship validates:
function validateHit(claim: HitClaim): boolean {
  // 1. Check projectile exists and hasn't hit yet
  const projectile = this.activeProjectiles.get(claim.projectileId);
  if (!projectile || projectile.hasHit) return false;

  // 2. Replay physics from spawn to claim timestamp
  const simulatedPos = replayProjectile(projectile, claim.timestamp);

  // 3. Check if simulated position is within hitbox
  const hit = isPointInRotatedRect(
    simulatedPos,
    this.state.position,
    this.state.deckBoundary,
    this.state.rotation
  );

  return hit;
}
```

**Key insight**: Server replays deterministic physics to validate. Prevents cheating while allowing client prediction.

### 3. Network Synchronization

#### Message Flow

```
Player → Ship (fire_cannon)
  ↓
Ship simulates, broadcasts projectile_spawn
  ↓
All clients render projectile, simulate physics
  ↓
Client detects hit, shows effects immediately
  ↓
Client sends projectile_hit_claim to target ship
  ↓
Target ship validates, broadcasts ship/damage
  ↓
All clients update ship health
```

**Key insight**: Layered authority - ship authoritative for spawning, target authoritative for damage.

#### Bandwidth Analysis

Per cannon shot:
- `ship/fire_cannon`: ~50 bytes (player ID, cannon index)
- `game/projectile_spawn`: ~100 bytes (ID, position, velocity, timestamp)
- `game/projectile_hit_claim`: ~60 bytes (projectile ID, damage)
- `ship/damage`: ~80 bytes (ship ID, health, timestamp)

Total: ~290 bytes per shot. With 4-second cooldown, max 0.25 shots/sec = **72 bytes/sec per cannon**.

With 2 ships × 4 cannons = 8 cannons max = **576 bytes/sec** worst case.

**Verdict**: Negligible bandwidth impact.

### 4. Collision Math: OBB vs AABB

Current game uses OBB (Oriented Bounding Box) for ship deck collision. Should projectiles use same?

#### Option A: Point vs OBB (Current approach)

```typescript
function pointInOBB(
  point: {x, y},
  rectCenter: {x, y},
  rectSize: {width, height},
  rotation: number
): boolean {
  // Transform point to rect's local space
  const localPos = rotatePointIsometric(
    {x: point.x - rectCenter.x, y: point.y - rectCenter.y},
    -rotation
  );

  // Check against axis-aligned rect
  return Math.abs(localPos.x) <= rectSize.width / 2 &&
         Math.abs(localPos.y) <= rectSize.height / 2;
}
```

**Complexity**: O(1), ~10 floating point ops
**Pros**: Reuses existing collision code
**Cons**: Slightly more expensive than AABB

#### Option B: Point vs AABB (Simpler)

```typescript
function pointInAABB(
  point: {x, y},
  ship: Ship
): boolean {
  // Calculate axis-aligned bounds
  const minX = ship.x - ship.width / 2;
  const maxX = ship.x + ship.width / 2;
  const minY = ship.y - ship.height / 2;
  const maxY = ship.y + ship.height / 2;

  return point.x >= minX && point.x <= maxX &&
         point.y >= minY && point.y <= maxY;
}
```

**Complexity**: O(1), ~4 floating point ops
**Pros**: 2.5x faster
**Cons**: Less accurate for rotated ships

**Decision**: Use OBB. Ships rotate frequently, AABB would cause misses on diagonal ships. Performance difference negligible (checking 2-4 ships max).

### 5. Particle Effects System

#### Effect Types

1. **Cannon Blast** (at cannon position)
   - Smoke puff (gray particles, expand + fade)
   - Flash (white circle, instant fade)
   - Duration: 500ms

2. **Projectile Trail** (follows cannonball)
   - Small smoke puffs every 50ms
   - Duration: 200ms each

3. **Water Splash** (miss impact)
   - Blue particles shoot upward
   - Gravity pulls back down
   - Duration: 800ms

4. **Hit Impact** (ship hit)
   - Wood splinters (brown, angular particles)
   - Smoke burst (gray, radial)
   - Duration: 1000ms

5. **Damage Smoke** (damaged ship, persistent)
   - Gray smoke rises from damaged ship
   - Continuous emitter while health < 50%
   - Intensity increases as health decreases

#### Phaser Implementation

```typescript
class CannonEffects {
  scene: Phaser.Scene;

  fireBlast(x: number, y: number) {
    // Flash
    const flash = this.scene.add.circle(x, y, 20, 0xffff00, 0.8);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 100,
      onComplete: () => flash.destroy()
    });

    // Smoke
    const particles = this.scene.add.particles('smoke');
    const emitter = particles.createEmitter({
      x, y,
      speed: {min: 50, max: 100},
      angle: {min: -30, max: 30},
      scale: {start: 0.5, end: 1.5},
      alpha: {start: 0.8, end: 0},
      lifespan: 500,
      quantity: 10
    });
    emitter.explode();

    // Cleanup
    this.scene.time.delayedCall(500, () => particles.destroy());
  }

  hitImpact(x: number, y: number) {
    // Splinters
    const splinters = this.scene.add.particles('splinter');
    const splinterEmitter = splinters.createEmitter({
      x, y,
      speed: {min: 100, max: 200},
      angle: {min: 0, max: 360},
      scale: {start: 0.3, end: 0.1},
      alpha: {start: 1, end: 0},
      lifespan: 800,
      gravityY: 100,
      quantity: 20
    });
    splinterEmitter.explode();

    // Smoke burst
    const smoke = this.scene.add.particles('smoke');
    const smokeEmitter = smoke.createEmitter({
      x, y,
      speed: {min: 30, max: 80},
      angle: {min: 0, max: 360},
      scale: {start: 0.8, end: 2},
      alpha: {start: 0.9, end: 0},
      lifespan: 1000,
      quantity: 15
    });
    smokeEmitter.explode();

    // Cleanup
    this.scene.time.delayedCall(1000, () => {
      splinters.destroy();
      smoke.destroy();
    });
  }
}
```

**Key insight**: Use Phaser's particle system for effects, with delayed cleanup to avoid memory leaks.

### 6. Performance Optimization Strategies

#### Spatial Partitioning

For many ships (future scalability):

```typescript
class SpatialGrid {
  cellSize: number = 200; // pixels
  grid: Map<string, Ship[]> = new Map();

  getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  getNearbyShips(projectile: Cannonball): Ship[] {
    const cellKey = this.getCellKey(projectile.position.x, projectile.position.y);
    return this.grid.get(cellKey) || [];
  }
}
```

**Benefit**: O(1) collision checks instead of O(n) when many ships.
**When needed**: >10 ships in same space.

#### Object Pooling

Reuse projectile/particle objects:

```typescript
class ProjectilePool {
  available: Cannonball[] = [];
  active: Cannonball[] = [];

  spawn(params: ProjectileSpawn): Cannonball {
    let projectile = this.available.pop();
    if (!projectile) {
      projectile = new Cannonball();
    }

    projectile.reset(params);
    this.active.push(projectile);
    return projectile;
  }

  despawn(projectile: Cannonball) {
    const index = this.active.indexOf(projectile);
    if (index >= 0) {
      this.active.splice(index, 1);
      this.available.push(projectile);
    }
  }
}
```

**Benefit**: Avoid GC pressure from frequent spawn/despawn.
**When needed**: High fire rate gameplay (>20 projectiles/sec).

## Comparative Analysis

### Similar Games

#### Sea of Thieves
- Manual aiming with arc indicator
- Physics-based projectiles with drop
- Cooperative crew required for large ships
- **Lesson**: Arc preview essential for usability

#### Sid Meier's Pirates!
- Simple broadside firing (no aim)
- Turn-based positioning
- Health bar with visible damage
- **Lesson**: Clear health feedback crucial

#### Assassin's Creed IV: Black Flag
- Auto-aim within cone
- Quick reload for arcade feel
- Ship upgrades for progression
- **Lesson**: Balance realism vs fun

### Key Takeaways

1. **Arc preview**: Essential for player feedback (all successful games have it)
2. **Reload time**: 3-5 seconds is sweet spot (AC4: 3s, SoT: 5s)
3. **Health display**: Always visible (all games show it)
4. **Cooperative crews**: Requires voice/text comms to be fun
5. **Physics vs arcade**: Hybrid works best (slight drop, but forgiving hitboxes)

## Risk Assessment

### High Risk
1. **Network desync**: Projectiles appear different on each client
   - **Mitigation**: Deterministic physics, timestamp validation
   - **Contingency**: Server-authoritative mode (higher latency)

2. **Hit registration feels unfair**: Lag causes perceived misses/hits
   - **Mitigation**: Client prediction + generous hitboxes
   - **Contingency**: Replay system to verify controversial hits

### Medium Risk
3. **Balance issues**: Combat too fast/slow/easy/hard
   - **Mitigation**: Extensive playtesting with tunable parameters
   - **Contingency**: Hot-reload balance config without code changes

4. **Performance**: Too many particles/projectiles tank framerate
   - **Mitigation**: Particle limits, object pooling, LOD system
   - **Contingency**: Quality settings to disable effects

### Low Risk
5. **Griefing**: Players spam cannons at spawn point
   - **Mitigation**: Spawn immunity (3 seconds), safe zones
   - **Contingency**: Admin tools to kick/ban griefers

## Next Steps

1. **Create decision document** after reviewing this research
2. **Build prototype** of core firing mechanic (Phase 1)
3. **Playtest** aim controls for feel
4. **Iterate** on physics parameters
5. **Implement** full system following proposal phases
