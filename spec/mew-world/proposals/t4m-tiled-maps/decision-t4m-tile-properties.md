# Decision: t4m-tile-properties

**Status:** Proposed
**Date:** 2025-10-13
**Deciders:** MEW World Team
**Related:** proposal.md, research.md

## Context

Tiled Map Editor allows defining custom properties on tiles. We need to decide:
1. What properties are needed for MEW World gameplay?
2. What data types to use?
3. How to handle missing/default values?
4. Should we use Tiled's built-in class system or purely custom properties?

## Decision

Use **custom properties** with explicit type definitions and clear defaults.

### Core Property Schema

```typescript
interface TileProperties {
  // Collision & Movement
  walkable?: boolean;        // Can player move onto this tile? (default: true)
  speedModifier?: number;    // Movement speed multiplier (default: 1.0)

  // Semantic Type
  terrain?: string;          // "grass" | "water" | "wall" | "sand" | "stone"

  // Future Extensions
  collisionType?: string;    // "full" | "none" (future: "partial")
}
```

### Property Defaults

When a property is not defined on a tile, use these defaults:
- `walkable`: `true` (most tiles are walkable)
- `speedModifier`: `1.0` (normal speed)
- `terrain`: `"grass"` (generic ground)
- `collisionType`: Derived from `walkable` (`false` → "full", `true` → "none")

## Rationale

### Why Custom Properties?

**Flexibility:**
- Add new properties without Tiled version constraints
- Application-specific (not limited by Tiled's built-in types)
- Easy to extend (just add new optional fields)

**Explicit semantics:**
- Property names clearly describe purpose
- Type safety in TypeScript
- No magic numbers or string encoding

**Designer-friendly:**
- Set in Tiled's property panel (visual editor)
- Type checking in Tiled (bool, float, string)
- Immediate feedback when editing

### Why Not Tiled's Class System?

Tiled 1.9+ has a "class" system for tile types.

**Pros:**
- Predefined sets of properties
- Inheritance (base classes)
- More structured

**Cons:**
- Requires Tiled 1.9+ (newer version)
- More complex to set up
- Less flexible for one-off tiles
- Class files separate from tileset

**Decision:** Use simple custom properties for now. Can migrate to classes later if needed.

### Property Type Choices

**`walkable: boolean`**
- Clear semantics: true/false
- No ambiguity (unlike int flags)
- Phaser-compatible

**`speedModifier: float`**
- Multiplicative (easier math than additive)
- 0.5 = half speed, 2.0 = double speed
- Range: 0.0 (immobile) to 2.0 (very fast)
- Default 1.0 = no change

**`terrain: string`**
- Human-readable
- Extensible (new terrain types don't break old code)
- Used for: sound effects, visual effects, gameplay logic
- Enum-like but not rigid

**`collisionType: string`** (future)
- Allows partial collision (diagonal walls, ledges)
- String instead of enum for extensibility
- Not implemented initially (use `walkable` only)

### Handling Missing Properties

Use **nullish coalescing** (`??`) in TypeScript:

```typescript
const tile = layer.getTileAt(x, y);
const walkable = tile?.properties.walkable ?? true;
const speedMod = tile?.properties.speedModifier ?? 1.0;
const terrain = tile?.properties.terrain ?? "grass";
```

**Benefits:**
- Graceful fallback to defaults
- No need to set properties on every tile
- Only set properties when non-default

## Implementation

### Setting Properties in Tiled

1. Open tileset editor
2. Select tile
3. Click "+" in Properties panel
4. Add property:
   - Name: `walkable`
   - Type: `bool`
   - Value: `false` (for walls)

5. Repeat for other properties as needed

### Reading Properties in Phaser

```typescript
function getTileProperties(tile: Phaser.Tilemaps.Tile | null): TileProperties {
  if (!tile) {
    return { walkable: true, speedModifier: 1.0, terrain: "grass" };
  }

  return {
    walkable: tile.properties.walkable ?? true,
    speedModifier: tile.properties.speedModifier ?? 1.0,
    terrain: tile.properties.terrain ?? "grass",
    collisionType: tile.properties.collisionType ?? "none"
  };
}

// Usage:
const tile = obstacleLayer.getTileAt(tileX, tileY);
const props = getTileProperties(tile);

if (!props.walkable) {
  // Collision - don't allow movement
}

if (props.speedModifier !== 1.0) {
  // Apply speed modification
  velocity.scale(props.speedModifier);
}
```

## Consequences

**Positive:**
- ✅ Simple property model (3 core properties)
- ✅ Designer-friendly (Tiled GUI)
- ✅ Type-safe (TypeScript interfaces)
- ✅ Extensible (add properties without breaking existing maps)
- ✅ Clear defaults (minimal property setting needed)

**Negative:**
- ❌ No validation in Tiled (can't enforce enum values)
- ❌ Properties duplicated per tile (not shared via classes)
- ❌ Typos possible (e.g., "walkeable" instead of "walkable")

**Mitigations:**
- Document standard property names clearly
- Provide example tileset with properties pre-configured
- TypeScript types catch typos at compile time
- Can add validation layer in Phaser if needed

## Future Extensions

### Phase 1: Core Properties (Milestone 3)
- `walkable`, `speedModifier`, `terrain`

### Phase 2: Visual/Audio Properties (Milestone 7)
- `sound`: Footstep sound effect
- `particle`: Particle effect when walking (dust, splash)
- `animation`: Tile animation reference

### Phase 3: Gameplay Properties (Milestone 8+)
- `damage`: Damage per second (lava, spikes)
- `teleport`: Teleport destination
- `interaction`: MCP tool to call on click
- `zIndex`: Render order override

### Migration to Classes

If we outgrow custom properties:

1. Create Tiled class definitions (.tiled-project file)
2. Define base classes: `Terrain`, `Obstacle`, `Liquid`
3. Inherit properties in subclasses
4. Update Phaser loader to read class properties

**When to migrate:**
- 10+ properties per tile
- Complex inheritance needed
- Multiple people creating maps (consistency issues)

## Alternatives Considered

### Option 1: String-encoded properties
Use single string property: `"walkable:false,speed:0.5,terrain:water"`

**Rejected because:**
- Error-prone parsing
- No type checking
- Hard to edit in Tiled

### Option 2: Separate layer per property
Use layer names to encode properties: `Walkable_False`, `Speed_0.5`

**Rejected because:**
- Layer explosion (too many layers)
- Can't combine properties easily
- Confusing for designers

### Option 3: Tile ID conventions
Use tile ID ranges: 1-100 walkable, 101-200 non-walkable

**Rejected because:**
- Inflexible (can't change without renumbering)
- Not self-documenting
- Hard to maintain

## References

- Tiled custom properties: https://doc.mapeditor.org/en/stable/manual/custom-properties/
- Tiled class system: https://doc.mapeditor.org/en/stable/manual/custom-properties/#typed-tiles
- Phaser tile properties: https://photonstorm.github.io/phaser3-docs/Phaser.Tilemaps.Tile.html#properties
- research.md: Tile Properties Schema
