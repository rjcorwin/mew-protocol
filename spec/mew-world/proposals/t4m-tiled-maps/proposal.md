# Proposal t4m: Tiled Map Integration with Collision and Tile Properties

**Status:** Draft
**Area:** MEW World
**Created:** 2025-10-13
**Proposal Code:** t4m (Tiled for MEW)

## Summary

Add support for loading isometric maps created in Tiled Map Editor, including:
- Tile-based collision detection (walls, boundaries)
- Tile properties affecting gameplay (water tiles reduce movement speed)
- Map boundary enforcement preventing players from leaving the playable area
- Integration with Phaser's tilemap system for efficient rendering

## Motivation

The current MEW World implementation generates a simple procedural grid with no collision detection or terrain variety. Players can:
- Move infinitely off the map edges
- Overlap with each other
- Not experience different terrain types

Tiled Map Editor is the industry-standard tool for creating 2D tile-based maps. Supporting Tiled maps enables:
1. **Designer-friendly workflow** - Visual map creation without coding
2. **Rich terrain variety** - Multiple tile types (grass, water, walls, roads)
3. **Gameplay depth** - Tile properties affect movement (swimming, obstacles)
4. **Reusable content** - Community can share custom maps

## Goals

### Primary Goals
1. Load `.tmx` (Tiled Map) and `.tsx` (tileset) files in JSON format
2. Render isometric maps with multiple layers (ground, decorations, walls)
3. Implement tile-based collision detection
4. Support tile properties (e.g., `walkable: false`, `speedModifier: 0.5`)
5. Enforce map boundaries preventing off-map movement
6. Synchronize tile-based positions across multiplayer clients

### Non-Goals (Future Work)
- Animated tiles
- Dynamic tile changes during gameplay
- Map editor integration within MEW World
- Procedural map generation from Tiled templates

## Technical Design

### Map File Format

**Tiled Export Format:** JSON (`.tmj` for maps, `.tsj` for tilesets)

**Directory structure:**
```
clients/mew-world/assets/maps/
├── example-map.tmj          # Tiled map (JSON format)
├── tilesets/
│   ├── terrain.tsj          # Tileset definition
│   └── terrain.png          # Tileset image
└── README.md                # Map creation guide
```

### Tile Properties Schema

Tilesets define custom properties per tile:

```json
{
  "id": 42,
  "properties": [
    { "name": "walkable", "type": "bool", "value": true },
    { "name": "speedModifier", "type": "float", "value": 1.0 },
    { "name": "terrain", "type": "string", "value": "grass" }
  ]
}
```

**Standard properties:**
- `walkable` (boolean): Can players move onto this tile? (default: true)
- `speedModifier` (float): Movement speed multiplier (default: 1.0, water: 0.5)
- `terrain` (string): Semantic type ("grass", "water", "wall", "road")
- `collisionType` (string): "full" | "partial" | "none" (future: diagonal walls)

### Map Layers

**Required layers (bottom to top):**
1. **Ground** - Walkable terrain (grass, sand, stone)
2. **Water** (optional) - Liquid tiles with speedModifier
3. **Obstacles** - Non-walkable tiles (walls, rocks, trees)
4. **Decorations** (optional) - Visual-only (flowers, shadows)

Each layer rendered as separate Phaser tilemap layer for performance.

### Collision System

**Tile-based collision detection:**

```typescript
interface TileCollision {
  walkable: boolean;
  speedModifier: number;
  terrain: string;
}

function checkTileCollision(worldX: number, worldY: number): TileCollision {
  // Convert world coordinates to tile coordinates
  const tileX = Math.floor(worldX / TILE_WIDTH);
  const tileY = Math.floor(worldY / TILE_HEIGHT);

  // Check bounds
  if (tileX < 0 || tileY < 0 || tileX >= mapWidth || tileY >= mapHeight) {
    return { walkable: false, speedModifier: 0, terrain: "boundary" };
  }

  // Get tile from obstacle layer (highest priority)
  const obstacleTile = obstacleLayer.getTileAt(tileX, tileY);
  if (obstacleTile && !obstacleTile.properties.walkable) {
    return { walkable: false, speedModifier: 0, terrain: obstacleTile.properties.terrain };
  }

  // Get tile from water layer
  const waterTile = waterLayer.getTileAt(tileX, tileY);
  if (waterTile) {
    return {
      walkable: true,
      speedModifier: waterTile.properties.speedModifier || 0.5,
      terrain: "water"
    };
  }

  // Default to ground tile
  return { walkable: true, speedModifier: 1.0, terrain: "grass" };
}
```

