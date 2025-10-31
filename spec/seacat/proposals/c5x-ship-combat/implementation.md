# Implementation Plan: c5x-ship-combat (Ship-to-Ship Combat)

**Proposal:** `spec/seacat/proposals/c5x-ship-combat/`
**Status:** Phase 1-4 ✅ COMPLETE, Phase 5 ⚠️ PARTIAL (visual effects ✅, audio ⏸️ Electron issue)
**Started:** 2025-01-24
**Last Updated:** 2025-01-28
**Phase 1-4 Completed:** 2025-01-27
**Phase 5 Visual Effects Completed:** 2025-01-28

---

## Status Overview

**Fully Operational (Phases 1-4):**
- ✅ **Phase 1:** Players can grab cannons, aim (horizontal ±45° + elevation 15-60°), fire with cooldown
- ✅ **Phase 2:** Cannonballs spawn and fly with realistic physics (gravity, elevation, velocity inheritance)
- ✅ **Phase 3:** Projectiles detect hits, validate server-side, apply damage, show health bars
- ✅ **Phase 4:** Ships sink at 0 HP (5s animation), respawn after 10s at spawn point with full health

**Phase 5 Status:**
- ✅ **Enhanced Visual Effects:** Camera shake (100ms) + rotating particle explosions (30 splinters)
- ⚠️ **Audio System:** Infrastructure implemented but disabled due to Electron/Phaser compatibility issue
  - All audio hooks in place with optional chaining (`?.play()`)
  - 5 MP3 files ready in `clients/seacat/assets/sounds/`
  - Loading code commented out (causes Electron crash)
  - See Phase 5 section below for debugging details

**Testing:**
```bash
cd /Users/rj/Git/rjcorwin/mew-protocol
mew space up
# Launch Seacat client
# Board ship, grab cannon (E), aim (arrows), fire (SPACE)
# ✅ Camera shake visible on fire
# ✅ Enhanced particle explosions on impact
# ❌ No audio (temporarily disabled)
```

---

## Overview

Add cannon-based ship combat to Seacat, enabling multiplayer PvP and cooperative multi-crew gameplay. Ships will have port/starboard cannons that players can control, aim, and fire to damage other ships.

## Architecture Summary

**Key Components:**
- **Ship Server** (`src/mcp-servers/ship-server/`) - Manages cannon state, projectile spawning, damage validation
- **Client Renderer** (`clients/seacat/src/game/GameScene.ts`) - Renders cannons, projectiles, effects, handles aiming input
- **Protocol Messages** - 6 new message types for cannon control and combat
- **Physics System** - Client-side deterministic projectile simulation with server validation

**Core Principles:**
- **Client prediction**: Instant visual feedback for aiming and firing
- **Server authority**: Ship server validates hits and manages damage
- **Deterministic physics**: All clients simulate identical projectile trajectories
- **OBB collision**: Reuse existing rotation-aware collision for projectile hits

## Implementation Phases

### Phase 1: Control Points & Aiming ✅ COMPLETE

**Goal:** Players can grab cannons and aim them, with visual feedback.

**Status:** ✅ COMPLETE - All features implemented and working!

#### Completed ✅

**Server-Side Implementation:**
- [x] **Ship server initialization** (`ShipServer.ts:58-102`)
  - Cannons initialized from config in constructor
  - 2 port cannons at `{x: -10, y: -24}` and `{x: 20, y: -24}`
  - 2 starboard cannons at `{x: -10, y: 24}` and `{x: 20, y: 24}`
  - Default aim angle: 0 (perpendicular to ship)
  - Cooldown: 4000ms (4 seconds)

- [x] **Cannon config** (`index.ts:49-68`)
  - `cannonPositions` defined with port/starboard arrays
  - `cannonCooldownMs: 4000` configured

- [x] **Grab/release implementation** (`ShipServer.ts:504-542`)
  - `grabCannon()` - Validates index, checks not controlled, releases other controls, sets controlledBy
  - `releaseCannon()` - Validates player controls it, clears controlledBy
  - Both methods fully implemented with error handling

- [x] **Aim system** (`ShipServer.ts:544-563`)
  - `aimCannon()` - Validates player controls cannon
  - Clamps aim angle to ±π/4 (±45°) from perpendicular
  - Updates cannon state with new aim angle

- [x] **Fire system** (`ShipServer.ts:565-594`)
  - `fireCannon()` - Validates player controls cannon
  - Checks cooldown (prevents firing if cooldown > 0)
  - Sets `cooldownRemaining = 4000ms` on fire
  - Logs fire event (projectile spawn TODO for Phase 2)

- [x] **Cooldown decrement** (`ShipServer.ts:316-323`)
  - Physics loop decrements `cooldownRemaining` every frame
  - Clamps to 0 when cooldown expires

- [x] **Message handlers** (`ShipParticipant.ts:170-193`)
  - `handleGrabCannon()` - Calls server method, broadcasts state
  - `handleReleaseCannon()` - Calls server method, broadcasts state
  - `handleAimCannon()` - Calls server method, broadcasts state
  - `handleFireCannon()` - Calls server method, broadcasts state
  - All handlers fully implemented

