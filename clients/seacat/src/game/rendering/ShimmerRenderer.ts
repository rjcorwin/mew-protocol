/**
 * ShimmerRenderer - Animated Shimmer Particles
 *
 * Renders animated white sparkle particles across the water to create
 * a shimmering underwater light effect. Particles twinkle with random
 * timing to create dynamic, organic movement.
 *
 * @module ShimmerRenderer
 */

import Phaser from 'phaser';

interface ShimmerParticle {
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  size: number;
  phase: number; // Animation phase (0-1)
  speed: number; // How fast it twinkles
  maxAlpha: number; // Maximum alpha value
}

/**
 * Renders animated shimmer particles for underwater light effects
 */
export class ShimmerRenderer {
  private scene: Phaser.Scene;
  private particles: ShimmerParticle[] = [];
  private particleContainer?: Phaser.GameObjects.Container;

  // Configuration
  private readonly PARTICLE_COUNT = 200; // Number of shimmer particles
  private readonly MIN_SIZE = 1;
  private readonly MAX_SIZE = 3;
  private readonly MIN_SPEED = 0.00015; // Slower twinkle (30% of original speed)
  private readonly MAX_SPEED = 0.0006; // Faster twinkle (30% of original speed)
  private readonly MIN_ALPHA = 0.2;
  private readonly MAX_ALPHA = 0.9;
  private readonly HORIZON_Y = 190; // Sky height - shimmer only appears below this line

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initializes the shimmer renderer
   * Call this once in GameScene.create()
   */
  public initialize(): void {
    // Create container for all particles
    this.particleContainer = this.scene.add.container(0, 0);
    this.particleContainer.setDepth(-900); // Behind most things but in front of background (-1000)
    this.particleContainer.setScrollFactor(0); // Fixed to camera (doesn't scroll)

    // Generate shimmer particles
    this.createShimmerParticles();
  }

  /**
   * Creates shimmer particles distributed across the viewport
   * Only generates particles in water area (below horizon)
   */
  private createShimmerParticles(): void {
    const windowWidth = this.scene.scale.width;
    const windowHeight = this.scene.scale.height;

    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      // Random position only in water area (below horizon)
      const x = Math.random() * windowWidth;
      const y = this.HORIZON_Y + Math.random() * (windowHeight - this.HORIZON_Y);

      // Random size
      const size = this.MIN_SIZE + Math.random() * (this.MAX_SIZE - this.MIN_SIZE);

      // Random animation properties
      const phase = Math.random(); // Start at random point in animation
      const speed = this.MIN_SPEED + Math.random() * (this.MAX_SPEED - this.MIN_SPEED);
      const maxAlpha = this.MIN_ALPHA + Math.random() * (this.MAX_ALPHA - this.MIN_ALPHA);

      // Create graphics for this particle
      const graphics = this.scene.add.graphics();
      this.particleContainer?.add(graphics);

      const particle: ShimmerParticle = {
        graphics,
        x,
        y,
        size,
        phase,
        speed,
        maxAlpha,
      };

      this.particles.push(particle);
      this.drawParticle(particle, 0); // Initial draw
    }

    console.log(`✓ Created ${this.PARTICLE_COUNT} shimmer particles`);
  }

  /**
   * Draws a single shimmer particle at current alpha
   */
  private drawParticle(particle: ShimmerParticle, alpha: number): void {
    particle.graphics.clear();

    // Draw white sparkle
    particle.graphics.fillStyle(0xffffff, alpha);
    particle.graphics.fillCircle(particle.x, particle.y, particle.size);

    // Optional: Add a subtle glow effect for larger particles
    if (particle.size > 2) {
      particle.graphics.fillStyle(0xffffff, alpha * 0.3);
      particle.graphics.fillCircle(particle.x, particle.y, particle.size * 1.5);
    }
  }

  /**
   * Updates shimmer particle animations
   * Call this every frame in GameScene.update()
   *
   * @param time - Total elapsed time (milliseconds)
   */
  public update(time: number): void {
    // Animate each particle
    for (const particle of this.particles) {
      // Calculate phase based on time and speed for consistent animation across frame rates
      // Add particle.phase offset for staggered start times
      const timePhase = ((time * particle.speed) + particle.phase) % 1;

      // Calculate alpha using sine wave for smooth twinkle
      // Sin wave goes from -1 to 1, we map it to 0 to maxAlpha
      const sineValue = Math.sin(timePhase * Math.PI * 2);
      const normalizedValue = (sineValue + 1) / 2; // Map to 0-1
      const alpha = normalizedValue * particle.maxAlpha;

      // Redraw particle with new alpha
      this.drawParticle(particle, alpha);
    }
  }

  /**
   * Updates shimmer particles on window resize
   * Call when window dimensions change
   */
  public updateOnResize(): void {
    const windowWidth = this.scene.scale.width;
    const windowHeight = this.scene.scale.height;

    // Redistribute particles across new window size (only in water area)
    for (const particle of this.particles) {
      particle.x = Math.random() * windowWidth;
      particle.y = this.HORIZON_Y + Math.random() * (windowHeight - this.HORIZON_Y);
      this.drawParticle(particle, particle.maxAlpha * Math.random());
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    for (const particle of this.particles) {
      particle.graphics.destroy();
    }
    this.particles = [];
    this.particleContainer?.destroy();
  }
}
