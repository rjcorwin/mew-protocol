# s6r-ship-sprite-rendering

**Status:** Draft
**Created:** 2025-10-25
**Related:** r8s-ship-rotation, i2m-true-isometric

## Problem

Ships are currently rendered as simple colored rectangles (brown fill with 4 colored corner dots). This placeholder visualization lacks visual appeal and doesn't clearly communicate ship orientation, type, or identity. With continuous rotation physics (r8s-ship-rotation) now implemented, we need high-quality rotated sprites that:

1. Show clear ship orientation at any angle
2. Match the isometric blocky aesthetic of the game world
3. Support 64 rotation frames for smooth turning (5.625° per frame)
4. Work with the existing ship rendering system

## Proposed Solution

Replace placeholder ship sprites with pre-rendered 3D sprite sheets generated from blocky voxel-style ship models.

### Sprite Sheet Format

**File:** `assets/sprites/ship1.png`
**Dimensions:** 1024×1024 pixels (8 columns × 8 rows = 64 frames)
**Frame size:** 128×128 pixels per frame
**Frame count:** 64 frames covering 360° rotation
**Rotation increment:** 5.625° per frame (360° / 64)

**Frame ordering:**
```
Frame 0:   0° (East, default heading from spec)
Frame 1:   5.625°
Frame 2:   11.25°
...
Frame 63:  354.375°
```

### Ship Model Style

**Visual aesthetic:** Minecraft-style isometric blocks (voxel-based)

**Rationale:**
- Matches existing tile artwork (isometric cubes from terrain.png)
- Simple, recognizable silhouettes
- Easy to create additional ship types
- Renders cleanly at low resolution (128×128)
- Consistent with game's blocky aesthetic

**Ship structure (example sailing ship):**
- Hull: Rectangular voxel blocks (dark wood color)
- Deck: Flat planks (lighter wood color)
- Mast: Vertical column (pole)
- Sails: Rectangular cloth blocks (white/cream)
- Details: Railings, crow's nest, rudder (optional)

### Rendering Pipeline

**Tool:** Blender 3D (free, cross-platform, scriptable)

**Process:**
1. Model ship using cube primitives (blocky style)
2. Set up orthographic camera for isometric view
   - Camera angle: 30° from horizontal, 45° azimuth
   - Orthographic projection (no perspective distortion)
3. Use Python script to automate 64-frame rotation render
4. Combine rendered PNGs into sprite sheet using ImageMagick

**Camera settings:**
- **Type:** Orthographic
- **Position:** X=10, Y=-10, Z=7 (isometric angle)
- **Rotation:** X=60°, Y=0°, Z=45°
- **Orthographic Scale:** 200 (adjust to fit ship in frame)

**Render settings:**
- **Resolution:** 128×128 pixels per frame
- **Background:** Transparent (PNG with alpha)
- **Samples:** 32 (sufficient for blocky geometry)
- **Shading:** Flat (no smooth interpolation for voxel look)

### Blender Export Script

```python
import bpy
import math
import os

# Configuration
output_dir = "/path/to/mew-protocol/clients/seacat/assets/sprites/ship_frames"
num_frames = 64
resolution = 128

# Create output directory
os.makedirs(output_dir, exist_ok=True)

# Set render settings
scene = bpy.context.scene
scene.render.resolution_x = resolution
scene.render.resolution_y = resolution
scene.render.film_transparent = True

# Get ship object
ship = bpy.data.objects.get('Ship')
if not ship:
    print("ERROR: No object named 'Ship' found!")
else:
    # Render each rotation
    for i in range(num_frames):
        angle = math.radians(i * (360.0 / num_frames))
        ship.rotation_euler[2] = angle  # Rotate around Z axis

        # Update scene
        bpy.context.view_layer.update()

        # Render
        scene.render.filepath = os.path.join(output_dir, f"ship_{i:03d}.png")
        bpy.ops.render.render(write_still=True)

        print(f"Rendered frame {i+1}/{num_frames}")

    print(f"Done! Frames saved to {output_dir}")
```

### Sprite Sheet Assembly

```bash
# Install ImageMagick (macOS)
brew install imagemagick

# Combine 64 frames into 8×8 sprite sheet
cd clients/seacat/assets/sprites
montage ship_frames/ship_*.png -tile 8x8 -geometry 128x128+0+0 -background none ship1.png
```

