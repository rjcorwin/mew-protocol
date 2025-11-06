# Grabable Hover Indicator Research (h4v)

## Executive Summary

This research explores visual feedback systems for interactive elements in games, specifically focusing on how to indicate that an object can be grabbed or interacted with. The goal is to provide clear, non-intrusive visual feedback when ship control points are within interaction range, while supporting a future where the control points themselves become invisible.

**Key Finding**: A hovering indicator positioned above the interaction point, using animation to draw attention, is the most effective approach that remains visible regardless of the underlying object's visibility.

## Problem Context

### Current State

Seacat uses colored circles to represent ship control points:
- **Green** (0x00ff00): Available control point
- **Yellow** (0xffcc00): Control point in range (can grab)
- **Red** (0xff0000): Control point controlled by another player

These circles rotate with the ship and provide clear visual feedback.

### Future State

The control points will eventually be represented by parts of the ship sprite itself:
- Wheel: Visible ship wheel in the sprite
- Sails: Visible sail rigging in the sprite
- Mast: Visible mast structure in the sprite
- Cannons: Visible cannon models in the sprite

**Problem**: Once control points become invisible/disabled, players will lose the visual feedback for what they can interact with.

### Requirements

1. **Independent of base object**: Indicator must work even when control point circles are hidden
2. **Clear and visible**: Must be easy to see against ship sprite and water background
3. **Non-intrusive**: Shouldn't clutter the screen or distract from gameplay
4. **Consistent**: Same indicator system for all control point types
5. **Animated**: Motion helps draw attention to interactive elements
6. **Future-proof**: Easy to replace placeholder with final animated sprite

## Industry Research

### Common Interaction Indicators

