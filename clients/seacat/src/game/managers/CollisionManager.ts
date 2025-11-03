import Phaser from 'phaser';
import * as IsoMath from '../utils/IsometricMath.js';
import { TILE_HEIGHT } from '../utils/Constants.js';
import { Ship } from '../../types.js';

/**
 * Manages collision detection for tiles and ship boundaries in the isometric game world.
 *
 * This manager provides collision detection services for both terrain-based collisions
 * (using tilemap layers) and ship deck boundary collisions (using oriented bounding boxes).
 * It handles the complexity of checking collisions in an isometric world with rotated objects.
 *
 * Responsibilities:
 * - Tile collision detection with terrain properties (walkable, speed modifiers)
 * - Ship deck boundary collision using OBB (Oriented Bounding Box)
 * - Point-in-rotated-rectangle collision detection for rotated ships
 * - Terrain type detection (grass, water, obstacles, etc.)
 *
 * Dependencies:
 * - IsometricMath for coordinate transformations and rotations
 * - Phaser.Tilemaps for tile-based collision detection
 *
 * @example
 * ```typescript
 * const collisionManager = new CollisionManager(
 *   scene,
 *   map,
 *   groundLayer,
 *   secondLayer,
 *   obstacleLayer,
 *   waterLayer
 * );
 *
 * // Check if a position is walkable
 * const collision = collisionManager.checkTileCollision(playerX, playerY);
 * if (!collision.walkable) {
 *   // Block movement
 * }
 *
 * // Check if player is on a ship
 * const shipCheck = collisionManager.checkShipBoundary({ x: playerX, y: playerY }, ships);
 * if (shipCheck) {
 *   console.log(`Player is on ship ${shipCheck.shipId}`);
 * }
 * ```
 */
export class CollisionManager {
  constructor(
    private scene: Phaser.Scene,
    private map: Phaser.Tilemaps.Tilemap,
    private groundLayer: Phaser.Tilemaps.TilemapLayer,
    private secondLayer: Phaser.Tilemaps.TilemapLayer | undefined,
    private obstacleLayer: Phaser.Tilemaps.TilemapLayer | undefined,
    private waterLayer: Phaser.Tilemaps.TilemapLayer | undefined
  ) {}

  /**
   * Check if a point is inside a rotated rectangle using OBB (Oriented Bounding Box) collision
   * Uses isometric rotation to match how players rotate on ships (i2m-true-isometric)
   * @param point Point to test in world coordinates
   * @param rectCenter Center of rectangle in world coordinates
   * @param rectSize Size of rectangle (width, height)
   * @param rotation Rotation angle in radians
   * @returns true if point is inside rotated rectangle
   */
  isPointInRotatedRect(
    point: { x: number; y: number },
    rectCenter: { x: number; y: number },
    rectSize: { width: number; height: number },
    rotation: number
  ): boolean {
    // Transform point to rectangle's local space
    const dx = point.x - rectCenter.x;
    const dy = point.y - rectCenter.y;

    // Rotate point by -rotation using isometric rotation to align with rect's axes
    const offset = { x: dx, y: dy };
    const localPos = IsoMath.rotatePointIsometric(offset, -rotation);

    // Check if point is inside axis-aligned rect
    const halfWidth = rectSize.width / 2;
    const halfHeight = rectSize.height / 2;

    return Math.abs(localPos.x) <= halfWidth && Math.abs(localPos.y) <= halfHeight;
  }