### Client Integration

**Changes to GameScene.ts:**

```typescript
// Load ship sprite sheet
preload() {
  this.load.spritesheet('ship1', 'assets/sprites/ship1.png', {
    frameWidth: 128,
    frameHeight: 128
  });
}

// Render ship with rotation frame
updateShip(ship: RemoteShip) {
  // Convert rotation to frame index (0-63)
  const normalizedRotation = ((ship.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const frameIndex = Math.round((normalizedRotation / (Math.PI * 2)) * 64) % 64;

  // Set sprite frame
  ship.sprite.setFrame(frameIndex);
}
```

**No changes to ship physics** - rotation calculations remain unchanged.

### Ship Dimensions

From SPEC.md (line 25):
- **Deck boundary:** 128×48 pixels (length × beam in ship-local coordinates)
- **Visual representation:** Should fit within 128×128 frame with padding
- **Collision detection:** Uses existing OBB system (unchanged)

**Sprite scaling:**
- Ship model should be sized to fit ~100×100 area within 128×128 frame
- Leaves margin for sails/mast extending beyond hull
- Maintains consistent scale with 32×16 tile characters

## Implementation Plan

### Phase 1: Blender Setup & First Ship Model
1. Install Blender
2. Create simple sailing ship model (blocky style)
3. Set up isometric camera
4. Test render single frame
5. Verify visual style matches game aesthetic

### Phase 2: Automated Rendering
1. Implement Python rotation script
2. Render 64 frames for ship1
3. Verify rotation smoothness
4. Adjust camera/lighting if needed

### Phase 3: Sprite Sheet Generation
1. Install ImageMagick
2. Generate 8×8 sprite sheet from frames
3. Verify frame order and transparency
4. Optimize PNG file size

### Phase 4: Client Integration
1. Update GameScene.ts to load sprite sheet
2. Replace rectangle rendering with sprite frames
3. Map rotation angle to frame index
4. Test smooth rotation during gameplay
5. Remove old corner dot visualization

### Phase 5: Additional Ship Types (Future)
1. Create ship2, ship3 models (different designs)
2. Render sprite sheets for each type
3. Add ship type selection to ship server config

## Alternatives Considered

### 1. Real-time 3D Rendering (Three.js/Babylon.js)
**Pros:** Infinite rotation smoothness, no sprite storage
**Cons:** Much higher complexity, performance overhead, breaks 2D pixel aesthetic
**Rejected:** Overengineered for isometric 2D game

### 2. Hand-drawn Pixel Art (32 frames)
**Pros:** Artistic control, authentic pixel art look
**Cons:** Labor-intensive, hard to maintain consistency, fewer rotation angles
**Rejected:** 64 frames would be too time-consuming to draw manually

### 3. Vector Graphics (SVG rotation)
**Pros:** Infinite rotation smoothness, scalable
**Cons:** Doesn't match pixel art aesthetic, harder to create blocky style
**Rejected:** Doesn't fit game's visual identity

### 4. Fewer Frames (16 or 32)
**Pros:** Faster to render, smaller sprite sheets
**Cons:** Visible "snapping" during rotation (especially at 16 frames)
**Rejected:** Ship rotation is continuous (r8s), needs smooth visual feedback

## Success Criteria

- ✅ Ship sprite clearly shows orientation at any angle
- ✅ Rotation appears smooth during gameplay (no visible frame snapping)
- ✅ Visual style matches isometric blocky aesthetic
- ✅ Sprite sheet loads in <100ms
- ✅ No performance degradation from current placeholder rendering
- ✅ Easy to create additional ship types using same pipeline

## Future Enhancements

1. **Multiple ship types:** Merchant ships, warships, fishing boats
2. **Damaged states:** Show battle damage with alternate sprite sheets
3. **Sail states:** Unfurled vs furled sails based on speed setting
4. **Wake effects:** Animated water trails behind moving ships
5. **Customization:** Players choose ship appearance from template gallery

## Dependencies

- Blender 3D (free download)
- ImageMagick (`brew install imagemagick`)
- No changes to MEW protocol or ship physics
- No changes to existing client rendering pipeline (just swap sprites)

## Migration Path

1. Keep placeholder rendering as fallback
2. Load sprite sheet asynchronously
3. Switch to sprite rendering when loaded
4. Remove placeholder code after validation

No breaking changes - purely visual enhancement.
