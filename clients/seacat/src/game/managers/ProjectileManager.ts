import Phaser from 'phaser';
import { Projectile, Ship } from '../../types.js';
import { CollisionManager } from './CollisionManager.js';
import { EffectsRenderer } from '../rendering/EffectsRenderer.js';
import { ShipCommands } from '../network/ShipCommands.js';
import { TILE_VISUAL_HEIGHT } from '../utils/Constants.js';
import { Howl } from 'howler';
import { ViewportManager } from '../utils/ViewportManager.js';

/**
 * Manages projectile lifecycle, physics simulation, and collision detection for ship combat.
 *
 * This manager handles all cannonball projectiles in the game, including spawning from
 * cannon fire events, simulating realistic ballistic physics with gravity, detecting
 * collisions with ships and water, creating impact effects, and playing audio feedback.
 *
 * Responsibilities:
 * - Spawn projectiles from cannon fire with initial position and velocity
 * - Simulate projectile physics with gravity and velocity updates
 * - Detect collisions with ships using distance checks
 * - Detect water impacts and despawn projectiles
 * - Render visual trails behind flying projectiles
 * - Play sound effects for firing, impacts, and splashes
 * - Handle hit claims and notify server of successful hits
 * - Camera shake effects when local player fires
 *
 * Dependencies:
 * - CollisionManager for ship hit detection
 * - EffectsRenderer for blast, impact, and splash effects
 * - ShipCommands for sending hit claims to server
 * - Howler for sound effects
 *
 * @example
 * ```typescript
 * const projectileManager = new ProjectileManager(
 *   scene,
 *   map,
 *   groundLayer,
 *   projectiles,
 *   collisionManager,
 *   effectsRenderer,
 *   sounds,
 *   getOnShip,
 *   shipCommands
 * );
 *
 * // Spawn projectile from cannon fire event
 * projectileManager.spawnProjectile(spawnPayload);
 *
 * // In game loop:
 * projectileManager.updateProjectiles(delta, ships);
 * ```
 */
export class ProjectileManager {
  private readonly GRAVITY = 150; // px/s² (must match server)
  private readonly LIFETIME = 2000; // ms

  constructor(
    private scene: Phaser.Scene,
    private map: Phaser.Tilemaps.Tilemap,
    private groundLayer: Phaser.Tilemaps.TilemapLayer,
    private projectiles: Map<string, Projectile>,
    private collisionManager: CollisionManager,
    private effectsRenderer: EffectsRenderer,
    private sounds: {
      cannonFire?: Howl;
      hitImpact?: Howl;
      waterSplash?: Howl;
      shipSinking?: Howl;
      shipRespawn?: Howl;
    },
    private getOnShip: () => string | null,
    private shipCommands: ShipCommands
  ) {}