**Client-Side Implementation:**
- [x] **Type definitions** (`types.ts:115-132`)
  - `Ship.cannons` with port/starboard arrays
  - Each cannon has sprite, position, controlledBy, aimAngle, cooldownRemaining

- [x] **State tracking** (`GameScene.ts:44-51`)
  - `controllingCannon: {side, index}` - Tracks which cannon player controls
  - `currentCannonAim: number` - Local aim angle for immediate feedback
  - `nearControlPoints: Set<string>` - Includes cannon control points

- [x] **Cannon initialization** (`GameScene.ts:542-563`)
  - Creates Graphics sprite for each cannon
  - Calculates relative position from world position
  - Stores controlledBy, aimAngle, cooldownRemaining from server

- [x] **Cannon state sync** (`GameScene.ts:587-611`)
  - Updates cannon state from position messages
  - Syncs controlledBy, aimAngle, cooldownRemaining
  - Logs cooldown updates for debugging

- [x] **Interaction detection** (`GameScene.ts:1566-1627`)
  - Checks port and starboard cannons for proximity (30px radius)
  - Calculates rotated cannon positions using isometric rotation
  - Adds nearest cannon to `nearControlPoints` set
  - Handles "cannon already controlled" state

- [x] **Input handling** (`GameScene.ts:1644-1728`)
  - E key: Grab/release cannon (calls `sendGrabCannon()` / release in `sendReleaseControl()`)
  - Left/right arrows: Aim cannon (updates `currentCannonAim`, calls `sendAimCannon()`)
  - Space bar: Fire cannon (calls `sendFireCannon()`)
  - All input fully implemented with proper state checks

- [x] **Message sending** (`GameScene.ts:1863-1921`)
  - `sendGrabCannon()` - Sends `ship/grab_cannon` message
  - `sendReleaseCannon()` - Sends `ship/release_cannon` message
  - `sendAimCannon()` - Sends `ship/aim_cannon` message
  - `sendFireCannon()` - Sends `ship/fire_cannon` message

- [x] **Visual rendering** (`GameScene.ts:714-804`)
  - `drawCannon()` method with full implementation:
    - Orange circles for available cannons (8px radius)
    - Yellow for nearby cannons
    - Red for controlled by others
    - White outline on all control points

- [x] **Aim arc visualization** (`GameScene.ts:751-795`)
  - Cyan arc showing ±45° firing range
  - Magenta aim line showing current aim direction
  - Crosshair at end of aim line
  - Arc rotates with ship using isometric rotation
  - Uses local `currentCannonAim` for immediate feedback when controlling

- [x] **Cooldown indicator** (`GameScene.ts:797-804`)
  - Gray circle that shrinks as cooldown expires
  - Size proportional to remaining cooldown (12px when just fired → 0px when ready)
  - Shows percentage in console logs

**Deliverable:** ✅ Players can see cannons, grab them, aim left/right, see aim arc, fire (with cooldown).

**Testing Results:**
1. ✅ Start ship, walk to port side
2. ✅ Press E near cannon - grabs it (yellow → controlled)
3. ✅ Press left/right arrows - aim arc rotates smoothly
4. ✅ Press space - fires cannon, cooldown indicator appears
5. ✅ Press E again - releases cannon
6. ✅ Cooldown prevents firing until 4 seconds elapse

**What's NOW Complete (Phases 2-3):**
- ✅ Projectile spawning with elevation physics (Phase 2)
- ✅ Cannonballs flying through air with gravity (Phase 2)
- ✅ Particle effects: blast, trail, splash, hit (Phase 2-3)
- ✅ Ship collision detection and damage (Phase 3)
- ✅ Health bars with color-coded display (Phase 3)

---

### Phase 2: Firing & Projectiles ✅ COMPLETE

**Goal:** Players can fire cannons, projectiles spawn and fly through air with physics.

**Strategy:** 3 sub-phases - spawning (server), physics (client), effects (polish).

**Completed:** 2025-01-27

---

#### Phase 2a: Server-Side Projectile Spawning ✅

**Goal:** Ship server calculates and broadcasts projectile spawn on fire.

**Implementation:**

- [x] **Add Projectile type** (`types.ts:196-203`)
  ```typescript
  interface Projectile {
    id: string;
    sourceShip: string;
    spawnTime: number;
    spawnPosition: Position;
    initialVelocity: Velocity;
  }
  ```

- [x] **Projectile spawn calculation** (`ShipServer.fireCannon():661-688`)
  - Calculate cannon world position using isometric rotation:
    ```typescript
    const rotated = rotateIsometric(cannon.relativePosition, this.state.rotation);
    const spawnPos = {
      x: this.state.position.x + rotated.x,
      y: this.state.position.y + rotated.y
    };
    ```
  - Calculate fire direction:
    ```typescript
    const isPort = side === 'port';
    const perpendicular = this.state.rotation + (isPort ? -PI/2 : PI/2);
    const fireAngle = perpendicular + cannon.aimAngle;
    ```
  - **Inherit ship velocity** (moving platform):
    ```typescript
    const CANNON_SPEED = 300; // px/s
    const vel = {
      x: Math.cos(fireAngle) * CANNON_SPEED + this.state.velocity.x,
      y: Math.sin(fireAngle) * CANNON_SPEED + this.state.velocity.y
    };
    ```
  - Generate unique ID: `${shipId}-${side}-${index}-${Date.now()}`

