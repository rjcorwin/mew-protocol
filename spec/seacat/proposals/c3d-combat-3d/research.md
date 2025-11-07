# Research: Full 3D Combat System Architecture

## Overview

This document outlines the entities, responsibilities, and message flows involved in the seacat ship combat system. The system implements a client-authoritative hit detection model with server-side validation, built on a full 3D physics model that separates ground movement from vertical elevation.

## Core Entities

### 1. Ship Server (Distributed Architecture)

**Each ship runs its own ShipServer process as a MEW participant:**
- `ship1` participant → ShipServer instance managing ship1
- `ship2` participant → ShipServer instance managing ship2
- Each server is sovereign over its own ship's state
- Ships communicate via MEW protocol messages

**Responsibilities:**
- **Own ship state:** Maintains authoritative state for its ship (position, rotation, health)
- **Own cannons:** Manages cannon controls (aim, elevation, cooldown, firing)
- **Own projectiles:** Calculates and spawns projectiles from its cannons
- **Hit validation:** Validates hit claims for projectiles **it spawned** by replaying projectile physics against **target state provided by client**
- **Damage authority:** Applies damage to itself when receiving validated damage commands **from other ships**
- **State broadcasting:** Broadcasts position/health updates to all participants
- **Sinking/respawn:** Manages sinking effects and respawn timer for its ship

**Note:** Ships do NOT track other ships' positions. Validation uses target state provided in the hit claim.

**State:**
```typescript
{
  participantId: string;
  position: Position;
  rotation: number;
  health: number;
  maxHealth: number;
  sinking: boolean;
  cannons: {
    port: CannonControlPoint[];
    starboard: CannonControlPoint[];
  };
  // ... other ship state
}
```

**Key Operations:**
- `handleFireCannon(payload)` - Validates and spawns projectile
- `handleProjectileHitClaim(payload)` - Validates hit and applies damage
- `updateShipState()` - Broadcasts position updates with health/sinking status

### 2. Cannon (Part of Ship state)

**Responsibilities:**
- Can be controlled by a player
- Maintains aim angle (horizontal, ±45°)
- Maintains elevation angle (vertical, 15°-60°)
- Enforces cooldown between shots (e.g., 3000ms)

**State:**
```typescript
{
  relativePosition: Position;  // Offset from ship center
  controlledBy: string | null; // Player ID
  aimAngle: number;            // Horizontal aim in radians
  elevationAngle: number;      // Vertical elevation in radians
  cooldownRemaining: number;   // ms until can fire again
  lastFired: number;           // Timestamp of last fire
}
```

**Key Operations:**
- `aimCannon(angle)` - Updates horizontal aim
- `adjustElevation(direction)` - Increases/decreases elevation
- `fire()` - Creates projectile if off cooldown

### 3. Projectile (Tracked on Server and Client)

**Server Representation:**
```typescript
{
  id: string;
  sourceShip: string;
  spawnTime: number;
  spawnPosition: Position;      // Screen-space position
  initialVelocity: Velocity3D;  // Ground velocity + height velocity
}
```

**Client Representation:**
```typescript
{
  id: string;
  sprite: Phaser.GameObjects.Arc; // Visual representation

  // Ground position and velocity (horizontal movement on isometric map)
  groundX: number;
  groundY: number;
  groundVx: number;
  groundVy: number;

  // Height position and velocity (vertical elevation in 3D space)
  heightZ: number;  // Height above ground (0 = water/ground level)
  heightVz: number; // Vertical velocity (positive = upward)

  spawnTime: number;
  sourceShip: string;
  minFlightTime: number; // Grace period before water collision
}
```

**Responsibilities:**
- Server: Store spawn data for validation
- Client: Simulate 3D physics and render visual

**Key Physics:**
```typescript
// Ground movement (no gravity)
groundX += groundVx * deltaT;
groundY += groundVy * deltaT;

// Height movement (with gravity)
heightVz -= GRAVITY * deltaT;
heightZ += heightVz * deltaT;

// Convert to screen coordinates for rendering
screenX = groundX - groundY;
screenY = (groundX + groundY) / 2 - heightZ;
```

### 4. Player (Client-side: `GameScene.ts`)

**Responsibilities:**
- Controls cannons (grab, aim, elevate, fire)
- Detects projectile collisions with ships
- Sends hit claims to server
- Renders combat effects (blasts, impacts, splashes)
- Plays combat sounds

**Key Operations:**
- `handleCannonControl()` - Process player input for cannon control
- `detectHit()` - Check projectile-ship collisions
- `sendHitClaim()` - Notify server of detected hit
- `renderProjectile()` - Update visual sprite position

## Message Flows

### Flow 1: Firing a Cannon

