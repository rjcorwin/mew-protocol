/**
 * ViewportManager - Diamond Viewport Utility
 *
 * Manages diamond-shaped viewport culling and coordinate calculations for the
 * seacat game. This utility provides methods for:
 * - Checking if entities are within the diamond viewport
 * - Calculating diamond dimensions and window sizes
 * - Computing camera zoom for proper framing
 *
 * The diamond viewport is a square rotated 45°, creating a rhombus shape that
 * provides a distinctive "diorama" aesthetic and performance culling.
 *
 * @module ViewportManager
 * @see spec/seacat/proposals/d7v-diamond-viewport/
 */

import { VIEWPORT, TILE_WIDTH, TILE_HEIGHT } from './Constants.js';

/**
 * Manages diamond viewport culling and coordinate calculations
 */
export class ViewportManager {
  /**
   * Checks if a world position is within the diamond viewport
   * centered on the given player position.
   *
   * For isometric maps: Uses a square check in world space which approximates
   * the diamond shape. This works because entities use world coordinates directly.
   *
   * @param worldX - Entity's world X coordinate (pixels)
   * @param worldY - Entity's world Y coordinate (pixels)
   * @param centerWorldX - Center point world X (typically player position)
   * @param centerWorldY - Center point world Y (typically player position)
   * @returns true if entity is within diamond viewport
   */
  static isInDiamond(
    worldX: number,
    worldY: number,
    centerWorldX: number,
    centerWorldY: number
  ): boolean {
    // Calculate world-space distance from center
    const dx = Math.abs(worldX - centerWorldX);
    const dy = Math.abs(worldY - centerWorldY);

    // Diamond dimensions in pixels (world space)
    const { width, height } = this.getDiamondDimensions();
    const maxDx = width / 2;
    const maxDy = height / 2;

    // Use Manhattan distance in world space for diamond shape
    // This creates a diamond-shaped viewport in screen space
    const normalizedDist = (dx / maxDx) + (dy / maxDy);

    return normalizedDist <= 1.0;
  }

  /**
   * Gets the diamond radius in tiles (for tile-based culling)
   */
  static getDiamondRadiusTiles(): number {
    return VIEWPORT.DIAMOND_SIZE_TILES / 2;
  }

  /**
   * Calculates the pixel dimensions of the diamond viewport
   * (square diamond: width and height are equal in tile count)
   */
  static getDiamondDimensions(): { width: number; height: number } {
    return {
      width: VIEWPORT.DIAMOND_SIZE_TILES * TILE_WIDTH,
      height: VIEWPORT.DIAMOND_SIZE_TILES * TILE_HEIGHT,
    };
  }

  /**
   * Calculates the total window dimensions including border padding
   */
  static getWindowDimensions(): { width: number; height: number } {
    const diamond = this.getDiamondDimensions();

    // Use separate border values for each edge
    const borderTopPx = VIEWPORT.DIAMOND_BORDER_TOP_TILES * TILE_HEIGHT;
    const borderBottomPx = VIEWPORT.DIAMOND_BORDER_BOTTOM_TILES * TILE_HEIGHT;
    const borderLeftPx = VIEWPORT.DIAMOND_BORDER_LEFT_TILES * TILE_WIDTH;
    const borderRightPx = VIEWPORT.DIAMOND_BORDER_RIGHT_TILES * TILE_WIDTH;

    return {
      width: diamond.width + borderLeftPx + borderRightPx,
      height: diamond.height + borderTopPx + borderBottomPx,
    };
  }

  /**
   * Gets the border dimensions in pixels
   */
  static getBorderDimensions(): {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } {
    return {
      top: VIEWPORT.DIAMOND_BORDER_TOP_TILES * TILE_HEIGHT,
      bottom: VIEWPORT.DIAMOND_BORDER_BOTTOM_TILES * TILE_HEIGHT,
      left: VIEWPORT.DIAMOND_BORDER_LEFT_TILES * TILE_WIDTH,
      right: VIEWPORT.DIAMOND_BORDER_RIGHT_TILES * TILE_WIDTH,
    };
  }

  /**
   * Calculates the appropriate camera zoom to fit the world view in the window
   *
   * @param windowWidth - Actual window/canvas width in pixels
   * @param windowHeight - Actual window/canvas height in pixels
   * @returns Zoom factor to apply to camera
   */
  static calculateZoom(windowWidth: number, windowHeight: number): number {
    const worldDimensions = this.getWindowDimensions();

    // Calculate zoom to fit world in window (best fit, no clipping)
    const zoomX = windowWidth / worldDimensions.width;
    const zoomY = windowHeight / worldDimensions.height;

    // Use minimum to ensure entire world fits
    return Math.min(zoomX, zoomY);
  }

  /**
   * Gets the diamond corner points in world space (for rendering border)
   * Assumes diamond is centered at (centerX, centerY)
   */
  static getDiamondCorners(centerX: number, centerY: number): Array<{ x: number; y: number }> {
    const { width, height } = this.getDiamondDimensions();
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    return [
      { x: centerX, y: centerY - halfHeight },        // Top
      { x: centerX + halfWidth, y: centerY },         // Right
      { x: centerX, y: centerY + halfHeight },        // Bottom
      { x: centerX - halfWidth, y: centerY },         // Left
    ];
  }
}
