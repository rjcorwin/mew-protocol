/**
 * ViewportRenderer - Diamond Viewport Rendering
 *
 * Renders the diamond viewport border and background elements for the seacat game.
 * This renderer handles:
 * - Diamond border visualization
 * - Background gradient (sky/sea)
 * - Window resize handling
 *
 * @module ViewportRenderer
 * @see spec/seacat/proposals/d7v-diamond-viewport/
 */

import Phaser from 'phaser';
import { ViewportManager } from '../utils/ViewportManager.js';

/**
 * Renders the diamond viewport border and background elements
 */
export class ViewportRenderer {
  private scene: Phaser.Scene;
  private borderGraphics?: Phaser.GameObjects.Graphics;
  private backgroundGraphics?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initializes the viewport renderer
   * Call this once in GameScene.create()
   */
  public initialize(): void {
    // Create background using Graphics (simpler than RenderTexture)
    this.createBackgroundGradient();

    // Create border graphics
    this.borderGraphics = this.scene.add.graphics();
    this.borderGraphics.setDepth(100); // Render above game world
  }

  /**
   * Creates a gradient background for sky and sea (d7v-diamond-viewport Phase 4)
   *
   * CRITICAL: Background fills WINDOW (screen space), not world space
   * - Uses scene.scale.width/height (actual window size)
   * - setScrollFactor(0) keeps it fixed to camera
   * - Horizon line calculated based on diamond dimensions
   */
  private createBackgroundGradient(): void {
    // IMPORTANT: Background fills WINDOW, not world
    const windowWidth = this.scene.scale.width;
    const windowHeight = this.scene.scale.height;

    // Create Graphics for gradient background
    const graphics = this.scene.add.graphics();
    graphics.setDepth(-2000); // Behind custom background image (-1000)
    graphics.setScrollFactor(0); // Fixed to camera (doesn't scroll)

    // Calculate horizon line position
    // Adjusted for pulled-down diamond: Put horizon at ~50% down from top (roughly where diamond top will be)
    // This can be fine-tuned based on border settings
    const horizonY = windowHeight * 0.5;

    // Draw sky gradient (top to horizon)
    // Phaser Graphics doesn't support native gradients, so we'll approximate with multiple horizontal lines
    for (let y = 0; y < horizonY; y++) {
      const t = y / horizonY;
      // Interpolate between sky colors
      const skyTop = { r: 0x87, g: 0xCE, b: 0xEB }; // #87CEEB
      const skyBottom = { r: 0x46, g: 0x82, b: 0xB4 }; // #4682B4
      const r = Math.round(skyTop.r + (skyBottom.r - skyTop.r) * t);
      const g = Math.round(skyTop.g + (skyBottom.g - skyTop.g) * t);
      const b = Math.round(skyTop.b + (skyBottom.b - skyTop.b) * t);
      const color = (r << 16) | (g << 8) | b;

      graphics.fillStyle(color, 1.0);
      graphics.fillRect(0, y, windowWidth, 1);
    }

    // Draw sea gradient (horizon to bottom)
    for (let y = horizonY; y < windowHeight; y++) {
      const t = (y - horizonY) / (windowHeight - horizonY);
      // Interpolate between sea colors
      const seaTop = { r: 0x2E, g: 0x5A, b: 0x88 }; // #2E5A88
      const seaBottom = { r: 0x1B, g: 0x3A, b: 0x5C }; // #1B3A5C
      const r = Math.round(seaTop.r + (seaBottom.r - seaTop.r) * t);
      const g = Math.round(seaTop.g + (seaBottom.g - seaTop.g) * t);
      const b = Math.round(seaTop.b + (seaBottom.b - seaTop.b) * t);
      const color = (r << 16) | (g << 8) | b;

      graphics.fillStyle(color, 1.0);
      graphics.fillRect(0, y, windowWidth, 1);
    }

    // Store reference
    this.backgroundGraphics = graphics;
  }

  /**
   * Renders the diamond border (d7v-diamond-viewport Phase 3)
   * Call this every frame in GameScene.update()
   *
   * @param centerX - Player world X coordinate (viewport center)
   * @param centerY - Player world Y coordinate (viewport center)
   */
  public renderBorder(centerX: number, centerY: number): void {
    if (!this.borderGraphics) return;

    this.borderGraphics.clear();

    // Get diamond corner points in world space
    const corners = ViewportManager.getDiamondCorners(centerX, centerY);

    // Draw diamond border (white, 50% opacity)
    this.borderGraphics.lineStyle(2, 0xffffff, 0.5);
    this.borderGraphics.beginPath();
    this.borderGraphics.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      this.borderGraphics.lineTo(corners[i].x, corners[i].y);
    }
    this.borderGraphics.closePath();
    this.borderGraphics.strokePath();
  }

  /**
   * Updates background size on window resize (d7v-diamond-viewport Phase 4.4)
   * Call when window dimensions change
   */
  public updateBackgroundOnResize(): void {
    if (!this.backgroundGraphics) return;

    // Destroy old background and create new one with correct size
    this.backgroundGraphics.destroy();
    this.createBackgroundGradient();
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.backgroundGraphics?.destroy();
    this.borderGraphics?.destroy();
  }
}
