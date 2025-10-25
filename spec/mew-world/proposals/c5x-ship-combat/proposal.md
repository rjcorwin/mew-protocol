# Ship-to-Ship Combat System (c5x-ship-combat)

**Status:** Draft
**Created:** 2025-01-24
**Area:** MEW World Game Feature
**Complexity:** High

## Overview

Add ship-to-ship combat mechanics to MEW World, allowing players to fire cannons at other ships. This feature enables cooperative multi-crew gameplay where players coordinate steering, sailing, and combat.

## Motivation

Currently ships provide exploration and navigation but lack gameplay conflict/cooperation mechanics. Ship combat:
- Creates engaging multiplayer objectives
- Enables cooperative crew gameplay
- Adds strategic depth to ship navigation
- Provides clear win/lose conditions
- Demonstrates MEW protocol's multi-participant coordination

## Design Goals

1. **Multi-crew cooperative**: Multiple players control different ship systems
2. **Physics-based**: Projectiles follow realistic arcs with gravity
3. **Strategic positioning**: Ship orientation and range matter
4. **Visual feedback**: Clear indicators for aiming, firing, hits, damage
5. **Network efficient**: Minimal message overhead for combat state
6. **Extensible**: Foundation for future combat features

## Core Mechanics

### 1. Cannon Control Points

Ships have 2-4 cannon positions (port/starboard):
- **Port cannons** (left side): 1-2 control points
- **Starboard cannons** (right side): 1-2 control points
- Players interact with cannons like wheel/sails (E key)
- Cannons have fixed firing arc (perpendicular to ship + 45° forward/back)

### 2. Firing Mechanics

When controlling a cannon:
- **Aim**: Left/Right arrows adjust angle within arc (±45° from perpendicular)
- **Fire**: Up arrow fires cannon (if loaded and cooled down)
- **Visual indicator**: Arc overlay showing aim direction and range
- **Cooldown**: 3-5 second reload time per cannon
- **Sound/particle effects**: Cannon blast, smoke

### 3. Projectile Physics

Cannonballs are physics-simulated projectiles:
- **Spawn**: At cannon position on ship (offset from center)
- **Initial velocity**: Direction = aim angle, speed = 300 px/s
- **Gravity**: Constant downward acceleration (simulated Y velocity)
- **Collision**: Check against ship hulls each frame
- **Splash**: Water impact if miss, smoke/debris if hit
- **Range**: ~400-600 pixels depending on angle

### 4. Damage System

Ships have health points:
- **Starting health**: 100 HP
- **Cannonball damage**: 20-25 HP per hit
- **Visual feedback**:
  - Hit markers (particle burst at impact)
  - Ship sprite darkens/cracks as health decreases
  - Smoke emanates from damaged ship
- **Sinking**: At 0 HP, ship stops moving, visual sinking animation
- **Respawn**: After 30 seconds, ship respawns at starting position

## Protocol Messages

### Ship State Extensions

Extend `game/position` payload for ships:

```typescript
interface ShipData {
  // ... existing fields
  health: number;              // 0-100
  maxHealth: number;           // 100
  sinking: boolean;            // true if health <= 0
  cannons: {
    port: CannonState[];
    starboard: CannonState[];
  };
}

interface CannonState {
  index: number;               // 0, 1, etc.
  relativePosition: {x, y};    // Ship-local coords
  aimAngle: number;            // Radians, relative to ship
  cooldownRemaining: number;   // ms until can fire again
  controlledBy: string | null; // Player ID
}
```

### New Message Types

#### `ship/aim_cannon`
Player adjusts cannon aim angle.

```typescript
{
  kind: 'ship/aim_cannon',
  to: ['ship1'],
  payload: {
    side: 'port' | 'starboard',
    index: number,
    aimAngle: number,      // Radians, clamped to ±π/4
    playerId: string
  }
}
```

#### `ship/fire_cannon`
Player fires cannon.

```typescript
{
  kind: 'ship/fire_cannon',
  to: ['ship1'],
  payload: {
    side: 'port' | 'starboard',
    index: number,
    playerId: string
  }
}
```

Response: Ship broadcasts projectile spawn event.

#### `game/projectile_spawn`
Ship notifies clients of projectile.

```typescript
{
  kind: 'game/projectile_spawn',
  to: [],  // Broadcast
  payload: {
    id: string,                // Unique projectile ID
    type: 'cannonball',
    sourceShip: string,        // Ship ID that fired
    position: {x, y},          // World coords
    velocity: {x, y},          // Initial velocity vector
    timestamp: number
  }
}
```

#### `game/projectile_hit`
Projectile hits a ship.

```typescript
{
  kind: 'game/projectile_hit',
  to: [],  // Broadcast
  payload: {
    projectileId: string,
    targetShip: string,
    hitPosition: {x, y},       // World coords
    damage: number,
    timestamp: number
  }
}
```

#### `ship/damage`
Ship takes damage (sent by hit ship).

```typescript
{
  kind: 'ship/damage',
  to: [],  // Broadcast
  payload: {
    shipId: string,
    damage: number,
    newHealth: number,
    sinking: boolean,
    timestamp: number
  }
}
```

## Client Rendering

### Cannon Indicators

When player is near cannon control point:
- Yellow circle at cannon position (like wheel/sails)
- Aiming arc overlay (translucent cone showing firing range)
- Crosshair showing current aim direction

When controlling cannon:
- Arc brightens, crosshair enlarges
- Cooldown progress bar
- Range indicator (distance markers)

### Projectiles

