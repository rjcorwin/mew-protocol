# Blender Ship Modeling Guide for Seacat

**Goal:** Create a simple blocky sailing ship that renders as 64 isometric rotation frames.

**Time estimate:** 30-60 minutes (first time)

**Prerequisites:**
- Blender installed (`brew install --cask blender`)
- Basic mouse/keyboard navigation (covered below)

---

## Part 1: Blender Basics (5 minutes)

### Launch Blender
1. Open Blender application
2. Click anywhere to dismiss splash screen
3. You'll see a default scene with a cube, camera, and light

### Essential Navigation
- **Rotate view:** Middle mouse button drag (or two-finger trackpad drag)
- **Pan view:** Shift + middle mouse drag
- **Zoom:** Scroll wheel (or pinch on trackpad)
- **Select object:** Left-click
- **Delete:** Select object, press X, confirm delete

### Essential Shortcuts
- **G:** Grab/move object
- **S:** Scale object
- **R:** Rotate object
- **X:** Delete object
- **Shift+A:** Add new object
- **Shift+D:** Duplicate object
- **Tab:** Toggle Edit mode (for modifying mesh)
- **Numpad 7:** Top view
- **Numpad 1:** Front view
- **Numpad 3:** Side view

### Pro Tip: Use Numpad Views
Press **Numpad 7** for perfect top-down view when modeling.

---

## Part 2: Camera Setup (10 minutes)

**DO THIS FIRST** - It's easier to model when you can see the final camera angle.

### Step 1: Delete Default Objects
1. Select the default cube: Left-click on it
2. Press **X** → Delete (confirm)
3. Repeat for any other objects you don't need

### Step 2: Configure Camera for Isometric View

1. **Select Camera:**
   - Left-click the camera object (small pyramid icon)
   - You'll see it outlined in orange

2. **Switch to Camera Properties:**
   - Right panel → Camera icon (looks like a camera)

