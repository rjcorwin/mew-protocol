import Phaser from 'phaser';

/**
 * Manages water rendering and wave animations.
 *
 * Responsibilities:
 * - Calculate wave height at any position
 * - Provide wave offset for bobbing effects on ships and players
 */
export class WaterRenderer {
  constructor(
    private scene: Phaser.Scene,
    private map: Phaser.Tilemaps.Tilemap
  ) {}

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
}
