# Decision: Shimmer Particle System (s8m)

**Status:** Accepted ✅
**Date:** 2025-01-08
**Deciders:** Development team
**Related:** d7v-diamond-viewport

## Context and Problem Statement

The seacat background image previously contained static white dots representing underwater light shimmer. These dots were removed from the image asset, requiring a programmatic solution to restore the shimmer effect with improved animation capabilities.

How should we implement animated underwater shimmer particles that:
- Animate smoothly and naturally
- Respect the horizon boundary
- Perform efficiently
- Are easily configurable

## Decision Drivers

- **Visual Quality**: Need smooth, organic-looking animation
- **Performance**: Must not impact frame rate
- **Maintainability**: Should be easy to configure and adjust
- **Realism**: Should only appear in water area, not sky
- **Responsiveness**: Must handle window resizing

## Considered Options

### Option 1: Phaser Graphics-based Particles (SELECTED)
Create individual particles using Phaser.GameObjects.Graphics, redraw each frame with updated alpha.

**Pros:**
- Simple implementation
- Direct control over rendering
- Minimal memory overhead
- Easy to debug and adjust
- Perfect for static-positioned particles

**Cons:**
- Redrawing each frame (mitigated by small particle count)
- Less reusable for other particle effects

### Option 2: Phaser Particle Emitter System
Use Phaser's built-in particle emitter with stationary particles.

**Pros:**
- Built-in animation support
- Potentially more performant
- Designed for particle effects

**Cons:**
- Overkill for simple twinkling dots
- More complex configuration
- Harder to control individual particle timing
- Designed for moving particles, not stationary ones

### Option 3: Sprite-based Particles
Create sprite objects for each particle using texture atlas.

**Pros:**
- Hardware-accelerated rendering
- Could reuse sprites for other effects

**Cons:**
- Higher memory usage (texture for each particle)
- Unnecessary for simple white dots
- More setup complexity

### Option 4: Custom WebGL Shader
Implement shimmer as custom fragment shader.

**Pros:**
- Maximum performance
- GPU-accelerated
- Could enable advanced effects

**Cons:**
- Over-engineered for simple effect
- Harder to debug and maintain
- More difficult to configure
- Requires WebGL expertise

## Decision Outcome

**Chosen Option: Option 1 - Phaser Graphics-based Particles**

### Rationale

The Graphics-based approach provides the optimal balance of:
1. **Simplicity**: Straightforward implementation, easy to understand
2. **Control**: Direct control over each particle's animation
3. **Performance**: Sufficient for 200 small particles at 60 FPS
4. **Configurability**: Easy to adjust parameters without code changes
5. **Maintainability**: Clear, debuggable code

For this specific use case (200 stationary particles with simple fade animation), the Graphics API is perfectly suited and avoids unnecessary complexity.

### Implementation Details

**Core Decisions:**
- **Particle Count**: 200 particles (balance between visual density and performance)
- **Animation Method**: Time-based sine wave (smooth, consistent across frame rates)
- **Speed Range**: 0.00015 - 0.0006 (30% of initial speeds for subtle effect)
- **Size Range**: 1-3 pixels (varied for visual interest)
- **Alpha Range**: 0.2 - 0.9 (never fully opaque for subtle shimmer)
- **Horizon Constraint**: Y >= 190px (water area only)
- **Render Depth**: -900 (behind game objects, in front of background)

**Performance Considerations:**
- Container uses `setScrollFactor(0)` to avoid world transform calculations
- Particles are simple circles (fast to draw)
- Only 200 particles total (well within Graphics performance capabilities)
- Time-based animation prevents frame-rate dependency

### Consequences

**Positive:**
- Clean separation of concerns (dedicated ShimmerRenderer)
- Easy to adjust visual parameters
- Smooth animation regardless of frame rate
- Respects horizon boundary for realism
- Handles window resize gracefully

**Negative:**
- Redrawing particles each frame (acceptable overhead for 200 particles)
- Graphics-specific implementation (not reusable for other particle types)

**Neutral:**
- Future particle effects may warrant different approaches
- Could be refactored to shader if performance becomes an issue (unlikely)

## Validation

Testing confirms:
- ✅ Smooth animation at 60 FPS with 200 particles
- ✅ Particles stay below horizon line
- ✅ Configurable parameters work as expected
- ✅ Window resize repositions particles correctly
- ✅ No noticeable performance impact

## Notes

The 30% speed reduction (from initial speeds) was a user-requested adjustment to create a more subtle, realistic underwater shimmer effect. This demonstrates the benefit of the configurable approach - easy to fine-tune based on feedback.

The horizon constraint (190px) matches the background image design where the sky occupies the top 190 pixels, ensuring shimmer only appears in the water area.
