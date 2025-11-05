import Phaser from 'phaser';
import { MEWClient } from '@mew-protocol/mew/client';
import { TILE_WIDTH, TILE_HEIGHT, TILE_VISUAL_HEIGHT } from '../utils/Constants.js';
import { ViewportManager } from '../utils/ViewportManager.js';

/**
 * Manages map loading, tileset generation, and navigation data for the isometric game world.
 *
 * This manager handles all aspects of the game map including loading Tiled JSON maps,
 * generating procedural tileset textures, creating depth-sorted sprites for environmental
 * objects, and extracting navigation data for AI pathfinding.
 *
 * Responsibilities:
 * - Generate isometric tileset textures procedurally
 * - Load Tiled JSON maps and create Phaser tilemap layers
 * - Create individual sprites from Layer 2 tiles for per-object depth sorting
 * - Extract and broadcast navigation data to ship AI systems
 * - Provide map data access to other managers (collision, rendering)
 *
 * Dependencies:
 * - Phaser.Tilemaps for tilemap rendering
 * - MEWClient for sending navigation data to ships
 *
 * @example
 * ```typescript
 * const mapManager = new MapManager(scene, mewClient);
 *
 * // In scene.create():
 * mapManager.generateTilesetTexture();
 * mapManager.loadTiledMap();
 *
 * // Access map data in other systems:
 * const groundLayer = mapManager.getGroundLayer();
 * const map = mapManager.getMap();
 * ```
 */
export class MapManager {
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private secondLayer?: Phaser.Tilemaps.TilemapLayer;
  private secondLayerSprites: Phaser.GameObjects.Sprite[] = [];
  private obstacleLayer?: Phaser.Tilemaps.TilemapLayer;
  private waterLayer?: Phaser.Tilemaps.TilemapLayer;
  private visibilityUpdateCounter = 0; // d7v-diamond-viewport: Performance optimization

  // Tile alpha tracking for smooth fade animations (smooth-visibility-transitions)
  private tileAlphaState: Map<string, number> = new Map(); // Key: "layer:x:y", Value: current alpha
  private spriteAlphaState: Map<Phaser.GameObjects.Sprite, number> = new Map(); // Track sprite alphas

  // Border frame system (smooth-visibility-transitions)
  private borderRows = [
    { distance: 1, alpha: 0.88 }, // Outermost border row: 88% opacity
    { distance: 2, alpha: 0.45 }, // Middle border row: 45% opacity
    { distance: 3, alpha: 0.10 }, // Innermost border row: 10% opacity
  ];
  private isPlayerMoving = false;
  private lastPlayerPosition = { x: 0, y: 0 };
  private movementCheckTimer = 0;

  constructor(
    private scene: Phaser.Scene,
    private client: MEWClient
  ) {}

