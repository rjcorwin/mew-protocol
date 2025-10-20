# Phase 1: Isometric Player Movement

**Proposal:** i2m-true-isometric
**Phase:** 1 of 4
**Status:** Draft
**Estimated Effort:** 6-8 hours

## Goal

Convert player movement from Cartesian arrow key mapping to isometric arrow key mapping, so player movement aligns with the isometric tile grid.

## Current Behavior

**File:** `clients/mew-world/src/game/GameScene.ts:552-563`

```typescript
const velocity = new Phaser.Math.Vector2(0, 0);

if (this.cursors.left?.isDown) velocity.x -= 1;
if (this.cursors.right?.isDown) velocity.x += 1;
if (this.cursors.up?.isDown) velocity.y -= 1;
if (this.cursors.down?.isDown) velocity.y += 1;
```

**Arrow Key Mapping (Cartesian):**
- ⬆️ Up = -Y (north in screen space)
- ⬇️ Down = +Y (south in screen space)
- ⬅️ Left = -X (west in screen space)
- ➡️ Right = +X (east in screen space)

**Problem:** Doesn't align with isometric tile diagonals.

## Isometric Tile Grid

Isometric tiles are **diamonds** (rotated 45°):

```
    N (up in screen)
    |
    *
   / \
  /   \
 *     * (NE-SW diagonal)
  \   /
   \ /
    *
    |
    S (down in screen)

NW-SE diagonal runs upper-left to lower-right
NE-SW diagonal runs upper-right to lower-left
```

**Isometric Basis Vectors:**
- **Northeast:** `{ x: +1, y: -0.5 }` (moving along NE tile edge)
- **Southeast:** `{ x: +1, y: +0.5 }` (moving along SE tile edge)
- **Southwest:** `{ x: -1, y: +0.5 }` (moving along SW tile edge)
- **Northwest:** `{ x: -1, y: -0.5 }` (moving along NW tile edge)

These are derived from isometric projection:
```
worldX = (tileX - tileY) * (TILE_WIDTH / 2)
worldY = (tileX + tileY) * (TILE_HEIGHT / 2)
```

Where:
- TILE_WIDTH = 32
- TILE_HEIGHT = 16

Normalized basis vectors (for tile movement):
- **X-axis** (along tiles): `{ x: 1, y: 0.5 }` normalized
- **Y-axis** (across tiles): `{ x: 1, y: -0.5 }` normalized

## Proposed Behavior

### Isometric Arrow Key Mapping

**Option A: Align with Tile Edges (Recommended)**

- ⬆️ Up = Northeast `{ x: +0.89, y: -0.45 }`
- ⬇️ Down = Southwest `{ x: -0.89, y: +0.45 }`
- ⬅️ Left = Northwest `{ x: -0.89, y: -0.45 }`
- ➡️ Right = Southeast `{ x: +0.89, y: +0.45 }`

**Calculation:**
```typescript
// Isometric basis vectors (not normalized yet)
const northeast = { x: 1, y: -0.5 };
const southeast = { x: 1, y: 0.5 };

// Normalize to length 1
const neLength = Math.sqrt(northeast.x ** 2 + northeast.y ** 2); // ~1.118
const normalized = {
  x: northeast.x / neLength, // ~0.894
  y: northeast.y / neLength, // ~-0.447
};
```

**Option B: Simpler 2:1 Ratio (Alternative)**

Use exact 2:1 ratio without normalization:

- ⬆️ Up = Northeast `{ x: +2, y: -1 }`
- ⬇️ Down = Southwest `{ x: -2, y: +1 }`
- ⬅️ Left = Northwest `{ x: -2, y: -1 }`
- ➡️ Right = Southeast `{ x: +2, y: +1 }`

Then normalize the combined velocity vector (after adding diagonals).

**Recommendation:** Use Option A (pre-normalized) for consistency.

## Implementation

### Step 1: Define Isometric Basis Vectors

**File:** `clients/mew-world/src/game/GameScene.ts`

Add constants near top:

```typescript
// Isometric movement basis vectors (normalized)
const ISO_NORTHEAST = { x: 0.894, y: -0.447 };
const ISO_SOUTHEAST = { x: 0.894, y: 0.447 };
const ISO_SOUTHWEST = { x: -0.894, y: 0.447 };
const ISO_NORTHWEST = { x: -0.894, y: -0.447 };
```

Or calculate from tile dimensions:

```typescript
// Calculate isometric basis from tile dimensions
const ISO_X_AXIS = { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 }; // Southeast direction
const ISO_Y_AXIS = { x: TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 }; // Northeast direction

// Normalize
const isoXLength = Math.sqrt(ISO_X_AXIS.x ** 2 + ISO_X_AXIS.y ** 2);
const isoYLength = Math.sqrt(ISO_Y_AXIS.x ** 2 + ISO_Y_AXIS.y ** 2);

const ISO_SOUTHEAST = { x: ISO_X_AXIS.x / isoXLength, y: ISO_X_AXIS.y / isoYLength };
const ISO_NORTHEAST = { x: ISO_Y_AXIS.x / isoYLength, y: ISO_Y_AXIS.y / isoYLength };
const ISO_SOUTHWEST = { x: -ISO_SOUTHEAST.x, y: -ISO_SOUTHEAST.y };
const ISO_NORTHWEST = { x: -ISO_NORTHEAST.x, y: -ISO_NORTHEAST.y };
```

### Step 2: Update Movement Input (GameScene.ts:552-563)