**Movement integration:**

```typescript
update(time: number, delta: number) {
  // Calculate intended new position
  const newX = this.localPlayer.x + velocity.x;
  const newY = this.localPlayer.y + velocity.y;

  // Check collision at new position
  const collision = checkTileCollision(newX, newY);

  if (collision.walkable) {
    // Apply speed modifier
    this.localPlayer.x += velocity.x * collision.speedModifier;
    this.localPlayer.y += velocity.y * collision.speedModifier;

    // Update current terrain for effects (future: footstep sounds)
    this.currentTerrain = collision.terrain;
  } else {
    // Collision - don't move
    // Future: slide along walls
  }
}
```

### Map Boundaries

**Hard boundaries prevent off-map movement:**

```typescript
// Map bounds from Tiled map dimensions
const mapBounds = {
  minX: 0,
  minY: 0,
  maxX: map.widthInPixels,
  maxY: map.heightInPixels
};

// Clamp player position
this.localPlayer.x = Phaser.Math.Clamp(this.localPlayer.x, mapBounds.minX, mapBounds.maxX);
this.localPlayer.y = Phaser.Math.Clamp(this.localPlayer.y, mapBounds.minY, mapBounds.maxY);
```

### Loading Maps

**Map selection at connection:**

Option 1: Space template specifies default map
```yaml
# templates/mew-world/space.yaml
game:
  map: "example-map"
```

Option 2: Connection form includes map selector (future)

**Loading in Phaser:**

```typescript
preload() {
  // Load Tiled map JSON
  this.load.tilemapTiledJSON('map', 'assets/maps/example-map.tmj');

  // Load tileset images
  this.load.image('terrain', 'assets/maps/tilesets/terrain.png');
}

create() {
  // Create tilemap
  const map = this.make.tilemap({ key: 'map' });
  const tileset = map.addTilesetImage('terrain', 'terrain');

  // Create layers
  const groundLayer = map.createLayer('Ground', tileset, 0, 0);
  const waterLayer = map.createLayer('Water', tileset, 0, 0);
  const obstacleLayer = map.createLayer('Obstacles', tileset, 0, 0);

  // Set collision on obstacle layer
  obstacleLayer.setCollisionByProperty({ walkable: false });

  // Store for collision checks
  this.obstacleLayer = obstacleLayer;
  this.waterLayer = waterLayer;
}
```

### Network Synchronization

**Position updates unchanged** - still broadcast world coordinates (pixels).
Tile-based collision is **client-side** for responsiveness.

**Future: Server-side validation** (Milestone 7: Polish)
- Gateway validates positions against map
- Prevents cheating (flying through walls)
- Requires gateway to load map data

### Tile Coordinate System

**Two coordinate systems in use:**

1. **Tile coordinates** (grid positions)
   - Used for: Map data, collision lookups
   - Range: (0, 0) to (mapWidth-1, mapHeight-1)

2. **World coordinates** (pixel positions)
   - Used for: Sprite positions, rendering
   - Range: Depends on isometric projection

**Conversion functions:**

```typescript
function worldToTile(worldX: number, worldY: number): { x: number, y: number } {
  return {
    x: Math.floor(worldX / TILE_WIDTH),
    y: Math.floor(worldY / TILE_HEIGHT)
  };
}

function tileToWorld(tileX: number, tileY: number): { x: number, y: number } {
  return {
    x: (tileX - tileY) * (TILE_WIDTH / 2),
    y: (tileX + tileY) * (TILE_HEIGHT / 2)
  };
}
```

