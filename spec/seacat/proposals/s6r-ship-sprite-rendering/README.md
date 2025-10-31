# s6r-ship-sprite-rendering

**Status:** Ready for implementation
**Created:** 2025-10-25
**Code:** s6r (ship-sprite-rendering)

## Quick Summary

Replace placeholder ship visualization (colored corner dots) with pre-rendered 3D sprite sheets. Ships display as blocky Minecraft-style vessels with 64 rotation frames for smooth visual turning.

## What This Proposal Contains

### Core Documentation
- **[proposal.md](./proposal.md)** - Complete specification with implementation plan
- **[research.md](./research.md)** - Tool comparisons, technical research, alternatives considered
- **[decision-s6r-ship-sprite-rendering.md](./decision-s6r-ship-sprite-rendering.md)** - Decision record with rationale

### Implementation Guides
- **[IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)** - Step-by-step workflow dividing human/agent tasks
- **[BLENDER_GUIDE.md](./BLENDER_GUIDE.md)** - Detailed Blender tutorial for ship modeling
- **[TESTING.md](./TESTING.md)** - Testing procedures and troubleshooting

## Key Decisions

1. **Tool:** Blender (free, scriptable, cross-platform)
2. **Frame count:** 64 frames (5.625° per frame)
3. **Style:** Minecraft-style voxel blocks (matches game aesthetic)
4. **Format:** 8×8 sprite sheet (1024×1024 pixels)

## Implementation Status

### ✅ Completed (Agent)
- [x] Proposal and research documentation
- [x] Blender rendering script (`scripts/render-ship-frames.py`)
- [x] Sprite sheet assembly script (`scripts/assemble-sprite-sheet.sh`)
- [x] Client integration (GameScene.ts updated)
- [x] SPEC.md updated with Milestone 8
- [x] Blender tutorial guide created
- [x] Testing guide created

### ⏳ Remaining (Human)
- [ ] Install Blender (`brew install --cask blender`)
- [ ] Model ship in Blender (follow BLENDER_GUIDE.md)
- [ ] Run rendering script (~2 minutes)
- [ ] Run sprite sheet assembly (~5 seconds)
- [ ] Test in game

## Quick Start

### For Human Developer

1. **Read the guides:**
   - Start with [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
   - Follow [BLENDER_GUIDE.md](./BLENDER_GUIDE.md) for modeling

2. **Install Blender:**
   ```bash
   brew install --cask blender
   ```

3. **Model ship in Blender:**
   - Launch Blender
   - Follow tutorial in BLENDER_GUIDE.md
   - Save as `clients/seacat/assets/blender/ship1.blend`

4. **Render frames:**
   ```bash
   cd clients/seacat
   blender assets/blender/ship1.blend --background --python scripts/render-ship-frames.py
   ```

5. **Assemble sprite sheet:**
   ```bash
   ./scripts/assemble-sprite-sheet.sh
   ```

6. **Test:**
   ```bash
   npm run build
   npm start
   ```

## Files Created

### Scripts (Ready to Use)
```
clients/seacat/
├── scripts/
│   ├── render-ship-frames.py        ✅ Created
│   └── assemble-sprite-sheet.sh     ✅ Created (executable)
└── assets/
    ├── blender/                      ✅ Created (empty, awaiting ship1.blend)
    └── sprites/
        └── ship_frames/              ✅ Created (empty, for temp frames)
```

### Code Changes (Applied)
```
clients/seacat/src/game/GameScene.ts:
  ✅ Added ship1 sprite sheet loading in preload()
  ✅ Updated ship creation to use sprite instead of hidden dummy
  ✅ Added calculateShipSpriteFrame() helper function
  ✅ Added sprite frame updates on rotation changes
  ✅ Added sprite sheet loading verification
```

### Documentation (Complete)
```
spec/seacat/
├── SPEC.md                           ✅ Updated (added Milestone 8)
└── proposals/s6r-ship-sprite-rendering/
    ├── README.md                     ✅ This file
    ├── proposal.md                   ✅ Full specification
    ├── research.md                   ✅ Technical research
    ├── decision-s6r-ship-sprite-rendering.md  ✅ Decision record
    ├── IMPLEMENTATION_PLAN.md        ✅ Workflow guide
    ├── BLENDER_GUIDE.md              ✅ Blender tutorial
    └── TESTING.md                    ✅ Testing procedures
```

## Time Estimate

- **Agent work:** ✅ Complete (~30 minutes)
- **Human work:** ⏳ Pending (~90-120 minutes)
  - Blender modeling: 30-60 min
  - Rendering: 2 min
  - Assembly: 5 sec
  - Testing: 10-20 min

## Next Steps

1. Human reads BLENDER_GUIDE.md
2. Human models ship and saves `ship1.blend`
3. Human runs rendering script
4. Human runs assembly script
5. Human tests in game
6. Iterate if needed (adjust camera, ship design, etc.)

## Support

If you encounter issues:
1. Check [TESTING.md](./TESTING.md) troubleshooting section
2. Review [BLENDER_GUIDE.md](./BLENDER_GUIDE.md) tips section
3. All scripts have detailed error messages

## Future Work

After ship1 is complete:
- Create ship2, ship3 (different designs)
- Add damage states (alternate sprite sheets)
- Implement sail animations
- Add wake effects

See [proposal.md](./proposal.md) "Future Enhancements" for details.

---

**Ready to start?** Read [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) first! 🚢
