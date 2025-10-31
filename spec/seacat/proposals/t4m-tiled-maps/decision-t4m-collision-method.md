# Decision: t4m-collision-method

**Status:** Proposed
**Date:** 2025-10-13
**Deciders:** Seacat Team
**Related:** proposal.md, research.md

## Context

Seacat needs collision detection to prevent players from walking through walls and to implement tile-based gameplay mechanics (e.g., water slowing movement). Three main approaches are available in Phaser 3:

1. **Tile-based collision** - Check tile properties at player position
2. **Arcade Physics** - Use Phaser's built-in physics engine
3. **Matter Physics** - Advanced 2D physics with realistic collisions

## Decision

Use **tile-based collision** with manual position checking.

## Rationale

### Why Tile-Based?

**Simplicity:**
- Direct tile property lookups: `layer.getTileAtWorldXY(x, y)`
- No physics engine overhead
- Easy to understand and debug

**Designer control:**
- Set `walkable: false` property in Tiled
- Immediate visual feedback in map editor
- No code changes needed for new collision tiles

**Performance:**
- O(1) tile lookups
- No physics simulation overhead
- Negligible CPU usage (<1ms per frame)

**Gameplay fit:**
- Seacat is grid-based, not physics-based
- No need for velocity, acceleration, bounce
- Tile properties drive mechanics (water = slow)

### Why Not Arcade Physics?

**Pros:**
- Phaser built-in (well-tested)
- Handles collisions automatically
- Good for platform games

**Cons:**
- Adds physics simulation overhead
- Harder to customize (e.g., water slowdown requires friction hacks)
- Players would need physics bodies (adds complexity)
- Overkill for simple tile-based movement

### Why Not Matter Physics?

**Pros:**
- Realistic physics (rotation, friction, slopes)
- Best collision accuracy

**Cons:**
- Significant complexity
- Much higher performance cost
- Features not needed for Seacat
- Would require redesigning movement system

## Implementation

```typescript
function checkCollision(worldX: number, worldY: number): CollisionResult {
  const tileX = Math.floor(worldX / TILE_WIDTH);
  const tileY = Math.floor(worldY / TILE_HEIGHT);

  // Check bounds
  if (tileX < 0 || tileY < 0 || tileX >= mapWidth || tileY >= mapHeight) {
    return { walkable: false, speedModifier: 0, terrain: "boundary" };
  }

  // Check obstacle layer (walls)
  const obstacleTile = obstacleLayer.getTileAt(tileX, tileY);
  if (obstacleTile && !obstacleTile.properties.walkable) {
    return { walkable: false, speedModifier: 0, terrain: "wall" };
  }

  // Check water layer (swimming)
  const waterTile = waterLayer.getTileAt(tileX, tileY);
  if (waterTile) {
    return {
      walkable: true,
      speedModifier: waterTile.properties.speedModifier || 0.5,
      terrain: "water"
    };
  }

  // Default: walkable ground
  return { walkable: true, speedModifier: 1.0, terrain: "grass" };
}

// In update loop:
const newX = player.x + velocity.x;
const newY = player.y + velocity.y;
const collision = checkCollision(newX, newY);

if (collision.walkable) {
  player.x += velocity.x * collision.speedModifier;
  player.y += velocity.y * collision.speedModifier;
}
```

## Consequences

**Positive:**
- ✅ Simple implementation (< 50 lines of code)
- ✅ Fast performance (O(1) per player)
- ✅ Designer-friendly (Tiled properties)
- ✅ Easy to extend (add new tile properties)
- ✅ No external dependencies

**Negative:**
- ❌ Less precise than pixel-perfect collision
- ❌ Can't have diagonal walls easily
- ❌ Player position between tiles needs rounding logic

**Mitigations:**
- For diagonal walls: Use multiple tiles to approximate slope
- For precision: Player sprite is small (32×32), fits well in 64×32 tiles
- For between-tile positions: Check tile at center of sprite

## Alternatives Considered

### Hybrid Approach
Use tile-based for walls, Arcade Physics for player-player collision.

**Rejected because:**
- Adds complexity without clear benefit
- Players overlapping is acceptable in cooperative game
- Can add player-player collision later if needed

### Server-Side Collision
Validate all collisions on gateway server.

**Future work:**
- Planned for Milestone 7 (Polish & Performance)
- Requires gateway to load map data
- Prevents cheating in competitive modes

## References

- Phaser Tilemap API: https://photonstorm.github.io/phaser3-docs/Phaser.Tilemaps.html
- research.md: Collision Detection Methods
- Similar implementation: phaser3-isometric-tilemap-example
