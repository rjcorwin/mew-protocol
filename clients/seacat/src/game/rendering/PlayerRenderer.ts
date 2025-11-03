import Phaser from 'phaser';
import { Direction } from '../../types.js';

/**
 * Manages player sprite animations and directional rendering for the isometric game.
 *
 * This renderer handles creating and updating player animations based on 8-directional
 * movement. It converts velocity vectors into appropriate facing directions and plays
 * the corresponding sprite animations.
 *
 * Responsibilities:
 * - Create 8-directional walk animations from sprite sheets
 * - Update sprite animation based on current movement velocity
 * - Calculate facing direction from velocity vectors
 * - Map angles to cardinal and diagonal directions
 *
 * Dependencies:
 * - Phaser animation system
 * - Player sprite sheet with 8 directional animations
 *
 * @example
 * ```typescript
 * const playerRenderer = new PlayerRenderer(scene);
 *
 * // In scene.create():
 * playerRenderer.createPlayerAnimations();
 *
 * // In game loop:
 * const velocity = new Phaser.Math.Vector2(vx, vy);
 * const facing = playerRenderer.updatePlayerAnimation(playerSprite, velocity);
 * ```
 */
export class PlayerRenderer {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Create 8 directional walk animations for player sprite
   */
  createPlayerAnimations(): void {
    // Create 8 directional walk animations
    // Sprite sheet layout: 8 rows (directions) × 4 columns (frames)
    const directions = [
      'south',     // Row 0: Walking down
      'southwest', // Row 1
      'west',      // Row 2: Walking left
      'northwest', // Row 3
      'north',     // Row 4: Walking up
      'northeast', // Row 5
      'east',      // Row 6: Walking right
      'southeast', // Row 7
    ];

    directions.forEach((dir, row) => {
      this.scene.anims.create({
        key: `walk-${dir}`,
        frames: this.scene.anims.generateFrameNumbers('player', {
          start: row * 4,
          end: row * 4 + 3,
        }),
        frameRate: 10,
        repeat: -1, // Loop indefinitely
      });
    });

    console.log('Created 8 directional walk animations');
  }

  /**
   * Update player animation based on velocity
   * @param sprite Player sprite to update
   * @param velocity Current movement velocity
   * @returns The calculated direction
   */
  updatePlayerAnimation(sprite: Phaser.GameObjects.Sprite, velocity: Phaser.Math.Vector2): Direction {
    // Calculate direction from velocity
    const direction = this.calculateDirection(velocity);

    // Play corresponding walk animation (true = ignore if already playing)
    sprite.play(`walk-${direction}`, true);

    return direction;
  }

  /**
   * Calculate facing direction from velocity vector
   * @param velocity Movement velocity
   * @returns One of 8 cardinal/diagonal directions
   */
  calculateDirection(velocity: Phaser.Math.Vector2): Direction {
    // Calculate angle from velocity vector
    const angle = Math.atan2(velocity.y, velocity.x);

    // Quantize to nearest 45° increment (8 directions)
    // Add 8 and mod 8 to handle negative angles
    const directionIndex = (Math.round(angle / (Math.PI / 4)) + 8) % 8;

    // Map angle to direction name
    const directions: Direction[] = [
      'east',      // 0° (right)
      'southeast', // 45°
      'south',     // 90° (down)
      'southwest', // 135°
      'west',      // 180° (left)
      'northwest', // 225°
      'north',     // 270° (up)
      'northeast', // 315°
    ];

    return directions[directionIndex];
  }
}
