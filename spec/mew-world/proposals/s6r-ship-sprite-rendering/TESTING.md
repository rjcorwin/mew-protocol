# Ship Sprite Rendering - Testing Guide

## Prerequisites

Before testing, ensure you have:
- ✅ Blender installed (`brew install --cask blender`)
- ✅ ImageMagick installed (`brew install imagemagick`)
- ✅ Ship model saved as `clients/mew-world/assets/blender/ship1.blend`
- ✅ Rendering scripts created (agent should have done this)

---

## Step 1: Render Ship Frames (~2 minutes)

### Command

```bash
cd clients/mew-world
blender assets/blender/ship1.blend --background --python scripts/render-ship-frames.py
```

### Expected Output

```
==================================================
MEW World Ship Frame Renderer
==================================================

✓ Blend file: /path/to/ship1.blend
✓ Scene configured: 128x128, transparent PNG
✓ Found ship object: Ship
✓ Output directory: /path/to/ship_frames

Rendering 64 frames...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[███░░░...] 10.0% | Frame  6/64 |   5.63° | ship_005.png
...
[██████████████████████████████] 100.0% | Frame 64/64 | 354.38° | ship_063.png
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Rendered 64 frames successfully!

==================================================
Rendering Complete!
==================================================
Output: /path/to/assets/sprites/ship_frames
Frames: ship_000.png - ship_063.png

Next step: Run assemble-sprite-sheet.sh
==================================================
```

### Time

- **Expected:** ~80-120 seconds
- Depends on: Scene complexity, render settings, CPU speed

### Verification

```bash
ls assets/sprites/ship_frames/ | wc -l
```

**Expected:** `64` (should show 64 files)

### Spot Check

```bash
open assets/sprites/ship_frames/ship_000.png  # Frame 0 (0°, East)
open assets/sprites/ship_frames/ship_016.png  # Frame 16 (90°, South)
open assets/sprites/ship_frames/ship_032.png  # Frame 32 (180°, West)
open assets/sprites/ship_frames/ship_048.png  # Frame 48 (270°, North)
```

**Check for:**
- ✅ Transparent background (checkered pattern in Preview)
- ✅ Ship clearly visible
- ✅ Ship rotates correctly between frames
- ✅ No clipping/cut-off parts

---

## Step 2: Assemble Sprite Sheet (~5 seconds)

### Command

```bash
cd clients/mew-world
./scripts/assemble-sprite-sheet.sh
```

### Expected Output

```
==================================================
MEW World Ship Sprite Sheet Assembler
==================================================

✓ ImageMagick found
✓ Frames directory: assets/sprites/ship_frames
✓ Found 64 frames

Assembling sprite sheet...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Sprite sheet created successfully!

==================================================
Sprite Sheet Complete!
==================================================
Output:      assets/sprites/ship1.png
Dimensions:  1024x1024
File size:   512K
Grid:        8x8 (64 frames)
Frame size:  128x128

Cleanup:
Individual frames are still in: assets/sprites/ship_frames

Delete individual frames? (y/n)
```

### Decision: Delete Frames?

**Recommendation:** Type `n` (keep for debugging)

- You can always delete manually later
- Useful to inspect individual frames if sprite sheet has issues
- Only uses ~8-10 MB disk space

### Verification

```bash
# Check sprite sheet exists
ls -lh assets/sprites/ship1.png

# View sprite sheet
open assets/sprites/ship1.png
```

**Expected image:**
- 8 columns × 8 rows of ship sprites
- Each sprite shows ship at different rotation
- Frame 0 (top-left) = 0°
- Frame 63 (bottom-right) = 354.375°
- Transparent background

### Visual Inspection Checklist

Open `ship1.png` and verify:
- ✅ 64 ship sprites arranged in 8×8 grid
- ✅ Sprites rotate smoothly from frame to frame
- ✅ No black borders or artifacts
- ✅ Transparent background (checkered in image viewer)
- ✅ Ships centered in each frame
- ✅ File size reasonable (300-600 KB)

---

## Step 3: Test in Game (~5 minutes)

### Build Client

```bash
cd clients/mew-world
npm run build
```

### Start MEW Space

```bash
# In separate terminal
cd /path/to/mew-protocol
mew space up -d
```

Or use existing running space.

### Launch Client

```bash
cd clients/mew-world
npm start
```

### Connect to Game

1. Connection form appears
2. Enter credentials:
   - Gateway URL: `ws://localhost:8080`
   - Space name: `mew-world`
   - Username: `player1` (or `player2`, `player3`, `player4`)
   - Token: (from `.mew/tokens/player1.token` in space directory)
3. Click **Connect**

### Test Ship Rendering

1. **Find the ship:**
   - Walk around map (arrow keys)
   - Ship should appear on screen

2. **Check sprite rendering:**
   - ✅ Ship shows sprite (not brown rectangle)
   - ✅ Ship sprite matches blocky design from Blender
   - ✅ Ship has correct orientation

3. **Grab ship wheel:**
   - Walk near ship stern (rear)
   - Press **E** when "Press E to grab wheel" appears
   - Hold **left/right arrow** to steer

4. **Verify rotation:**
   - ✅ Ship sprite rotates smoothly as ship turns
   - ✅ No visible frame snapping or jerking
   - ✅ Rotation matches steering direction
   - ✅ Ship orientation always correct