3. **Set to Orthographic:**
   - Type: Change from "Perspective" to "Orthographic"
   - Orthographic Scale: Set to **10** (we'll adjust later)

4. **Position Camera for Isometric Angle:**
   - With camera selected, press **N** to open properties sidebar
   - Go to "Item" tab
   - Set Location:
     - X: **10**
     - Y: **-10**
     - Z: **7**
   - Set Rotation (in degrees):
     - X: **60°**
     - Y: **0°**
     - Z: **45°**

5. **Lock Camera to View (Optional but helpful):**
   - Press **Numpad 0** to enter camera view
   - You'll see the frame that will be rendered
   - This helps you model exactly what the game will show

### Step 3: Adjust Camera Frame
1. In camera view (Numpad 0)
2. You should see a rectangular frame
3. We need it square for our 128×128 sprite
4. Go to **Output Properties** (right panel, printer icon)
5. Resolution:
   - X: **128**
   - Y: **128**

---

## Part 3: Ship Modeling (30-45 minutes)

### Design Reference
We're making a simple blocky sailing ship:
- **Hull:** Rectangular body (4 blocks long, 1.5 blocks wide)
- **Deck:** Flat top surface
- **Mast:** Vertical pole in center
- **Sails:** Rectangular blocks hanging from mast

**Style:** Think Minecraft boat, but viewed isometrically.

### Step 1: Create Hull

1. **Add a cube:**
   - Press **Shift+A** → Mesh → Cube
   - This creates a 2×2×2 cube at origin

2. **Scale it to ship hull proportions:**
   - Press **S** (scale)
   - Press **X** (constrain to X axis)
   - Type **2** (makes it 2× longer in X direction)
   - Press Enter

3. **Flatten it slightly:**
   - Press **S** (scale)
   - Press **Z** (constrain to Z axis)
   - Type **0.5** (makes it half as tall)
   - Press Enter

4. **Widen it a bit:**
   - Press **S** (scale)
   - Press **Y** (constrain to Y axis)
   - Type **0.75** (makes it 75% as wide as long)
   - Press Enter

**Result:** You should have a rectangular hull shape.

### Step 2: Create Deck

1. **Duplicate the hull:**
   - With hull selected, press **Shift+D** (duplicate)
   - Press **Z** to constrain movement to Z axis
   - Type **0.5** (moves it up slightly)
   - Press Enter

2. **Make it thinner (deck is just a plank):**
   - Press **S** (scale)
   - Press **Z** (constrain to Z axis)
   - Type **0.2** (makes it very flat)
   - Press Enter

3. **Change color (optional, for visual distinction):**
   - With deck selected, right panel → Material Properties
   - Click "New" to add material
   - Base Color: Choose lighter brown/tan

### Step 3: Create Mast

1. **Add a cube:**
   - Press **Shift+A** → Mesh → Cube

2. **Make it tall and thin:**
   - Press **S** (scale)
   - Press **Shift+Z** (constrain to X and Y, not Z)
   - Type **0.1** (makes it very thin)
   - Press Enter

3. **Make it tall:**
   - Press **S** (scale)
   - Press **Z** (constrain to Z axis)
   - Type **3** (makes it 3× taller)
   - Press Enter

4. **Move it up:**
   - Press **G** (grab/move)
   - Press **Z** (constrain to Z axis)
   - Type **2** (moves it up so it sits on deck)
   - Press Enter

### Step 4: Create Sails

1. **Add a cube:**
   - Press **Shift+A** → Mesh → Cube

2. **Make it flat (like a sail):**
   - Press **S** (scale)
   - Press **Y** (constrain to Y axis)
   - Type **0.05** (makes it very flat)
   - Press Enter

3. **Make it wide and tall:**
   - Press **S** (scale)
   - Press **X** (constrain to X axis)
   - Type **1.5** (makes it wider)
   - Press Enter

   - Press **S** (scale)
   - Press **Z** (constrain to Z axis)
   - Type **2** (makes it taller)
   - Press Enter

4. **Position next to mast:**
   - Press **G** (grab)
   - Press **Z**
   - Type **2.5** (moves it up to mast height)
   - Press Enter

5. **Optional: Add second sail:**
   - Duplicate sail: **Shift+D**
   - Move it up: **G**, **Z**, type **1**

### Step 5: Add Details (Optional)

**Crow's Nest (lookout platform on mast):**
1. Add small cube: **Shift+A** → Mesh → Cube
2. Scale down: **S**, **0.3**
3. Move to top of mast: **G**, **Z**, (position at mast top)

**Bowsprit (front pole):**
1. Duplicate mast: Select mast, **Shift+D**
2. Rotate 90°: **R**, **Y**, **90**
3. Scale shorter: **S**, **X**, **0.5**
4. Move to front: **G**, **X**, (position at bow)

**Railings:**
1. Add thin cubes around deck edges
2. Scale very thin: **S**, **Z**, **0.1**

**Don't go overboard** - simple is better! You can always add details later.

### Step 6: Join All Parts into Single Object

1. **Select all ship parts:**
   - Press **A** (select all)
   - Or click each part while holding **Shift**

2. **Join into one object:**
   - Press **Ctrl+J**
   - Everything becomes one "Ship" object

3. **Rename to "Ship":**
   - Right panel → Outliner (top-right)
   - Double-click the object name
   - Type **Ship**
   - Press Enter

4. **Set origin to center:**
   - With ship selected: Object menu → Set Origin → Origin to Geometry
   - This ensures the ship rotates around its center

### Step 7: Apply Flat Shading (Blocky Look)

1. **Select ship object**
2. **Right-click** → Shade Flat
3. This removes smooth gradients, giving sharp Minecraft-style edges

---

## Part 4: Render Settings (10 minutes)

### Step 1: Configure Render Output

1. **Select Render Properties** (right panel, camera icon)

2. **Set Render Engine:**
   - Render Engine: **Eevee** (faster) or **Cycles** (better quality, slower)
   - Recommendation: **Eevee** for first test

3. **Set Sampling (quality):**
   - For Eevee: Render samples: **32** (good quality, fast)
   - For Cycles: Samples: **64** (good quality, slower)

### Step 2: Enable Transparent Background

1. **Go to Film section** (in Render Properties)
2. **Check "Transparent"**
3. This makes background invisible (shows only ship)

### Step 3: Set Output Format

1. **Select Output Properties** (right panel, printer icon)
2. **File Format:** PNG
3. **Color:** RGBA (includes alpha channel for transparency)
4. **Compression:** 15% (default is fine)

### Step 4: Adjust Camera Framing

1. **Enter camera view:** Press **Numpad 0**
2. **Check ship framing:**
   - Ship should fill ~80% of frame
   - Leave small margin on all sides

3. **If ship too small/large:**
   - Select camera
   - Press **N** → Item tab
   - Adjust **Orthographic Scale** (try 8-12)

4. **If ship off-center:**
   - Select ship (not camera)
   - Move ship: **G**, then mouse/arrow keys
   - Or set Location to X=0, Y=0, Z=0

---

## Part 5: Test Render (5 minutes)

### Step 1: Render Single Frame

1. **Enter camera view:** Numpad 0
2. **Render:** Press **F12** (or Render menu → Render Image)
3. **Wait:** 5-10 seconds for render to complete
4. **View result:** Rendered image appears in new window

### Step 2: Evaluate Quality

**Check for:**
- ✅ Ship clearly visible and centered
- ✅ Background is transparent (checkered pattern in Blender)
- ✅ Ship has blocky, Minecraft-like appearance
- ✅ No parts clipped/cut off
- ✅ Good contrast (ship not too dark or bright)

**If adjustments needed:**
- **Too dark:** Add more light (Shift+A → Light → Sun)
- **Too small:** Increase camera Orthographic Scale
- **Too large:** Decrease camera Orthographic Scale
- **Off-center:** Move ship (G) or camera
- **Wrong angle:** Double-check camera rotation (60°, 0°, 45°)

### Step 3: Save Test Render (Optional)

1. In render window: Image menu → Save As
2. Save to: `/tmp/ship_test.png`
3. Open in Preview/image viewer to verify transparency

---

## Part 6: Save Blender File (IMPORTANT!)

### Save Your Work

1. **File menu → Save As**
2. **Navigate to:** `clients/seacat/assets/blender/`
3. **Filename:** `ship1.blend`
4. **Click Save**

**CRITICAL:** The Python rendering script will look for this exact file path!

---

## Part 7: Tips & Troubleshooting

### Common Issues

**Problem:** Ship looks blurry/smooth instead of blocky
- **Solution:** Right-click ship → Shade Flat

**Problem:** Can't see camera view
- **Solution:** Press Numpad 0 (or View menu → Cameras → Active Camera)

**Problem:** Ship is too dark
- **Solution:** Add more lights (Shift+A → Light → Sun), increase light strength

**Problem:** Background isn't transparent
- **Solution:** Render Properties → Film → Check "Transparent"

**Problem:** Ship rotates off-center during script
- **Solution:** Select ship → Object menu → Set Origin → Origin to Geometry

**Problem:** Render is too slow
- **Solution:** Use Eevee instead of Cycles, reduce samples to 16-32

### Pro Tips

1. **Work in camera view:** Press Numpad 0 and model while seeing final framing
2. **Use simple shapes:** Don't overcomplicate - blocky is the goal
3. **Duplicate wisely:** Use Shift+D to copy similar parts (masts, sails)
4. **Save often:** Ctrl+S to save frequently
5. **Test render early:** Press F12 often to check progress

### Color Palette Suggestions

**Wooden ship:**
- Hull: Dark brown (#8B4513)
- Deck: Light brown (#DEB887)
- Sails: Off-white (#F5F5DC)

**How to set colors:**
1. Select object part
2. Material Properties → Base Color
3. Click color picker, enter hex code

---

## Next Steps

After saving `ship1.blend`:

1. **Notify agent** - You're ready for automated rendering
2. **Agent will provide command** to run rendering script
3. **Wait ~80 seconds** for 64 frames to render
4. **Continue to sprite sheet assembly**

---

## Quick Reference Card

```
NAVIGATION:
  Rotate view:     Middle mouse drag
  Pan:             Shift + middle mouse
  Zoom:            Scroll wheel

MODELING:
  Add object:      Shift+A
  Duplicate:       Shift+D
  Delete:          X
  Move:            G (then X/Y/Z to constrain axis)
  Scale:           S (then X/Y/Z to constrain axis)
  Rotate:          R (then X/Y/Z to constrain axis)

VIEWS:
  Camera view:     Numpad 0
  Top view:        Numpad 7
  Front view:      Numpad 1
  Side view:       Numpad 3

RENDERING:
  Render frame:    F12

SELECTION:
  Select all:      A
  Deselect all:    Alt+A
  Join objects:    Ctrl+J
```

---

## Example Ship Reference

```
            /\     (Sail)
           /  \
          |    |
          |    |   (Mast)
          |    |
     ============  (Deck)
    /            \
   /              \
  |________________| (Hull)
```

**Side view - simple sailing ship**

Keep it minimal for first attempt! You can always create fancier ships later.

Good luck! 🚢
