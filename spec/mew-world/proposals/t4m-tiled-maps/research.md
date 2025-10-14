# Research: Tiled Map Integration

## Background

### What is Tiled?

[Tiled Map Editor](https://www.mapeditor.org/) is the de facto standard open-source 2D tile map editor used across the game development industry. It's been in active development since 2008 and is used by thousands of indie games.

**Key features:**
- Visual map editing with brush tools
- Support for isometric, orthogonal, hexagonal projections
- Multiple layer support (tile layers, object layers)
- Custom properties per tile/object/layer
- Export to JSON, XML, Lua, CSV formats
- Free and open source (GPL + BSD licensing)

### Why Tiled?

**Industry adoption:**
- Used by: Celeste, Stardew Valley, CrossCode, Dead Cells, and thousands more
- Strong community support and tutorials
- Phaser 3 has first-class Tiled integration
- Active development (latest: v1.11, 2024)

**Alternatives considered:**
- **LDtk** (Level Designer Toolkit) - Modern, but less mature
- **Ogmo Editor** - Simpler, but less feature-complete
- **Custom editor** - High development cost, poor UX
- **Procedural generation** - No designer control, harder to iterate

**Decision:** Use Tiled for proven reliability and Phaser integration.

## Tiled File Format

### Map Format (.tmj)

Tiled can export to multiple formats. For MEW World, we use **JSON (.tmj)**.

**Example structure:**
```json
{
  "compressionlevel": -1,
  "height": 20,
  "width": 20,
  "infinite": false,
  "layers": [
    {
      "data": [1, 2, 3, 4, ...],  // Tile IDs (flattened 2D array)
      "height": 20,
      "width": 20,
      "name": "Ground",
      "opacity": 1,
      "type": "tilelayer",
      "visible": true,
      "x": 0,
      "y": 0
    }
  ],
  "nextlayerid": 4,
  "nextobjectid": 1,
  "orientation": "isometric",
  "renderorder": "right-down",
  "tiledversion": "1.11.0",
  "tileheight": 32,
  "tilewidth": 64,
  "tilesets": [
    {
      "firstgid": 1,
      "source": "tilesets/terrain.tsj"
    }
  ],
  "type": "map",
  "version": "1.10"
}
```

**Why JSON instead of XML:**
- Smaller file size
- Native JavaScript parsing (no XML parser needed)
- Easier to read and debug
- Phaser's default Tiled format

### Tileset Format (.tsj)

**External tileset (recommended):**
```json
{
  "columns": 16,
  "image": "terrain.png",
  "imageheight": 512,
  "imagewidth": 1024,
  "margin": 0,
  "name": "terrain",
  "spacing": 0,
  "tilecount": 256,
  "tiledversion": "1.11.0",
  "tileheight": 32,
  "tilewidth": 64,
  "tiles": [
    {
      "id": 42,
      "properties": [
        { "name": "walkable", "type": "bool", "value": false },
        { "name": "terrain", "type": "string", "value": "wall" }
      ]
    },
    {
      "id": 85,
      "properties": [
        { "name": "speedModifier", "type": "float", "value": 0.5 },
        { "name": "terrain", "type": "string", "value": "water" }
      ]
    }
  ],
  "type": "tileset",
  "version": "1.10"
}
```

**Why external tilesets:**
- Reusable across multiple maps
- Easier to version control (one source of truth)
- Smaller map files

## Phaser 3 Tilemap Support

### Phaser Tilemap API

Phaser 3 has excellent Tiled integration through the `Phaser.Tilemaps` namespace.

**Loading:**
```typescript
preload() {
  this.load.tilemapTiledJSON('map-key', 'path/to/map.tmj');
  this.load.image('tileset-key', 'path/to/tileset.png');
}
```

**Creating:**
```typescript
create() {
  const map = this.make.tilemap({ key: 'map-key' });
  const tileset = map.addTilesetImage('tileset-name', 'tileset-key');
  const layer = map.createLayer('layer-name', tileset, 0, 0);
}
```

**Key classes:**
- `Phaser.Tilemaps.Tilemap` - The map container
- `Phaser.Tilemaps.Tileset` - Tileset reference
- `Phaser.Tilemaps.TilemapLayer` - Rendered layer (can have multiple)
- `Phaser.Tilemaps.Tile` - Individual tile with properties

### Isometric Support

Phaser supports isometric tilemaps but requires careful setup:

**In Tiled:**
- Set orientation to "isometric"
- Tile width: 64px (double height)
- Tile height: 32px
- Render order: "right-down" (recommended)

**In Phaser:**
- Load with `tilemapTiledJSON` (handles isometric automatically)
- Coordinate conversion built-in via `map.tileToWorldXY()`
- Camera bounds must account for isometric diamond shape

**Gotcha:** Isometric maps in Tiled use **staggered axis** internally but export as standard isometric. Phaser handles this correctly when loading .tmj files.

## Collision Detection Methods

### Option 1: Tile-Based Collision (RECOMMENDED)

**How it works:**
1. Convert player world position to tile coordinates
2. Look up tile at that position
3. Check tile's `walkable` property
4. Allow/deny movement

**Pros:**
- Simple and fast (O(1) lookups)
- Designer-friendly (set properties in Tiled)
- No physics overhead
- Perfect for grid-based games

**Cons:**
- Less precise than pixel-perfect collision
- Player position can be between tiles (needs rounding logic)

**Implementation:**
```typescript
const tile = layer.getTileAtWorldXY(player.x, player.y);
if (tile && !tile.properties.walkable) {
  // Collision! Don't allow movement
}
```

### Option 2: Arcade Physics Collision

**How it works:**
1. Enable Arcade Physics on tilemap layer
2. Set collision by tile property or index
3. Use `this.physics.add.collider(player, layer)`

**Pros:**
- Phaser built-in (well-tested)
- Handles velocity and bounce automatically
- Pixel-perfect collision

**Cons:**
- More complex (physics system overhead)
- Harder to customize (e.g., water slowdown)
- Overkill for tile-based movement

**Implementation:**
```typescript
// In create()
this.physics.add.existing(this.localPlayer);
layer.setCollisionByProperty({ walkable: false });
this.physics.add.collider(this.localPlayer, layer);
```

### Option 3: Matter Physics (Advanced)

**How it works:**
- Full 2D physics engine
- Supports slopes, rotation, friction
- Used for complex physics games

**Pros:**
- Most realistic physics
- Supports non-rectangular collision shapes

**Cons:**
- Significant complexity
- Performance overhead
- Not needed for tile-based game

**Decision:** Use **tile-based collision** (Option 1) for simplicity and designer control.

## Tile Properties Schema

### Standard Properties (Tiled Built-ins)

Tiled has some built-in properties but allows custom properties:

**Built-in:**
- `class` (string) - Type identifier
- `probability` (float) - For random tile placement

**Custom properties** (what we'll use):
- User-defined with types: bool, int, float, string, color, file, object
- Stored per tile in tileset JSON
- Accessible via `tile.properties.propertyName`

### Proposed Schema for MEW World

**Core properties:**
```typescript
interface TileProperties {
  walkable?: boolean;        // Can player move onto this tile? (default: true)
  speedModifier?: number;    // Movement speed multiplier (default: 1.0)
  terrain?: string;          // Semantic type: "grass" | "water" | "wall" | "sand"
  collisionType?: string;    // "full" | "none" (future: "partial" for slopes)
}
```

**Extended properties (future):**
```typescript
interface ExtendedTileProperties {
  sound?: string;            // Footstep sound: "grass" | "stone" | "water"
  damage?: number;           // Damage per second (lava: 10)
  teleport?: string;         // Teleport to map:x:y
  interaction?: string;      // MCP tool to call on click
}
```

**Setting in Tiled:**
1. Select tile in tileset editor
2. Click "Add Property" in Properties panel
3. Choose type (bool, float, string)
4. Set value

**Accessing in Phaser:**
```typescript
const tile = layer.getTileAt(x, y);
const walkable = tile.properties.walkable ?? true; // Default true
const speedModifier = tile.properties.speedModifier ?? 1.0;
```

## Map Layer Architecture

### Recommended Layer Structure

**Bottom to top (render order):**

1. **Ground** (tile layer)
   - Base terrain: grass, stone, sand, dirt
   - Always walkable
   - Sets default appearance

2. **Water** (tile layer, optional)
   - Overlays ground
   - Tiles with speedModifier: 0.5
   - Rendered with slight transparency (future: animated)

3. **Obstacles** (tile layer)
   - Walls, rocks, trees, buildings
   - walkable: false
   - Highest collision priority

4. **Decorations** (tile layer, optional)
   - Visual-only: flowers, shadows, cracks
   - No collision
   - Rendered above player (Z-index handling)

5. **Objects** (object layer, future)
   - Spawn points, treasure chests, NPCs
   - Not rendered as tiles
   - Used for gameplay logic

**Why this structure:**
- Clear separation of concerns
- Easy to edit individual aspects
- Performance: only check relevant layers for collision
- Flexibility: layers can be toggled on/off

### Layer Naming Convention

**Required names:**
- `Ground` - Must exist, base terrain
- `Obstacles` - Must exist if any walls

**Optional names:**
- `Water` - Swimming areas
- `Decorations` - Visual flair
- `Effects` - Particle effects, lighting

**Phaser layer loading:**
```typescript
// Required layers
const groundLayer = map.createLayer('Ground', tileset, 0, 0);
const obstacleLayer = map.createLayer('Obstacles', tileset, 0, 0);

// Optional layers (check if exists)
if (map.getLayer('Water')) {
  const waterLayer = map.createLayer('Water', tileset, 0, 0);
}
```

## Movement Speed Modifiers

### Design Constraints

**Current movement system** (from GameScene.ts):
```typescript
const MOVE_SPEED = 100; // pixels per second
velocity.scale(MOVE_SPEED * (delta / 1000));
player.x += velocity.x;
player.y += velocity.y;
```

**Integration approach:**
```typescript
// Get tile at player position
const tile = layer.getTileAtWorldXY(player.x, player.y);
const speedMod = tile?.properties.speedModifier ?? 1.0;

// Apply modifier
player.x += velocity.x * speedMod;
player.y += velocity.y * speedMod;
```

### Speed Modifier Values

**Proposed defaults:**
- Grass/Stone/Sand: `1.0` (100% speed, default)
- Water (swimming): `0.5` (50% speed)
- Ice (future): `1.5` (150% speed, slippery)
- Mud (future): `0.7` (70% speed)
- Road (future): `1.2` (120% speed)

**Why these values:**
- 0.5 for water: noticeable slowdown without being frustrating
- 1.0 as default: most tiles don't modify speed
- Range 0.5-1.5: keeps movement predictable

### Visual Feedback

**Current:** No indication of speed change

**Future enhancements:**
- Water ripple effect when entering water
- Speed indicator in UI
- Footstep sound changes by terrain
- Character animation changes (walking → swimming)

## Map Boundary Enforcement

### Current Problem

From SPEC.md: "No terrain boundaries (players can move infinitely)"

**Current camera bounds:**
```typescript
const minX = -(WORLD_HEIGHT - 1) * (TILE_WIDTH / 2);
const maxX = (WORLD_WIDTH - 1) * (TILE_WIDTH / 2);
camera.setBounds(minX, 0, maxX - minX, maxY);
```

Camera has bounds but **player movement is unlimited**.

### Solution: Clamp Player Position

**Hard boundaries (immediate):**
```typescript
// After movement calculation
const mapBounds = {
  minX: 0,
  minY: 0,
  maxX: map.widthInPixels,
  maxY: map.heightInPixels
};

player.x = Phaser.Math.Clamp(player.x, mapBounds.minX, mapBounds.maxX);
player.y = Phaser.Math.Clamp(player.y, mapBounds.minY, mapBounds.maxY);
```

**Tile-based boundaries (better):**
```typescript
// Before movement
const newTileX = Math.floor(newX / TILE_WIDTH);
const newTileY = Math.floor(newY / TILE_HEIGHT);

if (newTileX < 0 || newTileY < 0 ||
    newTileX >= mapWidth || newTileY >= mapHeight) {
  // Out of bounds - don't move
  return;
}
```

**Edge collision tiles (best, future):**
- Place invisible wall tiles around map perimeter
- Treated same as any other collision
- Allows irregular map shapes

## Network Synchronization

### Position Data Format

**Current position update** (from GameScene.ts):
```typescript
{
  participantId: string,
  worldCoords: { x: number, y: number },  // Pixel coordinates
  tileCoords: { x: number, y: number },   // Tile coordinates (unused)
  velocity: { x: number, y: number },
  timestamp: number,
  platformRef: string | null
}
```

**Impact of tile-based collision:**
- World coordinates remain the same (pixels)
- Each client performs collision detection locally
- No changes to network protocol needed

### Client-Side vs Server-Side Collision

**Current approach (client-only):**
- Each client checks collision independently
- Fast, responsive gameplay
- Possible cheating (client can ignore collision)

**Future approach (server-validated):**
- Gateway validates all position updates
- Rejects movements that pass through walls
- Requires gateway to load map data
- Planned for Milestone 7 (Polish & Performance)

**Trade-off:** Responsiveness vs security
- For cooperative game: client-side is fine
- For competitive game: need server validation

## Performance Analysis

### Rendering Performance

**Phaser Tilemap Rendering:**
- Uses WebGL batching (single draw call per layer)
- Static layers cached on GPU
- Culling: only draws visible tiles

**Benchmarks (from Phaser docs):**
- 100×100 map (10,000 tiles): 60 FPS
- 200×200 map (40,000 tiles): 60 FPS
- 500×500 map (250,000 tiles): ~45 FPS (rare for isometric)

**MEW World target:**
- 50×50 map (2,500 tiles): Easily 60 FPS
- 4 layers × 2,500 tiles = 10,000 tiles total
- Well within Phaser's capabilities

### Collision Detection Performance

**Tile lookup complexity:**
- Convert world → tile: 2 divisions, 2 floor operations = O(1)
- Tile property lookup: Hash map access = O(1)
- Per-frame cost: ~1 microsecond per player

**With 8 players:**
- 8 × 60 FPS = 480 collision checks/second
- Total: <0.5ms per frame
- Negligible impact

### Memory Usage

**Example map:**
- 50×50 tiles × 4 layers = 10,000 tiles
- Tile data: 10,000 × 4 bytes (tile ID) = 40KB
- Tileset: 256 tiles × 64×32 RGBA = ~2MB texture
- Map JSON: ~200KB (includes properties, metadata)

**Total: ~2.5MB per map**

For comparison:
- Current procedural grid: ~0KB (generated at runtime)
- Single 1920×1080 screenshot: ~8MB

**Conclusion:** Tiled maps add minimal memory overhead.

## Existing Implementations

### Games Using Tiled + Phaser

1. **Stardew Valley** (custom engine, but Tiled-based)
   - 50+ maps with complex collision
   - Water, crops, buildings, NPCs
   - Lessons: Clear layer structure is critical

2. **CrossCode** (custom engine, Tiled-based)
   - Isometric maps with elevation
   - Puzzle elements triggered by tiles
   - Lessons: Tile properties enable rich interactions

3. **Community examples:**
   - Phaser 3 + Tiled tutorial series (GameDev Academy)
   - Isometric RPG starter (itch.io)
   - Multiplayer tile game (GitHub: phaser3-multiplayer-with-physics)

### Common Patterns

**Layer structure:**
- Most games use 3-5 layers
- Ground → Obstacles → Decorations is standard
- Object layers for spawn points

**Tile properties:**
- Boolean flags common: `walkable`, `destructible`, `interactive`
- String types for complex behavior: `terrain`, `biome`, `sound`
- Float values rare except `speedModifier`, `friction`

**Collision methods:**
- Small games: Tile-based (like our proposal)
- Medium games: Arcade Physics
- Large games: Matter Physics or custom

## Open Research Questions

1. **Animated tiles:** Tiled supports tile animations. Should we?
   - Water animation would look great
   - Adds complexity to initial implementation
   - Recommendation: Add in Phase 3

2. **Multiple tilesets:** Tiled supports multiple tilesets per map
   - Allows mixing terrain + objects + characters
   - Requires careful tileset management
   - Recommendation: Start with single tileset, add later if needed

3. **Map compression:** Tiled can compress tile data (zlib, gzip)
   - Smaller file sizes
   - Requires decompression library in Phaser
   - Recommendation: Use uncompressed JSON initially (easier debugging)

4. **Chunk loading:** For very large maps, load chunks dynamically
   - Not needed for 50×50 maps
   - Would require custom streaming system
   - Recommendation: Out of scope for now

## Prior Art

### MEW Protocol Clients

- No existing MEW clients use Tiled
- This would be the first Tiled integration in MEW ecosystem
- Opportunity to set best practices

### Phaser Community

- Hundreds of Tiled + Phaser projects on GitHub
- Most use Arcade Physics (more complex than needed)
- Few use isometric projection (our use case)

**Most relevant example:**
- [phaser3-isometric-tilemap-example](https://github.com/nkholski/phaser3-isometric-tilemap-example)
- Shows isometric Tiled map in Phaser 3
- Uses tile-based collision (our approach)
- Good reference for implementation

## References

- [Tiled Documentation](https://doc.mapeditor.org/en/stable/)
- [Tiled JSON Format Spec](https://doc.mapeditor.org/en/stable/reference/json-map-format/)
- [Phaser Tilemap Tutorial](https://phaser.io/tutorials/making-your-first-phaser-3-game/part9)
- [Phaser Tilemap API](https://photonstorm.github.io/phaser3-docs/Phaser.Tilemaps.html)
- [Phaser Isometric Example](https://labs.phaser.io/view.html?src=src/tilemap/isometric/isometric.js)
- [Game Development Patterns: Tilemap Collision](https://gameprogrammingpatterns.com/spatial-partition.html)