- [x] **Active projectile tracking** (`ShipServer:58`)
  - Add `activeProjectiles: Map<string, Projectile>` to ship state
  - Store projectile on fire (for Phase 3 hit validation)
  - Auto-cleanup after 2 seconds

- [x] **Return projectile from fireCannon()** (`ShipServer:716`)
  - Return projectile object (or null if failed)
  - Participant will broadcast it

- [x] **Broadcast spawn message** (`ShipParticipant:199-222`)
  - Send `game/projectile_spawn` after `fireCannon()` succeeds
  - Include all spawn parameters

**Deliverable:** Ship creates projectile data and broadcasts spawn message. ✅

**Testing:** ✅
- Fire cannon, check console logs for spawn parameters
- Verify world position matches visual cannon location
- Fire from moving ship, verify velocity includes ship velocity

---

#### Phase 2b: Client-Side Physics Simulation ✅

**Goal:** Clients render cannonballs and simulate deterministic physics.

**Implementation:**

- [x] **Add Projectile interface** (`clients/seacat/src/types.ts:145-153`)
  ```typescript
  interface Projectile {
    id: string;
    sprite: Phaser.GameObjects.Arc;
    velocity: {x: number, y: number};
    spawnTime: number;
    sourceShip: string;
    minFlightTime: number; // Grace period for water collision
  }
  ```

- [x] **Add projectiles Map** (`GameScene:30`)
  - `private projectiles: Map<string, Projectile> = new Map()`

- [x] **Subscribe to spawn messages** (`GameScene.create():419-422`)
  - Listen for `game/projectile_spawn` messages
  - Filter out duplicate IDs (idempotency)

- [x] **Spawn projectile sprite** (`GameScene.spawnProjectile():678-717`)
  ```typescript
  const sprite = this.add.circle(
    payload.position.x,
    payload.position.y,
    4, // 8px diameter
    0x222222, // Dark gray
    1.0
  );
  sprite.setDepth(100); // Above ships/players

  this.projectiles.set(payload.id, {
    id: payload.id,
    sprite,
    velocity: {...payload.velocity}, // Copy velocity
    spawnTime: payload.timestamp,
    sourceShip: payload.sourceShip
  });
  ```

- [x] **Physics simulation** (`GameScene.update():1453-1555`)
  ```typescript
  const GRAVITY = 150; // px/s² (must match server)
  const LIFETIME = 2000; // ms
  const deltaS = delta / 1000;

  this.projectiles.forEach((proj, id) => {
    // Check lifetime
    const age = Date.now() - proj.spawnTime;
    if (age > LIFETIME) {
      proj.sprite.destroy();
      this.projectiles.delete(id);
      return;
    }

    // Apply gravity (downward acceleration)
    proj.velocity.y += GRAVITY * deltaS;

    // Update position (Euler integration)
    proj.sprite.x += proj.velocity.x * deltaS;
    proj.sprite.y += proj.velocity.y * deltaS;

    // Check if off-screen (optimization)
    const bounds = this.cameras.main.worldView;
    const margin = 100;
    if (proj.sprite.x < bounds.x - margin ||
        proj.sprite.x > bounds.right + margin ||
        proj.sprite.y < bounds.y - margin ||
        proj.sprite.y > bounds.bottom + margin) {
      proj.sprite.destroy();
      this.projectiles.delete(id);
    }
  });
  ```

- [x] **Add physics constants** (matched between server/client)
  ```typescript
  const PROJECTILE_CONSTANTS = {
    CANNON_SPEED: 300,    // px/s initial speed
    GRAVITY: 150,         // px/s² downward
    LIFETIME: 2000,       // ms before auto-despawn
  };
  ```

**Deliverable:** Cannonballs spawn and fly in parabolic arcs, despawn after 2s. ✅

**Testing:** ✅
1. Fire cannon → black circle appears at cannon position
2. Circle flies in parabolic arc (gravity visible)
3. Circle despawns after 2 seconds
4. Fire from moving ship → projectile moves faster in ship direction

---

#### Phase 2c: Visual Effects ✅

**Goal:** Add cannon blast and trail effects for satisfying feedback.

**Implementation:**

- [x] **Cannon blast effect** (`GameScene.createCannonBlast():719-760`)
  ```typescript
  function cannonBlastEffect(x: number, y: number) {
    // Flash
    const flash = this.add.circle(x, y, 15, 0xFFAA00, 0.9);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 150,
      onComplete: () => flash.destroy()
    });

    // Smoke puffs (5 circles expanding outward)
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 / 5) * i;
      const smoke = this.add.circle(
        x + Math.cos(angle) * 10,
        y + Math.sin(angle) * 10,
        6, 0x666666, 0.6
      );
      this.tweens.add({
        targets: smoke,
        x: smoke.x + Math.cos(angle) * 20,
        y: smoke.y + Math.sin(angle) * 20,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        onComplete: () => smoke.destroy()
      });
    }
  }
  ```
  - Called when `game/projectile_spawn` received in `spawnProjectile()`
  - Creates orange flash + smoke puffs