Client-side physics simulation:
- Render cannonball sprite (small black sphere)
- Trail particle effect (smoke puff)
- Parabolic arc following velocity + gravity
- Remove on impact or max range (2 seconds)

### Hit Effects

- **Direct hit**: Particle burst (wood splinters + smoke)
- **Water splash**: Blue particle fountain if miss
- **Damage smoke**: Persistent smoke emitter on damaged ship

### Health Display

- Health bar above ship (visible to all players)
- Color: Green (100%) → Yellow (50%) → Red (20%)
- Flashes on hit

## Implementation Phases

### Phase 1: Control Points & Aiming (Week 1)
- Add cannon control points to ship config
- Implement grab/release for cannons
- Add aiming with left/right arrows
- Render aim arc and crosshair
- **Deliverable**: Players can control cannons and aim

### Phase 2: Firing & Projectiles (Week 1)
- Implement fire cannon message/handler
- Client-side projectile physics
- Spawn/despawn projectiles with networking
- Visual effects (blast, trail, splash)
- **Deliverable**: Players can fire cannons (no damage yet)

### Phase 3: Collision & Damage (Week 2)
- Ship hull collision detection
- Damage system in ship server
- Health state sync
- Hit particle effects
- Health bar rendering
- **Deliverable**: Cannonballs damage ships

### Phase 4: Sinking & Respawn (Week 2)
- Sinking state and animation
- Respawn timer and logic
- Win/lose UI feedback
- Balance tuning (damage, cooldown, range)
- **Deliverable**: Complete combat loop

### Phase 5: Polish & Sounds (Week 3)
- Sound effects (cannon blast, splash, hit, sinking)
- Enhanced particle effects
- Ship damage visuals (cracks, holes)
- Score tracking (hits/kills)
- **Deliverable**: Production-ready feature

## Technical Challenges

### 1. Projectile Authority
**Problem**: Who simulates projectile physics?
**Solution**:
- Ship server spawns projectile (authority)
- All clients simulate independently (deterministic physics)
- Clients detect hits locally, ship validates
- Ship server is final authority on damage

### 2. Hit Detection
**Problem**: Network latency + moving targets
**Solution**:
- Client predicts hits locally for visual feedback
- Ship server validates hits server-side
- Use timestamp reconciliation for fairness
- Generous hitboxes (~1.5x ship size)

### 3. Collision with Rotating Ships
**Problem**: Ships rotate, so collision bounds change
**Solution**:
- Use OBB (Oriented Bounding Box) collision (already implemented)
- Check projectile point vs rotated ship rectangle
- Early-out optimization: distance check before OBB

### 4. Performance
**Problem**: Multiple projectiles + particles + collision checks
**Solution**:
- Max 10 active projectiles per ship
- Despawn after 2 seconds (max range)
- Object pooling for particles
- Spatial partitioning for collision checks (optional)

## Balance Parameters

```typescript
const CANNON_CONFIG = {
  cooldownMs: 4000,           // 4 second reload
  aimSpeed: Math.PI / 4,      // 45° per second
  aimArcMax: Math.PI / 4,     // ±45° from perpendicular

  projectileSpeed: 300,        // px/s
  projectileGravity: 150,      // px/s² downward
  projectileLifetime: 2000,    // ms before despawn

  damage: 25,                  // HP per hit
  hitboxPadding: 1.2,          // 20% larger hitbox

  effectsRange: 800,           // Max distance to render effects
};

const SHIP_HEALTH = {
  maxHealth: 100,
  sinkingDuration: 5000,       // 5 second sink animation
  respawnDelay: 30000,         // 30 second respawn
};
```

## Alternative Designs Considered

### Alt 1: Automatic Aiming
Cannons auto-aim at nearest enemy ship within arc.
- **Pros**: Easier for casual players
- **Cons**: Reduces skill ceiling, less strategic
- **Rejected**: Manual aiming more engaging

### Alt 2: Broadside Only
Cannons fire perpendicular to ship (no aim adjustment).
- **Pros**: Simpler implementation, encourages maneuvering
- **Cons**: Less player agency, frustrating in tight spaces
- **Rejected**: Aim control adds meaningful skill

### Alt 3: Server-Side Projectile Simulation
Ship server simulates all projectile physics.
- **Pros**: Single source of truth, prevents cheating
- **Cons**: Network latency feels bad, server CPU load
- **Rejected**: Client prediction + server validation better UX

## Future Extensions

### Phase 6+: Advanced Features
- **Multiple ammo types**: Chain shot (slows ship), grapeshot (damages crew)
- **Crew damage**: Reduce max speed if crew hit
- **Boarding**: Grappling hooks + melee combat
- **Environmental hazards**: Rocks, storms, whirlpools
- **Ship upgrades**: Better cannons, armor, speed
- **AI ships**: NPC enemies for PvE

## Success Metrics

- **Engagement**: 80%+ of playtests involve combat
- **Balance**: Average combat lasts 30-60 seconds
- **Performance**: <5ms per frame for projectile simulation
- **Network**: <100 bytes per shot (excluding initial spawn)
- **Accessibility**: New players hit 30%+ shots within 5 minutes

## Open Questions

1. Should friendly fire be enabled?
2. How to handle respawn location (fixed vs dynamic)?
3. Should damaged ships move slower?
4. Limit on concurrent cannons per ship?
5. Victory condition for combat (first to X kills)?

## References

- Existing ship control: `src/mcp-servers/ship-server/`
- Isometric rotation: `clients/mew-world/src/game/GameScene.ts:rotatePointIsometric()`
- Control point interaction: `GameScene.ts:checkShipInteractions()`
- Ship-to-ship collision: Already has OBB collision for deck boundaries
