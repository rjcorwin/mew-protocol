# Decision: Projectile Velocity Coordinate System (p2v-projectile-velocity)

**Status:** Under Review
**Date:** 2025-11-06
**Context:** c5x-ship-combat implementation revealed fundamental coordinate system mismatch

## Problem Statement

Cannon trajectories in seacat exhibit directionally-dependent behavior where:
- Firing **south** (bottom of diamond): Ball travels 3 tiles, hits water immediately
- Firing **north** (top of diamond): Ball travels 20+ tiles, flies excessively far
- Firing **east/west** (sides of diamond): Ball travels ~10 tiles (expected behavior)

### Root Cause

The server calculates projectile velocity as:
```typescript
vel.x = cos(fireAngle) * horizontalSpeed
vel.y = sin(fireAngle) * horizontalSpeed * SCALE - verticalComponent
```

The `sin(fireAngle)` term represents **horizontal ground movement** (north/south on the isometric map), but the client interprets `vel.y` as **pure vertical screen motion** (up/down like a side-scroller):

```typescript
// Client physics (ProjectileManager.ts:144-149)
proj.velocity.y += GRAVITY * deltaS  // Gravity affects Y
proj.sprite.x += proj.velocity.x * deltaS  // Move horizontally
proj.sprite.y += proj.velocity.y * deltaS  // Move vertically
```

**The fundamental issue:** In isometric projection, screen Y conflates two physically separate dimensions:
1. **Ground position** (north/south on the map)
2. **Height/elevation** (up/down in 3D space)

The current implementation mixes these in `vel.y`, causing the client's gravity to incorrectly affect horizontal ground movement.

## Option 1: Server-Only Fix (Simplified 2D Ballistics)

### Description
Remove isometric ground movement from velocity calculations entirely. Treat the game as a pure 2D side-scroller where:
- `vel.x` = horizontal screen direction (left/right)
- `vel.y` = vertical screen direction (up/down)
- Elevation controls only the initial upward velocity

### Implementation
```typescript
// Server (ShipServer.ts)
const vel: Velocity = {
  x: Math.cos(fireAngle) * horizontalSpeed,
  y: -verticalComponent,  // ONLY elevation, no sin(fireAngle)
};
```

### Pros
- ✅ **Minimal code changes** - server-only, no client refactor
- ✅ **Mathematically simple** - standard 2D projectile physics
- ✅ **Consistent trajectories** - all directions have same arc shape
- ✅ **Easy to tune** - single `verticalComponent` controls all arcs

### Cons
- ❌ **Incorrect for isometric** - ignores ground coordinate system
- ❌ **Non-uniform distances** - firing north/south still travels different screen distances than east/west due to tile geometry (32×16 px)
- ❌ **Visual disconnect** - cannonball appears to "slide" north/south without corresponding Y velocity
- ❌ **Breaks mental model** - players expect cannons to fire "across the map" not "across the screen"

### Example Behavior
- **Fire south**: `vel = (0, -150)` → moves straight up then falls
- **Fire north**: `vel = (0, -150)` → identical to south (wrong!)
- **Fire east**: `vel = (+260, -150)` → moves right with arc
- **Fire west**: `vel = (-260, -150)` → moves left with arc

**Result:** All shots arc upward the same amount, but north/south shots don't actually move across the map—they just move up and down on screen while staying in the same ground position.

---

## Option 2: Client Refactor (True 3D Isometric Physics)

### Description
Separate ground position from height in the physics simulation. Projectiles track:
1. **Ground position** (groundX, groundY) - horizontal movement on the map
2. **Height** (heightZ) - vertical elevation affected by gravity

Client converts to screen coordinates for rendering: `screenY = (groundX + groundY) / 2 - heightZ`

### Implementation

**Server (ShipServer.ts):**
```typescript
// Calculate 3D Cartesian velocity in ground-space
const cos_fire = Math.cos(fireAngle);
const sin_fire = Math.sin(fireAngle);

// Convert screen angle to ground azimuth
const cos_azimuth = (cos_fire + 2 * sin_fire) / norm;
const sin_azimuth = (2 * sin_fire - cos_fire) / norm;

// 3D velocity components
const groundVx = horizontalSpeed * cos_azimuth;
const groundVy = horizontalSpeed * sin_azimuth;
const heightVz = verticalComponent;

// Broadcast as 3D velocity
const vel = { groundVx, groundVy, heightVz };
```

**Client (ProjectileManager.ts):**
```typescript
// Update ground position (no gravity)
proj.groundX += proj.groundVx * deltaS;
proj.groundY += proj.groundVy * deltaS;

// Update height (with gravity)
proj.heightVz += GRAVITY * deltaS;  // Gravity only affects Z
proj.heightZ += proj.heightVz * deltaS;

// Convert to screen coordinates for rendering
proj.sprite.x = proj.groundX - proj.groundY;
proj.sprite.y = (proj.groundX + proj.groundY) / 2 - proj.heightZ;
```

### Pros
- ✅ **Mathematically correct** - proper 3D ballistics with isometric projection
- ✅ **Uniform distances** - all directions travel equal ground distance
- ✅ **Physically accurate** - gravity only affects height, not ground movement
- ✅ **Consistent trajectories** - same arc shape in all directions
- ✅ **Mental model alignment** - cannons fire across the map as expected
- ✅ **Extensible** - supports future features like terrain elevation, jumping, etc.

### Cons
- ❌ **Major refactor** - changes both server and client
- ❌ **Breaking change** - requires protocol update (`velocity` → `{groundVx, groundVy, heightVz}`)
- ❌ **Complexity** - more moving parts, harder to debug
- ❌ **Testing burden** - must verify all projectile interactions still work
- ❌ **Migration path** - how to handle old clients during rollout?

