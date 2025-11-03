import Phaser from 'phaser';
import * as Constants from '../utils/Constants.js';

const { TILE_WIDTH, TILE_HEIGHT } = Constants;

/**
 * Manages water rendering, wave physics, and animated water effects.
 *
 * This renderer creates realistic ocean waves using multiple layered sine waves that
 * create interference patterns. It provides wave height calculations for bobbing effects
 * on ships and players, and efficiently animates only visible water tiles.
 *
 * Responsibilities:
 * - Calculate wave height at any world position using combined sine waves
 * - Provide wave offset deltas for smooth bobbing effects on entities
 * - Animate visible water tiles with realistic wave motion (camera culled)
 * - Render semi-transparent shallow water overlays on sand tiles
 * - Create wave interference patterns for visual realism
 *
 * Dependencies:
 * - Phaser.Tilemaps for tile position lookups
 * - Phaser.Graphics for shallow water overlay rendering
 *
 * @example
 * ```typescript
 * const waterRenderer = new WaterRenderer(
 *   scene,
 *   map,
 *   groundLayer,
 *   shallowWaterGraphics
 * );
 *
 * // Calculate wave height for bobbing effect
 * const waveHeight = waterRenderer.calculateWaveHeightAtPosition(
 *   shipX,
 *   shipY,
 *   currentTime
 * );
 * shipY += waveHeight;
 *
 * // In game loop - animate water tiles
 * waterRenderer.animateVisibleWaterTiles(time);
 * ```
 */