5. **Test edge cases:**
   - Full 360° rotation (hold left arrow for several seconds)
   - Quick direction changes
   - Release wheel (ship should keep turning at locked angle)

### Performance Check

- ✅ Frame rate stays smooth (60 FPS)
- ✅ No lag when ship rotates
- ✅ Sprite switches instantly (no loading delay)
- ✅ No console errors

### Browser Console Check

Open DevTools (Cmd+Option+I), check for:
- ✅ No errors related to sprite loading
- ✅ Message: "Loaded sprite sheet: ship1"
- ✅ No warnings about missing frames

---

## Step 4: Multi-Player Testing (Optional)

### Launch Second Client

```bash
# In new terminal
cd clients/mew-world
npm start
```

### Connect as Different Player

- Username: `player2` (different from first client)
- Token: From `.mew/tokens/player2.token`

### Verify Remote Ship Rendering

1. **From player1's view:**
   - If player2 grabs wheel and steers
   - player1 should see ship rotating with correct sprite

2. **From player2's view:**
   - Should see own ship steering with rotating sprite

3. **Both players:**
   - ✅ Ship rotation synced across clients
   - ✅ Both see same ship orientation
   - ✅ No desync or lag

---

## Troubleshooting

### Problem: Rendering script fails with "No object named 'Ship'"

**Solution:**
1. Open `ship1.blend` in Blender
2. Check Outliner (top-right panel)
3. Ensure main object is named exactly "Ship" (case-sensitive)
4. If different name, rename or update script `SHIP_OBJECT_NAME`

### Problem: Frames are all black

**Solution:**
1. Check lighting in Blender (add Sun light if missing)
2. Verify camera can see ship (Numpad 0 in Blender)
3. Check render samples (increase to 64)

### Problem: Sprite sheet has black background instead of transparent

**Solution:**
1. In Blender: Render Properties → Film → Check "Transparent"
2. Re-render frames
3. Re-run sprite sheet assembly

### Problem: Ship sprite not showing in game (still brown rectangle)

**Solution:**
1. Check `assets/sprites/ship1.png` exists
2. Check browser console for loading errors
3. Hard refresh browser (Cmd+Shift+R)
4. Verify GameScene.ts was updated by agent
5. Rebuild client: `npm run build`

### Problem: Ship rotates but sprite doesn't change

**Solution:**
1. Check `setFrame()` is being called (add console.log)
2. Verify frame calculation: `console.log(frameIndex)` should show 0-63
3. Check sprite sheet loaded correctly: `this.textures.exists('ship1')`

### Problem: Sprite rotation is off by 90° or 180°

**Solution:**
1. Rotation offset issue - adjust calculation in GameScene.ts
2. Try: `const frameIndex = Math.round(((rotation + Math.PI/2) / (Math.PI * 2)) * 64) % 64;`
3. Or rotate ship in Blender: Select ship → R → Z → 90

### Problem: Performance drops when ship rotates

**Solution:**
1. Check sprite sheet file size (should be <1 MB)
2. Optimize PNG: `pngquant --quality=80-95 ship1.png`
3. Reduce sprite resolution (use 64×64 frames instead of 128×128)

---

## Success Criteria Checklist

- [ ] 64 frames rendered successfully
- [ ] Sprite sheet created (1024×1024, 8×8 grid)
- [ ] Ship sprite loads in game
- [ ] Ship rotates smoothly (no visible frame snapping)
- [ ] Rotation direction matches steering input
- [ ] No performance issues (60 FPS maintained)
- [ ] Sprite style matches game aesthetic (blocky/isometric)
- [ ] Transparent background (no black borders)
- [ ] Remote players see correct ship rotation
- [ ] No console errors

If all boxes checked: **Ship sprite rendering is complete! 🎉**

---

## Next Steps After Success

1. **Create additional ship types:**
   - Model `ship2.blend`, `ship3.blend` in Blender
   - Run same rendering pipeline
   - Update ship server to specify ship type

2. **Add damage states:**
   - Create alternate sprite sheets (e.g., `ship1_damaged.png`)
   - Switch sprite based on ship health

3. **Animate sails:**
   - Create multiple sail positions
   - Interpolate between sprites based on ship speed

4. **Optimize file size:**
   - Use `pngquant` or `optipng` to compress sprite sheets
   - Balance quality vs file size for web delivery

---

## File Locations Reference

```
clients/mew-world/
├── assets/
│   ├── blender/
│   │   └── ship1.blend              (Your Blender model)
│   └── sprites/
│       ├── ship_frames/             (64 individual PNGs, temp)
│       │   ├── ship_000.png
│       │   ├── ship_001.png
│       │   └── ... ship_063.png
│       └── ship1.png                (Final 8x8 sprite sheet)
├── scripts/
│   ├── render-ship-frames.py        (Blender rendering script)
│   └── assemble-sprite-sheet.sh     (ImageMagick assembly)
└── src/
    └── scenes/
        └── GameScene.ts             (Sprite loading code)
```

---

## Quick Command Reference

```bash
# 1. Render frames (from clients/mew-world)
blender assets/blender/ship1.blend --background --python scripts/render-ship-frames.py

# 2. Assemble sprite sheet
./scripts/assemble-sprite-sheet.sh

# 3. View sprite sheet
open assets/sprites/ship1.png

# 4. Build and test
npm run build
npm start

# 5. Cleanup (if needed)
rm -rf assets/sprites/ship_frames/  # Delete individual frames
```

Good luck! 🚢✨
