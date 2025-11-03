/**
 * Game constants for the Seacat isometric multiplayer game.
 *
 * This module defines all constant values used throughout the game including:
 * - Tile dimensions for isometric rendering
 * - World size parameters
 * - Movement and physics constants
 * - Isometric basis vectors for movement
 *
 * Responsibilities:
 * - Centralize all magic numbers and configuration values
 * - Define isometric projection parameters
 * - Specify movement speeds and update rates
 *
 * @module Constants
 * @example
 * ```typescript
 * import * as Constants from './utils/Constants';
 *
 * // Use tile dimensions for rendering
 * const tileWidth = Constants.TILE_WIDTH;
 *
 * // Use movement vectors for player input
 * const moveVector = {
 *   x: Constants.ISO_NORTHEAST.x * Constants.MOVE_SPEED,
 *   y: Constants.ISO_NORTHEAST.y * Constants.MOVE_SPEED
 * };
 * ```
 */

import Phaser from 'phaser';

// Tile dimensions
export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 16;
export const TILE_VISUAL_HEIGHT = 32; // Actual height of tiles with 3D depth in tileset

// World dimensions
export const WORLD_WIDTH = 20;
export const WORLD_HEIGHT = 20;

// Movement
export const MOVE_SPEED = 100; // pixels per second
export const POSITION_UPDATE_RATE = 100; // ms between position updates

// Isometric movement basis vectors (i2m-true-isometric Phase 1)
// Calculated from tile dimensions and normalized for consistent movement speed
export const ISO_X_AXIS = { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 }; // Southeast direction
export const ISO_Y_AXIS = { x: TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 }; // Northeast direction
const isoXLength = Math.sqrt(ISO_X_AXIS.x ** 2 + ISO_X_AXIS.y ** 2);
const isoYLength = Math.sqrt(ISO_Y_AXIS.x ** 2 + ISO_Y_AXIS.y ** 2);
export const ISO_NORTHEAST = { x: ISO_Y_AXIS.x / isoYLength, y: ISO_Y_AXIS.y / isoYLength };
export const ISO_SOUTHEAST = { x: ISO_X_AXIS.x / isoXLength, y: ISO_X_AXIS.y / isoXLength };
export const ISO_SOUTHWEST = { x: -ISO_NORTHEAST.x, y: -ISO_NORTHEAST.y };
export const ISO_NORTHWEST = { x: -ISO_SOUTHEAST.x, y: -ISO_SOUTHEAST.y };
