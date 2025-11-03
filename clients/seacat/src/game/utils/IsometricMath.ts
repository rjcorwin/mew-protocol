/**
 * Isometric coordinate transformation utilities for the Seacat game.
 *
 * This module provides functions for converting between Cartesian and isometric
 * coordinate systems, as well as performing rotations in both spaces. These
 * utilities are essential for rendering and collision detection in the isometric
 * game world.
 *
 * Responsibilities:
 * - Convert between Cartesian and isometric coordinate spaces
 * - Perform rotations in both coordinate systems
 * - Support ship rotation and orientation calculations
 *
 * @module IsometricMath
 * @example
 * ```typescript
 * import * as IsoMath from './utils/IsometricMath';
 *
 * // Convert isometric to Cartesian
 * const cartPos = IsoMath.isometricToCartesian({ x: 10, y: 5 });
 *
 * // Rotate a point in isometric space
 * const rotated = IsoMath.rotatePointIsometric({ x: 10, y: 5 }, Math.PI / 4);
 * ```
 */

/**
 * Rotates a point around the origin by the given angle using Cartesian rotation.
 *
 * This performs a standard 2D rotation transformation using a rotation matrix.
 * The rotation is counter-clockwise for positive angles.
 *
 * @param point - The point to rotate with x and y coordinates
 * @param angle - The rotation angle in radians (positive = counter-clockwise)
 * @returns The rotated point with x and y coordinates
 *
 * @example
 * ```typescript
 * // Rotate 90 degrees counter-clockwise
 * const rotated = rotatePoint({ x: 1, y: 0 }, Math.PI / 2);
 * // Result: { x: 0, y: 1 }
 * ```
 */
export function rotatePoint(point: { x: number; y: number }, angle: number): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

/**
 * Converts isometric coordinates to Cartesian (world) coordinates.
 *
 * This transformation is used to convert positions from the isometric rendering
 * space to the underlying Cartesian game world space. Essential for physics
 * calculations, collision detection, and applying rotations correctly.
 *
 * Formula:
 * - cartX = (isoX + isoY * 2) / 2
 * - cartY = (isoY * 2 - isoX) / 2
 *
 * @param isoPoint - Point in isometric space
 * @returns Point in Cartesian space
 *
 * @example
 * ```typescript
 * const isoPos = { x: 10, y: 10 };
 * const cartPos = isometricToCartesian(isoPos);
 * // cartPos can now be used for physics calculations
 * ```
 */
export function isometricToCartesian(isoPoint: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (isoPoint.x + isoPoint.y * 2) / 2,
    y: (isoPoint.y * 2 - isoPoint.x) / 2,
  };
}

/**
 * Converts Cartesian (world) coordinates to isometric coordinates.
 *
 * This transformation converts from the Cartesian game world space to the
 * isometric rendering space. Used after physics calculations to position
 * sprites correctly in the isometric view.
 *
 * Formula:
 * - isoX = cartX - cartY
 * - isoY = (cartX + cartY) / 2
 *
 * @param cartPoint - Point in Cartesian space
 * @returns Point in isometric space
 *
 * @example
 * ```typescript
 * const worldPos = { x: 100, y: 50 };
 * const isoPos = cartesianToIsometric(worldPos);
 * // isoPos can be used to position sprites on screen
 * ```
 */
export function cartesianToIsometric(cartPoint: { x: number; y: number }): { x: number; y: number } {
  return {
    x: cartPoint.x - cartPoint.y,
    y: (cartPoint.x + cartPoint.y) / 2,
  };
}

/**
 * Rotates a point in isometric space while maintaining visual correctness.
 *
 * This function ensures that rotations appear correct when viewed in the
 * isometric projection. It converts to Cartesian space, applies the rotation,
 * then converts back to isometric space.
 *
 * The workflow:
 * 1. Convert isometric point to Cartesian
 * 2. Apply standard 2D rotation
 * 3. Convert rotated point back to isometric
 *
 * This is essential for correctly rotating ships and other objects in the
 * isometric world.
 *
 * @param point - Point to rotate in isometric space
 * @param angle - Rotation angle in radians (positive = counter-clockwise)
 * @returns Rotated point in isometric space
 *
 * @example
 * ```typescript
 * // Rotate a ship position in isometric space
 * const shipIsoPos = { x: 100, y: 50 };
 * const rotatedPos = rotatePointIsometric(shipIsoPos, Math.PI / 4);
 * // The ship now faces a new direction with correct isometric projection
 * ```
 */
export function rotatePointIsometric(point: { x: number; y: number }, angle: number): { x: number; y: number } {
  // Transform to Cartesian
  const cart = isometricToCartesian(point);

  // Apply Cartesian rotation
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedCart = {
    x: cart.x * cos - cart.y * sin,
    y: cart.x * sin + cart.y * cos,
  };

  // Transform back to isometric
  return cartesianToIsometric(rotatedCart);
}
