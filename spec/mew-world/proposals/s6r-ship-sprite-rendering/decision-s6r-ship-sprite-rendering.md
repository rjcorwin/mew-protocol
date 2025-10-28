# Decision: s6r-ship-sprite-rendering

**Date:** 2025-10-25
**Status:** Approved for implementation
**Deciders:** Project maintainer
**Related:** r8s-ship-rotation, i2m-true-isometric

## Context

Ships currently render as placeholder brown rectangles with colored corner dots. With continuous rotation physics (r8s-ship-rotation) now functional, we need proper visual representation that:
- Shows ship orientation clearly
- Rotates smoothly (no visible frame snapping)
- Matches the game's isometric blocky aesthetic
- Is easy to produce and maintain

## Decision

We will use **Blender-generated pre-rendered sprite sheets** with **64 rotation frames** in an **8×8 grid layout** (1024×1024 pixels total).

## Rationale

### Why Blender?
1. **Free and cross-platform** - Works on macOS, Windows, Linux
2. **Scriptable** - Python API automates 64-frame rendering
3. **Full control** - Precise isometric camera positioning
4. **Industry standard** - Extensive documentation and tutorials
5. **Future-proof** - Can render different ship types, damage states, etc.

**Rejected alternatives:**
- **MagicaVoxel:** Personal project with unclear macOS support status
- **Hand-drawn sprites:** Too labor-intensive for 64 frames
- **Real-time 3D:** Over-engineered for 2D pixel game

### Why 64 Frames?
1. **Smooth rotation** - 5.625° per frame is imperceptible
2. **Continuous physics** - Ships rotate smoothly (r8s), need matching visuals
3. **Acceptable storage** - ~512 KB per ship type (reasonable for web delivery)
4. **Industry standard** - Matches modern indie games (Factorio, etc.)

**Rejected alternatives:**
- **32 frames:** Visible snapping at 11.25° increments
- **128 frames:** Diminishing returns, doubles file size and render time

### Why Blocky Voxel Style?
1. **Visual consistency** - Matches isometric cube tiles (terrain.png)
2. **Easy to create** - Simple cube-based modeling in Blender
3. **Clear silhouettes** - Ship orientation obvious at any angle
4. **Scalable** - Easy to create new ship types with same aesthetic

**Rejected alternatives:**
- **Detailed pixel art:** Too time-consuming, hard to maintain consistency
- **Vector graphics:** Doesn't match pixel art aesthetic

### Why 8×8 Grid Layout?
1. **GPU-friendly** - 1024×1024 is power-of-2 texture size
2. **Standard format** - Phaser 3 has built-in sprite sheet support
3. **Better memory alignment** - Square textures optimize GPU usage

**Rejected alternatives:**
- **Single row (64×1):** Would be 8192×128 pixels (too wide, GPU inefficient)

## Implementation Approach

### Rendering Pipeline
1. Model ship in Blender using cube primitives (voxel style)
2. Set up orthographic isometric camera (60° pitch, 45° yaw)
3. Run Python script to render 64 rotation frames
4. Combine frames with ImageMagick into 8×8 sprite sheet
5. Load sprite sheet in Phaser, map rotation angle to frame index

### Camera Settings
- **Type:** Orthographic (matches isometric tiles)
- **Position:** X=10, Y=-10, Z=7
- **Rotation:** X=60°, Y=0°, Z=45°
- **Orthographic Scale:** 200 (adjust to fit ship)

### Ship Dimensions
- **Sprite frame:** 128×128 pixels
- **Ship size:** ~100×100 pixels (fits deck boundary of 128×48)
- **Scale:** Consistent with 32×32 character sprites

## Consequences

### Positive
- **Professional appearance** - Ships look like actual vessels, not placeholders
- **Smooth rotation** - Matches continuous physics system
- **Easy expansion** - Same pipeline creates new ship types
- **No performance cost** - Sprite switching is O(1) in Phaser
- **Asset reusability** - Blender models can be re-rendered at different resolutions

### Negative
- **Initial setup time** - Requires learning basic Blender modeling
- **Render time** - ~80 seconds per ship type for 64 frames
- **File size** - ~512 KB per ship type (acceptable but not trivial)
- **Storage overhead** - Need to keep Blender source files for future edits

### Neutral
- **Tooling dependency** - Requires Blender + ImageMagick (both free, widely used)
- **Manual process** - Not fully automated (need to model each ship in Blender)

## Alternatives Considered

### 1. Real-time 3D Rendering (Three.js)
**Pros:** Infinite rotation smoothness, single 3D model file
**Cons:** High complexity, breaks 2D aesthetic, performance overhead
**Verdict:** Over-engineered for isometric 2D game

### 2. Hand-drawn Pixel Art (32 frames)
**Pros:** Artistic control, authentic retro look
**Cons:** Labor-intensive, hard to maintain, visible snapping
**Verdict:** Too slow to iterate on designs

### 3. Fewer Frames (16 or 32)
**Pros:** Smaller files, faster rendering
**Cons:** Visible frame snapping during continuous rotation
**Verdict:** Doesn't match smooth physics (r8s-ship-rotation)

### 4. Vector Graphics (SVG)
**Pros:** Scalable, infinite rotation
**Cons:** Doesn't match pixel art aesthetic, complex to create blocky style
**Verdict:** Wrong visual style for this game

### 5. MagicaVoxel Turntable Renderer
**Pros:** Purpose-built for voxel art, very easy interface
**Cons:** Personal project with unclear macOS availability, less control over camera
**Verdict:** Too risky to depend on; Blender is more reliable

## Follow-up Actions

1. ✅ Create proposal and research documentation
2. Update mew-world SPEC.md with sprite rendering section
3. Create Blender tutorial in proposal directory
4. Implement first ship model and render sprite sheet
5. Update GameScene.ts to use sprite sheet instead of rectangles
6. Test rotation smoothness in gameplay
7. Document process for creating additional ship types

## Notes

- This decision focuses on the rendering pipeline, not ship design specifics
- First ship will be a simple sailing vessel (single mast, rectangular sails)
- Future ships can have different designs (merchant, warship, fishing boat)
- Sprite sheet format is compatible with future enhancements (damage states, sail animations)
- No changes to ship physics or MEW protocol - purely visual upgrade
