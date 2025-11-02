# s6r-ship-sprite-rendering: Implementation Plan

## Division of Labor

### Human Tasks (Blender UI Work)
- Install Blender
- Model the ship using cube primitives
- Set up camera and lighting
- Test render a single frame
- Review final sprite sheet quality

### Agent Tasks (Scripting & Integration)
- Create Blender Python rendering script
- Create sprite sheet assembly script
- Update Phaser client code (GameScene.ts)
- Update SPEC.md documentation
- Create testing instructions

---

## Phase 1: Environment Setup (15 minutes)

### 1.1 Install Blender (HUMAN)
```bash
# macOS installation
brew install --cask blender
```

**Verification:**
- Launch Blender
- Confirm it opens without errors
- Close Blender

### 1.2 Install ImageMagick (AGENT)
Agent will verify/install ImageMagick for sprite sheet assembly.

### 1.3 Create Asset Directories (AGENT)
Agent will create the necessary directory structure:
```
clients/seacat/assets/
├── sprites/
│   └── ship_frames/  (temp directory for individual frames)
└── blender/          (source .blend files)
```

---

## Phase 2: Blender Setup & Ship Modeling (30-60 minutes, HUMAN)

### 2.1 Initial Blender Setup (HUMAN)
**Agent provides:** Step-by-step tutorial guide
**Human does:**
1. Launch Blender
2. Delete default cube (X key)
3. Set up orthographic camera for isometric view
4. Add simple lighting

### 2.2 Ship Modeling (HUMAN)
**Agent provides:** Reference dimensions and blocky ship design guide
**Human does:**
1. Create hull using cube primitives
2. Add deck, mast, and sails
3. Keep it simple (blocky Minecraft style)
4. Join all parts into single "Ship" object
5. Apply flat shading for blocky look

**Target:** Simple sailing ship (~15-20 cubes total)

### 2.3 Test Single Frame Render (HUMAN)
**Agent provides:** Render settings checklist
**Human does:**
1. Set render to 256×256 PNG (higher res to avoid blur when scaled)
2. Enable transparent background
3. Render single frame (F12)
4. Verify ship looks good and fits in frame
5. Adjust camera/ship scale if needed

### 2.4 Save Blender File (HUMAN)
Save as: `clients/seacat/assets/blender/ship1.blend`

---

## Phase 3: Automated Rendering (10 minutes, AGENT + HUMAN)

### 3.1 Create Rendering Script (AGENT)
Agent creates: `clients/seacat/scripts/render-ship-frames.py`

**Script features:**
- Reads ship from `ship1.blend`
- Renders 64 frames (360° rotation)
- Outputs to `assets/sprites/ship_frames/`
- Progress reporting
- Error handling

### 3.2 Run Rendering Script (HUMAN)
**Agent provides:** Exact command to run
**Human does:**
```bash
cd clients/seacat
blender assets/blender/ship1.blend --background --python scripts/render-ship-frames.py
```

**Expected time:** ~80 seconds for 64 frames

**Verification:**
- Check `assets/sprites/ship_frames/` contains `ship_000.png` through `ship_063.png`
- Spot-check a few frames to verify rotation

---

## Phase 4: Sprite Sheet Assembly (5 minutes, AGENT + HUMAN)

### 4.1 Create Assembly Script (AGENT)
Agent creates: `clients/seacat/scripts/assemble-sprite-sheet.sh`

**Script features:**
- Uses ImageMagick to combine 64 frames
- Creates 8×8 grid (2048×2048, using 256×256 frames)
- Transparent background
- Outputs to `assets/sprites/ship1.png`
- Cleans up temp frames (optional)

### 4.2 Run Assembly Script (HUMAN)
**Agent provides:** Exact command to run
**Human does:**
```bash
cd clients/seacat
./scripts/assemble-sprite-sheet.sh
```

**Verification:**
- `assets/sprites/ship1.png` exists
- Open in image viewer: should see 8×8 grid of ship rotations
- File size: ~300-600 KB

---

## Phase 5: Client Integration (20 minutes, AGENT)

### 5.1 Update GameScene.ts (AGENT)
**Changes:**
1. Add sprite sheet preloading in `preload()`:
   ```typescript
   this.load.spritesheet('ship1', 'assets/sprites/ship1.png', {
     frameWidth: 128,
     frameHeight: 128
   });
   ```

2. Update ship sprite creation to use sprite sheet instead of rectangle

3. Add rotation-to-frame mapping in `updateRemoteShip()`:
   ```typescript
   const frameIndex = Math.round((normalizedRotation / (Math.PI * 2)) * 64) % 64;
   ship.sprite.setFrame(frameIndex);
   ```

4. Remove old corner dot visualization code

### 5.2 Test in Game (HUMAN)
**Agent provides:** Testing instructions
**Human does:**
1. Build client: `npm run build`
2. Start seacat space: `mew space up`
3. Launch client: `npm start`
4. Connect and grab ship wheel
5. Steer ship and verify:
   - Sprite rotates smoothly
   - Ship orientation matches steering
   - No visual glitches
   - Performance is smooth

