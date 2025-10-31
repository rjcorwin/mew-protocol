# Seacat Maps

This directory contains Tiled map files (.tmj) and tilesets for Seacat.

## Current Maps

- **example-map.tmj** - Basic 20×20 isometric map with walls and water demonstration

## Map Format

Maps are created in [Tiled Map Editor](https://www.mapeditor.org/) and exported to JSON format (.tmj).

### Map Settings

When creating a map in Tiled:
- **Orientation:** Isometric
- **Tile Size:** 64×32 pixels (width × height)
- **Render Order:** Right-down
- **Format:** JSON (.tmj)

### Required Layers

Maps should have these layers (bottom to top):

1. **Ground** - Base terrain (grass, sand, stone)
   - Always walkable
   - Sets visual appearance

2. **Water** (optional) - Swimming areas
   - Tiles with `speedModifier: 0.5`
   - Overlays ground

3. **Obstacles** - Non-walkable tiles (walls, rocks)
   - Tiles with `walkable: false`
   - Highest collision priority

4. **Decorations** (future) - Visual-only elements
   - No collision
   - Flowers, shadows, effects

## Tilesets

### terrain.tsj

The main terrain tileset includes:

**Tile IDs and Properties:**

- **ID 0:** Grass (green)
  - `walkable: true`
  - `speedModifier: 1.0`
  - `terrain: "grass"`

- **ID 1:** Sand (tan)
  - `walkable: true`
  - `speedModifier: 1.0`
  - `terrain: "sand"`

- **ID 2:** Water (blue)
  - `walkable: true`
  - `speedModifier: 0.5`  ← Swimming!
  - `terrain: "water"`

- **ID 3:** Wall (gray)
  - `walkable: false`  ← Blocks movement!
  - `speedModifier: 0.0`
  - `terrain: "wall"`

- **ID 4:** Stone (light gray)
  - `walkable: true`
  - `speedModifier: 1.0`
  - `terrain: "stone"`

### Tile Properties Schema

All tiles support these custom properties:

```typescript
{
  walkable?: boolean;        // Can player move onto this tile? (default: true)
  speedModifier?: number;    // Movement speed multiplier (default: 1.0)
  terrain?: string;          // Semantic type (default: "grass")
}
```

## Creating a New Map

### 1. Install Tiled

Download from https://www.mapeditor.org/

### 2. Create New Map

File → New → New Map:
- Orientation: **Isometric**
- Tile layer format: **CSV** or **Base64 (uncompressed)**
- Tile size: **64 × 32**
- Map size: Your choice (20×20 recommended for testing)

### 3. Create Embedded Tileset

**IMPORTANT:** Phaser requires embedded tilesets, not external tileset files.

Map → New Tileset:
- Name: "terrain"
- Type: Based on Tileset Image (or Collection of Images)
- Tile width: 64, Tile height: 32
- **✓ Check "Embed in map"** (critical!)
- Image: Use any placeholder (the game generates tiles procedurally)

Then add tile properties for tiles 0-4 (see "Tile Properties Schema" below)

### 4. Create Layers

Layer → New Layer → Tile Layer:
- Create "Ground" layer
- Create "Obstacles" layer
- Create "Water" layer (optional)

### 5. Paint Tiles

Use the tileset panel to select tiles and paint on layers:
- **Ground layer:** Use grass (ID 1) or sand (ID 2) for base terrain
- **Obstacles layer:** Use walls (ID 4) for boundaries and buildings
- **Water layer:** Use water tiles (ID 3) for ponds/rivers

### 6. Test Tile Properties

Select a tile in the tileset → View properties panel:
- Verify `walkable`, `speedModifier`, `terrain` properties are set
- Add/modify properties as needed

### 7. Export Map

File → Export As:
- Format: **JSON map files (*.tmj *.json)**
- Save to `assets/maps/your-map-name.tmj`

### 8. Load in Game

Update `GameScene.ts`:
```typescript
this.load.tilemapTiledJSON('map', 'assets/maps/your-map-name.tmj');
```

## Map Design Tips

### Boundaries

Create wall boundaries around map edges to prevent players from walking off:
```
############
#          #
#          #
#          #
############
```

### Rooms

Use walls to create enclosed spaces with openings:
```
#####
#   ####
#      #
####   #
   #####
```

### Water Features

Add water tiles (ID 3) for ponds, rivers, or swimming areas:
- Players move at 50% speed in water
- Can combine with obstacles to create islands

### Testing

1. Launch game: `npm start`
2. Connect as player1
3. Walk around map
4. Verify:
   - Can't walk through walls
   - Water slows movement
   - Can't walk off map edges

## Troubleshooting

### Map not loading

- Check console for errors
- Verify `.tmj` file is valid JSON
- Ensure tileset path is correct in map file

### Tiles rendering wrong colors

- Regenerate tileset texture in `GameScene.ts:generateTilesetTexture()`
- Tile colors: grass=green, sand=tan, water=blue, wall=gray, stone=light gray

### Collision not working

- Verify tile properties are set in tileset (not individual map tiles)
- Check property names match exactly: `walkable`, `speedModifier`, `terrain`
- Ensure Obstacles layer exists and has wall tiles

### Camera bounds wrong

- Camera bounds are calculated from map dimensions
- Isometric maps extend into negative X space
- See `RENDERING.md` for camera details

## References

- [Tiled Documentation](https://doc.mapeditor.org/)
- [Tiled JSON Format](https://doc.mapeditor.org/en/stable/reference/json-map-format/)
- [Seacat Spec](../../spec/seacat/SPEC.md)
- [Proposal t4m](../../spec/seacat/proposals/t4m-tiled-maps/)
