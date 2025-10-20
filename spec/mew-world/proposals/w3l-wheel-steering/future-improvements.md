# Future Improvements: Wheel Steering & Ship Rendering

**Proposal:** w3l-wheel-steering
**Status:** Deferred enhancements
**Date:** 2025-10-20

## Current State (v1)

**Ship Rendering:**
- Simple rectangular sprite
- Runtime 2D rotation using `sprite.setRotation()`
- Works but doesn't perfectly match isometric aesthetic

**Wheel Steering:**
- ✅ Continuous rotation implemented
- ✅ Wheel angle state
- ✅ Position locking (wheel holds angle when released)
- ✅ Turn rate proportional to wheel angle

## Future Enhancement: Pre-Rendered Ship Rotations

**Status:** Planned for future milestone
**Priority:** Polish (non-critical)
**Estimated Effort:** 8-12 hours

### Approach

Replace simple rectangle with **pre-rendered ship sprite sheet** showing 32 or 64 different angles.

**Industry Standard:**
- StarCraft: 32 angles (11.25° increments)
- Age of Empires: 16 angles (22.5° increments)
- Command & Conquer: 32-64 angles

**Recommended:** 32 angles (good balance of smoothness vs memory)

### Implementation Plan

#### Phase 1: Create Sprite Sheet (Art)

**Tools:**
- Blender (3D modeling)
- Aseprite (pixel art)
- Or commissioned artist

**Process:**
1. Create ship 3D model or pixel art base
2. Render from isometric angle at 32 rotations (11.25° increments)
3. Export as sprite sheet: 32 frames, each frame is ship at different angle
4. File format: PNG with transparency

**Sprite Sheet Layout:**
```
Frame 0: 0° (East)
Frame 1: 11.25° (ESE)
Frame 2: 22.5° (ESE)
...
Frame 8: 90° (South)
...
Frame 16: 180° (West)
...
Frame 24: 270° (North)
...
Frame 31: 348.75° (ENE)
```

**Dimensions:**
- Each frame: 200×100 pixels (current ship size)
- Total sheet: Could be 8×4 grid (8 columns, 4 rows)

#### Phase 2: Update Client Rendering

**File:** `clients/mew-world/src/game/GameScene.ts`

**Changes:**

1. **Load sprite sheet in preload()**
```typescript
preload() {
  // ...existing loads...
  this.load.spritesheet('ship-sprite', 'assets/ship-32angles.png', {
    frameWidth: 200,
    frameHeight: 100,
  });
}
```

2. **Replace rectangle generation with sprite**
```typescript
// BEFORE (current):
const shipGraphics = this.add.graphics();
shipGraphics.fillRect(0, 0, width, height);
shipGraphics.generateTexture(key, width, height);
const shipSprite = this.add.sprite(x, y, key);

// AFTER (with sprite sheet):
const shipSprite = this.add.sprite(x, y, 'ship-sprite');
shipSprite.setOrigin(0.5, 0.5);
```

3. **Update rotation to use frames instead of setRotation()**
```typescript
// BEFORE (current):
shipSprite.setRotation(update.shipData.rotation);

// AFTER (frame-based):
const ROTATION_FRAMES = 32;
const normalizedRotation = (update.shipData.rotation + Math.PI * 2) % (Math.PI * 2);
const frameIndex = Math.round(
  (normalizedRotation / (Math.PI * 2)) * ROTATION_FRAMES
) % ROTATION_FRAMES;
shipSprite.setFrame(frameIndex);
```

4. **Remove setRotation() calls**
```typescript
// DELETE these lines:
shipSprite.setRotation(ship.rotation);
```

**No changes to physics or server** - ship rotation angle stays Cartesian radians.

#### Phase 3: Testing

**Test Cases:**
- [ ] Ship loads with correct sprite
- [ ] Ship rotates smoothly through all 32 angles
- [ ] Rotation matches ship.rotation value
- [ ] Control points stay aligned during rotation
- [ ] Players on ship rotate correctly
- [ ] Collision bounds match visual sprite

**Edge Cases:**
- Rotation wrapping at 360° → 0°
- Negative rotations
- Fast rotation (frame skipping)

### Benefits