```
1. Player (Client)
   └─> Presses SPACE while controlling cannon
       └─> Client sends MEW message to ship server
           Topic: "ship-commands"
           Payload: {
             type: "fire-cannon",
             side: "port",
             index: 0,
             playerId: "player-123"
           }

2. Ship Server
   └─> Receives "fire-cannon" message
       └─> Validates request:
           - Player controls this cannon?
           - Cannon off cooldown?
       └─> If valid:
           ├─> Calculate firing position (cannon world position)
           ├─> Calculate 3D velocity:
           │   - Convert ship rotation + aim angle → ground azimuth
           │   - Split CANNON_SPEED by elevation:
           │     - horizontalSpeed = speed * cos(elevation)
           │     - verticalSpeed = speed * sin(elevation)
           │   - Project horizontal onto ground axes:
           │     - groundVx = horizontalSpeed * cos(azimuth)
           │     - groundVy = horizontalSpeed * sin(azimuth)
           │   - heightVz = verticalSpeed (positive = upward)
           ├─> Create Projectile entity
           ├─> Store in projectiles map
           ├─> Set cannon cooldown
           └─> Broadcast to ALL participants:
               Topic: "combat-events"
               Payload: {
                 type: "projectile-spawn",
                 id: "proj-abc123",
                 position: { x: 512, y: 384 },
                 velocity: {
                   groundVx: 120,
                   groundVy: 80,
                   heightVz: 150
                 },
                 timestamp: 1234567890,
                 sourceShip: "ship-1"
               }

3. All Clients
   └─> Receive "projectile-spawn" message
       └─> ProjectileManager.spawnProjectile()
           ├─> Convert screen position → ground coordinates
           ├─> Create visual sprite (black circle, 8px diameter)
           ├─> Store in projectiles map with 3D state
           ├─> Play cannon fire sound
           └─> If local player on firing ship:
               └─> Trigger camera shake
```

### Flow 2: Projectile Tracking

```
Server (Stateless):
└─> Stores projectile spawn data in memory
    └─> Does NOT simulate physics
    └─> Used only for validation of hit claims
    └─> Auto-expires after PROJECTILE_LIFETIME (2000ms)

Client (Active Simulation):
└─> Every frame (update loop):
    ├─> For each projectile:
    │   ├─> Apply 3D physics (Euler integration):
    │   │   - Update ground position (no gravity)
    │   │   - Update height velocity (with gravity)
    │   │   - Update height position
    │   ├─> Convert ground + height → screen coordinates
    │   ├─> Update sprite position
    │   ├─> Render smoke trail (30% chance per frame)
    │   └─> Check collisions (see Flow 3)
    └─> Despawn if age > LIFETIME (2000ms)
```

### Flow 3: Hit Detection and Two-Step Validation

```
1. Client (Hit Detection)
   └─> Every frame, for each projectile:
       └─> Check if projectile at deck height:
           - abs(heightZ) <= DECK_HEIGHT_THRESHOLD (30px)
       └─> For each ship (except source):
           └─> Check OBB collision:
               - Point in rotated rectangle?
               - Use 20% generous hitbox padding
           └─> If HIT:
               ├─> Show impact effect (client prediction)
               ├─> Play hit sound
               ├─> Send hit claim to space (all participants receive):
               │   Kind: "game/projectile_hit_claim"
               │   Payload: {
               │     projectileId: "proj-abc123",
               │     targetShipId: "ship2",
               │     timestamp: 1234567950,
               │     claimedDamage: 25,
               │     targetPosition: { x: 640, y: 512 },
               │     targetRotation: 1.57,
               │     targetBoundary: { width: 200, height: 100 }
               │   }
               └─> Despawn projectile locally

2. Firing Ship Server (Validation Phase)
   └─> Receives "game/projectile_hit_claim" message(s)
       NOTE: Multiple clients may send duplicate claims for same collision!
       └─> Check: Do I own this projectile? (Is it in my activeProjectiles map?)
       └─> If NOT found in activeProjectiles:
           └─> Reject: "already expired or consumed" (idempotent duplicate handling)
       └─> If NOT mine (different source ship):
           └─> Ignore (another ship's projectile)
       └─> If MINE and EXISTS:
           └─> Replay physics from spawn using MY projectile data:
               ├─> Find projectile in activeProjectiles (spawn position, velocity, timestamp)
               ├─> elapsed = claim.timestamp - projectile.spawnTime
               ├─> Calculate ground position:
               │   - spawnGroundX = spawnPos.x/2 + spawnPos.y
               │   - spawnGroundY = spawnPos.y - spawnPos.x/2
               │   - groundX = spawnGroundX + groundVx * elapsed
               │   - groundY = spawnGroundY + groundVy * elapsed
               ├─> Calculate height:
               │   - heightZ = heightVz * elapsed - 0.5 * GRAVITY * elapsed²
               ├─> Convert to screen position:
               │   - screenX = groundX - groundY
               │   - screenY = (groundX + groundY) / 2 - heightZ
               └─> Validate collision using TARGET STATE FROM CLAIM:
                   ├─> Compare replayed projectile position vs claim.targetPosition
                   ├─> Check distance within claim.targetBoundary (with 20% padding)
                   ├─> (Note: Firing ship does NOT track target ship independently)
                   ├─> (Note: Trusts client's snapshot of target position/rotation/boundary)
                   └─> If VALID:
                       ├─> Remove projectile from activeProjectiles
                       └─> Send damage command TO TARGET SHIP:
                           Kind: "ship/apply_damage"
                           To: [targetShipId]  // Direct message to target ship
                           Payload: {
                             amount: 25,
                             sourceProjectile: "proj-abc123"
                           }
                   └─> If INVALID:
                       └─> Log rejection, do nothing (client was wrong about trajectory)

3. Target Ship Server (Damage Application Phase)
   └─> Receives "ship/apply_damage" message FROM firing ship
       └─> Apply damage to own ship:
           ├─> this.server.takeDamage(payload.amount)
           ├─> ship.health -= amount
           ├─> If health <= 0:
           │   └─> ship.sinking = true
           └─> Broadcast updated state to ALL participants:
               (Via normal position update message)
               shipData: {
                 health: 75,
                 maxHealth: 100,
                 sinking: false,
                 ...
               }

4. All Clients
   └─> Receive position update with new health from target ship
       └─> Update local ship state:
           ├─> ship.health = shipData.health
           ├─> ship.sinking = shipData.sinking
           └─> If sinking:
               └─> Trigger sinking effects (see Flow 4)
```