---

## Phase 6: Documentation (10 minutes, AGENT)

### 6.1 Update SPEC.md (AGENT)
Add section under "Milestone 7" (or new milestone) documenting:
- Ship sprite system
- 64-frame rotation
- Blender rendering pipeline
- How to create new ship types

### 6.2 Create Ship Creation Guide (AGENT)
Document in proposal directory:
- Complete Blender workflow for new ship types
- Rendering script usage
- Troubleshooting common issues

---

## Detailed Task Breakdown

### AGENT TASKS (Can be done now)

#### Task A1: Install/Verify ImageMagick ✓
```bash
brew install imagemagick || echo "Already installed"
magick -version
```

#### Task A2: Create Directory Structure ✓
```bash
mkdir -p clients/seacat/assets/sprites/ship_frames
mkdir -p clients/seacat/assets/blender
mkdir -p clients/seacat/scripts
```

#### Task A3: Create Blender Rendering Script ✓
File: `clients/seacat/scripts/render-ship-frames.py`
- Complete Python script with error handling
- Configurable resolution, frame count
- Progress reporting

#### Task A4: Create Sprite Sheet Assembly Script ✓
File: `clients/seacat/scripts/assemble-sprite-sheet.sh`
- ImageMagick montage command
- Error checking
- Optional cleanup of temp frames

#### Task A5: Write Blender Tutorial Guide ✓
File: `spec/seacat/proposals/s6r-ship-sprite-rendering/BLENDER_GUIDE.md`
- Step-by-step instructions for ship modeling
- Camera setup with exact coordinates
- Render settings
- Screenshots/descriptions of each step

#### Task A6: Update GameScene.ts ✓
Changes:
- Sprite sheet loading
- Frame calculation from rotation
- Remove placeholder rendering

#### Task A7: Update SPEC.md ✓
Add ship sprite rendering documentation

---

### HUMAN TASKS (After agent completes scripts)

#### Task H1: Install Blender
- Run: `brew install --cask blender`
- Launch to verify

#### Task H2: Model Ship in Blender
- Follow BLENDER_GUIDE.md (agent-created)
- Create simple blocky sailing ship
- Save as `ship1.blend`
- **Estimated time:** 30-60 minutes

#### Task H3: Test Single Frame
- Render one frame (F12)
- Verify quality and fit
- Adjust if needed

#### Task H4: Run Rendering Script
- Execute command (agent provides)
- Wait ~80 seconds
- Verify 64 PNG frames created

#### Task H5: Run Assembly Script
- Execute command (agent provides)
- Verify `ship1.png` sprite sheet
- Check in image viewer

#### Task H6: Test in Game
- Build and run client
- Start space
- Test ship rotation
- Verify smooth visuals

---

## Success Criteria

- [ ] 64 ship rotation frames rendered from Blender
- [ ] Sprite sheet assembled (8×8 grid, 2048×2048)
- [ ] Client loads and displays ship sprite
- [ ] Ship rotates smoothly during gameplay
- [ ] No performance degradation
- [ ] Sprite visual style matches game aesthetic

---

## Rollback Plan

If sprite sheet has issues:
1. Keep old rectangle rendering as fallback
2. Add config flag to toggle sprite/rectangle mode
3. Debug sprite sheet loading separately

No breaking changes - purely additive.

---

## Time Estimate

| Phase | Time | Who |
|-------|------|-----|
| Environment setup | 15 min | Both |
| Blender modeling | 30-60 min | Human |
| Rendering | 10 min | Both |
| Assembly | 5 min | Both |
| Integration | 20 min | Agent |
| Documentation | 10 min | Agent |
| **Total** | **90-120 min** | |

**Agent work can start immediately** (scripts, docs, code changes)
**Human work starts after** agent provides tutorial and scripts

---

## Next Steps

1. **Agent:** Create all scripts and documentation (Tasks A1-A7)
2. **Human:** Install Blender and model ship (Tasks H1-H3)
3. **Human:** Run rendering pipeline (Tasks H4-H5)
4. **Human:** Test in game (Task H6)
5. **Both:** Iterate if needed (adjust ship model, camera angle, etc.)

---

## Questions / Decision Points

1. **Ship design:** Start with simple sailing ship? (Recommended: yes)
2. **Frame count:** Confirm 64 frames? (Recommended: yes, can reduce to 32 if performance issues)
3. **Cleanup temp frames:** Delete after assembly? (Recommended: keep for debugging)
4. **Fallback rendering:** Keep rectangle code? (Recommended: yes, with feature flag)

---

## Reference Files

After agent completes tasks, human will have:
- `BLENDER_GUIDE.md` - Step-by-step Blender tutorial
- `render-ship-frames.py` - Automated rendering script
- `assemble-sprite-sheet.sh` - Sprite sheet builder
- `TESTING.md` - How to test in game

All scripts will be executable and documented with clear instructions.
