/**
 * Rotate a point by the given angle (Cartesian rotation)
 * @param point Point to rotate
 * @param angle Rotation angle in radians
 * @returns Rotated point
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
 * Convert isometric coordinates to Cartesian coordinates (i2m-true-isometric Phase 3)
 * @param isoPoint Point in isometric space
 * @returns Point in Cartesian space
 */
export function isometricToCartesian(isoPoint: { x: number; y: number }): { x: number; y: number } {
  return {
    x: (isoPoint.x + isoPoint.y * 2) / 2,
    y: (isoPoint.y * 2 - isoPoint.x) / 2,
  };
}

/**
 * Convert Cartesian coordinates to isometric coordinates (i2m-true-isometric Phase 3)
 * @param cartPoint Point in Cartesian space
 * @returns Point in isometric space
 */
export function cartesianToIsometric(cartPoint: { x: number; y: number }): { x: number; y: number } {
  return {
    x: cartPoint.x - cartPoint.y,
    y: (cartPoint.x + cartPoint.y) / 2,
  };
}

/**
 * Rotate a point in isometric space (i2m-true-isometric Phase 3)
 * This ensures rotation appears correct in isometric projection
 * @param point Point to rotate in isometric space
 * @param angle Rotation angle in radians
 * @returns Rotated point in isometric space
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
