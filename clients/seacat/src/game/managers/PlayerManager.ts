import Phaser from 'phaser';
import { PositionUpdate, Player } from '../../types.js';
import { WaterRenderer } from '../rendering/WaterRenderer.js';

/**
 * Manages remote player lifecycle, synchronization, and rendering in the multiplayer game.
 *
 * This manager handles all remote player entities, including creating sprites, smoothly
 * interpolating positions from network updates, applying water wave effects, managing
 * animations, and handling depth sorting for proper isometric rendering.
 *
 * Responsibilities:
 * - Create and destroy remote player sprites
 * - Smoothly interpolate player positions from network updates
 * - Apply wave bobbing effects to players standing in water
 * - Update player animations based on movement and facing direction
 * - Dynamic depth sorting relative to Layer 2 tiles for correct rendering order
 * - Handle players boarding and disembarking from ships
 *
 * Dependencies:
 * - WaterRenderer for wave height calculations
 * - Phaser.Tilemaps for tile-based depth sorting
 *
 * @example
 * ```typescript
 * const playerManager = new PlayerManager(
 *   scene,
 *   map,
 *   groundLayer,
 *   secondLayer,
 *   waterRenderer,
 *   remotePlayers
 * );
 *
 * // Update remote player from network
 * playerManager.updateRemotePlayer(positionUpdate);
 *
 * // In game loop:
 * playerManager.interpolateRemotePlayers(delta, time);
 * ```
 */
export class PlayerManager {
  constructor(
    private scene: Phaser.Scene,
    private map: Phaser.Tilemaps.Tilemap,
    private groundLayer: Phaser.Tilemaps.TilemapLayer,
    private secondLayer: Phaser.Tilemaps.TilemapLayer | undefined,
    private waterRenderer: WaterRenderer,
    private remotePlayers: Map<string, Player>
  ) {}

  /**
   * Update or create a remote player from position update
   * @param update Position update from network
   */
  updateRemotePlayer(update: PositionUpdate): void {
    let player = this.remotePlayers.get(update.participantId);

    if (!player) {
      // Create new remote player
      const sprite = this.scene.add.sprite(
        update.worldCoords.x,
        update.worldCoords.y,
        'player'
      );
      sprite.setOrigin(0.5, 0.8);
      sprite.setTint(0xff0000); // Red for remote players
      // Depth is set dynamically in update() based on Y position

      player = {
        id: update.participantId,
        sprite,
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
        lastUpdate: update.timestamp,
        velocity: update.velocity,
        platformRef: update.platformRef,
        onShip: null,
        lastWaveOffset: 0, // Initialize wave offset tracking
      };

      this.remotePlayers.set(update.participantId, player);
      console.log(`Remote player joined: ${update.participantId}`);
    } else {
      // Update existing player's target position
      player.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
      player.lastUpdate = update.timestamp;
      player.velocity = update.velocity;
    }

    // Update remote player animation based on received facing direction
    const velocityMagnitude = Math.sqrt(
      update.velocity.x ** 2 + update.velocity.y ** 2
    );

    if (velocityMagnitude > 0) {
      // Player is moving - play walk animation in the received direction
      player.sprite.play(`walk-${update.facing}`, true);
    } else {
      // Player is idle - stop animation
      player.sprite.anims.stop();
    }
  }

  /**
   * Interpolate all remote players toward their target positions
   * Apply wave bobbing for players in water
   * @param delta Delta time in milliseconds
   * @param time Current game time in milliseconds
   */
  interpolateRemotePlayers(delta: number, time: number): void {
    this.remotePlayers.forEach((player) => {
      // Update depth dynamically - check if south of Layer 2 tiles
      const remoteTilePos = this.map.worldToTileXY(player.sprite.x, player.sprite.y);
      let remoteRenderAbove = false;

      if (remoteTilePos && this.secondLayer) {
        const tileNorth = this.secondLayer.getTileAt(
          Math.floor(remoteTilePos.x),
          Math.floor(remoteTilePos.y) - 1
        );
        if (tileNorth) {
          remoteRenderAbove = true;
        }
      }

      player.sprite.setDepth(remoteRenderAbove ? 20000 : 1000);

      const dx = player.targetPosition.x - player.sprite.x;
      const dy = player.targetPosition.y - player.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 1) {
        // Smooth interpolation
        const factor = Math.min(1, (delta / 1000) * 5); // Adjust speed as needed
        player.sprite.x += dx * factor;
        player.sprite.y += dy * factor;
      }

      // Apply wave bobbing if remote player is in water (not on ship)
      if (!player.onShip) {
        const tilePos = this.map.worldToTileXY(player.sprite.x, player.sprite.y);
        if (tilePos) {
          const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));
          if (tile && tile.properties?.navigable === true) {
            // Remote player is in water, apply wave offset delta
            const currentWaveOffset = this.waterRenderer.calculateWaveHeightAtPosition(player.sprite.x, player.sprite.y, time);
            const waveDelta = currentWaveOffset - player.lastWaveOffset;
            player.sprite.y += waveDelta;
            player.lastWaveOffset = currentWaveOffset;
          } else {
            // Remote player is not in water, reset wave offset
            player.lastWaveOffset = 0;
          }
        } else {
          // Out of bounds, reset wave offset
          player.lastWaveOffset = 0;
        }
      } else {
        // Remote player is on ship, reset wave offset (ship handles bobbing)
        player.lastWaveOffset = 0;
      }
    });
  }

  /**
   * Move remote players with a ship by delta
   * @param shipId Ship ID
   * @param dx X delta
   * @param dy Y delta
   */
  movePlayersOnShip(shipId: string, dx: number, dy: number): void {
    this.remotePlayers.forEach((player) => {
      if (player.onShip === shipId) {
        player.sprite.x += dx;
        player.sprite.y += dy;
      }
    });
  }

  /**
   * Rotate remote players on a ship
   * @param shipId Ship ID
   * @param rotationDelta Rotation change in radians
   */
  rotatePlayersOnShip(shipId: string, rotationDelta: number): void {
    this.remotePlayers.forEach((player) => {
      if (player.onShip === shipId) {
        // Note: We need to add shipRelativePosition to Player type
        // For now, this will handle future implementation
        console.log(`Remote player ${player.id} should rotate on ship ${shipId}`);
      }
    });
  }

  /**
   * Teleport remote players off a sunk ship
   * @param shipId Ship ID
   */
  teleportPlayersOffShip(shipId: string): void {
    this.remotePlayers.forEach((player) => {
      if (player.onShip === shipId) {
        player.onShip = null;
      }
    });
  }

  /**
   * Get remote players map (for external access)
   */
  getRemotePlayers(): Map<string, Player> {
    return this.remotePlayers;
  }
}