- [x] **Projectile trail effect** (`GameScene.update():1471-1489`)
  ```typescript
  // In projectile update loop
  if (Math.random() < 0.3) { // 30% chance per frame (~18 puffs/sec at 60fps)
    const trail = this.add.circle(
      proj.sprite.x,
      proj.sprite.y,
      3, 0x888888, 0.5
    );
    this.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      onComplete: () => trail.destroy()
    });
  }
  ```

- [x] **Water splash effect** (`GameScene.createWaterSplash():794-838`)
  - Blue particle fountain on water collision
  - Added as bonus polish

- [ ] **Improve cannonball sprite** (optional polish - deferred)
  - Add subtle rotation during flight
  - Add shadow circle below cannonball
  - Use gradient fill for 3D effect

- [ ] **Effect optimization** (deferred - performance is good)
  - Limit max simultaneous effect sprites (e.g., 50)
  - Reuse effect sprites via object pool (optional)
  - Disable effects if FPS drops below threshold

**Deliverable:** Satisfying cannon fire with flash, smoke burst, trailing smoke, and water splash. ✅

**Testing:** ✅
1. Fire cannon → see orange flash and smoke burst at cannon
2. Cannonball leaves smoke trail as it flies
3. Water splash on collision with water surface
4. Effects maintain good framerate
5. Multiple simultaneous fires work well

---

---

### Phase 2 Technical Notes

**Isometric Rotation Helper:**

Both server and client need rotation functions. Client already has `rotatePointIsometric()` in GameScene. Server needs similar function:

```typescript
// Add to ShipServer.ts
private rotatePointIsometric(point: Position, angle: number): Position {
  // Same isometric rotation used by client
  // Convert to Cartesian, rotate, convert back to isometric
  const cartX = (point.x + point.y * 2) / 2;
  const cartY = (point.y * 2 - point.x) / 2;

  const rotatedX = cartX * Math.cos(angle) - cartY * Math.sin(angle);
  const rotatedY = cartX * Math.sin(angle) + cartY * Math.cos(angle);

  const isoX = rotatedX - rotatedY;
  const isoY = (rotatedX + rotatedY) / 2;

  return { x: isoX, y: isoY };
}
```

**Cannon Position Calculation (for blast effect):**

Client can calculate cannon world position from ship position update:

```typescript
// When receiving game/projectile_spawn
const ship = this.ships.get(payload.sourceShip);
if (ship) {
  // Find which cannon fired (parse from projectile ID)
  const [shipId, side, indexStr] = payload.id.split('-');
  const index = parseInt(indexStr);

  const cannon = ship.cannons[side][index];
  const rotated = this.rotatePointIsometric(cannon.relativePosition, ship.rotation);
  const cannonX = ship.sprite.x + rotated.x;
  const cannonY = ship.sprite.y + rotated.y;

  // Show blast effect at cannon position
  this.cannonBlastEffect(cannonX, cannonY);
}
```

**Constants File (Recommended):**

Create `src/constants/projectile.ts` (shared):
```typescript
export const PROJECTILE = {
  CANNON_SPEED: 300,    // px/s
  GRAVITY: 150,         // px/s²
  LIFETIME: 2000,       // ms
  VISUAL_RADIUS: 4,     // px (8px diameter)
} as const;
```

Then import in both server and client to ensure perfect synchronization.

---

**Overall Phase 2 Deliverable:**
✅ Fire cannon (Space bar) → blast effect → cannonball flies with trail → despawns

**Phase 2 Success Criteria:**
- [ ] Cannonballs spawn at correct position (at cannon, not ship center)
- [ ] Projectiles follow parabolic arc (gravity visible)
- [ ] Moving ship: projectiles inherit ship velocity
- [ ] Two clients see identical trajectories (deterministic physics)
- [ ] Projectiles auto-despawn after 2 seconds
- [ ] Cannon blast effect visible on all clients
- [ ] Trail effect follows projectile smoothly
- [ ] No memory leaks (sprites destroyed properly)
- [ ] 60 FPS maintained with 10-20 projectiles in flight

---

### Phase 3: Collision & Damage ✅ COMPLETE

**Goal:** Cannonballs damage ships on hit, health bars visible.

**Completed:** 2025-01-27

#### Client-Side Hit Detection
- [x] **Collision check in update loop** (`GameScene.update():1491-1525`)
  - For each projectile, check against all ships (except source ship)
  - Use existing `isPointInRotatedRect()` OBB collision
  - Hitbox: `ship.deckBoundary * 1.2` (20% padding for generosity)

- [x] **Hit prediction**
  - When hit detected, show effect immediately (client prediction)
  - Send `game/projectile_hit_claim` to target ship (`sendProjectileHitClaim():2332-2343`)
  - Projectile despawned immediately locally

