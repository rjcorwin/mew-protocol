# Research: 3D Isometric Projectile Physics (p2v-projectile-velocity)

## Background

Seacat uses isometric projection for rendering a 2D game world in a pseudo-3D perspective. Cannon projectiles follow ballistic physics with gravity, requiring proper handling of the coordinate system transformation.

## Isometric Coordinate System

### Screen vs Ground Coordinates

Isometric projection maps 2D ground coordinates to 2D screen coordinates using a 2:1 ratio diamond grid:

```
Ground space (map):     Screen space (display):
   groundY                      screenY
      ↑                            ↑
      |                           /
      |                          /
      +---→ groundX            +---→ screenX
```

### Forward Transform (Ground → Screen)

```typescript
screenX = groundX - groundY
screenY = (groundX + groundY) / 2
```

### Inverse Transform (Screen → Ground)

```typescript
groundX = screenX / 2 + screenY
groundY = screenY - screenX / 2
```

## The Problem: Screen Y Conflates Two Dimensions

In standard 2D graphics, `screenY` represents only vertical position. But in isometric projection, `screenY` mixes:

1. **Ground position** (north/south on the map) - from `(groundX + groundY) / 2`
2. **Height/elevation** (up/down in 3D space) - subtracted from the result

Full formula with height:
```typescript
screenY = (groundX + groundY) / 2 - heightZ
```

This conflation causes problems for physics simulation where gravity should only affect height, not ground position.

## Attempted Solutions

### Naive Approach (Original Bug)

Apply gravity directly to `screenY`:

```typescript
// WRONG: Gravity affects both ground movement AND height
velocity.y += GRAVITY * dt
sprite.y += velocity.y * dt
```

**Problem:** Gravity now affects ground position, causing north/south shots to behave differently than east/west shots.

### 2D Screen-Space Physics (Rejected)

Ignore isometric coordinates and treat everything as 2D screen space:

```typescript
velocity.x = cos(angle) * speed
velocity.y = -elevation  // Only elevation, no ground movement
```

**Problem:** Projectiles don't move north/south on the map, they just move up/down on screen while staying in the same ground position.

### Scaled Sin Component (Rejected)

Add a scaling factor to balance ground movement with elevation:

```typescript
velocity.y = sin(angle) * speed * 0.65 - elevation
```

**Problem:** Arbitrary magic number with no clear justification. Distances still unequal. Breaks if tile dimensions, gravity, or elevation change.

## Correct Solution: Separate 3D Coordinates

Track projectiles in true 3D space with distinct dimensions:

```typescript
interface Projectile {
  // Ground position (horizontal map movement)
  groundX: number
  groundY: number
  groundVx: number  // Velocity in ground-space
  groundVy: number

  // Height (vertical elevation)
  heightZ: number
  heightVz: number  // Velocity upward/downward
}
```

### Physics Update (Client)

```typescript
// Update ground position - NO gravity
groundX += groundVx * dt
groundY += groundVy * dt

// Update height - WITH gravity
heightVz -= GRAVITY * dt
heightZ += heightVz * dt

// Convert to screen for rendering
sprite.x = groundX - groundY
sprite.y = (groundX + groundY) / 2 - heightZ
```

### Coordinate Space Conversion

When firing a cannon at screen-space angle `fireAngle`, we must convert to ground-space azimuth:

```typescript
// Screen direction vectors
const cos_fire = Math.cos(fireAngle)
const sin_fire = Math.sin(fireAngle)

// Inverse isometric transform to get ground direction
const cos_azimuth_unnorm = cos_fire + 2 * sin_fire
const sin_azimuth_unnorm = 2 * sin_fire - cos_fire

// Normalize
const norm = Math.sqrt(cos_azimuth_unnorm² + sin_azimuth_unnorm²)
const cos_azimuth = cos_azimuth_unnorm / norm
const sin_azimuth = sin_azimuth_unnorm / norm

// Ground-space velocity
groundVx = speed * cos_azimuth
groundVy = speed * sin_azimuth
```

**Derivation:**

Given isometric transform: `screenX = gX - gY`, `screenY = (gX + gY)/2`

Direction vector in screen space: `(cos θ, sin θ)`

We need ground direction `(cos φ, sin φ)` such that:
```
cos θ = d(screenX)/ds = d(gX - gY)/ds
sin θ = d(screenY)/ds = d((gX + gY)/2)/ds
```

Where `s` is arc length along the ground path.

Solving:
```
cos θ = cos φ - sin φ
sin θ = (cos φ + sin φ) / 2
```

Rearranging:
```
cos φ = cos θ + 2 sin θ
sin φ = 2 sin θ - cos θ
```

(Then normalize to unit vector)

## Server Hit Validation

The server must validate hit claims by replaying the exact physics simulation the client performed. Two key requirements:

### 1. Iterative Integration (Not Analytical)

The client uses Euler integration frame-by-frame at 60 FPS:

```typescript
// Client physics loop
for each frame {
  heightVz -= GRAVITY * dt
  heightZ += heightVz * dt
}
```

Using the analytical ballistic equation `h = h₀ + v₀t - ½gt²` would diverge from the client's numerical integration over time. The server MUST simulate frame-by-frame to match exactly.

### 2. Height Threshold Validation

The client only allows hits when projectiles are at deck level:

```typescript
if (Math.abs(heightZ) > DECK_HEIGHT_THRESHOLD) {
  return  // Skip hit detection
}
```

The server must enforce the same threshold, otherwise cheating clients could claim hits on high-arcing shots that visually pass over ships.

## Constants Synchronization

| Constant | Value | Location |
|----------|-------|----------|
| `GRAVITY` | 150 px/s² | Client: ProjectileManager.ts:54<br>Server: ShipServer.ts:805 |
| `DECK_HEIGHT_THRESHOLD` | 30 px | Client: ProjectileManager.ts:211<br>Server: ShipServer.ts:806 |
| `FRAME_TIME` | 1/60 sec | Client: Game loop<br>Server: ShipServer.ts:807 |

If these constants drift out of sync, client and server will disagree on hit validation.

## Prior Art

### Factorio

Uses true isometric with separate height layer for terrain. Projectiles track ground position and height independently.

### Diablo II

Uses pseudo-isometric (pre-rendered tiles). Projectiles are 2D sprites with depth sorting, not true 3D physics.

### StarCraft

Similar to Diablo - 2D gameplay with isometric rendering. Flying units have height for collision purposes but not true 3D ballistics.

### Age of Empires II

Implements height map for terrain. Arrows and projectiles use approximated 3D trajectories but not full physics simulation.

## References

- [Isometric Projection - Wikipedia](https://en.wikipedia.org/wiki/Isometric_projection)
- [Isometric Game Programming - Red Blob Games](https://www.redblobgames.com/grids/hexagons/)
- [Ballistic Trajectory - Wikipedia](https://en.wikipedia.org/wiki/Trajectory_of_a_projectile)
- Phaser3 Documentation - Isometric Camera
- Client implementation: `clients/seacat/src/game/managers/ProjectileManager.ts`
- Server implementation: `src/mcp-servers/ship-server/ShipServer.ts`