**Before:**
```typescript
const velocity = new Phaser.Math.Vector2(0, 0);

if (this.cursors.left?.isDown) velocity.x -= 1;
if (this.cursors.right?.isDown) velocity.x += 1;
if (this.cursors.up?.isDown) velocity.y -= 1;
if (this.cursors.down?.isDown) velocity.y += 1;
```

**After:**
```typescript
const velocity = new Phaser.Math.Vector2(0, 0);

// Isometric movement: arrow keys move along isometric tile axes
if (this.cursors.up?.isDown) {
  velocity.x += ISO_NORTHEAST.x;
  velocity.y += ISO_NORTHEAST.y;
}
if (this.cursors.down?.isDown) {
  velocity.x += ISO_SOUTHWEST.x;
  velocity.y += ISO_SOUTHWEST.y;
}
if (this.cursors.left?.isDown) {
  velocity.x += ISO_NORTHWEST.x;
  velocity.y += ISO_NORTHWEST.y;
}
if (this.cursors.right?.isDown) {
  velocity.x += ISO_SOUTHEAST.x;
  velocity.y += ISO_SOUTHEAST.y;
}
```

**Normalization stays the same:**
```typescript
if (velocity.length() > 0) {
  velocity.normalize();
  velocity.scale(MOVE_SPEED * (delta / 1000));
  // ... rest of movement logic
}
```

### Step 3: Update Animation Direction Calculation

**File:** `GameScene.ts:289-307`

**Current:**
```typescript
private calculateDirection(velocity: Phaser.Math.Vector2): Direction {
  const angle = Math.atan2(velocity.y, velocity.x);
  const directions: Direction[] = [
    'east', 'southeast', 'south', 'southwest',
    'west', 'northwest', 'north', 'northeast',
  ];
  const index = Math.round(angle / (Math.PI / 4)) % 8;
  return directions[(index + 8) % 8];
}
```

**Issue:** This assumes Cartesian velocity angles.

**Fix:** This should still work! The velocity vector is now in isometric space, but `atan2(y, x)` still gives the correct screen-space angle for animation selection.

**Action:** Keep as-is, test to verify animation directions match movement.

### Step 4: Test Diagonal Movement

**Before (Cartesian):**
- Press Up+Right: velocity = `{1, -1}` normalized = `{0.707, -0.707}`
- Moves at 45° angle (northeast in Cartesian)

**After (Isometric):**
- Press Up+Right:
  - Up adds: `{0.894, -0.447}` (northeast)
  - Right adds: `{0.894, 0.447}` (southeast)
  - Combined: `{1.788, 0}` normalized = `{1, 0}` (pure east)
- Moves **east along isometric tile edge**

This is correct! Diagonal arrow presses now move along tile rows/columns.

## Testing Plan

### Test Cases

1. **Cardinal Isometric Directions**
   - [ ] Press Up → player moves northeast (along tile diagonal)
   - [ ] Press Down → player moves southwest
   - [ ] Press Left → player moves northwest
   - [ ] Press Right → player moves southeast

2. **Diagonal Isometric Directions**
   - [ ] Press Up+Right → player moves east (along tile row)
   - [ ] Press Up+Left → player moves north (along tile column)
   - [ ] Press Down+Right → player moves south (along tile column)
   - [ ] Press Down+Left → player moves west (along tile row)

3. **Animation Matches Movement**
   - [ ] Walking northeast shows "northeast" animation
   - [ ] Walking east shows "east" animation
   - [ ] All 8 directions show correct animation

4. **Collision Still Works**
   - [ ] Player cannot walk through obstacles
   - [ ] Tile collision detection unchanged

5. **Ship Boarding Still Works**
   - [ ] Player can walk onto ship deck
   - [ ] Ship boundary detection works (uses world coords)

## Edge Cases

### Movement Speed Consistency

**Before:** All directions move at MOVE_SPEED (100 px/s)

**After:** Should still move at MOVE_SPEED

**Verify:** Normalized velocity ensures consistent speed.

### Camera Follow

**Current:** Camera follows player sprite position

**After:** No change needed (camera tracks world coords)

### Remote Players

**Server sends:** World coordinates and velocity

**Client receives:** Already in world space

**Impact:** None (server doesn't know about isometric mapping)

## Alternative: Add WASD Support

While implementing arrow keys, also add WASD:

```typescript
// Add WASD keys
this.wKey = this.input.keyboard!.addKey('W');
this.aKey = this.input.keyboard!.addKey('A');
this.sKey = this.input.keyboard!.addKey('S');
this.dKey = this.input.keyboard!.addKey('D');

// In update():
if (this.wKey?.isDown || this.cursors.up?.isDown) {
  velocity.x += ISO_NORTHEAST.x;
  velocity.y += ISO_NORTHEAST.y;
}
// ... etc
```

## Rollback Plan

If isometric movement feels wrong:

1. Revert changes to arrow key mapping
2. Keep Cartesian movement
3. Document as "cosmetic isometric only"

## Success Criteria

- [ ] Player movement aligns visually with isometric tile grid
- [ ] Movement feels natural and responsive
- [ ] All 8 directions work correctly
- [ ] Animations match movement direction
- [ ] No regression in collision or ship boarding

## Files Changed

- `clients/mew-world/src/game/GameScene.ts`
  - Add isometric basis vector constants (~10 lines)
  - Update movement input logic (~20 lines changed)
  - Possibly update calculateDirection() if needed

**Total Changes:** ~30-40 lines

## Dependencies

**None** - This phase is independent.

## Next Phase

After Phase 1 complete:
- Phase 3: Player-on-Ship Isometric Rotation
- Phase 4: Control Point Isometric Positioning
- Phase 2: Ship Pre-Rendered Sprites (deferred)