- [x] **Hit effects** (`GameScene.createHitEffect():843-880`)
  - Wood splinters (20 brown particles, radial burst)
  - Smoke burst (10 gray particles, expand)
  - Duration: 800-1000ms

- [x] **Water splash effect** (`GameScene.createWaterSplash():794-838`)
  - If projectile hits water surface
  - Blue particle fountain at impact position
  - Duration: 800ms

#### Server-Side Validation
- [x] **Hit claim handling** (`ShipParticipant.handleProjectileHitClaim():228-244`)
  - Ship receives `game/projectile_hit_claim` message
  - Validate projectile exists in `activeProjectiles`
  - Replay physics from spawn to claim timestamp (`ShipServer.validateProjectileHit():740-781`):
    ```typescript
    replayProjectile(projectile, claimTimestamp) {
      const elapsed = (claimTimestamp - projectile.spawnTime) / 1000;
      const pos = {...projectile.position};
      const vel = {...projectile.velocity};

      vel.y += GRAVITY * elapsed;
      pos.x += vel.x * elapsed;
      pos.y += vel.y * elapsed;

      return pos;
    }
    ```
  - Check if replayed position is within ship OBB
  - If valid: apply damage
  - If invalid: ignore (client desync or cheating attempt)

- [x] **Damage system** (`ShipServer.takeDamage():783-794`)
  - Add `health: number` to ship state (initial: 100, from config)
  - `takeDamage(amount: number)`: Reduce health, clamp to 0
  - Health broadcast via position updates (includes health, maxHealth, sinking)
  - Mark projectile as consumed (prevent double-hit)

#### Client-Side Health Display
- [x] **Health bar rendering** (`GameScene.drawHealthBar():847-880`)
  - Above ship sprite (40px offset), always visible
  - Width: 100px, height: 8px
  - Background: dark gray (0x333333)
  - Fill: Green (>50%), Yellow (>20%), Red (≤20%)
  - Redrawn every frame

- [x] **Damage state sync**
  - Health synced via position updates (includes `shipData.health`, `shipData.maxHealth`)
  - Update ship health in `updateShip()` (lines 644-646)
  - Health bar fill width calculated: `(health / maxHealth) * width`

**Deliverable:** Cannonballs damage ships on hit, health bars show damage. ✅

**Testing:** ✅
1. Two ships spawned side by side (`templates/seacat/space.yaml`)
2. Player boards ship, fires at other ship
3. Hit effect shows on impact (wood splinters + smoke)
4. Health bar appears/updates (100 → 75 → 50 → 25 → 0)
5. Server validates hits via physics replay
6. Console logs show hit validation messages

---

### Phase 4: Sinking & Respawn ✅ COMPLETE

**Goal:** Ships sink at 0 HP and respawn after delay.

#### Sinking State
- [x] **Death detection**
  - In `takeDamage()`, check if `health <= 0`
  - Set `sinking: boolean = true`
  - Broadcast state with `sinking: true`
  - Stop movement (set velocity to 0, disable controls)
  - Release all control points (wheel, sails, cannons)
  - **Implementation:** `ShipServer.ts:791-812`

- [x] **Client-side sinking animation**
  - Ship sprite moves downward over 5 seconds (100px)
  - Fade alpha: 1.0 → 0.2
  - Disable control point interaction
  - Teleport players off sinking ship to water
  - **Implementation:** `GameScene.ts:1510-1534` (animation), `GameScene.ts:651-671` (detection)

- [x] **Sinking duration and respawn timer**
  - Server respawn timer: 10 seconds (reduced from 30s for testing)
  - Client animation: 5 seconds sink, then 5 seconds wait
  - **Implementation:** `ShipServer.ts:59,809-811` (timer setup)

#### Respawn System
- [x] **Server-side respawn**
  - After 10 seconds, reset ship state:
    - Position → spawn point from config
    - Health → maxHealth (100)
    - Sinking → false
    - Velocity → {x: 0, y: 0}
    - Reset wheel angle, turn rate, speed level
  - **Implementation:** `ShipServer.ts:818-840` (respawn method)
  - **Cleanup:** `ShipServer.ts:845-854` (cleanup method clears timers)

- [x] **Client-side respawn**
  - Detects respawn when `sinking: false` after `sinking: true`
  - Reset alpha to 1.0 for ship, control points, cannons
  - Ship appears at spawn position
  - **Implementation:** `GameScene.ts:673-689`

#### Win/Lose UI
- [ ] **Combat feedback** (deferred to Phase 5: Polish)
  - Show "You sank [ShipName]!" message to attacker
  - Show "Your ship was sunk!" message to sunk ship's crew
  - Display respawn timer: "Respawning in Xs..."

**Deliverable:** Ships sink at 0 HP, respawn after 10 seconds. ✅

**Implementation Notes:**
- Hit validation architecture: Client sends hit claim to SOURCE ship (not target), source validates physics replay, then forwards damage to target via `ship/apply_damage` message
- Target ship position/boundary passed in hit claim payload for accurate server-side validation
- Projectile lifetime: 3 seconds server-side (1s grace period for validation)

**Testing:**
1. Fire 4 cannonballs at enemy ship (100 → 0 HP)
2. Should see sinking animation (fade, sink, smoke)
3. After 5 seconds, ship invisible
4. After 30 seconds total, ship reappears at spawn