  /**
   * Check if a point collides with any ship's deck boundary
   * @param point Point to test
   * @param ships Map of all ships
   * @returns Object with ship info if on a ship, null otherwise
   */
  checkShipBoundary(
    point: { x: number; y: number },
    ships: Map<string, Ship>
  ): { shipId: string; relativePosition: { x: number; y: number } } | null {
    let foundShip: string | null = null;
    let shipRelativePos: { x: number; y: number } | null = null;

    ships.forEach((ship) => {
      // Use OBB collision to check if player is on rotated ship deck
      const isOnDeck = this.isPointInRotatedRect(
        point,
        { x: ship.sprite.x, y: ship.sprite.y },
        ship.deckBoundary,
        ship.rotation
      );

      if (isOnDeck) {
        // Calculate position relative to ship center (in ship's local space)
        const dx = point.x - ship.sprite.x;
        const dy = point.y - ship.sprite.y;

        // Rotate to ship-local coordinates using isometric rotation (i2m-true-isometric)
        const offset = { x: dx, y: dy };
        const localPos = IsoMath.rotatePointIsometric(offset, -ship.rotation);

        foundShip = ship.id;
        shipRelativePos = { x: localPos.x, y: localPos.y }; // Store in ship-local coords
      }
    });

    if (foundShip && shipRelativePos) {
      return { shipId: foundShip, relativePosition: shipRelativePos };
    }
    return null;
  }

  /**
   * Check tile collision at a world position
   * @param worldX World X coordinate
   * @param worldY World Y coordinate
   * @returns Collision info with walkability, speed modifier, and terrain type
   */
  checkTileCollision(worldX: number, worldY: number): {
    walkable: boolean;
    speedModifier: number;
    terrain: string;
  } {
    // Offset collision check northward (negative Y) to account for 3D tile height
    // This prevents north-side penetration and allows south-side approach
    // Players can get close from south (appear in front), but blocked earlier from north
    const collisionOffsetY = -TILE_HEIGHT; // Check one full tile north
    const tilePos = this.map.worldToTileXY(worldX, worldY + collisionOffsetY);

    if (!tilePos) {
      // Out of bounds
      return { walkable: false, speedModifier: 0, terrain: 'boundary' };
    }

    // Floor the coordinates to ensure integer tile indices
    const tileX = Math.floor(tilePos.x);
    const tileY = Math.floor(tilePos.y);

    // Check map boundaries
    if (tileX < 0 || tileY < 0 || tileX >= this.map.width || tileY >= this.map.height) {
      return { walkable: false, speedModifier: 0, terrain: 'boundary' };
    }

    // Check obstacle layer first (highest priority)
    if (this.obstacleLayer) {
      const obstacleTile = this.obstacleLayer.getTileAt(tileX, tileY);
      if (obstacleTile) {
        const walkable = obstacleTile.properties.walkable ?? true;
        if (!walkable) {
          return {
            walkable: false,
            speedModifier: 0,
            terrain: obstacleTile.properties.terrain || 'wall'
          };
        }
      }
    }

    // Check Tile Layer 2 (blocks movement by default if tile exists)
    if (this.secondLayer) {
      const tile = this.secondLayer.getTileAt(tileX, tileY);
      if (tile) {
        // Default to blocking (false) if tile exists, unless explicitly set to walkable
        const walkable = tile.properties.walkable ?? false;
        if (!walkable) {
          return {
            walkable: false,
            speedModifier: 0,
            terrain: tile.properties.terrain || 'obstacle'
          };
        }
      }
    }

    // Check water layer (affects speed)
    if (this.waterLayer) {
      const waterTile = this.waterLayer.getTileAt(tileX, tileY);
      if (waterTile) {
        return {
          walkable: true,
          speedModifier: waterTile.properties.speedModifier ?? 0.5,
          terrain: waterTile.properties.terrain || 'water'
        };
      }
    }

    // Default to ground tile (walkable, normal speed)
    const groundTile = this.groundLayer.getTileAt(tileX, tileY);
    if (groundTile) {
      return {
        walkable: groundTile.properties.walkable ?? true,
        speedModifier: groundTile.properties.speedModifier ?? 1.0,
        terrain: groundTile.properties.terrain || 'grass'
      };
    }

    // No tile found - treat as walkable
    return { walkable: true, speedModifier: 1.0, terrain: 'grass' };
  }
}