  /**
   * Spawn a projectile from a cannon (c5x-ship-combat Phase 2)
   * @param payload Spawn payload from server
   */
  spawnProjectile(payload: any): void {
    const { id, position, velocity, timestamp, sourceShip } = payload;

    // Check for duplicate (idempotency)
    if (this.projectiles.has(id)) {
      console.log(`Projectile ${id} already exists, ignoring duplicate spawn`);
      return;
    }

    console.log(`[GameScene] Spawning projectile ${id} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
    console.log(`  Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) px/s`);

    // Create cannonball sprite (black circle, 8px diameter)
    const sprite = this.scene.add.circle(
      position.x,
      position.y,
      4, // radius = 4px (8px diameter)
      0x222222, // Dark gray/black
      1.0 // Full opacity
    );
    sprite.setDepth(100); // Above ships and players

    // Store projectile
    const projectile: Projectile = {
      id,
      sprite,
      velocity: { ...velocity }, // Copy velocity
      spawnTime: timestamp,
      sourceShip,
      minFlightTime: 200, // 200ms grace period before water collision check (prevents instant despawn from deck-level shots)
    };

    this.projectiles.set(id, projectile);
    console.log(`[GameScene] Projectile ${id} spawned successfully. Total projectiles: ${this.projectiles.size}`);

    // Phase 5: Play cannon fire sound (c5x-ship-combat)
    this.sounds?.cannonFire?.play();

    // Phase 5: Camera shake if local player is on the firing ship (c5x-ship-combat)
    if (sourceShip === this.getOnShip()) {
      this.scene.cameras.main.shake(100, 0.005); // 100ms duration, 0.005 intensity
    }

    // Show cannon blast effect at spawn position (Phase 2c)
    this.effectsRenderer.createCannonBlast(position.x, position.y);
  }

  /**
   * Update all projectiles: apply physics, check collisions, render trails
   * @param delta Delta time in milliseconds
   * @param ships Map of all ships
   */
  updateProjectiles(delta: number, ships: Map<string, Ship>): void {
    const deltaS = delta / 1000; // Convert to seconds

    this.projectiles.forEach((proj, id) => {
      // Check lifetime (safety net)
      const age = Date.now() - proj.spawnTime;
      if (age > this.LIFETIME) {
        proj.sprite.destroy();
        this.projectiles.delete(id);
        console.log(`[GameScene] Projectile ${id} despawned (lifetime expired). Total: ${this.projectiles.size}`);
        return;
      }

      // Apply gravity (downward acceleration)
      proj.velocity.y += this.GRAVITY * deltaS;

      // Update position (Euler integration)
      proj.sprite.x += proj.velocity.x * deltaS;
      proj.sprite.y += proj.velocity.y * deltaS;

      // Phase 2c: Add smoke trail effect (30% chance per frame ~18 puffs/sec at 60fps)
      if (Math.random() < 0.3) {
        const trail = this.scene.add.circle(
          proj.sprite.x,
          proj.sprite.y,
          3,
          0x888888,
          0.5
        );
        trail.setDepth(100);

        this.scene.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 1.5,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => trail.destroy()
        });
      }

      // Phase 3: Check collision with ships (except source ship)
      let hitShip = false;
      ships.forEach((ship) => {
        if (ship.id === proj.sourceShip) return; // Don't hit own ship
        if (hitShip) return; // Already hit a ship this frame

        // Use existing OBB collision with generous hitbox
        const hitboxPadding = 1.2; // 20% generous hitbox
        const paddedBoundary = {
          width: ship.deckBoundary.width * hitboxPadding,
          height: ship.deckBoundary.height * hitboxPadding
        };

        if (this.collisionManager.isPointInRotatedRect(
          { x: proj.sprite.x, y: proj.sprite.y },
          { x: ship.sprite.x, y: ship.sprite.y },
          paddedBoundary,
          ship.rotation
        )) {
          // HIT! Show effect immediately (client prediction)
          this.effectsRenderer.createHitEffect(proj.sprite.x, proj.sprite.y);

          // Phase 5: Play hit impact sound (c5x-ship-combat)
          this.sounds?.hitImpact?.play();

          // Send hit claim to target ship for validation (include target's position/boundary for server validation)
          this.shipCommands.sendProjectileHitClaim(
            ship.id,
            proj.id,
            Date.now(),
            ship.sprite.x,
            ship.sprite.y,
            ship.rotation,
            ship.deckBoundary
          );

          // Despawn projectile locally
          proj.sprite.destroy();
          this.projectiles.delete(id);
          console.log(`[GameScene] Projectile ${id} hit ship ${ship.id}. Total: ${this.projectiles.size}`);
          hitShip = true;
          return;
        }
      });

      if (hitShip) return; // Skip water check if we hit a ship

      // Phase 2c: Check for water surface collision
      // ONLY check if: (1) past grace period AND (2) descending
      // Grace period prevents instant despawn from deck-level downward shots
      if (age > proj.minFlightTime && proj.velocity.y > 0) {
        const tilePos = this.map.worldToTileXY(proj.sprite.x, proj.sprite.y);
        if (tilePos) {
          const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));

          if (tile && tile.properties?.navigable === true) {
            // Projectile is over water - calculate water surface Y coordinate
            const worldPos = this.map.tileToWorldXY(Math.floor(tilePos.x), Math.floor(tilePos.y));
            if (worldPos) {
              // Water surface is at the tile's world Y position
              // Add half tile visual height to get the center/surface of the water tile
              const waterSurfaceY = worldPos.y + (TILE_VISUAL_HEIGHT / 2);

              // Check if cannonball has hit the water (with small margin for cannonball radius)
              if (proj.sprite.y >= waterSurfaceY - 5) {
                // HIT WATER! Show splash and despawn
                this.effectsRenderer.createWaterSplash(proj.sprite.x, proj.sprite.y);

                // Phase 5: Play water splash sound (c5x-ship-combat)
                this.sounds?.waterSplash?.play();

                proj.sprite.destroy();
                this.projectiles.delete(id);
                console.log(`[GameScene] Projectile ${id} hit water at (${proj.sprite.x.toFixed(1)}, ${proj.sprite.y.toFixed(1)}). Total: ${this.projectiles.size}`);
                return;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Get projectiles map (for external access)
   */
  getProjectiles(): Map<string, Projectile> {
    return this.projectiles;
  }

  /**
   * Updates visibility of projectiles based on diamond viewport culling (d7v-diamond-viewport)
   * Uses hard cutoff (no fade) to avoid ghostly appearance
   * Call this from GameScene.update() with player position
   *
   * @param centerX - Player world X coordinate (viewport center)
   * @param centerY - Player world Y coordinate (viewport center)
   */
  updateVisibility(centerX: number, centerY: number): void {
    for (const projectile of this.projectiles.values()) {
      const isVisible = ViewportManager.isInDiamond(
        projectile.sprite.x,
        projectile.sprite.y,
        centerX,
        centerY
      );

      projectile.sprite.setVisible(isVisible);
    }
  }
}