  /**
   * Generate a simple tileset texture with different colored tiles
   */
  generateTilesetTexture(): void {
    const tilesetWidth = 512;
    const tilesetHeight = 128;
    const graphics = this.scene.add.graphics();

    // Tile colors: Match your actual cube tiles
    const tileColors = [
      0xd4b896, // 0: sand/tan cube
      0x5a9547, // 1: grass (green cube)
      0x5ba3d4, // 2: water (blue cube)
      0x4a4a4a, // 3: concrete/dark cube (wall)
      0x808080  // 4: stone (light gray) - unused
    ];

    // Draw tiles in a grid (8 columns × 4 rows = 32 tiles)
    for (let tileId = 0; tileId < 32; tileId++) {
      const col = tileId % 8;
      const row = Math.floor(tileId / 8);
      const x = col * TILE_WIDTH;
      const y = row * TILE_HEIGHT;

      // Use color for first 5 tiles, then repeat pattern
      const colorIndex = tileId < 5 ? tileId : tileId % 5;
      const color = tileColors[colorIndex];

      // Draw isometric diamond tile
      graphics.fillStyle(color, 1);
      graphics.lineStyle(1, 0x000000, 0.3);

      graphics.beginPath();
      graphics.moveTo(x + TILE_WIDTH / 2, y);                              // Top
      graphics.lineTo(x + TILE_WIDTH, y + TILE_HEIGHT / 2);               // Right
      graphics.lineTo(x + TILE_WIDTH / 2, y + TILE_HEIGHT);               // Bottom
      graphics.lineTo(x, y + TILE_HEIGHT / 2);                            // Left
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    // Generate texture from graphics
    graphics.generateTexture('terrain', tilesetWidth, tilesetHeight);
    graphics.destroy();
  }

  /**
   * Load Tiled map and create layers
   */
  loadTiledMap(): void {
    // Create tilemap from Tiled JSON
    this.map = this.scene.make.tilemap({ key: 'map' });

    // Add tileset (name from Tiled must match)
    const tileset = this.map.addTilesetImage('terrain', 'terrain');

    if (!tileset) {
      console.error('Failed to load tileset');
      return;
    }

    // Create layers - map1.tmj has "Tile Layer 1"
    const ground = this.map.createLayer('Tile Layer 1', tileset, 0, 0);
    if (ground) {
      this.groundLayer = ground;
    } else {
      // Fallback to original layer names if using example map
      const fallbackGround = this.map.createLayer('Ground', tileset, 0, 0);
      if (fallbackGround) {
        this.groundLayer = fallbackGround;
      }
    }

    // Create "Tile Layer 2" if it exists
    // Convert to individual sprites for per-tile depth sorting
    if (this.map.getLayer('Tile Layer 2')) {
      const layer2 = this.map.createLayer('Tile Layer 2', tileset, 0, 0);
      if (layer2) {
        this.secondLayer = layer2;

        // Create individual sprites for each tile using render texture approach
        for (let tileY = 0; tileY < this.map.height; tileY++) {
          for (let tileX = 0; tileX < this.map.width; tileX++) {
            const tile = layer2.getTileAt(tileX, tileY);
            if (tile) {
              const worldPos = this.map.tileToWorldXY(tileX, tileY);
              if (worldPos) {
                // Use Phaser's tile texture data directly
                const tileTexture = tile.tileset?.image;
                if (!tileTexture) continue;

                // Get the tile's source position from Phaser's tileset
                const tileData = tile.tileset?.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
                if (!tileData) continue;

                // Create a unique frame for this tile
                const frameName = `tile_layer2_${tileX}_${tileY}`;
                const terrainTexture = this.scene.textures.get('terrain');

                if (!terrainTexture.has(frameName)) {
                  // Extract tile with extra height for 3D appearance
                  terrainTexture.add(
                    frameName,
                    0,
                    tileData.x,
                    tileData.y,
                    TILE_WIDTH,
                    TILE_VISUAL_HEIGHT
                  );
                }

                // Create sprite at exact position where tilemap would render it
                // Position at full visual height (32px) to align bottom with ground
                const sprite = this.scene.add.sprite(
                  worldPos.x + TILE_WIDTH / 2,
                  worldPos.y + TILE_VISUAL_HEIGHT,
                  'terrain',
                  frameName
                );
                sprite.setOrigin(0.5, 1); // Center-bottom origin

                // Layer 2 renders above or below player dynamically
                sprite.setDepth(10000);

                this.secondLayerSprites.push(sprite);
              }
            }
          }
        }

        // Hide original layer
        layer2.setVisible(false);
      }
    }

    // Create Obstacles layer if it exists
    if (this.map.getLayer('Obstacles')) {
      const obstacles = this.map.createLayer('Obstacles', tileset, 0, 0);
      if (obstacles) {
        this.obstacleLayer = obstacles;
      }
    }

    // Create Water layer if it exists
    if (this.map.getLayer('Water')) {
      const water = this.map.createLayer('Water', tileset, 0, 0);
      if (water) {
        this.waterLayer = water;
      }
    }

    console.log(`Map loaded: ${this.map.width}×${this.map.height} tiles`);

    // Initialize all tiles as hidden (smooth-visibility-transitions)
    // They will be shown by updateVisibleTiles() based on viewport
    this.initializeTileVisibility();

    // Send map navigation data to ships
    this.sendMapDataToShips();
  }

  /**
   * Initialize all tiles as hidden (smooth-visibility-transitions)
   * Called once when map loads to ensure only viewport tiles are visible
   */
  private initializeTileVisibility(): void {
    // Hide all tiles in all layers
    const layers = [this.groundLayer, this.obstacleLayer, this.waterLayer, this.secondLayer].filter(Boolean);

    layers.forEach((layer) => {
      if (!layer) return;

      for (let tileY = 0; tileY < this.map.height; tileY++) {
        for (let tileX = 0; tileX < this.map.width; tileX++) {
          const tile = layer.getTileAt(tileX, tileY);
          if (tile) {
            tile.setVisible(false);
            tile.setAlpha(0);
          }
        }
      }
    });

    // Hide all second layer sprites
    this.secondLayerSprites.forEach((sprite) => {
      sprite.setVisible(false);
      sprite.setAlpha(0);
    });

    console.log('All tiles initialized as hidden - will fade in based on viewport');
  }

  /**
   * Extract navigation data and send to ships
   */
  sendMapDataToShips(): void {
    // Extract navigable tile data for ship collision detection
    const navigableTiles: boolean[][] = [];
    let navigableCount = 0;
    let nonNavigableCount = 0;

    for (let y = 0; y < this.map.height; y++) {
      navigableTiles[y] = [];
      for (let x = 0; x < this.map.width; x++) {
        // Check if tile is navigable (for ships - should be water)
        const tile = this.groundLayer.getTileAt(x, y);
        const isNavigable = tile?.properties?.navigable === true;
        navigableTiles[y][x] = isNavigable;

        if (isNavigable) {
          navigableCount++;
        } else {
          nonNavigableCount++;
        }
      }
    }

    console.log(`Map navigation data: ${navigableCount} navigable tiles, ${nonNavigableCount} non-navigable tiles`);

    // Determine map orientation
    // Phaser uses numeric constants: 0=orthogonal, 1=isometric, 2=staggered, 3=hexagonal
    const rawOrientation = this.map.orientation;
    const orientationNum = Number(rawOrientation);
    const orientation = (orientationNum === 1 || String(rawOrientation).toLowerCase() === 'isometric') ?
      'isometric' as const :
      'orthogonal' as const;

    console.log(`Map orientation: ${rawOrientation} -> ${orientation}`);

    const mapData = {
      tileWidth: TILE_WIDTH,
      tileHeight: TILE_HEIGHT,
      mapWidth: this.map.width,
      mapHeight: this.map.height,
      navigableTiles,
      orientation,
    };

    // Send to all ships (broadcast since we don't know ship IDs yet)
    this.client.send({
      kind: 'ship/map_data',
      to: [], // Broadcast to all participants
      payload: mapData,
    });
  }

  // Getters for accessing map data
  getMap(): Phaser.Tilemaps.Tilemap {
    return this.map;
  }

  getGroundLayer(): Phaser.Tilemaps.TilemapLayer {
    return this.groundLayer;
  }

  getSecondLayer(): Phaser.Tilemaps.TilemapLayer | undefined {
    return this.secondLayer;
  }

  getSecondLayerSprites(): Phaser.GameObjects.Sprite[] {
    return this.secondLayerSprites;
  }

  getObstacleLayer(): Phaser.Tilemaps.TilemapLayer | undefined {
    return this.obstacleLayer;
  }

  getWaterLayer(): Phaser.Tilemaps.TilemapLayer | undefined {
    return this.waterLayer;
  }

  /**
   * Updates visible tiles based on diamond viewport culling (d7v-diamond-viewport)
   * Animates tiles in/out smoothly with border frame system (smooth-visibility-transitions)
   * Call this from GameScene.update() with player position every frame
   *
   * @param centerX - Player world X coordinate (viewport center)
   * @param centerY - Player world Y coordinate (viewport center)
   */
  updateVisibleTiles(centerX: number, centerY: number): void {
    if (!this.map) return;

    // Check if player is moving (border frame system)
    const dx = Math.abs(centerX - this.lastPlayerPosition.x);
    const dy = Math.abs(centerY - this.lastPlayerPosition.y);
    const movementThreshold = 1; // pixels

    if (dx > movementThreshold || dy > movementThreshold) {
      this.isPlayerMoving = true;
      this.movementCheckTimer = 0;
      this.lastPlayerPosition = { x: centerX, y: centerY };
    } else {
      // Player hasn't moved - start timer to fade out border
      this.movementCheckTimer++;
      // After 60 frames (~1 second) of no movement, start fading border
      if (this.movementCheckTimer > 60) {
        this.isPlayerMoving = false;
      }
    }

    // Update ground layer visibility
    if (this.groundLayer) {
      this.updateLayerVisibility(this.groundLayer, 'ground', centerX, centerY);
    }

    // Update second layer sprites visibility with animated fade (smooth-visibility-transitions)
    // OPTIMIZED: Only check sprites that could be near viewport
    const centerTilePos = this.map.worldToTileXY(centerX, centerY);
    if (centerTilePos) {
      // Ensure integer tile coordinates
      const centerTileX = Math.floor(centerTilePos.x);
      const centerTileY = Math.floor(centerTilePos.y);
      const radiusTiles = ViewportManager.getDiamondRadiusTiles();

      const maxBorderDistance = this.borderRows[this.borderRows.length - 1].distance;

      this.secondLayerSprites.forEach((sprite) => {
        // Convert sprite world position to tile coordinates
        const spriteTilePos = this.map.worldToTileXY(sprite.x, sprite.y);
        if (!spriteTilePos) return;

        // Ensure integer tile coordinates
        const spriteTileX = Math.floor(spriteTilePos.x);
        const spriteTileY = Math.floor(spriteTilePos.y);

        // Calculate distance from diamond edge
        const dx = Math.abs(spriteTileX - centerTileX);
        const dy = Math.abs(spriteTileY - centerTileY);
        const maxDist = Math.max(dx, dy);
        const distanceFromEdge = maxDist - radiusTiles;

        // Quick cleanup check - force hide if too far
        if (distanceFromEdge > maxBorderDistance + 5) {
          if (sprite.visible) {
            sprite.setVisible(false);
            sprite.setAlpha(0);
            this.spriteAlphaState.set(sprite, 0);
          }
          return;
        }

        // Get current alpha (default to 0 for new sprites)
        const currentAlpha = this.spriteAlphaState.get(sprite) ?? 0;

        // Determine target alpha based on border frame system
        let targetAlpha = 0.0;

        if (distanceFromEdge <= 0) {
          // Core area (inside diamond): always fully visible
          targetAlpha = 1.0;
        } else {
          // Check if sprite is in a border row
          for (const borderRow of this.borderRows) {
            if (distanceFromEdge === borderRow.distance) {
              // Sprite is in this border row
              // Show border at fixed alpha if moving, else fade to 0
              targetAlpha = this.isPlayerMoving ? borderRow.alpha : 0.0;
              break;
            }
          }
          // If not in any border row, targetAlpha stays 0
        }

        // Animate toward target (slow lerp: 0.05 per frame = ~20 frames to complete)
        const newAlpha = currentAlpha + (targetAlpha - currentAlpha) * 0.05;

        // Update sprite
        if (newAlpha > 0.01) {
          sprite.setVisible(true);
          sprite.setAlpha(newAlpha);
          this.spriteAlphaState.set(sprite, newAlpha);
        } else {
          sprite.setVisible(false);
          sprite.setAlpha(0);
          this.spriteAlphaState.set(sprite, 0);
        }
      });
    }

    // Update obstacle layer visibility
    if (this.obstacleLayer) {
      this.updateLayerVisibility(this.obstacleLayer, 'obstacle', centerX, centerY);
    }

    // Update water layer visibility
    if (this.waterLayer) {
      this.updateLayerVisibility(this.waterLayer, 'water', centerX, centerY);
    }
  }

  /**
   * Helper method to update visibility for a tilemap layer
   * Uses border frame system with predictable opacity rows (smooth-visibility-transitions)
   * OPTIMIZED: Only checks tiles near viewport, not entire map
   */
  private updateLayerVisibility(
    layer: Phaser.Tilemaps.TilemapLayer,
    layerName: string,
    centerX: number,
    centerY: number
  ): void {
    // Convert center world position to tile coordinates using Phaser's isometric conversion
    const centerTilePos = this.map.worldToTileXY(centerX, centerY);
    if (!centerTilePos) return;

    // Ensure integer tile coordinates (worldToTileXY can return floats)
    const centerTileX = Math.floor(centerTilePos.x);
    const centerTileY = Math.floor(centerTilePos.y);
    const radiusTiles = ViewportManager.getDiamondRadiusTiles();

    // Calculate max border distance for optimization
    const maxBorderDistance = this.borderRows[this.borderRows.length - 1].distance;
    const checkMargin = maxBorderDistance + 5; // Extra margin for cleanup
    const minTileX = Math.max(0, Math.floor(centerTileX - radiusTiles - checkMargin));
    const maxTileX = Math.min(this.map.width - 1, Math.ceil(centerTileX + radiusTiles + checkMargin));
    const minTileY = Math.max(0, Math.floor(centerTileY - radiusTiles - checkMargin));
    const maxTileY = Math.min(this.map.height - 1, Math.ceil(centerTileY + radiusTiles + checkMargin));

    // Process tiles in viewport area
    for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        const tile = layer.getTileAt(tileX, tileY);
        if (!tile) continue;

        // Calculate distance from diamond edge
        const dx = Math.abs(tileX - centerTileX);
        const dy = Math.abs(tileY - centerTileY);
        const maxDist = Math.max(dx, dy); // Chebyshev distance for square diamond
        const distanceFromEdge = maxDist - radiusTiles;

        // Get current alpha (default to 0 for new tiles)
        const tileKey = `${layerName}:${tileX}:${tileY}`;
        const currentAlpha = this.tileAlphaState.get(tileKey) ?? 0;

        // Determine target alpha based on border frame system
        let targetAlpha = 0.0;

        if (distanceFromEdge <= 0) {
          // Core area (inside diamond): always fully visible
          targetAlpha = 1.0;
        } else {
          // Check if tile is in a border row
          for (const borderRow of this.borderRows) {
            if (distanceFromEdge === borderRow.distance) {
              // Tile is in this border row
              // Show border at fixed alpha if moving, else fade to 0
              targetAlpha = this.isPlayerMoving ? borderRow.alpha : 0.0;
              break;
            }
          }
          // If not in any border row, targetAlpha stays 0
        }

        // Animate toward target (slow lerp: 0.05 per frame = ~20 frames to complete at 60fps)
        const newAlpha = currentAlpha + (targetAlpha - currentAlpha) * 0.05;

        // Update tile
        if (newAlpha > 0.01) {
          tile.setVisible(true);
          tile.setAlpha(newAlpha);
          this.tileAlphaState.set(tileKey, newAlpha);
        } else {
          tile.setVisible(false);
          tile.setAlpha(0);
          this.tileAlphaState.set(tileKey, 0);
        }
      }
    }

    // Cleanup: Force-hide tiles far outside all borders
    const cleanupDistance = maxBorderDistance + 5;
    for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
        const dx = Math.abs(tileX - centerTileX);
        const dy = Math.abs(tileY - centerTileY);
        const maxDist = Math.max(dx, dy);
        const distanceFromEdge = maxDist - radiusTiles;

        if (distanceFromEdge > cleanupDistance) {
          const tile = layer.getTileAt(tileX, tileY);
          if (tile && tile.visible) {
            tile.setVisible(false);
            tile.setAlpha(0);
            const tileKey = `${layerName}:${tileX}:${tileY}`;
            this.tileAlphaState.set(tileKey, 0);
          }
        }
      }
    }
  }
}