## Implementation Plan

### Phase 1: Basic Map Loading (Milestone 3a)

1. Create example Tiled map with multiple layers
2. Implement map loading in Phaser preload/create
3. Render tilemap layers (replace procedural grid)
4. Update camera bounds to match map dimensions
5. Test with single player

### Phase 2: Collision Detection (Milestone 3b)

1. Implement tile-based collision checking
2. Add map boundary enforcement
3. Prevent movement onto non-walkable tiles
4. Test collision with walls and map edges

### Phase 3: Tile Properties (Milestone 3c)

1. Read tile properties from Tiled data
2. Implement speedModifier for water tiles
3. Visual feedback when entering water (future: animation)
4. Test swimming mechanics

### Phase 4: Multiplayer Validation (Milestone 3d)

1. Test collision with multiple players
2. Verify position synchronization still works
3. Document map creation workflow
4. Create additional example maps

## Migration Strategy

**Backward compatibility:** Keep procedural grid as fallback

```typescript
preload() {
  // Try to load Tiled map
  this.load.tilemapTiledJSON('map', 'assets/maps/default.tmj');

  this.load.on('loaderror', (file) => {
    if (file.key === 'map') {
      console.warn('Map not found, using procedural grid');
      this.useProcedural = true;
    }
  });
}

create() {
  if (this.useProcedural) {
    this.createIsometricGround(); // Existing code
  } else {
    this.loadTiledMap(); // New code
  }
}
```

## Performance Considerations

**Phaser Tilemap Rendering:**
- Tilemaps are highly optimized (single draw call per layer)
- Supports thousands of tiles without performance impact
- Layer caching prevents re-rendering static tiles

**Collision Detection:**
- O(1) tile lookups using grid-based indexing
- Only check tile at player's position (not entire map)
- Cache tile properties to avoid repeated property reads

**Memory:**
- Example: 50x50 map with 4 layers = 10,000 tiles
- Tileset: 256 tiles × 64×32px = ~2MB texture
- Map data: ~200KB JSON
- Total: <3MB per map (acceptable)

## Testing Strategy

### Unit Tests
- Tile coordinate conversions (world ↔ tile)
- Collision detection logic
- Speed modifier application
- Boundary enforcement

### Integration Tests
- Map loading from Tiled JSON
- Layer rendering order
- Tile property reading
- Multi-player collision

### Manual Testing
- Create test map with all tile types
- Walk to map boundaries (should stop)
- Walk into walls (should stop)
- Walk into water (should slow down)
- Test with 2+ players

## Documentation

### For Developers
- Update `SPEC.md` with Tiled map section
- Update `RENDERING.md` with tile coordinate system
- Add `docs/MAP-CREATION.md` guide for Tiled

### For Map Creators
- Tiled map template with example tiles
- Required layer names and structure
- Tile property schema
- Export settings (JSON format)

## Open Questions

See `decision-t4m-*.md` files for detailed decision records:
1. **Map format:** Tiled JSON vs XML vs custom format?
2. **Collision method:** Tile-based vs pixel-perfect vs Arcade Physics?
3. **Tile properties:** Custom schema vs standard Tiled properties?
4. **Network validation:** Client-only vs server-validated collision?
5. **Map distribution:** Bundled vs downloadable vs procedural?

## Success Criteria

1. ✅ Load and render Tiled isometric maps in MEW World
2. ✅ Players cannot walk through walls or off map edges
3. ✅ Water tiles reduce movement speed to 50%
4. ✅ Multiple players see consistent collision behavior
5. ✅ Map creation documented with examples
6. ✅ Performance: 60 FPS with 50×50 tile maps

## References

- [Tiled Documentation](https://doc.mapeditor.org/)
- [Phaser Tilemap Tutorial](https://phaser.io/tutorials/making-your-first-phaser-3-game/part9)
- [Phaser Tilemap API](https://photonstorm.github.io/phaser3-docs/Phaser.Tilemaps.Tilemap.html)
- MEW World SPEC.md (current implementation)
- MEW World RENDERING.md (coordinate systems)
