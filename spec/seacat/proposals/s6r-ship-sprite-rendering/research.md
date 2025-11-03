# s6r-ship-sprite-rendering: Research

## 3D Rendering Tools Comparison

### Blender (Recommended)
- **Cost:** Free, open-source
- **Platforms:** Windows, macOS, Linux
- **Learning curve:** Moderate
- **Scripting:** Python API (excellent for automation)
- **Isometric support:** Full control via orthographic camera
- **Export:** PNG, sprite sheets via ImageMagick
- **Community:** Massive, extensive tutorials

**Pros:**
- Industry-standard tool
- Powerful Python scripting for batch rendering
- Perfect control over camera angles
- Free and cross-platform

**Cons:**
- Overkill for simple voxel models
- Requires learning 3D modeling basics

### MagicaVoxel
- **Cost:** Free
- **Platforms:** Windows, macOS, Linux
- **Learning curve:** Very low
- **Scripting:** Limited
- **Isometric support:** Built-in turntable renderer
- **Export:** PNG sequence
- **Community:** Active voxel art community

**Pros:**
- Purpose-built for voxel/blocky art
- Intuitive interface (like 3D pixel art)
- Built-in turntable renderer for rotation frames
- Exports to .vox (importable to Blender)

**Cons:**
- Personal project, development paused
- Less control over render settings
- Turntable may not match exact isometric angle needed

**Status:** Considered but rejected due to uncertainty about macOS build availability

### Three.js / Babylon.js (Real-time 3D)
- **Cost:** Free, open-source
- **Platforms:** Web-based
- **Learning curve:** High (requires WebGL knowledge)
- **Isometric support:** Manual implementation

**Rejected:** Over-engineered for 2D sprite generation

## Sprite Sheet Formats Research

### Frame Count Analysis

| Frames | Degrees/Frame | Visual Smoothness | Storage Size | Render Time |
|--------|---------------|-------------------|--------------|-------------|
| 8      | 45°           | Choppy            | 64 KB        | ~10 sec     |
| 16     | 22.5°         | Noticeable steps  | 128 KB       | ~20 sec     |
| 32     | 11.25°        | Acceptable        | 256 KB       | ~40 sec     |
| **64** | **5.625°**    | **Smooth**        | **512 KB**   | **~80 sec** |
| 128    | 2.8125°       | Very smooth       | 1 MB         | ~160 sec    |

**Decision: 64 frames**
- Ships rotate continuously (r8s-ship-rotation), not in discrete steps
- 5.625° increments imperceptible to human eye at game speed
- 512 KB acceptable for web delivery (single ship type)
- Diminishing returns beyond 64 frames

### Sprite Sheet Layout

**Option 1: Single Row (64×1)**
- Dimensions: 8192×128 pixels
- Pros: Simple indexing
- Cons: Very wide texture, may hit GPU limits

**Option 2: Grid (8×8)**
- Dimensions: 1024×1024 pixels
- Pros: Square texture (power of 2), GPU-friendly
- Cons: Slightly more complex indexing

**Decision: 8×8 grid**
- Standard GPU texture size (1024×1024)
- Better memory alignment
- Frame index calculation: `row = floor(index / 8)`, `col = index % 8`

## Isometric Projection Research

### Camera Angles for Isometric View

Classic isometric projection:
- **Pitch (X rotation):** 60° from horizontal
- **Yaw (Z rotation):** 45° azimuth
- **Camera type:** Orthographic (no perspective)

**Formula verification:**
```
tan(30°) = 1/√3 ≈ 0.577
Camera height ratio = √3/2 ≈ 0.866
```

Blender camera position for isometric:
- Distance from origin: 10 units
- X = 10 × cos(45°) × cos(30°) ≈ 6.12
- Y = -10 × sin(45°) × cos(30°) ≈ -6.12
- Z = 10 × sin(30°) = 5.0

**Simplified position:** X=10, Y=-10, Z=7 (gives ~30° pitch with 45° yaw)

### Comparison with Game Tiles

From SPEC.md:
- Tile dimensions: 32×16 pixels
- Isometric projection formula:
  ```
  screenX = (x - y) * (tileWidth / 2)
  screenY = (x + y) * (tileHeight / 2)
  ```

