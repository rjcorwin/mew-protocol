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

  /**
   * Calculate fade alpha for smooth visibility transitions at diamond edges
   * (smooth-visibility-transitions)
   *
   * Returns alpha value (0.0-1.0) based on distance from diamond edge:
   * - 1.0: Inside fade zone (fully visible)
   * - 0.0-1.0: In fade zone (linearly interpolated)
   * - 0.0: Outside diamond (fully invisible)
   *
   * @param tileX - Tile X coordinate
   * @param tileY - Tile Y coordinate
   * @param centerTileX - Center tile X coordinate (viewport center)
   * @param centerTileY - Center tile Y coordinate (viewport center)
   * @param radiusTiles - Diamond radius in tiles
   * @param fadeZoneTiles - Size of fade zone in tiles (default: from VIEWPORT config)
   * @returns Alpha value 0.0-1.0
   */
  static getFadeAlpha(
    tileX: number,
    tileY: number,
    centerTileX: number,
    centerTileY: number,
    radiusTiles: number,
    fadeZoneTiles: number = VIEWPORT.FADE_ZONE_TILES
  ): number {
    // Calculate Chebyshev distance (max of dx, dy) for square diamond
    const dx = Math.abs(tileX - centerTileX);
    const dy = Math.abs(tileY - centerTileY);
    const maxDist = Math.max(dx, dy);

    // Calculate distance from edge (positive = inside, negative = outside)
    const distanceFromEdge = radiusTiles - maxDist;

    if (distanceFromEdge <= 0) {
      // Outside diamond
      return 0.0;
    } else if (distanceFromEdge >= fadeZoneTiles) {
      // Inside fade zone (fully visible)
      return 1.0;
    } else {
      // In fade zone - linear interpolation
      return distanceFromEdge / fadeZoneTiles;
    }
  }

  /**
   * Calculate fade alpha for entities using world coordinates
   * (smooth-visibility-transitions)
   *
   * This is a convenience method for entities that use world coordinates
   * instead of tile coordinates. Uses Manhattan distance approximation
   * for the diamond shape in world space.
   *
   * @param worldX - Entity world X coordinate
   * @param worldY - Entity world Y coordinate
   * @param centerWorldX - Center world X coordinate
   * @param centerWorldY - Center world Y coordinate
   * @returns Alpha value 0.0-1.0
   */
  static getFadeAlphaWorld(
    worldX: number,
    worldY: number,
    centerWorldX: number,
    centerWorldY: number
  ): number {
    // Calculate world-space distance from center
    const dx = Math.abs(worldX - centerWorldX);
    const dy = Math.abs(worldY - centerWorldY);

    // Diamond dimensions in pixels (world space)
    const { width, height } = this.getDiamondDimensions();
    const maxDx = width / 2;
    const maxDy = height / 2;

    // Use Manhattan distance in world space for diamond shape
    const normalizedDist = (dx / maxDx) + (dy / maxDy);

    // Fade zone as percentage of radius
    const fadeZonePercent = VIEWPORT.FADE_ZONE_TILES / this.getDiamondRadiusTiles();

    if (normalizedDist >= 1.0) {
      // Outside diamond
      return 0.0;
    } else if (normalizedDist <= (1.0 - fadeZonePercent)) {
      // Inside fade zone (fully visible)
      return 1.0;
    } else {
      // In fade zone - linear interpolation
      const distanceIntoFadeZone = 1.0 - normalizedDist;
      return distanceIntoFadeZone / fadeZonePercent;
    }
  }
}