export class WaterRenderer {
  private groundLayer: Phaser.Tilemaps.TilemapLayer;
  private shallowWaterGraphics: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private map: Phaser.Tilemaps.Tilemap,
    groundLayer: Phaser.Tilemaps.TilemapLayer,
    shallowWaterGraphics: Phaser.GameObjects.Graphics
  ) {
    this.groundLayer = groundLayer;
    this.shallowWaterGraphics = shallowWaterGraphics;
  }

  /**
   * Calculate wave height at a specific world position
   * @param x World X coordinate
   * @param y World Y coordinate
   * @param time Current game time in milliseconds
   * @returns Wave height offset in pixels
   */
  calculateWaveHeightAtPosition(x: number, y: number, time: number): number {
    // Convert world position to tile coordinates for wave calculation
    const tilePos = this.map.worldToTileXY(x, y);
    if (!tilePos) return 0;

    const waveSpeed = 0.0005;
    const waveFrequency = 0.2;
    const waveAmplitude = 12;

    // Calculate wave using same formula as water tiles
    const tileX = Math.floor(tilePos.x);
    const tileY = Math.floor(tilePos.y);

    // Primary wave - travels east-west
    const wavePhase1 = (tileX * waveFrequency - tileY * waveFrequency * 0.3) + (time * waveSpeed);
    const wave1 = Math.sin(wavePhase1);

    // Secondary wave - different frequency and direction (more north-south)
    const wavePhase2 = (tileX * waveFrequency * 0.5 + tileY * waveFrequency * 0.7) + (time * waveSpeed * 1.3);
    const wave2 = Math.sin(wavePhase2) * 0.5;

    // Tertiary wave - high frequency ripples
    const wavePhase3 = (tileX * waveFrequency * 2 - tileY * waveFrequency * 0.5) + (time * waveSpeed * 0.7);
    const wave3 = Math.sin(wavePhase3) * 0.3;

    // Combine all waves
    const combinedWave = wave1 + wave2 + wave3;

    return combinedWave * waveAmplitude;
  }

  /**
   * Animate visible water tiles with wave motion.
   * Only processes tiles currently visible on camera for performance.
   * @param time Current game time in milliseconds
   */
  animateVisibleWaterTiles(time: number): void {
    const camera = this.scene.cameras.main;

    // Clear previous frame's shallow water overlay
    this.shallowWaterGraphics.clear();

    // Get camera center in world coordinates
    const cameraCenterX = camera.worldView.x + camera.worldView.width / 2;
    const cameraCenterY = camera.worldView.y + camera.worldView.height / 2;

    // Estimate tile range to check (for isometric, we need a larger range)
    // This is approximate but much faster than checking every tile
    const tileBuffer = 100; // Check tiles within ~100 tile radius of camera center

    // Convert camera center to approximate tile coords
    const centerTile = this.map.worldToTileXY(cameraCenterX, cameraCenterY);
    if (!centerTile) return;

    const minX = Math.max(0, Math.floor(centerTile.x) - tileBuffer);
    const maxX = Math.min(this.map.width - 1, Math.ceil(centerTile.x) + tileBuffer);
    const minY = Math.max(0, Math.floor(centerTile.y) - tileBuffer);
    const maxY = Math.min(this.map.height - 1, Math.ceil(centerTile.y) + tileBuffer);

    // Get camera bounds in world coordinates with buffer
    const bufferPixels = 100;
    const viewLeft = camera.worldView.x - bufferPixels;
    const viewRight = camera.worldView.x + camera.worldView.width + bufferPixels;
    const viewTop = camera.worldView.y - bufferPixels;
    const viewBottom = camera.worldView.y + camera.worldView.height + bufferPixels;

    // Wave parameters
    const waveSpeed = 0.0005; // Slower wave movement
    const waveFrequency = 0.2;
    const waveAmplitude = 12; // Vertical movement in pixels (big dramatic waves!)

    // Only iterate through tiles near the camera
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = this.groundLayer.getTileAt(x, y);

        if (tile) {
          // Get tile's world position
          const worldPos = this.map.tileToWorldXY(x, y);
          if (!worldPos) continue;

          // Check if tile is actually within camera view
          if (worldPos.x >= viewLeft && worldPos.x <= viewRight &&
            worldPos.y >= viewTop && worldPos.y <= viewBottom) {

            // Create a more varied wave effect by combining multiple sine waves
            // This creates interference patterns like real ocean waves

            // Primary wave - travels east-west
            const wavePhase1 = (x * waveFrequency - y * waveFrequency * 0.3) + (time * waveSpeed);
            const wave1 = Math.sin(wavePhase1);

            // Secondary wave - different frequency and direction (more north-south)
            const wavePhase2 = (x * waveFrequency * 0.5 + y * waveFrequency * 0.7) + (time * waveSpeed * 1.3);
            const wave2 = Math.sin(wavePhase2) * 0.5; // Smaller amplitude

            // Tertiary wave - high frequency ripples
            const wavePhase3 = (x * waveFrequency * 2 - y * waveFrequency * 0.5) + (time * waveSpeed * 0.7);
            const wave3 = Math.sin(wavePhase3) * 0.3; // Even smaller

            // Combine all waves
            const combinedWave = wave1 + wave2 + wave3;

            // Move tile vertically based on combined wave (bob up and down)
            const yOffset = combinedWave * waveAmplitude;

            const isNavigable = tile.properties?.navigable === true;
            const isSand = tile.properties?.terrain === 'shallow-sand' || tile.properties?.terrain === 'water';

            if (isNavigable) {
              // This is a water tile - animate it
              tile.pixelY = worldPos.y + yOffset;
            } else if (isSand) {
              // This is a sand tile - render semi-transparent water on top
              // Draw an isometric diamond overlay that follows the wave
              const tileX = worldPos.x + TILE_WIDTH / 2;
              const tileY = worldPos.y + yOffset;

              this.shallowWaterGraphics.fillStyle(0x6fdaf0, 0.3); // Blue water at 30% opacity
              this.shallowWaterGraphics.beginPath();
              this.shallowWaterGraphics.moveTo(tileX, tileY);                              // Top
              this.shallowWaterGraphics.lineTo(tileX + TILE_WIDTH / 2, tileY + TILE_HEIGHT / 2);   // Right
              this.shallowWaterGraphics.lineTo(tileX, tileY + TILE_HEIGHT);               // Bottom
              this.shallowWaterGraphics.lineTo(tileX - TILE_WIDTH / 2, tileY + TILE_HEIGHT / 2);   // Left
              this.shallowWaterGraphics.closePath();
              this.shallowWaterGraphics.fillPath();
            }
          }
        }
      }
    }
  }
}
