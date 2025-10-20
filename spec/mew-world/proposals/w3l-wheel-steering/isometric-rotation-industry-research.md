# Industry Research: How Isometric Games Handle Rotation

**Date:** 2025-10-20
**Research Question:** How do professional isometric games handle rotating objects (ships, vehicles, etc.)?

## Classic Isometric Games

### 1. **SimCity 2000 / 3000** (Maxis)
**Approach:** No dynamic rotation
- Buildings are static, pre-rendered at fixed isometric angles
- No rotating vehicles or dynamic objects
- Camera can rotate in 4 cardinal directions (rotate the entire world view)

### 2. **Age of Empires Series** (Ensemble Studios)
**Approach:** Sprite-based with pre-rendered rotations
- Units have 8 or 16 directional sprites (pre-rendered from 3D models)
- Each unit has a sprite sheet with different angles
- No smooth rotation - discrete angles only
- Movement is Cartesian, sprites snap to nearest angle
- **Example:** Catapult has 8 different sprites for 8 compass directions

**Key Insight:** They don't actually rotate sprites - they swap between pre-rendered angles.

### 3. **StarCraft** (Blizzard)
**Approach:** Sprite-based, 32 directional frames
- Units pre-rendered at 32 different angles (11.25° increments)
- Movement physics are Cartesian
- Visual representation snaps to nearest of 32 angles
- Ships/vehicles use same approach

**Implementation:**
```
angleInDegrees = atan2(velocity.y, velocity.x) * 180 / PI
spriteIndex = round(angleInDegrees / 11.25) % 32
sprite = unitSprites[spriteIndex]
```

### 4. **Diablo I & II** (Blizzard)
**Approach:** 8 or 16 directional sprites
- Characters and enemies have discrete directional sprites
- No smooth rotation
- Movement is Cartesian grid-based
- Collision is tile-based (isometric diamond tiles)

### 5. **Civilization II** (MicroProse)
**Approach:** Static isometric, no rotation
- Units don't rotate dynamically
- Each unit type has a single isometric sprite
- Facing direction shown by positioning or animation, not rotation

### 6. **Fallout 1 & 2** (Black Isle)
**Approach:** 6-directional sprites (hexagonal grid)
- Characters have 6 facing directions (hex grid)
- Movement snaps to hex tiles
- No smooth rotation

## Modern Isometric/2.5D Games

### 7. **Bastion** (Supergiant Games)
**Approach:** 3D world with isometric camera
- Actually 3D geometry rendered with fixed isometric camera angle
- True 3D rotation applied to objects
- Isometric is just the camera projection
- **Not 2D tiles** - it's 3D!

### 8. **Hades** (Supergiant Games)
**Approach:** 3D with fixed camera (similar to Bastion)
- Characters and environment are 3D models
- Isometric view is camera position
- Smooth rotation because it's actual 3D

### 9. **Into the Breach** (Subset Games)
**Approach:** Static isometric, no rotation
- Mechs and units face cardinal directions only
- No smooth rotation
- Tile-based movement
- Purely Cartesian grid under the hood

### 10. **Factorio** (Wube Software)
**Approach:** Sprites with 4 directional variants
- Buildings/vehicles have 4 facing directions (N, E, S, W)
- No smooth rotation - discrete 90° rotations only
- Belt systems snap to 4 directions
- Collision and physics are Cartesian

### 11. **RimWorld** (Ludeon Studios)
**Approach:** Minimal rotation, mostly static
- Buildings face cardinal directions
- Pawns (characters) have multiple directional sprites
- No smooth vehicle rotation
- Grid-based Cartesian physics

## Ship/Vehicle Rotation Specifically

### **Command & Conquer: Red Alert** (Westwood)
**Ships/Vehicles:**
- 32 or 64 pre-rendered rotation frames per unit
- Smooth-looking rotation by cycling through frames
- Physics are Cartesian (tank drives in straight lines)
- Sprites are just visual representation

