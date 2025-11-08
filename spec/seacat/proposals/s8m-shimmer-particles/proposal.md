# s8m-shimmer-particles

**Status:** Implemented ✅
**Created:** 2025-01-08
**Implemented:** 2025-01-08
**Related:** d7v-diamond-viewport (background rendering)

## Problem

The background image previously contained static white dots representing underwater shimmer/sparkle effects. These dots were removed from the image to enable programmatic animation and better control over the visual effect. However, without them, the underwater area lacks the dynamic light shimmer that enhances the ocean atmosphere.

Static shimmer dots have several limitations:
1. **No animation**: Cannot twinkle or fade to create realistic light effects
2. **Fixed density**: Cannot be adjusted without editing the image asset
3. **Performance**: Image must be reloaded to change shimmer characteristics
4. **Inflexible positioning**: Shimmer appears in sky area where it doesn't belong

## Proposed Solution

Implement a **programmatic shimmer particle system** that generates and animates white sparkle particles across the water area to create dynamic underwater light effects.

### Key Features

#### 1. Particle Generation
- Generate configurable number of particles (default: 200)
- Random positions distributed across viewport width
- Constrained to water area only (below 190px horizon line)
- Random size variation (1-3 pixels) for visual diversity
- Each particle has independent animation parameters

#### 2. Smooth Animation
- Time-based sine wave animation for consistent frame-rate-independent twinkling
- Randomized animation speed per particle (0.00015 - 0.0006)
- Staggered start phases to avoid synchronized twinkling
- Alpha fade from 0 to random maximum (0.2 - 0.9) for varied intensity
- Larger particles (>2px) include subtle glow effect

#### 3. Horizon Boundary
- Shimmer particles only appear below horizon line (y >= 190px)
- Sky area (top 190px) remains clear
- Creates realistic underwater light effect confined to water

#### 4. Render Integration
- Depth: -900 (behind game objects but in front of background at -1000)
- Fixed to camera (doesn't scroll with world)
- Updates every frame for smooth animation
- Repositions on window resize

### Configuration Parameters

```typescript
PARTICLE_COUNT: 200           // Number of shimmer particles
MIN_SIZE: 1                   // Minimum particle size (pixels)
MAX_SIZE: 3                   // Maximum particle size (pixels)
MIN_SPEED: 0.00015           // Minimum twinkle speed (30% of original)
MAX_SPEED: 0.0006            // Maximum twinkle speed (30% of original)
MIN_ALPHA: 0.2               // Minimum opacity
MAX_ALPHA: 0.9               // Maximum opacity
HORIZON_Y: 190               // Sky height in pixels
```

### Implementation Architecture

#### ShimmerRenderer Class
New renderer module: `src/game/rendering/ShimmerRenderer.ts`

**Methods:**
- `initialize()` - Creates particle container and generates initial particles
- `update(time)` - Animates all particles based on elapsed time
- `updateOnResize()` - Repositions particles when window resizes
- `destroy()` - Cleanup on scene destruction

**Integration:**
- Initialized in `GameScene.create()` after ViewportRenderer
- Updated every frame in `GameScene.update()`
- Responds to window resize events

#### Particle Data Structure
```typescript
interface ShimmerParticle {
  graphics: Phaser.GameObjects.Graphics  // Render graphics
  x: number                              // Screen X position
  y: number                              // Screen Y position (>= 190)
  size: number                           // Particle radius
  phase: number                          // Animation start offset (0-1)
  speed: number                          // Twinkle speed multiplier
  maxAlpha: number                       // Maximum opacity for this particle
}
```

## Benefits

1. **Dynamic Animation**: Particles twinkle and fade for realistic light shimmer
2. **Configurable**: Easy to adjust density, speed, and intensity without editing assets
3. **Performance**: Efficient rendering using Phaser Graphics API
4. **Boundary Aware**: Respects horizon line for realistic ocean effect
5. **Responsive**: Automatically adjusts to window size changes
6. **Organic Movement**: Randomized parameters create natural, non-repetitive patterns

## Technical Details

### Animation Formula
```typescript
// Time-based sine wave with phase offset
const timePhase = ((time * particle.speed) + particle.phase) % 1;
const sineValue = Math.sin(timePhase * Math.PI * 2);
const alpha = ((sineValue + 1) / 2) * particle.maxAlpha;
```

This ensures:
- Smooth transitions (sine wave)
- Frame-rate independence (time-based)
- Staggered timing (phase offset)
- Varied intensity (maxAlpha multiplier)

### Rendering Approach
- Uses Phaser Graphics for efficient particle drawing
- Particles are redrawn each frame with new alpha
- Container fixed to camera (setScrollFactor(0))
- White color (0xFFFFFF) for pure light effect
- Optional glow for larger particles (size > 2)

## Alternative Approaches Considered

1. **Phaser Particle Emitter**: More complex setup, overkill for static positioned particles
2. **Sprite-based particles**: Higher memory overhead, unnecessary for simple dots
3. **Shader-based**: More performant but harder to configure and debug
4. **WebGL particles**: Over-engineered for the simple effect needed

**Decision**: Graphics-based approach provides optimal balance of simplicity, performance, and configurability.

## Future Enhancements

Potential improvements for future consideration:
- Depth-based intensity variation (brighter near surface)
- Color tinting for different water conditions
- Interactive response to player movement
- Dynamic particle count based on performance metrics
- Integration with weather/time-of-day systems

## Files Changed

- `src/game/rendering/ShimmerRenderer.ts` (new)
- `src/game/GameScene.ts` (integration)
- `assets/backgrounds/background.png` (shimmer dots removed)

## Visual Effect

The shimmer creates a subtle, organic underwater atmosphere by:
- Twinkling at varied speeds throughout the water area
- Fading smoothly between invisible and visible states
- Varying in size and intensity for depth perception
- Remaining fixed to viewport for consistent framing
- Respecting the horizon boundary for realism