---

### Phase 5: Polish & Sounds ⚠️ PARTIAL (Visual Effects Complete, Audio Pending)

**Goal:** Production-ready feature with audio and enhanced visuals.

**Status:** Enhanced visual effects ✅ COMPLETE and working. Audio system infrastructure implemented but temporarily disabled due to Electron/Phaser compatibility issue.

#### Enhanced Particle Effects ✅ WORKING
- [x] **Cannon blast upgrade**
  - Camera shake on fire (100ms, 0.005 intensity, local player only)
  - **Implementation**: `GameScene.ts:824-827`
  - **Status**: ✅ Working in game

- [x] **Hit impact upgrade**
  - More splinters (30 particles, up from 20)
  - Varied particle sizes (random 2-5px radius)
  - Rotation animation (360° spin during flight)
  - **Implementation**: `GameScene.ts:964-984`
  - **Status**: ✅ Working in game

#### Sound Effects ⚠️ IMPLEMENTED BUT DISABLED
**Issue**: Phaser audio loading crashes Electron app on startup. Audio code is written but commented out pending fix.

**Attempted Implementation:**
- [x] Audio loading in preload() (`GameScene.ts:90-98`) - DISABLED
- [x] Sound instance creation (`GameScene.ts:175-203`) - DISABLED
- [x] Cannon fire sound hook (`GameScene.ts:837`) - Code ready with `?.` optional chaining
- [x] Hit impact sound hook (`GameScene.ts:1722`) - Code ready with `?.` optional chaining
- [x] Water splash sound hook (`GameScene.ts:1768`) - Code ready with `?.` optional chaining
- [x] Sinking sound loop hook (`GameScene.ts:693`) - Code ready with `?.` optional chaining
- [x] Respawn sound hook (`GameScene.ts:718`) - Code ready with `?.` optional chaining
- [x] Audio context resume on user interaction (`GameScene.ts:201-209`)
- [x] Sound file directory created: `clients/seacat/assets/sounds/`
- [x] README with download sources: `clients/seacat/assets/sounds/README.md`
- [x] Real MP3 files downloaded (cannon-fire.mp3, hit-impact.mp3, water-splash.mp3, ship-sinking.mp3, ship-respawn.mp3)

**Root Cause**:
- Phaser's `this.load.audio()` in Electron environment causes crash
- MP3 files are valid (verified with `file` command)
- Files load in browser but not in Electron/bundled context
- Issue: Phaser's XHR-based audio loader fundamentally incompatible with Electron
- **Tested**: Phaser with absolute paths (same as Howler fix) still crashes
- **Conclusion**: Path resolution was only part of the problem; Phaser's loader itself fails in Electron

**Solution Implemented** ✅:
Replaced Phaser audio with **Howler.js v2.2.3**:
1. Installed `howler` and `@types/howler` packages
2. Changed sound type from `Phaser.Sound.BaseSound` to `Howl`
3. Removed all `this.load.audio()` calls from `preload()` method
4. Create `Howl` instances in `create()` with:
   - **Absolute paths**: `window.location.href + 'assets/sounds/*.mp3'`
   - **html5: true**: Uses HTML5 Audio instead of Web Audio API (Electron-compatible)
   - **preload: false**: Lazy loading on first `.play()` call prevents startup crashes
5. Playback code unchanged (`.play()` works for both Phaser and Howler)

**Files Modified**:
- `clients/seacat/src/game/GameScene.ts` - Howler.js implementation (lines 2, 56-62, 168-215, 880)
- `clients/seacat/package.json` - Added Howler.js dependencies
- `clients/seacat/assets/sounds/*.mp3` - 5 sound files (working)

- [ ] **Damage smoke**
  - Persistent emitter on damaged ships (health < 50%)
  - Smoke intensity increases as health decreases
  - Rises from ship center

#### Ship Damage Visuals
- [ ] **Damage sprite overlay**
  - Crack textures overlaid on ship sprite
  - 3 damage states: Light (50-75%), Medium (25-50%), Heavy (<25%)
  - Randomize crack positions slightly

- [ ] **Scorch marks**
  - Dark circles where cannonballs hit
  - Persist until respawn

#### Balance Tuning
- [ ] **Playtest parameters**
  - Cooldown time (currently 4s) - adjust if too fast/slow
  - Damage per hit (currently 25) - adjust if combat too quick/long
  - Projectile speed/gravity - adjust if too hard/easy to hit
  - Hitbox padding (currently 1.2x) - adjust if hits feel unfair

- [ ] **Config file**
  - Move balance params to `cannon-config.json`
  - Allow hot-reload during playtesting (no rebuild needed)

#### Score Tracking
- [ ] **Combat statistics**
  - Track hits, misses, kills per player
  - Store in player state

- [ ] **Leaderboard UI**
  - Show top combatants (optional, Phase 6+)

**Deliverable:** Polished combat system with audio, enhanced effects, balanced gameplay.