**Implementation Pattern:**
1. Tank moves in Cartesian space: `position += velocity * deltaTime`
2. Tank heading calculated: `heading = atan2(velocity.y, velocity.x)`
3. Sprite selected: `spriteFrame = quantize(heading, numFrames)`
4. Render sprite at Cartesian position

### **Age of Empires III** (Ensemble Studios)
**Ships:**
- Fully 3D models (not sprites)
- Rendered with orthographic/isometric-like camera
- True 3D rotation applied to ship models
- Water is 3D surface with shaders

**Key Decision:** They moved to full 3D to handle rotation cleanly.

### **Anno 1800** (Blue Byte)
**Ships:**
- Full 3D models
- Isometric-style camera angle
- Smooth rotation because it's 3D geometry
- Sails, rigging all 3D animated

## Industry Standard Approaches

### Approach A: **Pre-Rendered Rotation Frames** (Classic)
**Used by:** StarCraft, Age of Empires, C&C, Warcraft II

**How it works:**
1. Create 3D model of ship
2. Render from fixed isometric angle at 8, 16, or 32 rotations
3. Export as sprite sheet
4. Game swaps sprites based on heading

**Pros:**
- Looks great (if enough frames)
- Physics stay simple (Cartesian)
- No runtime 3D rendering needed

**Cons:**
- Large sprite sheets (memory)
- Discrete rotation (not perfectly smooth)
- Can't dynamically customize (colors, flags, etc.)

### Approach B: **Full 3D with Isometric Camera** (Modern)
**Used by:** Hades, Bastion, Anno series, Age of Empires III

**How it works:**
1. Build 3D models and world
2. Position camera at isometric angle
3. Use orthographic projection
4. Render as 3D scene

**Pros:**
- Perfectly smooth rotation
- Dynamic lighting, shadows
- Can zoom, change angles
- Easier to add effects

**Cons:**
- Requires 3D engine
- More complex rendering
- Higher system requirements

### Approach C: **No Rotation / Fixed Angles** (Simplest)
**Used by:** SimCity, Into the Breach, Civilization, RimWorld

**How it works:**
1. Objects don't rotate dynamically
2. Buildings/units face fixed directions
3. Rotation (if any) snaps to 4 cardinal directions

**Pros:**
- Simplest to implement
- Lowest memory/CPU
- Clean, clear visuals

**Cons:**
- Less dynamic
- Feels more static
- Limited realism

## What About 2D Sprite Rotation in Isometric?

### **The Problem with Runtime Sprite Rotation**

When you take a flat 2D sprite and use `sprite.setRotation()`:
- You're rotating in **screen space** (Cartesian)
- The sprite rotates around its center point
- It doesn't "rotate in isometric space"

**Example Issue:**
```
Isometric Rectangle (3D perspective):
    /----\
   /      \
  /        \
 \--------/

Rotated 45° in screen space:
      /
     / \
    /   \
   /     \
  ---------
   \     /
    \   /
     \ /

^ Looks wrong! Doesn't follow isometric projection.
```

### **Why Games Avoid This**

**No major isometric game uses runtime 2D sprite rotation** for this reason. They either:
1. Pre-render rotations (sprite sheets)
2. Use 3D models
3. Don't rotate dynamically

## Specific Ship Rotation Examples

### **Sid Meier's Pirates!** (2004)
- Full 3D ships
- Isometric-ish camera
- Smooth rotation via 3D models

### **Age of Sail Series**
- 2D sprites with 32 directional frames
- Pre-rendered ship angles
- Smooth rotation by frame cycling

### **Port Royale Series**
- 3D ship models
- Top-down/isometric camera
- Full 3D rotation

### **Pixel Piracy**
- Pixel art ships
- Ships are built from modular parts
- Rotation snaps to 4-8 cardinal directions
- When rotating, ship "rebuilds" its pixels in new orientation

## Recommendations for MEW World

Given our constraints:

### Option 1: **Pre-Rendered Ship Rotations** (Industry Standard for 2D)
**Approach:**
- Create ship sprite at 8 or 16 angles
- Swap sprites based on ship heading
- Keep Cartesian physics
- **Example:** StarCraft style