Ship sprites must use same projection angle to match tiles visually.

## Ship Design Guidelines

### Size Reference

From SPEC.md (line 25):
- Ship deck: 128×48 pixels (length × beam)
- Character sprites: 32×32 pixels
- Tile size: 32×16 pixels

**Ship scale:**
- Length: 4 tiles (128px / 32px)
- Width: 3 tiles (48px / 16px)
- Mast height: ~2-3 tiles above deck

### Blocky Ship Anatomy

**Essential components:**
1. **Hull:** Rectangular body (dark wood)
   - Length: 4 voxels
   - Width: 1.5 voxels
   - Height: 1 voxel
2. **Deck:** Flat surface (lighter wood)
3. **Mast:** Vertical pole (centered, 3 voxels tall)
4. **Sails:** Rectangular cloth blocks (2 voxels × 2 voxels)
5. **Rudder:** Rear steering element (optional detail)

**Optional details:**
- Railings (thin voxel lines)
- Crow's nest (small platform at mast top)
- Cabin (small structure on deck)
- Bowsprit (forward extension)

**Color palette (Minecraft-inspired):**
- Dark wood: #8B4513 (saddle brown)
- Light wood: #DEB887 (burlywood)
- Sail cloth: #F5F5DC (beige)
- Accent: #654321 (dark brown for details)

## Rendering Performance Research

### Phaser Sprite Sheet Performance

From Phaser 3 documentation:
- Sprite sheets: O(1) frame access
- 1024×1024 texture: ~4 MB GPU memory (uncompressed RGBA)
- Frame switching: <1ms on modern hardware
- Loading time: ~50-100ms for PNG decode

**Conclusion:** 64-frame sprite sheet has negligible performance impact

### Alternative: Texture Atlas

Phaser supports TexturePacker format:
- Optimized packing (reduces whitespace)
- JSON metadata for frame positions
- Better memory efficiency for irregular shapes

**Rejected for now:** Ships are uniform 128×128, grid layout is sufficient

## Existing Game Examples

### Games using pre-rendered 3D sprites:
- **Donkey Kong Country (1994):** Pre-rendered 3D models → 2D sprites
- **Age of Empires (1997):** 32-direction unit sprites from 3D renders
- **StarCraft (1998):** 17-direction sprites for units/buildings
- **Factorio (2020):** 64-direction sprites for vehicles

**Industry standard:** Pre-rendered sprites for 2D games with rotation

### Sprite count trends:
- Early games (1990s): 8-16 directions
- Modern indie games (2010s+): 32-64 directions
- High-budget games: Real-time 3D

**Conclusion:** 64 frames is current indie game standard

## Tools Installation (macOS)

### Blender
```bash
brew install --cask blender
# or download from blender.org
```

### ImageMagick
```bash
brew install imagemagick

# Verify installation
magick -version
```

### Alternative: GraphicsMagick
```bash
brew install graphicsmagick
gm montage ...  # Similar syntax
```

**Decision:** ImageMagick (more common, better documentation)

## Future Optimization Research

### PNG Compression

Tools for reducing sprite sheet file size:
- **pngquant:** Lossy compression (256 colors)
- **optipng:** Lossless optimization
- **TinyPNG API:** Online compression service

**Typical savings:** 40-60% file size reduction with minimal quality loss

**Command:**
```bash
pngquant --quality=80-95 ship1.png
optipng ship1-fs8.png
```

### Lazy Loading Strategy

If multiple ship types exist:
1. Load placeholder sprite on game start
2. Async load full sprite sheets in background
3. Swap to full sprites when available
4. Preload next ship type on demand

**Not needed for single ship type** - 512 KB is acceptable initial load.

## References

- [Blender Python API](https://docs.blender.org/api/current/)
- [Phaser 3 Sprite Sheets](https://photonstorm.github.io/phaser3-docs/Phaser.Textures.TextureManager.html)
- [ImageMagick Montage](https://imagemagick.org/script/montage.php)
- [Isometric Projection](https://en.wikipedia.org/wiki/Isometric_projection)
- [MagicaVoxel](https://ephtracy.github.io/) (considered but not used)
