# Bug Fix: Ship Default Orientation and Dimension Naming

**Date:** 2025-10-20
**Issue:** Ship shape didn't match its default heading direction, confusing dimension names
**Status:** Fixed

## Problem

The ship was configured with conflicting orientation assumptions:

**Ship Dimensions:**
- Width: 64 pixels (narrower)
- Height: 96 pixels (longer)
- Shape: Vertical/tall rectangle

**Default Heading:**
- `initialHeading: 'east'` (rotation = 0)
- Moves RIGHT (positive X direction)
- Implies ship is oriented horizontally

**Control Point Comments:**
- Wheel at `{x: 0, y: 32}` - labeled as "Back of ship"
- Sails at `{x: -16, y: 0}` - labeled as "Left side of ship"

**The Contradiction:**
If the ship moves EAST (right) with the wheel at the "back" (y: 32 = down), the ship would be moving sideways relative to its visual shape. The 64×96 dimensions suggest the ship should be taller than wide, implying forward/backward movement (north/south), not sideways (east/west).

## Visual Analysis

When rotation = 0 (east):
```
Current (wrong):
  Ship moves → EAST (right)
  Ship shape: Tall (96 height)
  Result: Moving sideways
```

When rotation = π/2 (south):
```
Correct:
  Ship moves ↓ SOUTH (down)
  Ship shape: Tall (96 height)
  Wheel at top (stern)
  Sails at bottom (bow)
  Result: Moving forward along ship's length
```

## Solution

Changed default orientation and renamed dimensions to match ship's actual layout:

1. **Default heading:** `'east'` → `'south'`
   - Ship now faces forward along its length by default

2. **Dimension swap and rename:**
   - Ship uses **local coordinate system** where it faces east at rotation=0
   - Local X-axis = forward direction (bow to stern)
   - Local Y-axis = sideways direction (port to starboard)
   - OLD: `deckWidth: 64, deckHeight: 96` (confusing names)
   - NEW: `deckLength: 128, deckBeam: 48` (nautically correct)
   - Length extends along local X, Beam extends along local Y

3. **Control point positions updated:**
   - OLD wheel: `{x: 0, y: 32}` - arbitrary position
   - NEW wheel: `{x: -54, y: 0}` - at stern in ship-local coordinates
   - OLD sails: `{x: -16, y: 0}` - arbitrary position
   - NEW sails: `{x: 44, y: 0}` - at bow in ship-local coordinates
   - Both centered on ship's beam (y: 0)

## Coordinate System Reference

With `rotation = π/2` (south):
```
Screen coordinates (facing south):
        ↑ negative Y (stern/wheel)
        |
        |
   -----+----- ship center
        |
        |
        ↓ positive Y (bow/sails)
```

Ship dimensions (in ship-local coordinates):
- Length (X): 128 pixels (-64 to +64 from center)
- Beam (Y): 48 pixels (-24 to +24 from center)
- Wheel at: x = -54 (near stern edge)
- Sails at: x = +44 (near bow edge)
- Ratio: 2.67:1 (long, narrow ship)

## Changes Made

**`src/mcp-servers/ship-server/index.ts`:**
```typescript
// Before
initialHeading: (process.env.SHIP_START_HEADING || 'east') as any,
wheelPosition: { x: 0, y: 32 },
sailsPosition: { x: -16, y: 0 },
deckWidth: 64,
deckHeight: 96,

// After
initialHeading: (process.env.SHIP_START_HEADING || 'south') as any,
wheelPosition: { x: -54, y: 0 },  // Stern in ship-local coords
sailsPosition: { x: 44, y: 0 },   // Bow in ship-local coords
deckLength: 128, // Bow to stern (local X)
deckBeam: 48,    // Port to starboard (local Y)
```

**`src/mcp-servers/ship-server/types.ts`:**
```typescript
// Renamed properties
export interface ShipConfig {
  // ...
  deckLength: number; // Ship length (bow to stern) in pixels
  deckBeam: number;   // Ship beam (port to starboard) in pixels
  // ...
}
```

## Impact

- Ship now faces forward along its length by default (south heading)
- Ship dimensions properly reflect long/narrow vessel (128×48 instead of 64×96)
- Wheel positioned at stern, sails at bow (nautically correct)
- Property names use proper nautical terminology (length/beam vs width/height)
- Ship shape matches movement direction
- No breaking changes to protocol or client code
- Environment variable `SHIP_START_HEADING` can still override default

## Testing

1. Start ship with default heading (south)
2. Verify ship moves downward (matches visual orientation)
3. Verify wheel is at top edge (stern)
4. Verify sails are at bottom area (bow)
5. Turn wheel left/right - ship should pivot naturally around center
6. Verify colored corner dots show proper ship rectangle

## Related

- **w3l-wheel-steering:** Wheel-based steering implementation
- **r8s-ship-rotation:** Foundation rotation system
- **Ship dimensions:** 64×96 pixel deck boundary
