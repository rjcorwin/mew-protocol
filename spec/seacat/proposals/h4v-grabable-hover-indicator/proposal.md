# Proposal h4v: Grabable Hover Indicator

**Status**: Implemented (Retroactive Documentation)
**Created**: 2025-11-06
**Area**: Seacat Game Client
**Implemented**: Yes (commits 177b484, 20946c4)

## Summary

Add a visual hover indicator that appears above ship control points when they are within grabbing range. This indicator is independent of the control point visualization itself, allowing control points to eventually become invisible (represented by ship sprite parts) while still providing clear visual feedback for interaction.

## Motivation

**Current Problem**:
- Ship control points (wheel, sails, mast, cannons) are currently represented by colored circles
- These circles will eventually be made invisible as they'll be represented by parts of the ship sprite
- Without the control point circles, players would have no visual indication of what they can interact with

**User Experience Need**:
- Players need clear visual feedback when they're in range to grab a control point
- The indicator should be distinct from the ship itself so it works even when control points are invisible
- The indicator should feel responsive and draw attention without being distracting

## Goals

### Primary Goals
1. Provide clear visual indicator when player is within grabbing range of a control point
2. Make indicator independent of control point visualization (won't disappear when control points become invisible)
3. Position indicator above the control point to avoid visual clutter
4. Work consistently for all control point types (wheel, sails, mast, cannons)

### Secondary Goals
5. Add subtle animation for visual appeal and to draw attention
6. Use placeholder graphic that can be easily replaced with animated sprite later

## Non-Goals

- Changing the existing control point visualization (colored circles)
- Adding interaction hints or tutorial text
- Supporting different indicator styles for different control point types
- Implementing the final animated sprite (this is a placeholder)

## Technical Approach

### Visual Design

**Indicator Appearance**:
- Simple down-pointing arrow/chevron shape
- Green color (0x00ff00) with high opacity (0.9) for visibility
- White outline (2px) for contrast against various backgrounds
- Positioned 25 pixels above the control point
- Size: 10px arrow pointing toward control point

**Animation**:
- Subtle vertical bobbing: 3px amplitude
- Period: ~3 seconds (using `Math.sin(time / 200)`)
- Creates gentle floating effect to draw attention

### Implementation Architecture

**Type Changes** (`clients/seacat/src/types.ts`):
```typescript
interface Ship {
  controlPoints: {
    wheel: {
      sprite: Phaser.GameObjects.Graphics;
      indicator: Phaser.GameObjects.Graphics; // New: Hover indicator
      relativePosition: { x: number; y: number };
      controlledBy: string | null;
    };
    // Similar for sails, mast
  };
  cannons?: {
    port: Array<{
      sprite: Phaser.GameObjects.Graphics;
      indicator: Phaser.GameObjects.Graphics; // New: Hover indicator
      // ... other fields
    }>;
    // Similar for starboard
  };
}
```

**Renderer Method** (`clients/seacat/src/game/rendering/ShipRenderer.ts`):
```typescript
drawGrabableIndicator(
  graphics: Phaser.GameObjects.Graphics,
  controlPoint: { relativePosition: { x: number; y: number } },
  shipSprite: Phaser.GameObjects.Sprite,
  shipRotation: number,
  isInRange: boolean,
  time?: number
): void {
  // Clear previous frame
  graphics.clear();

  // Only draw if player is in range
  if (!isInRange) return;

  // Calculate world position with ship rotation
  const rotatedPos = IsoMath.rotatePointIsometric(
    controlPoint.relativePosition,
    shipRotation
  );
  const worldX = shipSprite.x + rotatedPos.x;
  const worldY = shipSprite.y + rotatedPos.y;

  // Position above control point with bobbing
  const HOVER_HEIGHT = 25;
  const bobOffset = time ? Math.sin(time / 200) * 3 : 0;
  const indicatorY = worldY - HOVER_HEIGHT + bobOffset;

  // Draw down-pointing chevron
  // (implementation details...)
}
```

**Manager Integration** (`clients/seacat/src/game/managers/ShipManager.ts`):
- Create indicator Graphics objects when ships are spawned
- Set depth to 10 (above other elements) for visibility
- Call `drawGrabableIndicator()` in both update loops:
  - `updateShip()` - when receiving network updates
  - `interpolateShips()` - every frame during interpolation

### Interaction with Existing Systems

**nearControlPoints Tracking**:
The system uses the existing `nearControlPoints` Set from `ShipInputHandler`:
- Format for basic controls: `"${shipId}:${controlPoint}"` (e.g., "ship1:wheel")
- Format for cannons: `"${shipId}:cannon-${side}-${index}"` (e.g., "ship1:cannon-port-0")

**Note**: A bug was fixed where cannons were being tracked with the generic "cannon" key instead of the detailed key, preventing cannon indicators from showing. This was fixed in commit 20946c4.

## Implementation Phases

### Phase 1: Core Implementation ✅ (Completed)
**Goal**: Basic hover indicator working for all control points

**Tasks Completed**:
1. ✅ Added `indicator` field to Ship type for all control points
2. ✅ Created `drawGrabableIndicator()` method in ShipRenderer
3. ✅ Created indicator Graphics objects in ShipManager
4. ✅ Integrated indicator drawing in update loops
5. ✅ Fixed cannon key format mismatch bug
6. ✅ Tested with all control point types

**Success Criteria Met**:
- ✅ Indicator appears when player approaches any control point
- ✅ Indicator disappears when player moves away
- ✅ Indicator moves correctly with ship rotation and position
- ✅ Bobbing animation is smooth and subtle
- ✅ Works for wheel, sails, mast, and all cannons

### Phase 2: Visual Polish (Future)
**Goal**: Replace placeholder with animated sprite

**Planned Tasks**:
1. Design/commission animated indicator sprite
2. Create sprite sheet with animation frames
3. Load sprite asset in scene preload
4. Replace Graphics indicator with Sprite
5. Configure animation (loop, speed, etc.)
6. Adjust positioning if needed

**Acceptance Criteria**:
- Animated sprite looks polished and professional
- Animation draws attention without being distracting
- Performance remains good with multiple indicators
- Easy to see against all backgrounds

## Testing

### Manual Testing Completed

**Scenarios Tested**:
- ✅ Approach wheel, sails, and mast - indicators appear correctly
- ✅ Approach cannons on both port and starboard sides - indicators appear
- ✅ Move away from control points - indicators disappear
- ✅ Ship rotation - indicators maintain correct position relative to control points
- ✅ Ship movement - indicators move with ship smoothly
- ✅ Multiple ships - indicators work independently for each ship
- ✅ Controlling a control point - indicator behaves correctly

**Visual Verification**:
- ✅ Indicator is clearly visible above control points
- ✅ Bobbing animation is smooth
- ✅ Green color provides good contrast
- ✅ Doesn't interfere with other UI elements

## Implementation Details

### Files Modified

1. **clients/seacat/src/types.ts**
   - Added `indicator: Phaser.GameObjects.Graphics` to all control point definitions
   - Both main control points (wheel, sails, mast) and cannons

2. **clients/seacat/src/game/rendering/ShipRenderer.ts**
   - Added `drawGrabableIndicator()` method (~60 lines)
   - Handles world position calculation, bobbing animation, and drawing

3. **clients/seacat/src/game/managers/ShipManager.ts**
   - Creates indicator graphics in ship creation (lines 154-159)
   - Creates indicator graphics for cannons (in cannon map functions)
   - Calls drawGrabableIndicator() in updateShip() (lines 380-382, 394, 404)
   - Calls drawGrabableIndicator() in interpolateShips() (lines 488-490, 502, 512)

4. **clients/seacat/src/game/input/ShipInputHandler.ts**
   - Fixed cannon key format to include side and index (lines 451-454)

### Commits

- **177b484**: Initial implementation of hover indicators
- **20946c4**: Fix cannon indicators by matching key format

## Future Enhancements

### Animated Sprite (Phase 2)
Replace the current placeholder arrow with a proper animated sprite:
- Could be a glowing ring, sparkles, or other attention-grabbing effect
- Should match the game's aesthetic (cozy pirate theme)
- Consider different indicators for different control types (optional)

### Accessibility Options
- Toggle indicators on/off in settings
- Adjust indicator size for visibility
- Alternative indicator styles (for colorblind players)

### Context-Specific Indicators
- Show different indicators for locked/unavailable controls
- Indicate what action will happen (e.g., "grab" vs "release")
- Tutorial-specific indicators for first-time players

## Success Metrics

- ✅ Players can easily identify interactable control points
- ✅ No confusion about when interaction is possible
- ✅ Indicator doesn't cause visual clutter or distraction
- ✅ System is ready for control points to become invisible
- ✅ No performance impact from additional graphics objects

## Open Questions

1. **Final Sprite Design**: What should the animated indicator look like?
   - **Recommendation**: Defer to art direction; placeholder is functional

2. **Per-Control Differentiation**: Should different control types have different indicators?
   - **Recommendation**: Start with uniform design; add variation if user testing shows confusion

3. **Color Coding**: Should indicator color change based on control state?
   - **Current**: Always green when in range
   - **Alternative**: Could show different colors for different states (e.g., yellow for "can grab", red for "controlled by other")

4. **Size and Visibility**: Is the current size appropriate for all screen sizes?
   - **Current**: 10px arrow, 25px above control point
   - **May need**: Testing on different resolutions/displays

## Resources

- **Development Time**: ~2 hours (completed)
- **Testing Time**: ~30 minutes (completed)
- **Future Art Asset**: TBD (when replacing placeholder)

## References

- Related work: Control point visualization system (existing)
- Related work: ShipInputHandler proximity detection (existing)
- Pattern: Phaser Graphics for placeholder UI elements
- Pattern: Manager pattern for rendering concerns

## Appendix: Code Examples

### Drawing the Indicator

```typescript
// In ShipRenderer.drawGrabableIndicator()
const bobOffset = time ? Math.sin(time / 200) * 3 : 0;
const arrowY = indicatorY + bobOffset;

graphics.fillStyle(0x00ff00, 0.9);  // Bright green
graphics.lineStyle(2, 0xffffff, 1); // White outline

graphics.beginPath();
graphics.moveTo(worldX, arrowY + arrowSize);         // Bottom point
graphics.lineTo(worldX - arrowSize, arrowY);         // Top left
graphics.lineTo(worldX, arrowY + arrowSize / 2);     // Middle notch
graphics.lineTo(worldX + arrowSize, arrowY);         // Top right
graphics.lineTo(worldX, arrowY + arrowSize);         // Back to bottom
graphics.closePath();
graphics.fillPath();
graphics.strokePath();
```

### Usage in Manager

```typescript
// In ShipManager.interpolateShips()
const currentTime = Date.now();

this.shipRenderer.drawGrabableIndicator(
  ship.controlPoints.wheel.indicator,
  ship.controlPoints.wheel,
  ship.sprite,
  ship.rotation,
  this.nearControlPoints.has(`${ship.id}:wheel`),
  currentTime
);
```

### Key Format for Cannons

```typescript
// In ShipInputHandler.checkShipInteractions()
if (nearestControlPoint.controlPoint === 'cannon' &&
    nearestControlPoint.cannonSide !== undefined &&
    nearestControlPoint.cannonIndex !== undefined) {
  // Include side and index in key for proper tracking
  this.nearControlPoints.add(
    `${nearestControlPoint.shipId}:cannon-${nearestControlPoint.cannonSide}-${nearestControlPoint.cannonIndex}`
  );
}
```