### Flow 4: Ship Sinking and Respawn

```
1. Ship Server
   └─> When ship.health <= 0:
       ├─> Set ship.sinking = true
       ├─> Broadcast in position update:
       │   - shipData.health = 0
       │   - shipData.sinking = true
       └─> Start respawn timer (e.g., 5 seconds)
           └─> After timer:
               ├─> Reset ship state:
               │   - position = spawn location
               │   - health = maxHealth
               │   - sinking = false
               ├─> Broadcast "ship-respawn" event:
               │   Topic: "combat-events"
               │   Payload: {
               │     type: "ship-respawn",
               │     shipId: "ship-2",
               │     position: { x: 1024, y: 768 },
               │     health: 100
               │   }

2. Client (Sinking Effects)
   └─> When ship.sinking = true:
       ├─> Start sinking animation:
       │   - Tween ship sprite alpha: 1.0 → 0.0
       │   - Tween ship sprite scale: 1.0 → 0.8
       │   - Duration: 3 seconds
       ├─> Play sinking sound (looped)
       ├─> Create water splash effects
       └─> Hide ship boundary and control points

3. Client (Respawn Effects)
   └─> Receive "ship-respawn" event:
       ├─> Stop sinking sound
       ├─> Reset ship sprite:
       │   - alpha = 1.0
       │   - scale = 1.0
       │   - position = respawn position
       ├─> Play respawn sound
       ├─> Create spawn flash effect
       └─> Show ship boundary and control points
```

### Flow 5: Water Impact

```
Client (Local Detection):
└─> Every frame, for each projectile:
    └─> If age > minFlightTime (200ms):
        └─> If heightVz < 0 (descending):
            └─> Get tile at screen position
            └─> If tile is navigable (water):
                └─> If heightZ <= 0 (at/below water surface):
                    ├─> Create water splash effect
                    ├─> Play splash sound
                    ├─> Despawn projectile locally
                    └─> No server notification needed
                        (projectiles auto-expire on server)
```

## Key Design Decisions

### 1. Distributed Multi-Ship Architecture

**Why:**
- Each ship is a sovereign MEW participant with authority over its own state
- Natural fit with MEW protocol's participant model
- No single point of failure
- Scales to many ships (each runs independently)

**How:**
- Each ship participant runs its own ShipServer process
- Ships communicate via MEW protocol messages
- Each server manages only its own ship's state

**Tradeoffs:**
- More complex than centralized game server
- Requires coordination between ship servers for combat
- Must handle distributed state consistency

### 2. Two-Phase Hit Validation (Hybrid Authority Model)

**Phase 1: Firing Ship Validates Trajectory**
- Firing ship server stores projectile spawn data
- Receives hit claims from clients
- Replays projectile physics to validate collision
- Authority on: "Did this projectile trajectory hit the target?"

