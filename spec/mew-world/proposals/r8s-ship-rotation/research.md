# Research: Ship Rotation in Isometric Games

## Overview

This document researches how ship rotation is implemented in similar games, technical approaches for rotated collision detection, and performance considerations for rotating player positions on moving platforms.

## Existing Game Implementations

### Stardew Valley (Fishing Boats)

**Approach:**
- Boats have fixed sprite orientation (always face right)
- Movement is grid-aligned, no rotation
- Players snap to fixed positions on boat

**Relevance:** Not applicable - boats don't rotate

### Don't Starve Together (Boats)

**Approach:**
- Boats rotate smoothly in 360°
- Uses polygon collision for hull
- Players maintain relative positions during rotation
- Walking on deck is world-aligned (not ship-relative)

**Technical Details:**
- Boat rotation interpolated over time (not instant)
- Player positions stored in boat-local coordinates
- Transform to world space each frame: `worldPos = boatPos + rotate(localPos, boatAngle)`
- Collision uses rotated bounding box (OBB)

**Relevance:** Highly relevant - similar boat mechanics

### Age of Empires II (Ships)

**Approach:**
- Ships rotate to face movement direction
- Pre-rendered sprites for 8 or 16 rotations
- Collision uses simplified shapes (circles or axis-aligned boxes)
- Units on ships don't walk around deck (fixed garrison)

**Relevance:** Sprite rotation approach applicable, but no deck walking

### Sea of Thieves (Full 3D Ships)

**Approach:**
- 3D ship models rotate in real-time
- Physics-based rotation with momentum
- Players walk on deck using 3D collision meshes
- Movement is ship-relative (walking "forward" follows deck orientation)

**Relevance:** Gold standard for ship mechanics, but 3D vs 2D

### Dwarf Fortress (Boats)

**Approach:**
- ASCII representation, no visual rotation
- Boats have facing direction for mechanics
- Collision is tile-based, no rotation needed

**Relevance:** Not applicable for visual rotation

## Rotation Collision Detection Approaches

### 1. Oriented Bounding Box (OBB)

**Algorithm:**
```
1. Transform point to rectangle's local coordinate system
2. Rotate point by inverse of rectangle's rotation
3. Test if point is inside axis-aligned rectangle
```

**Pros:**
- Exact collision for rectangular boundaries
- O(1) complexity per test
- Simple math (one matrix multiply)

**Cons:**
- Only works for rectangles
- Need separate approach for non-rectangular ships

**Performance:** ~10-20 CPU cycles per test

**Best for:** Rectangular ship decks (our use case)

### 2. Separating Axis Theorem (SAT)

**Algorithm:**
```
For each edge of both polygons:
  Project both polygons onto axis perpendicular to edge
  If projections don't overlap, no collision
If all projections overlap, collision detected
```

**Pros:**
- Works for any convex polygon
- Exact collision detection
- Industry standard for 2D games

**Cons:**
- More complex than OBB
- O(n*m) where n,m are edge counts
- Overkill for rectangles

**Performance:** ~50-100 CPU cycles for two rectangles

**Best for:** Complex ship shapes, ship-to-ship collision

### 3. Polygon Point-in-Polygon (Ray Casting)

**Algorithm:**
```
Cast horizontal ray from point
Count intersections with polygon edges
Odd count = inside, even count = outside
```

**Pros:**
- Works for any polygon (convex or concave)
- Well-understood algorithm
- Easy to implement

**Cons:**
- Edge cases require careful handling
- Slightly slower than OBB for rectangles

**Performance:** ~30-40 CPU cycles for 4-sided polygon

**Best for:** Irregular ship shapes

### 4. Circle Approximation

**Algorithm:**
```
Test if point is within radius distance of ship center
```

**Pros:**
- Extremely fast (one distance calculation)
- No rotation needed

**Cons:**
- Very inaccurate for rectangular ships
- Can't detect being on specific part of deck

**Performance:** ~5 CPU cycles

**Best for:** Simple proximity checks, not deck boundaries

### Recommendation

**Use OBB for deck boundaries:**
- Exact collision for rectangular decks
- Fastest option for rectangles
- Simple implementation
- Can upgrade to SAT later if ship shapes become complex

## Player Rotation Mathematics

### 2D Rotation Matrix

Rotate point (x, y) by angle θ around origin:

```
x' = x * cos(θ) - y * sin(θ)
y' = x * sin(θ) + y * cos(θ)
```

Rotate point around arbitrary center (cx, cy):

```
1. Translate to origin: (x - cx, y - cy)
2. Rotate: (x', y') using matrix above
3. Translate back: (x' + cx, y' + cy)
```

### Optimizations