**Testing:**
1. Full combat loop with 4+ players
2. Multiple ships engaging simultaneously
3. Verify audio plays at correct times
4. Check performance (60 FPS with 10+ projectiles)
5. Balance testing: combat duration, hit rates, TTK

---

## Protocol Messages Reference

### New Message Types

All messages use MEW protocol v0.4 envelope format.

#### 1. `ship/grab_cannon`
Player requests control of a cannon.

```typescript
{
  kind: 'ship/grab_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number  // 0, 1, etc.
  }
}
```

#### 2. `ship/release_cannon`
Player releases cannon control.

```typescript
{
  kind: 'ship/release_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number
  }
}
```

#### 3. `ship/aim_cannon`
Player adjusts cannon aim angle.

```typescript
{
  kind: 'ship/aim_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number,
    aimAngle: number  // Radians, clamped to ±π/4
  }
}
```

#### 4. `ship/fire_cannon`
Player fires cannon.

```typescript
{
  kind: 'ship/fire_cannon',
  to: ['ship1'],
  payload: {
    playerId: string,
    side: 'port' | 'starboard',
    index: number
  }
}
```

#### 5. `game/projectile_spawn`
Ship broadcasts projectile creation (response to fire).

```typescript
{
  kind: 'game/projectile_spawn',
  to: [],  // Broadcast
  payload: {
    id: string,                 // Unique projectile ID
    type: 'cannonball',
    sourceShip: string,         // Ship ID that fired
    position: {x: number, y: number},
    velocity: {x: number, y: number},  // Includes inherited ship velocity
    timestamp: number
  }
}
```

#### 6. `game/projectile_hit_claim`
Client claims projectile hit (for validation).

```typescript
{
  kind: 'game/projectile_hit_claim',
  to: ['targetShip'],
  payload: {
    projectileId: string,
    claimedDamage: number,
    timestamp: number
  }
}
```

#### 7. `ship/damage`
Ship confirms damage (after validation).

```typescript
{
  kind: 'ship/damage',
  to: [],  // Broadcast
  payload: {
    shipId: string,
    projectileId: string,
    damage: number,
    newHealth: number,
    sinking: boolean,
    timestamp: number
  }
}
```

#### 8. `ship/respawn`
Ship respawns after sinking.

```typescript
{
  kind: 'ship/respawn',
  to: [],  // Broadcast
  payload: {
    shipId: string,
    spawnPosition: {x: number, y: number},
    timestamp: number
  }
}
```

---

## File Modifications Checklist

### Server Files

- [ ] **`src/mcp-servers/ship-server/types.ts`**
  - [x] Add cannon types (DONE)
  - [ ] Add projectile types
  - [ ] Add health/damage types

- [ ] **`src/mcp-servers/ship-server/ShipServer.ts`**
  - [ ] Initialize cannon positions in constructor
  - [ ] Implement `grabCannon()`, `releaseCannon()`, `aimCannon()`, `fireCannon()`
  - [ ] Add projectile spawn calculation
  - [ ] Add hit validation logic
  - [ ] Add damage system
  - [ ] Add respawn system
  - [ ] Update physics loop to decrement cooldowns

- [ ] **`src/mcp-servers/ship-server/ShipParticipant.ts`**
  - [x] Add message handlers (STUBBED)
  - [ ] Implement handler bodies
  - [ ] Add projectile state to broadcast payload

- [ ] **`src/mcp-servers/ship-server/index.ts`**
  - [ ] Add cannon config (positions, cooldown, damage) to ship initialization

### Client Files

- [ ] **`clients/seacat/src/types.ts`**
  - [x] Add cannon types to Ship/ShipData (DONE)
  - [ ] Add Projectile interface

- [ ] **`clients/seacat/src/game/GameScene.ts`**
  - [x] Add cannon state tracking variables (DONE)
  - [ ] Initialize cannon sprites when ship created
  - [ ] Extend `checkShipInteractions()` for cannon proximity
  - [ ] Handle E key for cannon grab/release
  - [ ] Handle arrow keys for aim/fire when controlling cannon
  - [ ] Render cannon control points
  - [ ] Render aim arc visualization
  - [ ] Implement projectile class
  - [ ] Subscribe to projectile spawn messages
  - [ ] Add projectile physics update
  - [ ] Add hit detection
  - [ ] Render health bars
  - [ ] Subscribe to damage messages
  - [ ] Implement sinking/respawn animations
  - [ ] Add all particle effects

---

## Testing Strategy

### Unit Tests
- [ ] Projectile physics determinism (same inputs → same outputs)
- [ ] Hit validation (replay physics matches client)
- [ ] OBB collision accuracy
- [ ] Cooldown system timing

### Integration Tests
- [ ] Cannon grab/release flow
- [ ] Aim angle clamping (stays within ±45°)
- [ ] Projectile spawn inherits ship velocity
- [ ] Damage validation rejects invalid hits
- [ ] Health reaches 0 triggers sinking
- [ ] Respawn timer works correctly

### End-to-End Tests
- [ ] Two players fire at each other
- [ ] Multiple cannons per ship work independently
- [ ] Hits register correctly on moving ships
- [ ] Sinking animation completes
- [ ] Respawn works correctly
- [ ] Multiple ships in combat simultaneously