**Phase 2: Target Ship Applies Damage**
- Target ship server receives damage command from firing ship
- Applies damage to its own health
- Broadcasts updated health state
- Authority on: "What is my current health?"

**Why:**
- **Prevents client cheating:** Firing ship validates physics (client can't fake hits)
- **Prevents firing ship abuse:** Target ship applies damage (firing ship can't force damage without sending message)
- **Distributed trust:** No single entity has complete control
- **Audit trail:** Two-step process creates clear message flow for debugging/replays

**Tradeoffs:**
- More complex than single-authority model
- Two network hops (client → firing ship → target ship)
- Requires both ships to be online for combat to work

### 3. Client-Authoritative Hit Detection

**Why:**
- Reduces network latency for satisfying visual feedback
- Server still validates to prevent cheating
- Works well with predicted client physics

**Multi-Client Behavior:**
- **ALL clients** simulate all projectiles and detect collisions
- If 2+ clients are connected, multiple hit claims may be sent for same collision
- **Server handles duplicates idempotently:**
  - First claim → validates → deletes projectile from `activeProjectiles` → processes damage
  - Subsequent claims → projectile not found → rejected as "already consumed"
- Result: Projectile can only be consumed once, regardless of how many clients detect the hit

**Tradeoffs:**
- Requires physics replay on server for validation
- Possible false positives (client sees hit, server rejects)
- Network latency can cause validation failures
- Duplicate claims create extra network traffic (but harmless due to idempotency)

### 4. Server Does NOT Simulate Physics

**Why:**
- Reduces server CPU load
- Clients already simulate for rendering
- Server only needs to validate claims

**Tradeoffs:**
- Server must replay physics on demand
- Must store spawn data for validation period
- Slight increase in message complexity

### 5. Full 3D Physics Model

**Why:**
- Eliminates direction-dependent trajectory bugs
- Realistic ballistic arcs
- Separates concerns: ground movement vs elevation

**Implementation:**
- Ground coordinates (groundX, groundY) - no gravity
- Height coordinate (heightZ) - with gravity
- Velocity split: horizontal (groundVx, groundVy) + vertical (heightVz)
- Sign convention: heightVz > 0 = upward, gravity subtracts from heightVz

### 6. Isometric Coordinate Transforms

**Forward (3D → Screen):**
```
screenX = groundX - groundY
screenY = (groundX + groundY) / 2 - heightZ
```

**Inverse (Screen → 3D):**
```
groundX = screenX/2 + screenY + heightZ
groundY = screenY - screenX/2 + heightZ
```

**Azimuth Conversion (Screen Angle → Ground Angle):**
```
cos_azimuth = (cos_fire + 2*sin_fire) / norm
sin_azimuth = (2*sin_fire - cos_fire) / norm
```

### 7. Event Broadcasting

All combat events are broadcast to ALL participants in the space:
- `projectile-spawn` - When cannon fires
- `ship-damaged` - When hit validated
- `ship-respawn` - When ship respawns after sinking

This ensures all clients have consistent combat state.

## Current Implementation Status

### Implemented:
- ✅ Ship entity with health tracking
- ✅ Cannon control (aim, elevation, fire)
- ✅ 3D projectile physics (ground + height separation)
- ✅ Projectile spawning and broadcasting
- ✅ Client-side physics simulation
- ✅ Visual effects (blasts, impacts, splashes, trails)
- ✅ Sound effects (cannon fire, impacts, splashes, sinking, respawn)
- ✅ Hit detection (client-side OBB collision)
- ✅ Hit validation (server-side physics replay)
- ✅ Damage application
- ✅ Sinking state and effects
- ✅ Ship respawn

### Known Issues:
- 🐛 Direction-dependent distance bug at max elevation
  - West-facing: ~20 tiles
  - South-facing: ~1 tile
  - Likely issue with azimuth calculation or ship velocity inheritance

### Future Enhancements:
- 🔮 Projectile-projectile collisions (cannonballs deflecting mid-air)
- 🔮 Environmental factors (wind affecting trajectory)
- 🔮 Different projectile types (grapeshot, chain shot)
- 🔮 Ricochet physics (bouncing off ship hulls)
- 🔮 Advanced damage model (different damage zones on ship)

## References

- Ship Server Implementation: `src/mcp-servers/ship-server/ShipServer.ts`
- Projectile Manager (Client): `clients/seacat/src/game/managers/ProjectileManager.ts`
- Ship Manager (Client): `clients/seacat/src/game/managers/ShipManager.ts`
- Type Definitions: `src/mcp-servers/ship-server/types.ts`, `clients/seacat/src/types.ts`
- Related Proposals: `spec/seacat/proposals/p2v-projectile-velocity/`