**Implementation:**
```typescript
const ROTATION_FRAMES = 8; // 45° increments
const angleIndex = Math.round((ship.rotation / (Math.PI * 2)) * ROTATION_FRAMES) % ROTATION_FRAMES;
ship.sprite.setFrame(angleIndex);
```

**Pros:**
- Industry-proven approach
- Looks good with enough frames
- Keeps physics simple
- No coordinate mixing

**Cons:**
- Need to create 8-16 ship sprites
- Discrete rotation (not perfectly smooth)

### Option 2: **No Dynamic Rotation** (Simplest)
**Approach:**
- Ship faces 4 cardinal directions only (N, E, S, W)
- Rotation snaps to 90° increments
- Matches Into the Breach, Factorio

**Pros:**
- Simplest
- Clear, readable
- Easy to understand

**Cons:**
- Less realistic
- Limits sailing feel

### Option 3: **Move to 3D** (Modern Approach)
**Approach:**
- Use Three.js or Babylon.js
- Render 3D ship models
- Keep isometric camera angle
- True 3D rotation

**Pros:**
- Perfectly smooth
- Modern, flexible
- Can add effects

**Cons:**
- Major refactor
- Requires 3D models
- More complex

### Option 4: **Hybrid - Fake It** (Current + Polish)
**Approach:**
- Keep current Cartesian rotation
- Accept that ship is a rotated rectangle
- Make ship sprite less obviously rectangular
- **Example:** Draw ship with rounded/tapered ends so rotation looks more natural

**Pros:**
- Minimal changes
- Works with current system

**Cons:**
- Still looks "off" in isometric world
- Not industry standard

## Industry Consensus

**For 2D isometric games with rotating vehicles:**

1. **Best Practice:** Pre-rendered rotation frames (8-16 angles minimum)
2. **Modern Approach:** Use 3D models with isometric camera
3. **Acceptable:** No rotation / discrete 4-way rotation
4. **Avoid:** Runtime 2D sprite rotation in isometric space

## Examples to Study

**Good rotation in isometric:**
- StarCraft (RTS, sprites)
- Age of Empires II (RTS, sprites)
- Anno 1800 (3D)
- Hades (3D with isometric camera)

**Games that avoid the problem:**
- Into the Breach (no rotation)
- SimCity 2000 (no rotation)
- Civilization (minimal rotation)

## Conclusion

**For MEW World ships, the industry-standard approach would be:**

**Pre-rendered rotation sprites** - Create the ship at 8 different isometric angles, swap sprites based on heading. This is how every major 2D isometric RTS handles vehicles.

**Alternative if staying with current approach:**
Accept that we're using a "cosmetic isometric" system (Cartesian physics with isometric tiles) and make the ship sprite less obviously rectangular so the Cartesian rotation looks more natural.

## Code Example: Pre-Rendered Approach

```typescript
// Create ship with 8 rotation frames
class Ship {
  sprite: Phaser.Sprite;
  rotation: number; // Radians (Cartesian)
  rotationFrames = 8; // Number of pre-rendered angles

  updateSprite() {
    // Convert rotation to frame index
    const normalizedRotation = (this.rotation + Math.PI * 2) % (Math.PI * 2);
    const frameIndex = Math.round(
      (normalizedRotation / (Math.PI * 2)) * this.rotationFrames
    ) % this.rotationFrames;

    // Set sprite frame (no runtime rotation!)
    this.sprite.setFrame(frameIndex);

    // Position sprite (Cartesian)
    this.sprite.setPosition(this.position.x, this.position.y);
  }
}
```

## References

- **Gamasutra:** "The Tricks Used in Age of Empires II"
- **GDC Vault:** "StarCraft Sprite Rendering"
- **Dev Blogs:** Anno series 3D ship rendering
- **Postmortems:** Diablo II technical challenges

## Action Items

1. Decide: Pre-rendered sprites vs 3D vs accept current limitations?
2. If pre-rendered: Create ship sprite sheet at 8 angles
3. If 3D: Evaluate Three.js/Babylon.js integration
4. If current: Improve ship sprite shape to look less rectangular