### Performance Tests
- [ ] 10+ projectiles in flight maintain 60 FPS
- [ ] Particle effects don't tank framerate
- [ ] Network bandwidth stays under 1KB/sec per player

---

## Balance Parameters

```typescript
const CANNON_CONFIG = {
  // Firing
  cooldownMs: 4000,           // Time between shots
  damage: 25,                 // HP per hit (4 hits to sink)

  // Aiming
  aimSpeed: Math.PI / 4,      // 45° per second
  aimArcMax: Math.PI / 4,     // ±45° from perpendicular

  // Projectiles
  projectileSpeed: 300,        // px/s initial velocity
  projectileGravity: 150,      // px/s² downward acceleration
  projectileLifetime: 2000,    // ms before despawn

  // Collision
  hitboxPadding: 1.2,          // 20% larger hitbox

  // Effects
  effectsRange: 800,           // Max distance to render effects
};

const SHIP_HEALTH = {
  maxHealth: 100,
  sinkingDuration: 5000,       // 5 second sink animation
  respawnDelay: 30000,         // 30 second respawn wait
};
```

---

## Success Metrics

- [ ] 80%+ of playtests involve combat
- [ ] Average combat lasts 30-60 seconds
- [ ] New players hit 30%+ shots within 5 minutes
- [ ] <5ms per frame for projectile simulation
- [ ] No network desyncs in 100 test shots
- [ ] 60 FPS maintained with 10+ active projectiles

---

## Open Questions (For User)

1. **Friendly fire**: Should cannons damage your own ship if hit?
2. **Respawn location**: Fixed start point or last safe position?
3. **Speed penalty**: Should damaged ships move slower?
4. **Concurrent limit**: Max players per cannon (1 or allow queuing)?
5. **Victory UI**: How to display combat scores/leaderboard?

---

## Dependencies

**Blocked by:** None (all required systems implemented)

**Blocks:** Future combat features (boarding, different ammo types, ship upgrades)

**Related proposals:**
- `w3l-wheel-steering` - Wheel control system (reuse pattern for cannons)
- `i2m-true-isometric` - Isometric rotation (needed for cannon positioning)
- `r8s-ship-rotation` - Ship rotation physics (affects projectile spawn)

---

## Timeline Estimate

| Phase | Duration | Dates (Example) |
|-------|----------|-----------------|
| Phase 1: Control & Aiming | 3 days | Jan 24-26 |
| Phase 2: Firing & Projectiles | 3 days | Jan 27-29 |
| Phase 3: Collision & Damage | 4 days | Jan 30 - Feb 2 |
| Phase 4: Sinking & Respawn | 3 days | Feb 3-5 |
| Phase 5: Polish & Sounds | 4 days | Feb 6-9 |
| **Total** | **17 days** | **~3 weeks** |

*Note: Assumes ~4-6 hours per day development time*

---

## Current Status Summary

**Phase 1 Progress:** ✅ 100% COMPLETE
- ✅ Type definitions added
- ✅ Data structures in place
- ✅ Message handlers fully implemented
- ✅ Client state tracking variables added
- ✅ Ship server cannon initialization DONE
- ✅ Grab/release implementation DONE
- ✅ Aim system DONE
- ✅ Fire system with cooldown DONE
- ✅ Client interaction detection DONE
- ✅ Visual rendering DONE
- ✅ Aim arc visualization DONE
- ✅ Cooldown indicator DONE

**Phase 2 Status:** 🔲 0% complete (next to implement)

**Next Steps (Phase 2):**
1. Add projectile spawn logic to `ShipServer.fireCannon()`
2. Broadcast `game/projectile_spawn` message with spawn params
3. Implement `Projectile` class in GameScene
4. Subscribe to projectile spawn messages in client
5. Render cannonball sprites (black circles)
6. Add physics simulation (gravity + velocity)
7. Implement despawn after 2 seconds or off-screen
8. Add trail particle effect (smoke puffs)
9. Add cannon blast effect (flash + smoke)

**Files Modified (Phase 1):**
- ✅ `clients/seacat/src/types.ts` - Cannon types added
- ✅ `src/mcp-servers/ship-server/types.ts` - Cannon types added
- ✅ `clients/seacat/src/game/GameScene.ts` - Full cannon system
- ✅ `src/mcp-servers/ship-server/ShipParticipant.ts` - All handlers implemented
- ✅ `src/mcp-servers/ship-server/ShipServer.ts` - All cannon methods implemented
- ✅ `src/mcp-servers/ship-server/index.ts` - Cannon config added

**Files to Modify (Phase 2):**
- 🔲 `src/mcp-servers/ship-server/types.ts` - Add `Projectile` type
- 🔲 `src/mcp-servers/ship-server/ShipServer.ts` - Add projectile spawn calculation
- 🔲 `src/mcp-servers/ship-server/ShipParticipant.ts` - Broadcast projectile spawn
- 🔲 `clients/seacat/src/types.ts` - Add `Projectile` interface
- 🔲 `clients/seacat/src/game/GameScene.ts` - Add projectile physics & rendering