**Pre-calculate sin/cos:**
```typescript
// Bad: Calculate every frame for every player
players.forEach(p => {
  const cos = Math.cos(ship.rotation);
  const sin = Math.sin(ship.rotation);
  // ... rotate player
});

// Good: Calculate once per ship
const cos = Math.cos(ship.rotation);
const sin = Math.sin(ship.rotation);
players.forEach(p => {
  // ... use cached cos/sin
});
```

**Use rotation delta, not absolute:**
```typescript
// Bad: Recalculate from ship center each frame
player.worldPos = rotateAroundPoint(player.localPos, ship.center, ship.rotation);

// Good: Only rotate when ship actually turns
onShipRotate(rotationDelta) {
  player.localPos = rotatePoint(player.localPos, rotationDelta);
}
```

**Avoid accumulating floating point error:**
```typescript
// Bad: Accumulate rotations (error compounds)
player.rotation += rotationDelta;

// Good: Recalculate from canonical source
player.rotation = ship.rotation + player.localRotationOffset;
```

## Performance Considerations

### Rotation Frequency

**Best Practice:** Only rotate players when ship actually changes heading

```typescript
// Don't rotate every frame
update() {
  if (ship.rotation !== ship.lastRotation) {
    rotatePlayersOnShip(ship, ship.rotation - ship.lastRotation);
    ship.lastRotation = ship.rotation;
  }
}
```

**Expected Frequency:**
- Ship heading changes: ~0.5-2 Hz (user steering input)
- Position updates: 10 Hz (constant)
- Game loop: 60 Hz (constant)

**Rotation cost:** Only paid ~0.5-2 times per second, not 60 times

### Batch Processing

**Optimize for multiple players:**

```typescript
// Bad: Calculate sin/cos for each player
players.forEach(player => {
  if (player.onShip === shipId) {
    const rotated = rotatePoint(player.pos, ship.rotation);
    // ...
  }
});

// Good: Calculate once, apply to all
const playersOnShip = players.filter(p => p.onShip === shipId);
if (playersOnShip.length > 0) {
  const cos = Math.cos(rotationDelta);
  const sin = Math.sin(rotationDelta);
  playersOnShip.forEach(player => {
    const x = player.pos.x;
    const y = player.pos.y;
    player.pos.x = x * cos - y * sin;
    player.pos.y = x * sin + y * cos;
  });
}
```

### Memory Layouts

**Cache-friendly player data:**

```typescript
// Bad: Scattered object properties
class Player {
  id: string;
  sprite: Sprite;
  name: string;
  onShip: string | null;
  shipRelativeX: number;
  shipRelativeY: number;
  // ... 20 other properties
}

// Good: Group hot data together
class Player {
  // Hot data (accessed every frame)
  shipRelativePosition: { x: number, y: number };
  onShip: string | null;

  // Cold data (accessed rarely)
  metadata: {
    id: string;
    name: string;
    sprite: Sprite;
    // ...
  };
}
```

### Profiling Results (Estimated)

**Cost per player rotation:**
- 2 multiplies + 2 adds + sin/cos lookup = ~10 CPU cycles
- For 10 players on ship: ~100 CPU cycles total
- At 60 FPS: 6,000 cycles/second = 0.002ms on 3GHz CPU

**Conclusion:** Player rotation cost is negligible, even with dozens of players

## Phaser-Specific Considerations

### Sprite Rotation

Phaser sprites have built-in rotation:

```typescript
sprite.setRotation(angleInRadians); // Set absolute rotation
sprite.rotation += deltaRadians;     // Increment rotation
sprite.angle = degrees;              // Set in degrees
```

**Important:** Phaser uses radians by default, degrees with `.angle` property

### Scene Graph Rotation

Making objects children of rotated sprites:

```typescript
// Child automatically rotates with parent
shipSprite.add(controlPointGraphics);
controlPointGraphics.setPosition(relativeX, relativeY);
// When shipSprite.rotation changes, child rotates too
```

**Pros:**
- Automatic rotation propagation
- No manual calculation needed
- Handles nested rotations

**Cons:**
- Can't easily mix world-space and local-space children
- Player sprites probably shouldn't be children (they walk off ship)

**Use for:** Control points, deck fixtures (permanent ship features)
**Don't use for:** Players (they board/leave)

### Rotation Interpolation

Phaser has built-in tweens for smooth rotation:

```typescript
this.tweens.add({
  targets: shipSprite,
  rotation: targetRotation,
  duration: 500, // 0.5 seconds
  ease: 'Sine.easeInOut'
});
```

**Considerations:**
- Players must rotate during tween, not just at end
- Need to track rotation in `update()` and rotate players incrementally
- Alternative: Manual interpolation for more control

## Isometric-Specific Challenges

### Visual vs Logical Rotation

In isometric view, rotation has two meanings:

1. **Logical rotation:** Ship's heading in world space (0° = east)
2. **Visual rotation:** Sprite rotation on screen

For orthogonal isometric (our case), they're the same. For true isometric projection, need to account for camera angle.

**Our case:** No special handling needed

### Z-Ordering with Rotation

Rotated ships may overlap with terrain tiles differently:

```typescript
// Update sprite depth based on y-position (standard isometric)
ship.sprite.setDepth(ship.position.y);

// Players on deck should render above ship
player.sprite.setDepth(ship.sprite.depth + 1);
```

**Important:** Depth must update as ship moves, not just rotates

### Tile Collision for Rotated Ships

Ship collision with terrain is more complex when rotated:

**Current (non-rotated):**
- Test 5 points (center + 4 corners) against navigable tiles

**With rotation:**
- Calculate rotated corner positions
- Test rotated corners against tiles
- May need to test more points for diagonal orientations

**Example:** 64×96 ship rotated 45° has different footprint than axis-aligned

## Alternative: Pre-Rendered Rotation

Instead of runtime rotation, use 8 different ship sprites:

### Pros
- No rotation math needed
- Can hand-craft each angle for pixel-perfect art
- Potentially better visual quality
- Common in classic isometric games

### Cons
- 8× sprite memory usage
- 8× art asset creation time
- Can't smoothly interpolate between angles
- Still need rotated collision logic

### Conclusion

Runtime rotation is better for our use case:
- Placeholder art doesn't need pixel-perfect quality
- Smooth interpolation desirable for gameplay feel
- Single sprite easier to manage during prototyping
- Can switch to pre-rendered later if needed

## Security Considerations

### Client-Side Rotation Validation

Ships broadcast rotation, clients apply it:

**Potential issue:** Malicious client sends fake rotation

**Mitigation:**
- Ship rotation is authoritative on ship server
- Clients only render, don't control rotation
- Invalid rotations ignored (e.g., rotation not matching heading)

**Validation:**
```typescript
// Client receives ship position update
if (Math.abs(update.rotation - headingToRotation(update.heading)) > 0.01) {
  console.warn('Invalid rotation for heading, ignoring');
  return;
}
```

### Player Position Validation

Players on deck broadcast their ship-relative positions:

**Potential issue:** Player claims to be on ship but outside deck boundary

**Mitigation:**
- Server validates player is within rotated deck boundary
- Eject players who move outside boundary
- Clamp positions to deck edges

**Not implemented yet, but should be added when ship rotation goes live**

## Recommended Implementation Order

Based on research findings:

1. **Phase A (Low Risk):** Add rotation to ship sprite rendering
   - Pure visual change, no gameplay impact
   - Test with simple brown rectangle

2. **Phase B (Medium Risk):** Rotate deck boundary collision
   - Implement OBB collision
   - Affects boarding detection, needs thorough testing

3. **Phase D (Low Risk):** Rotate control points using scene graph
   - Make graphics children of ship sprite
   - Leverage Phaser's built-in rotation

4. **Phase C (High Risk):** Rotate players on deck
   - Most complex, affects all players simultaneously
   - Needs careful synchronization testing

5. **Phase F (Polish):** Add smooth rotation interpolation
   - Visual improvement only, low risk

6. **Phase E (Optional):** Ship-relative player movement
   - May confuse players, could skip or make configurable

## Open Questions

1. **Should rotation be instant or interpolated?**
   - Research suggests interpolated feels better
   - Need to test with playtesters

2. **Should players rotate with ship or stay world-aligned?**
   - Most games rotate players
   - Feels more realistic
   - **Recommendation:** Rotate players

3. **Should walking on deck be ship-relative or world-aligned?**
   - Don't Starve: world-aligned (simpler)
   - Sea of Thieves: ship-relative (more realistic)
   - **Recommendation:** Start with world-aligned, add ship-relative later if desired

4. **How fast should ships rotate?**
   - Instant: gameplay-focused, less realistic
   - 0.5s: balanced
   - 1-2s: realistic, may feel sluggish
   - **Recommendation:** 0.5s (configurable)

5. **Should rotation be smooth or snap to 45° increments?**
   - Snap: matches 8-direction system
   - Smooth: better visuals
   - **Recommendation:** Smooth interpolation between 45° snapped targets

## References

- Don't Starve Together boat mechanics: https://dontstarve.fandom.com/wiki/Boat
- Phaser rotation docs: https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Transform.html
- 2D rotation matrix: https://en.wikipedia.org/wiki/Rotation_matrix
- OBB collision: https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/2d-rotated-rectangle-collision-r2604/
- SAT algorithm: https://dyn4j.org/2010/01/sat/
- Isometric z-ordering: https://shaunlebron.github.io/IsometricBlocks/