**Visual:**
- Ship looks proper in isometric world
- Smoother appearance (32 angles vs continuous but wrong-looking)
- Can show ship details (masts, sails, helm, deck)
- Matches aesthetic of isometric tile map

**Performance:**
- Slightly better (no runtime rotation transform)
- Sprite sheet caching

**Maintainability:**
- More professional appearance
- Easier to add ship variants (different ship types)

### Drawbacks

**Memory:**
- Sprite sheet size: ~200KB for 32 frames (compressed PNG)
- Not significant for modern systems

**Art Work:**
- Requires creating 32 sprite frames
- Either 3D rendering or manual pixel art
- Time investment: 4-6 hours for artist

**Discrete Rotation:**
- 11.25° increments vs continuous
- Acceptable trade-off (industry standard)

### Alternative: 64 Angles

**If 32 isn't smooth enough:**
- Use 64 angles (5.625° increments)
- Smoother but 2x memory
- Diminishing returns (human eye can't tell difference)

**Recommendation:** Start with 32, only increase if needed.

## Other Future Enhancements

### 1. Wheel Visual Indicator

**Current:** No visual feedback of wheel angle
**Future:** Add wheel indicator on HUD

**Mockup:**
```
┌─────────────────┐
│ Ship Controls   │
│                 │
│  Wheel: ──●──   │  ← Shows wheel at 45° right
│         L   R   │
│                 │
│  Speed: ■■■□    │
└─────────────────┘
```

**Implementation:**
- Small UI element showing wheel position
- Updates in real-time as player steers
- Helps player understand current turn rate

### 2. Improved Control Point Visuals

**Current:** Simple circles
**Future:** Detailed graphics

**Wheel:**
- Ship's wheel graphic (sprite)
- Rotates based on wheelAngle
- Glows when player controls it

**Sails:**
- Rope/sail graphic
- Shows current sail level (0-3)
- Animates when adjusting

### 3. Ship Wake/Trail Effect

**Enhancement:** Add particle effect behind ship
- Particles emit from stern
- Trail shows ship's path
- Helps visualize movement

### 4. Multiple Ship Types

**Current:** Single ship type
**Future:** Different ship classes

**Examples:**
- Sloop (small, fast, maneuverable)
- Brigantine (medium)
- Galleon (large, slow, heavy cargo)

**Implementation:**
- Different sprite sheets per ship type
- Different turn rates, speeds
- Different deck sizes

### 5. Dynamic Sail Rendering

**Current:** Speed level is just a number
**Future:** Sails visually change

**Levels:**
- Speed 0: Sails furled
- Speed 1: Partial sails
- Speed 2: Full sails
- Speed 3: All sails deployed

**Implementation:**
- Multiple sprite sheets with different sail configurations
- Or layered sprites (hull + sails separate)

### 6. Wind Mechanics

**Enhancement:** Add wind direction
- Affects ship speed based on heading vs wind
- Sailing into wind = slower
- Sailing with wind = faster
- Adds strategic depth

### 7. Ship Inertia/Momentum

**Current:** Ship turns based only on wheel angle
**Future:** Ship has momentum

**Physics:**
- Turn rate depends on current speed
- Slower ships turn faster
- Ship "drifts" slightly when changing heading
- More realistic sailing feel

**Implementation:**
- Add momentum vector to ShipState
- Apply physics drag/friction
- Tune for good feel vs realism

## Timeline Estimate

**Pre-rendered sprites (32 angles):**
- Art creation: 4-6 hours
- Code integration: 2-3 hours
- Testing/polish: 2-3 hours
- **Total:** 8-12 hours

**Other enhancements:**
- Each: 2-6 hours depending on complexity

## Decision

**Current (v1):** Keep simple rectangle
- Functional, works with wheel steering
- Allows testing gameplay mechanics
- Fast to iterate

**Future (v2+):** Add pre-rendered sprites
- Polish pass after core mechanics proven
- Better visual quality
- Industry-standard approach

## References

- Industry research: `isometric-rotation-industry-research.md`
- Coordinate system analysis: `isometric-coordinate-research.md`
- Original proposal: `proposal.md`
- Implementation decision: `decision-w3l-wheel-steering.md`

---

**Status:** Documented for future implementation
**Priority:** Low (polish, not core functionality)
**Blocked by:** None (can implement anytime)