### Example Behavior
- **Fire south**: Ground moves south at 260 px/s, height arcs from +150 to water
- **Fire north**: Ground moves north at 260 px/s, height arcs from +150 to water
- **Fire east**: Ground moves east at 260 px/s, height arcs from +150 to water
- **Fire west**: Ground moves west at 260 px/s, height arcs from +150 to water

**Result:** All shots travel equal ground distance (~10-12 tiles) with identical arc shapes, correctly representing 3D ballistics in isometric space.

---

## Option 3: Hybrid Approach (Scaled Sin Component)

### Description
Keep the existing 2D screen-space physics but scale the `sin(fireAngle)` term to balance with elevation. This is a compromise between mathematical correctness and implementation simplicity.

### Implementation
```typescript
// Server (ShipServer.ts)
const ISO_Y_SCALE = 0.65;  // Empirically tuned
const vel: Velocity = {
  x: Math.cos(fireAngle) * horizontalSpeed,
  y: Math.sin(fireAngle) * horizontalSpeed * ISO_Y_SCALE - verticalComponent,
};
```

### Pros
- ✅ **Minimal changes** - server-only, one-line fix
- ✅ **No protocol changes** - works with existing client
- ✅ **Tunable** - can adjust `ISO_Y_SCALE` to balance distances
- ✅ **Includes direction** - cannons do fire across the map

### Cons
- ❌ **Not mathematically correct** - arbitrary scaling factor
- ❌ **Still conflates dimensions** - mixes ground movement with elevation
- ❌ **Difficult to tune** - no clear way to calculate ideal scale factor
- ❌ **Approximate solution** - distances won't be perfectly equal
- ❌ **Fragile** - breaks if tile dimensions, gravity, or elevation change
- ❌ **Unintuitive** - why 0.65? Magic number with no clear justification

### Example Behavior (with 0.65x scaling)
- **Fire south**: `vel.y = +169 - 150 = +19` → slight downward trend, arcs up then down
- **Fire north**: `vel.y = -169 - 150 = -319` → strong upward, flies very far
- **Fire east**: `vel.y = 0 - 150 = -150` → moderate upward arc
- **Fire west**: `vel.y = 0 - 150 = -150` → moderate upward arc

**Result:** Distances more balanced than no scaling, but still unequal. South travels ~5 tiles, north travels ~15 tiles, east/west travel ~10 tiles.

---

## Comparison Matrix

| Criterion | Option 1 (Simplified) | Option 2 (3D Physics) | Option 3 (Scaled) |
|-----------|----------------------|----------------------|-------------------|
| **Correctness** | ❌ Incorrect | ✅ Correct | ⚠️ Approximate |
| **Distance Uniformity** | ❌ Variable | ✅ Equal | ⚠️ Improved |
| **Implementation Effort** | ✅ Trivial | ❌ Large | ✅ Trivial |
| **Code Complexity** | ✅ Simple | ❌ Complex | ✅ Simple |
| **Breaking Changes** | ✅ None | ❌ Protocol | ✅ None |
| **Tunability** | ✅ Easy | ✅ Easy | ⚠️ Hard |
| **Extensibility** | ❌ Limited | ✅ High | ❌ Limited |
| **Mental Model** | ❌ Confusing | ✅ Clear | ⚠️ Okay |

---

## Recommendation

**Choose Option 2 (Client Refactor - True 3D Isometric Physics)** despite higher implementation cost.

### Rationale

1. **Correctness over convenience** - This is a foundational system. Getting it right now prevents compounding technical debt.

2. **Already experiencing pain** - We've spent significant time debugging coordinate system issues. A proper fix eliminates an entire class of bugs.

3. **Future-proofing** - Proper 3D physics enables:
   - Terrain elevation (hills, cliffs)
   - Character jumping/climbing
   - Flying projectiles (arrows, spells)
   - Building heights
   - Multi-level maps

4. **Clear semantics** - Separating ground position from height makes the code easier to understand and maintain.

5. **Performance is fine** - The additional coordinate conversion is negligible (<1% CPU).

### Migration Path

1. **Phase 1:** Implement server-side 3D velocity calculation
2. **Phase 2:** Update protocol to support both 2D and 3D velocity formats
3. **Phase 3:** Update client to handle 3D physics, fall back to 2D for old messages
4. **Phase 4:** After 1 version, remove 2D fallback support

### If Option 2 is Rejected

Fall back to **Option 1 (Simplified)** with explicit documentation that this is a limitation. Do NOT use Option 3 (Scaled) as it's a band-aid that makes the problem harder to fix later.

---

## Decision

**TBD** - Awaiting stakeholder input

**If Option 2 is approved:**
- [ ] Create implementation plan
- [ ] Update protocol spec
- [ ] Implement server changes
- [ ] Implement client changes
- [ ] Add integration tests
- [ ] Update CHANGELOG

**If Option 1 is chosen:**
- [ ] Document limitation in code comments
- [ ] Add issue to track future 3D physics work
- [ ] Implement simplified formula
- [ ] Update CHANGELOG

---

## References

- Original bug report: "Cannon trajectory bug when ship moves north/south"
- Related: c5x-ship-combat proposal (Phase 2: Projectile Physics)
- Isometric coordinate formulas: `spec/seacat/SPEC.md` (if documented)
- Client physics: `clients/seacat/src/game/managers/ProjectileManager.ts:144-149`
- Server velocity calc: `src/mcp-servers/ship-server/ShipServer.ts:689-699`
