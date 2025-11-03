import Phaser from 'phaser';

/**
 * Manages visual effects rendering for combat, impacts, and UI overlays.
 *
 * This renderer creates and animates all particle effects and temporary visual feedback
 * in the game, including weapon fire, water splashes, impact effects, and health displays.
 * All effects are temporary and self-cleaning using Phaser tweens.
 *
 * Responsibilities:
 * - Cannon blast VFX with flash and expanding smoke puffs
 * - Water splash particle effects on projectile impact
 * - Ship hit effects with wood splinters and smoke bursts
 * - Dynamic health bars above ships with color-coded health status
 *
 * Dependencies:
 * - Phaser tweens system for animation
 * - Phaser graphics primitives (circles, rectangles)
 *
 * @example
 * ```typescript
 * const effectsRenderer = new EffectsRenderer(scene);
 *
 * // Create cannon fire effect
 * effectsRenderer.createCannonBlast(cannonX, cannonY);
 *
 * // Show water splash on projectile impact
 * effectsRenderer.createWaterSplash(impactX, impactY);
 *
 * // Display ship health bar
 * effectsRenderer.drawHealthBar(shipX, shipY - 50, currentHealth, maxHealth);
 * ```
 */
export class EffectsRenderer {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Create cannon blast effect when cannon fires (c5x-ship-combat Phase 2c)
   */
  createCannonBlast(x: number, y: number): void {
    // Orange flash
    const flash = this.scene.add.circle(x, y, 15, 0xFFAA00, 0.9);
    flash.setDepth(100);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy()
    });

    // Smoke puffs expanding outward
    const smokeCount = 5;
    for (let i = 0; i < smokeCount; i++) {
      const angle = (Math.PI * 2 / smokeCount) * i;
      const smoke = this.scene.add.circle(
        x + Math.cos(angle) * 10,
        y + Math.sin(angle) * 10,
        6,
        0x666666,
        0.6
      );
      smoke.setDepth(100);

      this.scene.tweens.add({
        targets: smoke,
        x: smoke.x + Math.cos(angle) * 20,
        y: smoke.y + Math.sin(angle) * 20,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => smoke.destroy()
      });
    }
  }

  /**
   * Create water splash effect when cannonball hits water (c5x-ship-combat Phase 2c)
   */
  createWaterSplash(x: number, y: number): void {
    // Create blue particle fountain effect
    const particleCount = 8;
    const splashRadius = 20;
    const splashDuration = 800; // ms

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i;
      const distance = Math.random() * splashRadius;

      const particle = this.scene.add.circle(
        x + Math.cos(angle) * 5,
        y + Math.sin(angle) * 5,
        3 + Math.random() * 2, // Random size 3-5px
        0x4488ff, // Blue water color
        0.7
      );
      particle.setDepth(100); // Same as projectiles

      // Animate particle outward and fade
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 10, // Slight upward arc
        alpha: 0,
        scale: 1.5,
        duration: splashDuration,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy()
      });
    }

    // Add a central splash circle that expands
    const splashCircle = this.scene.add.circle(x, y, 5, 0x6699ff, 0.5);
    splashCircle.setDepth(100);

    this.scene.tweens.add({
      targets: splashCircle,
      scale: 3,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => splashCircle.destroy()
    });
  }

  /**
   * Draw health bar above ship (Phase 3)
   */
  drawHealthBar(x: number, y: number, health: number, maxHealth: number): void {
    const width = 100;
    const height = 8;
    const healthPercent = health / maxHealth;

    // Background (dark gray)
    const bg = this.scene.add.rectangle(x, y, width, height, 0x333333, 0.8);
    bg.setDepth(200);

    // Health fill (color based on health)
    let color: number;
    if (healthPercent > 0.5) color = 0x00ff00; // Green
    else if (healthPercent > 0.2) color = 0xffff00; // Yellow
    else color = 0xff0000; // Red

    const fill = this.scene.add.rectangle(
      x - (width / 2) + (width * healthPercent / 2),
      y,
      width * healthPercent,
      height,
      color,
      0.9
    );
    fill.setDepth(201);

    // Destroy after this frame (will be redrawn next frame)
    this.scene.time.delayedCall(0, () => {
      bg.destroy();
      fill.destroy();
    });
  }

  /**
   * Create hit effect when cannonball hits ship (Phase 3)
   */
  createHitEffect(x: number, y: number): void {
    // Phase 5: Enhanced wood splinters (brown particles, radial burst) (c5x-ship-combat)
    // Increased from 20 to 30 particles with rotation animation
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      const particle = this.scene.add.circle(x, y, 2 + Math.random() * 3, 0x8B4513, 0.8);
      particle.setDepth(100);

      // Phase 5: Add rotation speed for spinning particles
      const rotationSpeed = (Math.random() - 0.5) * 0.2;

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        angle: rotationSpeed * 360, // Rotate while flying
        duration: 800,
        onComplete: () => particle.destroy()
      });
    }

    // Smoke burst (gray particles)
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const particle = this.scene.add.circle(x, y, 4, 0x666666, 0.6);
      particle.setDepth(100);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        alpha: 0,
        scale: 2,
        duration: 1000,
        onComplete: () => particle.destroy()
      });
    }
  }
}