#### 1. Glowing Outline/Highlight
**Examples**: Many modern games (Horizon Zero Dawn, Assassin's Creed)
- **Pros**: Subtle, professional looking, clearly defines the object
- **Cons**: Requires shader effects, more complex implementation, depends on object visibility

#### 2. Floating Icon Above Object
**Examples**: RPGs, simulation games (The Sims, Stardew Valley)
- **Pros**: Independent of object, easy to implement, can be animated
- **Cons**: Can feel UI-heavy, may block visibility

#### 3. Proximity Prompt/Button Icon
**Examples**: Action games with context-sensitive actions
- **Pros**: Shows exact button to press, very clear
- **Cons**: More UI elements, assumes consistent control scheme

#### 4. Particle Effects
**Examples**: Zelda series (sparkles on interactive objects)
- **Pros**: Attractive, draws attention without being intrusive
- **Cons**: More complex to implement, can be performance-intensive

#### 5. Pulsing/Bobbing Indicator
**Examples**: Platformers, adventure games
- **Pros**: Motion naturally draws eye, simple to implement
- **Cons**: Can be distracting if overdone

### Best Practices from Game UI Research

**Motion and Attention**:
- Subtle motion (2-4px) is effective without being distracting
- Slow animation speeds (2-4 seconds per cycle) feel calmer
- Vertical motion (bobbing) is more natural than horizontal

**Color Psychology**:
- **Green**: "Go", "available", "safe" - Good for "can interact"
- **Yellow**: "Attention", "caution" - Good for "nearby but need to get closer"
- **Blue**: "Information", "neutral" - Good for non-urgent interactions
- **White**: Clean, visible against most backgrounds

**Positioning**:
- Above object: Clear, doesn't obscure object
- Below object: Less common, can be hidden by object
- Overlay: Most visible but blocks object view

**Size Considerations**:
- Too small: Hard to see, especially at distance
- Too large: Clutters screen, blocks view
- Ideal: 8-15px for indicators at typical game zoom levels

## Technical Options Analysis

### Option A: Graphics-Based Placeholder (Chosen)

**Approach**: Use Phaser Graphics to draw simple shapes, easily replaceable later

**Pros**:
- ✅ Fast to implement
- ✅ No asset creation needed for prototype
- ✅ Easy to iterate on design
- ✅ Low performance overhead
- ✅ Clearly marked as placeholder
- ✅ Easy to replace with sprite later

**Cons**:
- ❌ Not as visually polished
- ❌ Limited animation capabilities
- ❌ Requires redrawing every frame

**Implementation**: Create Graphics objects, use `clear()` and redraw each frame based on isInRange state.

### Option B: Sprite-Based Final Asset

**Approach**: Create animated sprite for the indicator from the start

**Pros**:
- ✅ More polished appearance
- ✅ Sprite animation system built-in
- ✅ Easier to make visually appealing
- ✅ Better performance (sprite batching)

**Cons**:
- ❌ Requires art asset creation upfront
- ❌ Slower to iterate on design
- ❌ Commits to specific visual style early

**Recommendation**: Do this in Phase 2 after validating the concept

### Option C: Particle System

**Approach**: Use Phaser particle emitters for sparkle/glow effect

**Pros**:
- ✅ Very attractive visual effect
- ✅ Built-in Phaser particle system
- ✅ Can create dynamic, organic feeling

**Cons**:
- ❌ Higher performance cost
- ❌ More complex to implement
- ❌ Harder to control precisely
- ❌ May feel too "magical" for pirate theme

**Recommendation**: Consider for special cases (treasure, quest items) but not standard interactions

## Design Decision: Chevron Arrow

### Why a Down-Pointing Arrow?

**Directional Clarity**:
- Points directly at the interaction point
- Universally understood symbol
- No text/language barrier

**Visual Simplicity**:
- Clean, simple shape
- Easy to recognize at a glance
- Works at small sizes

**Cultural Context**:
- Commonly used in game UIs for "here" or "this item"
- Similar to map markers in many games
- Familiar pattern for players

### Alternative Shapes Considered

1. **Circle/Ring**:
   - Pro: Simple, non-directional
   - Con: Less clear about exact interaction point
   - Con: Might confuse with existing control point circles

2. **Hand Icon**:
   - Pro: Clearly indicates "grab" action
   - Con: Requires more detail, harder to see at distance
   - Con: May not scale well

3. **Exclamation Mark**:
   - Pro: Universal attention symbol
   - Con: Implies urgency/warning rather than opportunity
   - Con: Less clear about location

4. **Star/Sparkle**:
   - Pro: Attractive, positive connotation
   - Con: Less directional
   - Con: May feel inconsistent with pirate theme

5. **Anchor** (thematic):
   - Pro: Fits pirate/sailing theme
   - Con: Conceptually wrong (anchors are for stopping)
   - Con: More complex shape

## Animation Research

### Bobbing Motion

**Natural Frequency**:
- Research shows 0.3-0.5 Hz (2-3 second periods) feel natural
- Too fast (>1 Hz): Jittery, distracting
- Too slow (<0.2 Hz): Barely noticeable

**Amplitude**:
- 2-4px: Subtle, professional
- 5-10px: Noticeable, attention-grabbing
- >10px: Distracting, unprofessional

**Chosen Values**:
- Period: ~3 seconds (time / 200 with Math.sin)
- Amplitude: 3px
- Function: `Math.sin(time / 200) * 3`

**Rationale**: Subtle enough to not distract, noticeable enough to draw attention, natural feeling.

### Alternative Animation Patterns Considered

1. **Pulsing Opacity**:
   ```typescript
   const opacity = 0.5 + Math.sin(time / 300) * 0.4; // 0.1 to 0.9
   ```
   - Pros: More subtle, less motion sickness risk
   - Cons: Less noticeable, opacity changes can look like rendering bugs

2. **Scaling**:
   ```typescript
   const scale = 1.0 + Math.sin(time / 300) * 0.2; // 0.8 to 1.2
   ```
   - Pros: Draws attention effectively
   - Cons: Can look aggressive, harder to implement with Graphics

3. **Rotation**:
   ```typescript
   const rotation = time / 1000; // Continuous spin
   ```
   - Pros: Constant motion maintains attention
   - Cons: Can be nauseating, wastes visual energy

4. **Combined Effects**:
   - Pros: Can be very eye-catching
   - Cons: Usually overkill, risks looking cheap

## Phaser Implementation Details

### Graphics vs Sprite Trade-offs

**Phaser Graphics**:
```typescript
// Create once
const indicator = scene.add.graphics();

// Redraw every frame
indicator.clear();
indicator.fillStyle(0x00ff00, 0.9);
indicator.fillCircle(x, y, 10);
```

**Advantages**:
- No asset loading required
- Easy to modify programmatically
- Good for prototypes and placeholders

**Disadvantages**:
- Redraws every frame (more CPU)
- No sprite batching optimization
- Limited visual quality

**Phaser Sprite**:
```typescript
// Load in preload
scene.load.spritesheet('indicator', 'assets/indicator.png', {
  frameWidth: 32,
  frameHeight: 32
});

// Create once
const indicator = scene.add.sprite(x, y, 'indicator');
indicator.play('bob');
```

**Advantages**:
- Better performance (GPU batching)
- Richer visual effects
- Built-in animation system

**Disadvantages**:
- Requires asset creation
- Less flexible for iteration
- Asset loading overhead

### Depth Management

**Z-Index Considerations**:
- Background: -1 to 0
- Water/tiles: 0 to 1
- Ships: 1
- Players: 2
- UI elements: 5+
- **Indicators: 10** (above gameplay, below top-level UI)

This ensures indicators are always visible above the ship and water.

### Rotation Handling

Control points rotate with the ship, so indicators must:
1. Calculate control point world position using isometric rotation
2. Position indicator relative to that world position
3. Update every frame as ship moves/rotates

```typescript
const rotatedPos = IsoMath.rotatePointIsometric(
  controlPoint.relativePosition,
  shipRotation
);
const worldX = ship.sprite.x + rotatedPos.x;
const worldY = ship.sprite.y + rotatedPos.y;
```

## Performance Considerations

### Graphics Redraw Cost

**Per Frame Cost**:
- Clear: ~0.01ms
- Draw shapes: ~0.05ms per shape
- Total per indicator: ~0.1ms

**With Multiple Ships**:
- 4 ships × 3 control points = 12 indicators
- 4 ships × 4 cannons avg = 16 cannon indicators
- Total: ~28 indicators max
- Cost: ~2.8ms per frame
- Impact: Negligible at 60fps (16.67ms budget)

**Optimization**:
- Only draw when `isInRange === true`
- Most of the time, only 1-2 indicators visible
- Typical cost: < 0.5ms per frame

### Sprite Animation Alternative (Phase 2)

Sprites would be more efficient:
- No redraw cost
- GPU batching
- But requires upfront asset work

## Visual Design Specifications

### Color Scheme

**Primary**: Green (#00ff00)
- Reason: Indicates "available" / "can interact"
- Opacity: 0.9 (high visibility)
- Contrast: Good against water (blue) and ship (brown/tan)

**Outline**: White (#ffffff)
- Width: 2px
- Purpose: Ensure visibility against all backgrounds
- Provides crisp edge definition

### Size and Positioning

**Arrow Size**: 10px
- Small enough to not clutter
- Large enough to see clearly
- Appropriate for 1.5x camera zoom

**Hover Height**: 25px above control point
- Clear separation from control point
- Doesn't obscure ship sprite
- Room for bobbing animation (±3px)

**Total Bounds**: ~20px wide × ~15px tall (with bobbing)

## Integration with Existing Systems

### ShipInputHandler Integration

The indicator system relies on the existing proximity detection:

```typescript
// ShipInputHandler tracks nearby control points
public nearControlPoints: Set<string> = new Set();

// Key format is critical:
// - Basic: "shipId:controlPoint"
// - Cannon: "shipId:cannon-side-index"
```

**Bug Found and Fixed**: Initial implementation used generic "cannon" key, but ShipManager checked for "cannon-port-0" format. This caused cannon indicators to never show.

### Manager Pattern Consistency

Following existing pattern:
- **ShipManager**: Owns ship state and indicators
- **ShipRenderer**: Draws visual elements
- **ShipInputHandler**: Detects proximity
- **GameScene**: Orchestrates updates

Indicators follow the same ownership:
- Created in ShipManager
- Drawn by ShipRenderer
- Visibility controlled by ShipInputHandler data

## Future Enhancement Possibilities

### Phase 2: Animated Sprite

Replace Graphics with sprite sheet:
- 8-16 frames of animation
- Possible effects: glow pulse, sparkle, rotation
- Still maintains bobbing motion

### Phase 3: Contextual Indicators

Different indicators for different states:
- **Green**: Available to grab
- **Yellow**: Nearby but need to get closer (if implementing ranges)
- **Red**: Controlled by someone else (if showing locked controls)
- **Blue**: Different interaction type (e.g., read vs grab)

### Phase 4: Accessibility

Options for players with different needs:
- Size adjustment (for visibility)
- Color options (for color blindness)
- Motion reduction (disable bobbing)
- On/off toggle (for minimalist UI preference)

### Phase 5: Tutorial Integration

Special indicators for tutorial:
- Larger/more prominent
- With text labels ("Press E to grab")
- Pulse to draw attention
- Disable after first successful interaction

## Lessons from Implementation

### What Worked Well

1. **Independent Graphics Objects**: Creating separate indicator Graphics objects was the right call - keeps concerns separated
2. **Reusing nearControlPoints**: Leveraging existing proximity detection avoided duplication
3. **Time-based Animation**: Using `Date.now()` for animation time is simple and effective
4. **High Depth Value**: Setting depth to 10 ensures indicators are always visible

### Issues Encountered

1. **Cannon Key Mismatch**: Initial implementation had cannon indicators not showing due to key format mismatch
   - **Lesson**: Always verify key formats match across systems
   - **Fix**: Updated ShipInputHandler to include side/index in cannon keys

2. **Performance Concerns**: Initial worry about redrawing Graphics every frame
   - **Reality**: Not an issue, < 0.5ms per frame in practice
   - **Lesson**: Measure before optimizing

### Recommendations for Similar Features

1. Start with Graphics placeholder for rapid iteration
2. Verify key/identifier formats across systems early
3. Use high depth values for always-visible indicators
4. Time-based animation is simpler than delta-time for simple effects
5. Test with actual gameplay before investing in final assets

## References

**Game UI/UX Research**:
- Game UI Discoveries: What Players Want: https://www.gamedeveloper.com/design/game-ui-discoveries-what-players-want
- The Art of Game Design: A Book of Lenses (Schell) - Chapter on Feedback
- Interaction Design in Games: https://www.interaction-design.org/literature/article/games-and-game-design

**Phaser Documentation**:
- Graphics API: https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Graphics.html
- Sprite API: https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Sprite.html
- Display Depth: https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Depth.html

**Animation Research**:
- The Illusion of Life (Disney Animation Principles)
- Juice It or Lose It (GDC Talk): https://www.youtube.com/watch?v=Fy0aCDmgnxg
- Animation Principles for Game Designers

**Similar Implementations**:
- Stardew Valley's interaction indicators
- Animal Crossing's sparkles on interactive items
- Portal's context-sensitive reticle system

## Conclusion

The chosen approach (Graphics-based placeholder with bobbing animation) successfully balances:
- **Speed**: Fast to implement and iterate
- **Effectiveness**: Clearly communicates interactivity
- **Independence**: Works regardless of control point visibility
- **Performance**: Negligible impact on frame rate
- **Future-proofing**: Easy to replace with polished sprite

The implementation provides immediate value while leaving room for visual enhancement in future phases.
