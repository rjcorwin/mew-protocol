import Phaser from 'phaser';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Player, Ship, Direction } from '../types.js';

const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;
const TILE_VISUAL_HEIGHT = 32; // Actual height of tiles with 3D depth in tileset
const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 20;
const MOVE_SPEED = 100; // pixels per second
const POSITION_UPDATE_RATE = 100; // ms between position updates

// Isometric movement basis vectors (i2m-true-isometric Phase 1)
// Calculated from tile dimensions and normalized for consistent movement speed
const ISO_X_AXIS = { x: TILE_WIDTH / 2, y: TILE_HEIGHT / 2 }; // Southeast direction
const ISO_Y_AXIS = { x: TILE_WIDTH / 2, y: -TILE_HEIGHT / 2 }; // Northeast direction
const isoXLength = Math.sqrt(ISO_X_AXIS.x ** 2 + ISO_X_AXIS.y ** 2);
const isoYLength = Math.sqrt(ISO_Y_AXIS.x ** 2 + ISO_Y_AXIS.y ** 2);
const ISO_NORTHEAST = { x: ISO_Y_AXIS.x / isoYLength, y: ISO_Y_AXIS.y / isoYLength };
const ISO_SOUTHEAST = { x: ISO_X_AXIS.x / isoXLength, y: ISO_X_AXIS.y / isoXLength };
const ISO_SOUTHWEST = { x: -ISO_NORTHEAST.x, y: -ISO_NORTHEAST.y };
const ISO_NORTHWEST = { x: -ISO_SOUTHEAST.x, y: -ISO_SOUTHEAST.y };

export class GameScene extends Phaser.Scene {
  private client!: MEWClient;
  private playerId!: string;
  private localPlayer!: Phaser.GameObjects.Sprite;
  private remotePlayers: Map<string, Player> = new Map();
  private ships: Map<string, Ship> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private streamId: string | null = null;
  private lastPositionUpdate = 0;
  private lastFacing: Direction = 'south'; // Default facing direction
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private secondLayer?: Phaser.Tilemaps.TilemapLayer;
  private secondLayerSprites: Phaser.GameObjects.Sprite[] = []; // Individual sprites for depth sorting
  private obstacleLayer?: Phaser.Tilemaps.TilemapLayer;
  private waterLayer?: Phaser.Tilemaps.TilemapLayer;
  private shallowWaterGraphics!: Phaser.GameObjects.Graphics; // Semi-transparent water overlay for sand tiles
  private controllingShip: string | null = null;
  private controllingPoint: 'wheel' | 'sails' | 'mast' | 'cannon' | null = null;
  private onShip: string | null = null; // Track if local player is on a ship
  private shipRelativePosition: { x: number; y: number } | null = null; // Position relative to ship center
  private applyingShipRotation = false; // Flag to prevent overwriting rotated position
  private currentWheelDirection: 'left' | 'right' | null = null; // Track wheel turning state (w3l-wheel-steering)
  private controllingCannon: { side: 'port' | 'starboard', index: number } | null = null; // Track cannon control (c5x-ship-combat)
  private currentCannonAim: number = 0; // Track cannon aim angle in radians (c5x-ship-combat)
  private nearControlPoints: Set<string> = new Set(); // Track which control points player is near (format: "shipId:wheel" or "shipId:sails" or "shipId:cannon-port-0")
  private lastPlayerWaveOffset: number = 0; // Track last wave offset for smooth bobbing

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load actual tileset image
    this.load.image('terrain', 'assets/maps/terrain.png');

    // Load Tiled map
    this.load.tilemapTiledJSON('map', 'assets/maps/small-map.tmj');

    // Load player sprite sheet (8 directions, 4 frames each)
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    // Get client and player ID from registry
    this.client = this.registry.get('mewClient') as MEWClient;
    this.playerId = this.registry.get('playerId') as string;

    // Load Tiled map
    this.loadTiledMap();

    // Create graphics for shallow water overlay (renders on top of sand)
    this.shallowWaterGraphics = this.add.graphics();
    this.shallowWaterGraphics.setDepth(0.5); // Between ground (0) and ships (0)

    // Create 8-direction walk animations
    this.createPlayerAnimations();

    // Set up camera bounds based on map dimensions
    const camera = this.cameras.main;
    const minX = -(this.map.height - 1) * (TILE_WIDTH / 2);
    const maxX = (this.map.width - 1) * (TILE_WIDTH / 2);
    const maxY = (this.map.width + this.map.height - 1) * (TILE_HEIGHT / 2);
    camera.setBounds(minX, 0, maxX - minX, maxY);

    // Create local player sprite at center of grid
    // Center tile (10, 10) in isometric coordinates
    const centerX = (10 - 10) * (TILE_WIDTH / 2); // = 0
    const centerY = (10 + 10) * (TILE_HEIGHT / 2); // = 320
    this.localPlayer = this.add.sprite(centerX, centerY, 'player');
    this.localPlayer.setOrigin(0.5, 0.8);
    // Depth is set dynamically in update() based on Y position

    // Set up camera to follow player
    camera.startFollow(this.localPlayer, true, 0.1, 0.1);

    // Zoom in camera for closer view
    camera.setZoom(1.5);

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Request stream for position updates
    this.requestPositionStream();

    // Subscribe to position updates from other players
    this.subscribeToPositionUpdates();

    console.log(`Game started as ${this.playerId}`);
  }

  private generateTilesetTexture() {
    // Generate a simple tileset texture with different colored tiles
    const tilesetWidth = 512;
    const tilesetHeight = 128;
    const graphics = this.add.graphics();

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

  private loadTiledMap() {
    // Create tilemap from Tiled JSON
    this.map = this.make.tilemap({ key: 'map' });

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
                const terrainTexture = this.textures.get('terrain');

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
                const sprite = this.add.sprite(
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

    // Send map navigation data to ships
    this.sendMapDataToShips();
  }

  private sendMapDataToShips() {
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

    console.log(`Sent map navigation data: ${this.map.width}×${this.map.height} tiles, orientation: ${orientation}`);
  }

  private createPlayerAnimations() {
    // Create 8 directional walk animations
    // Sprite sheet layout: 8 rows (directions) × 4 columns (frames)
    const directions = [
      'south',     // Row 0: Walking down
      'southwest', // Row 1
      'west',      // Row 2: Walking left
      'northwest', // Row 3
      'north',     // Row 4: Walking up
      'northeast', // Row 5
      'east',      // Row 6: Walking right
      'southeast', // Row 7
    ];

    directions.forEach((dir, row) => {
      this.anims.create({
        key: `walk-${dir}`,
        frames: this.anims.generateFrameNumbers('player', {
          start: row * 4,
          end: row * 4 + 3,
        }),
        frameRate: 10,
        repeat: -1, // Loop indefinitely
      });
    });

    console.log('Created 8 directional walk animations');
  }

  private updatePlayerAnimation(sprite: Phaser.GameObjects.Sprite, velocity: Phaser.Math.Vector2): Direction {
    // Calculate direction from velocity
    const direction = this.calculateDirection(velocity);

    // Play corresponding walk animation (true = ignore if already playing)
    sprite.play(`walk-${direction}`, true);

    return direction;
  }

  private calculateDirection(velocity: Phaser.Math.Vector2): Direction {
    // Calculate angle from velocity vector
    const angle = Math.atan2(velocity.y, velocity.x);

    // Quantize to nearest 45° increment (8 directions)
    // Add 8 and mod 8 to handle negative angles
    const directionIndex = (Math.round(angle / (Math.PI / 4)) + 8) % 8;

    // Map angle to direction name
    const directions: Direction[] = [
      'east',      // 0° (right)
      'southeast', // 45°
      'south',     // 90° (down)
      'southwest', // 135°
      'west',      // 180° (left)
      'northwest', // 225°
      'north',     // 270° (up)
      'northeast', // 315°
    ];

    return directions[directionIndex];
  }

  private async requestPositionStream() {
    // Use a shared stream name for all players
    this.streamId = 'mew-world-positions';
    console.log(`Using shared position stream: ${this.streamId}`);
  }

  private subscribeToPositionUpdates() {
    // Subscribe to position messages from all participants
    this.client.onMessage((envelope: any) => {
      if (envelope.kind === 'game/position') {
        try {
          const update: PositionUpdate = envelope.payload;

          // Ignore our own updates
          if (update.participantId === this.playerId) {
            return;
          }

          // Check if this is a ship update
          if (update.shipData) {
            this.updateShip(update);
          } else {
            // Update or create remote player
            this.updateRemotePlayer(update);
          }
        } catch (error) {
          console.error('Failed to parse position update:', error);
        }
      }
    });
  }

  private updateRemotePlayer(update: PositionUpdate) {
    let player = this.remotePlayers.get(update.participantId);

    if (!player) {
      // Create new remote player
      const sprite = this.add.sprite(
        update.worldCoords.x,
        update.worldCoords.y,
        'player'
      );
      sprite.setOrigin(0.5, 0.8);
      sprite.setTint(0xff0000); // Red for remote players
      // Depth is set dynamically in update() based on Y position

      player = {
        id: update.participantId,
        sprite,
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
        lastUpdate: update.timestamp,
        velocity: update.velocity,
        platformRef: update.platformRef,
        onShip: null,
        lastWaveOffset: 0, // Initialize wave offset tracking
      };

      this.remotePlayers.set(update.participantId, player);
      console.log(`Remote player joined: ${update.participantId}`);
    } else {
      // Update existing player's target position
      player.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
      player.lastUpdate = update.timestamp;
      player.velocity = update.velocity;
    }

    // Update remote player animation based on received facing direction
    const velocityMagnitude = Math.sqrt(
      update.velocity.x ** 2 + update.velocity.y ** 2
    );

    if (velocityMagnitude > 0) {
      // Player is moving - play walk animation in the received direction
      player.sprite.play(`walk-${update.facing}`, true);
    } else {
      // Player is idle - stop animation
      player.sprite.anims.stop();
    }
  }

  private updateShip(update: PositionUpdate) {
    if (!update.shipData) return;

    let ship = this.ships.get(update.participantId);

    if (!ship) {
      // Create ship as a simple container with boundary dots drawn dynamically (i2m-true-isometric)
      // No sprite texture - just a graphics object that we'll redraw each frame
      const shipGraphics = this.add.graphics();
      shipGraphics.setDepth(0); // Below players

      // Create a dummy sprite for position/rotation tracking
      // We don't actually render this, but we need it for the Ship interface
      const shipSprite = this.add.sprite(
        update.worldCoords.x,
        update.worldCoords.y,
        '' // No texture
      );
      shipSprite.setVisible(false); // Hide the sprite, we'll draw with graphics
      shipSprite.setOrigin(0.5, 0.5);

      // Create control point indicators
      const wheelGraphics = this.add.graphics();
      const sailsGraphics = this.add.graphics();
      const mastGraphics = this.add.graphics();

      // Calculate relative positions from world positions
      const wheelRelative = {
        x: update.shipData.controlPoints.wheel.worldPosition.x - update.worldCoords.x,
        y: update.shipData.controlPoints.wheel.worldPosition.y - update.worldCoords.y,
      };
      const sailsRelative = {
        x: update.shipData.controlPoints.sails.worldPosition.x - update.worldCoords.x,
        y: update.shipData.controlPoints.sails.worldPosition.y - update.worldCoords.y,
      };
      // Mast is at center of ship (crow's nest for better view)
      const mastRelative = { x: 0, y: 0 };

      console.log(`Ship ${update.participantId} created:`);
      console.log(`  Ship position: (${update.worldCoords.x}, ${update.worldCoords.y})`);
      console.log(`  Deck boundary: ${update.shipData.deckBoundary.width}x${update.shipData.deckBoundary.height}`);
      console.log(`  Wheel world: (${update.shipData.controlPoints.wheel.worldPosition.x}, ${update.shipData.controlPoints.wheel.worldPosition.y})`);
      console.log(`  Wheel relative: (${wheelRelative.x}, ${wheelRelative.y})`);
      console.log(`  Sails world: (${update.shipData.controlPoints.sails.worldPosition.x}, ${update.shipData.controlPoints.sails.worldPosition.y})`);
      console.log(`  Sails relative: (${sailsRelative.x}, ${sailsRelative.y})`);

      ship = {
        id: update.participantId,
        sprite: shipSprite,
        boundaryGraphics: shipGraphics, // Graphics object for drawing boundary dots
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
        rotation: update.shipData.rotation,
        lastUpdate: update.timestamp,
        velocity: update.velocity,
        controlPoints: {
          wheel: {
            sprite: wheelGraphics,
            relativePosition: wheelRelative,
            controlledBy: update.shipData.controlPoints.wheel.controlledBy,
          },
          sails: {
            sprite: sailsGraphics,
            relativePosition: sailsRelative,
            controlledBy: update.shipData.controlPoints.sails.controlledBy,
          },
          mast: {
            sprite: mastGraphics,
            relativePosition: mastRelative,
            controlledBy: null, // Client-side only, not synced
          },
        },
        // c5x-ship-combat: Initialize cannons if present
        cannons: update.shipData.cannons ? {
          port: update.shipData.cannons.port.map((cannonData) => ({
            sprite: this.add.graphics(),
            relativePosition: {
              x: cannonData.worldPosition.x - update.worldCoords.x,
              y: cannonData.worldPosition.y - update.worldCoords.y,
            },
            controlledBy: cannonData.controlledBy,
            aimAngle: cannonData.aimAngle,
            cooldownRemaining: cannonData.cooldownRemaining,
          })),
          starboard: update.shipData.cannons.starboard.map((cannonData) => ({
            sprite: this.add.graphics(),
            relativePosition: {
              x: cannonData.worldPosition.x - update.worldCoords.x,
              y: cannonData.worldPosition.y - update.worldCoords.y,
            },
            controlledBy: cannonData.controlledBy,
            aimAngle: cannonData.aimAngle,
            cooldownRemaining: cannonData.cooldownRemaining,
          })),
        } : undefined,
        speedLevel: update.shipData.speedLevel,
        deckBoundary: update.shipData.deckBoundary,
        lastWaveOffset: 0, // Initialize wave offset tracking
      };

      // Set initial rotation
      shipSprite.setRotation(update.shipData.rotation);

      this.ships.set(update.participantId, ship);
      console.log(`Ship joined: ${update.participantId}`);

      // Send map data to newly joined ship
      this.sendMapDataToShips();
    } else {
      // Update existing ship
      ship.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
      ship.rotation = update.shipData.rotation;
      ship.lastUpdate = update.timestamp;
      ship.velocity = update.velocity;
      ship.speedLevel = update.shipData.speedLevel;
      ship.controlPoints.wheel.controlledBy = update.shipData.controlPoints.wheel.controlledBy;
      ship.controlPoints.sails.controlledBy = update.shipData.controlPoints.sails.controlledBy;

      // c5x-ship-combat: Update cannon state
      if (update.shipData.cannons && ship.cannons) {
        ship.cannons.port.forEach((cannon, index) => {
          if (update.shipData.cannons!.port[index]) {
            const serverCannon = update.shipData.cannons!.port[index];
            cannon.controlledBy = serverCannon.controlledBy;
            cannon.aimAngle = serverCannon.aimAngle;
            cannon.cooldownRemaining = serverCannon.cooldownRemaining;
            if (serverCannon.cooldownRemaining > 0) {
              console.log(`Port cannon ${index} cooldown update: ${serverCannon.cooldownRemaining}ms`);
            }
          }
        });
        ship.cannons.starboard.forEach((cannon, index) => {
          if (update.shipData.cannons!.starboard[index]) {
            const serverCannon = update.shipData.cannons!.starboard[index];
            cannon.controlledBy = serverCannon.controlledBy;
            cannon.aimAngle = serverCannon.aimAngle;
            cannon.cooldownRemaining = serverCannon.cooldownRemaining;
            if (serverCannon.cooldownRemaining > 0) {
              console.log(`Starboard cannon ${index} cooldown update: ${serverCannon.cooldownRemaining}ms`);
            }
          }
        });
      }

      // Update ship sprite rotation
      ship.sprite.setRotation(update.shipData.rotation);

      // Phase C: Rotate players on deck when ship turns
      if (update.shipData.rotationDelta && Math.abs(update.shipData.rotationDelta) > 0.001) {
        const rotationDelta = update.shipData.rotationDelta;
        console.log(`Ship ${ship.id} rotated by ${(rotationDelta * 180 / Math.PI).toFixed(1)}°`);

        // Rotate local player if on this ship
        if (this.onShip === ship.id && this.shipRelativePosition) {
          // Flag that we're applying rotation (don't recalculate shipRelativePosition this frame)
          this.applyingShipRotation = true;

          // Apply rotation to player's world position using isometric rotation
          // Note: We use ship.rotation (total angle), NOT rotationDelta
          // This matches how ship boundary corners are calculated (no accumulated error)
          const rotatedWorldPos = this.rotatePointIsometric(this.shipRelativePosition, ship.rotation);
          this.localPlayer.x = ship.sprite.x + rotatedWorldPos.x;
          this.localPlayer.y = ship.sprite.y + rotatedWorldPos.y;

          console.log(`Player rotated to world pos (${this.localPlayer.x.toFixed(1)}, ${this.localPlayer.y.toFixed(1)})`);
        }

        // Rotate remote players on this ship
        this.remotePlayers.forEach((player) => {
          if (player.onShip === ship.id) {
            // Note: We need to add shipRelativePosition to Player type
            // For now, this will handle future implementation
            console.log(`Remote player ${player.id} should rotate on ship ${ship.id}`);
          }
        });
      }
    }

    // Draw ship boundary and control point indicators at current ship position
    this.drawShipBoundary(ship.boundaryGraphics, ship.sprite, ship.deckBoundary, ship.rotation);
    this.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite, this.nearControlPoints.has(`${ship.id}:wheel`));
    this.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite, this.nearControlPoints.has(`${ship.id}:sails`));
    this.drawControlPoint(ship.controlPoints.mast.sprite, ship.controlPoints.mast, ship.sprite, this.nearControlPoints.has(`${ship.id}:mast`), 'mast');

    // c5x-ship-combat: Draw cannon control points
    if (ship.cannons) {
      ship.cannons.port.forEach((cannon, index) => {
        const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-port-${index}`);
        const isControlledByUs = this.controllingShip === ship.id &&
                                  this.controllingPoint === 'cannon' &&
                                  this.controllingCannon?.side === 'port' &&
                                  this.controllingCannon?.index === index;
        this.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs);
      });
      ship.cannons.starboard.forEach((cannon, index) => {
        const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-starboard-${index}`);
        const isControlledByUs = this.controllingShip === ship.id &&
                                  this.controllingPoint === 'cannon' &&
                                  this.controllingCannon?.side === 'starboard' &&
                                  this.controllingCannon?.index === index;
        this.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs);
      });
    }
  }

  private drawControlPoint(
    graphics: Phaser.GameObjects.Graphics,
    controlPoint: { relativePosition: { x: number; y: number }; controlledBy: string | null },
    shipSprite: Phaser.GameObjects.Sprite,
    isPlayerNear: boolean = false,
    type: 'wheel' | 'sails' | 'mast' = 'wheel'
  ) {
    graphics.clear();

    // Phase D: Rotate control point position with ship rotation using isometric rotation (i2m-true-isometric Phase 4)
    // Apply ship's rotation to the relative position to get rotated world position
    const rotatedPos = this.rotatePointIsometric(controlPoint.relativePosition, shipSprite.rotation);
    const worldX = shipSprite.x + rotatedPos.x;
    const worldY = shipSprite.y + rotatedPos.y;

    // Draw a circle at the control point position
    // Yellow if player is near and can interact, red if controlled by other, green/brown if free
    let color: number;
    let opacity: number;
    if (isPlayerNear) {
      color = 0xffcc00; // Bright amber-yellow when player is close enough to interact
      opacity = 0.8; // Higher opacity for better visibility
    } else if (controlPoint.controlledBy) {
      color = 0xff0000; // Red if controlled by someone
      opacity = 0.5;
    } else {
      // Different color for mast (brown) vs other controls (green)
      color = type === 'mast' ? 0x8b4513 : 0x00ff00; // Brown for mast, green for others
      opacity = 0.5;
    }

    graphics.fillStyle(color, opacity);
    graphics.fillCircle(worldX, worldY, 8);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(worldX, worldY, 8);
  }

  /**
   * Draw cannon control point with aim arc (c5x-ship-combat)
   */
  private drawCannon(
    graphics: Phaser.GameObjects.Graphics,
    cannon: { relativePosition: { x: number; y: number }; controlledBy: string | null; aimAngle: number; cooldownRemaining: number },
    shipSprite: Phaser.GameObjects.Sprite,
    shipRotation: number,
    isPlayerNear: boolean = false,
    isControlledByUs: boolean = false
  ) {
    graphics.clear();

    // Calculate cannon world position with isometric rotation
    const rotatedPos = this.rotatePointIsometric(cannon.relativePosition, shipRotation);
    const worldX = shipSprite.x + rotatedPos.x;
    const worldY = shipSprite.y + rotatedPos.y;

    // Determine cannon color based on state
    let color: number;
    let opacity: number;

    if (isPlayerNear) {
      color = 0xffff00; // Yellow if player is near
      opacity = 0.8;
    } else if (cannon.controlledBy) {
      color = 0xff0000; // Red if controlled by someone
      opacity = 0.5;
    } else {
      color = 0xff8800; // Orange for cannons (distinct from green controls)
      opacity = 0.5;
    }

    // Draw cannon control point
    graphics.fillStyle(color, opacity);
    graphics.fillCircle(worldX, worldY, 8);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(worldX, worldY, 8);

    // If controlled by us, draw aim arc and aim line
    if (isControlledByUs) {
      const maxAim = Math.PI / 4; // ±45°
      const aimLength = 60; // Length of aim indicator line

      // Determine which side cannon is on (port = left, starboard = right)
      // Port cannons aim to the left (negative Y in ship space)
      // Starboard cannons aim to the right (positive Y in ship space)
      const isPort = cannon.relativePosition.y < 0;
      const perpendicularAngle = isPort ? shipRotation - Math.PI / 2 : shipRotation + Math.PI / 2;

      // Draw aim arc (±45° from perpendicular)
      graphics.lineStyle(2, 0x00ffff, 0.5); // Cyan arc
      graphics.beginPath();
      graphics.arc(
        worldX,
        worldY,
        aimLength,
        perpendicularAngle - maxAim,
        perpendicularAngle + maxAim,
        false
      );
      graphics.strokePath();

      // Draw current aim line (use local aim for immediate feedback if we're controlling)
      const aimAngle = isControlledByUs ? this.currentCannonAim : cannon.aimAngle;
      const currentAimAngle = perpendicularAngle + aimAngle;
      const aimEndX = worldX + Math.cos(currentAimAngle) * aimLength;
      const aimEndY = worldY + Math.sin(currentAimAngle) * aimLength;

      graphics.lineStyle(3, 0xff00ff, 1); // Bright magenta aim line
      graphics.beginPath();
      graphics.moveTo(worldX, worldY);
      graphics.lineTo(aimEndX, aimEndY);
      graphics.strokePath();

      // Draw crosshair at end of aim line
      const crosshairSize = 8;
      graphics.lineStyle(2, 0xff00ff, 1);
      graphics.beginPath();
      graphics.moveTo(aimEndX - crosshairSize, aimEndY);
      graphics.lineTo(aimEndX + crosshairSize, aimEndY);
      graphics.moveTo(aimEndX, aimEndY - crosshairSize);
      graphics.lineTo(aimEndX, aimEndY + crosshairSize);
      graphics.strokePath();
    }

    // Draw cooldown indicator if reloading
    if (cannon.cooldownRemaining > 0) {
      const cooldownProgress = cannon.cooldownRemaining / 4000; // Assume 4s cooldown
      console.log(`Drawing cooldown: ${cannon.cooldownRemaining}ms remaining (${(cooldownProgress * 100).toFixed(0)}%)`);
      graphics.fillStyle(0x888888, 0.7);
      graphics.fillCircle(worldX, worldY, 12 * cooldownProgress);
    }
  }

  private drawShipBoundary(
    graphics: Phaser.GameObjects.Graphics,
    shipSprite: Phaser.GameObjects.Sprite,
    deckBoundary: { width: number; height: number },
    rotation: number
  ) {
    graphics.clear();

    // Define the 4 corners of the deck in local ship space (relative to center)
    const halfW = deckBoundary.width / 2;
    const halfH = deckBoundary.height / 2;
    const corners = [
      { x: -halfW, y: -halfH, color: 0xff0000 }, // Top-left: Red
      { x: halfW, y: -halfH, color: 0x00ff00 },  // Top-right: Green
      { x: halfW, y: halfH, color: 0x0000ff },   // Bottom-right: Blue
      { x: -halfW, y: halfH, color: 0xffff00 },  // Bottom-left: Yellow
    ];

    // Draw each corner dot using isometric rotation (i2m-true-isometric)
    corners.forEach((corner) => {
      const rotatedPos = this.rotatePointIsometric({ x: corner.x, y: corner.y }, rotation);
      const worldX = shipSprite.x + rotatedPos.x;
      const worldY = shipSprite.y + rotatedPos.y;

      graphics.fillStyle(corner.color, 1);
      graphics.fillCircle(worldX, worldY, 6);
    });
  }

  private calculateWaveHeightAtPosition(x: number, y: number, time: number): number {
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

  private animateVisibleWaterTiles(time: number) {
    const camera = this.cameras.main;

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

  update(time: number, delta: number) {
    // Animate water tiles (only those visible on screen)
    this.animateVisibleWaterTiles(time);

    // Update player depth dynamically based on Y position
    // Check if player is south of any Layer 2 tiles (should render on top)
    const playerTilePos = this.map.worldToTileXY(this.localPlayer.x, this.localPlayer.y);
    let renderAboveLayer2 = false;

    if (playerTilePos && this.secondLayer) {
      // Check tile one row north of player
      const tileNorth = this.secondLayer.getTileAt(
        Math.floor(playerTilePos.x),
        Math.floor(playerTilePos.y) - 1
      );
      if (tileNorth) {
        renderAboveLayer2 = true; // Player is south of a Layer 2 tile
      }
    }

    this.localPlayer.setDepth(renderAboveLayer2 ? 20000 : 1000); // Above or below Layer 2

    // Handle local player movement (only if not controlling ship)
    const velocity = new Phaser.Math.Vector2(0, 0);

    // Only allow player movement if NOT currently controlling ship
    if (!this.controllingShip) {
      // Isometric movement: screen-aligned controls (cardinal screen directions)
      // Each arrow key moves straight in its screen direction by combining two diamond axes
      // UP = north (straight up) = northwest + northeast
      // RIGHT = east (straight right) = northeast + southeast
      // DOWN = south (straight down) = southeast + southwest
      // LEFT = west (straight left) = southwest + northwest
      if (this.cursors.up?.isDown) {
        velocity.x += ISO_NORTHWEST.x + ISO_NORTHEAST.x;
        velocity.y += ISO_NORTHWEST.y + ISO_NORTHEAST.y;
      }
      if (this.cursors.right?.isDown) {
        velocity.x += ISO_NORTHEAST.x + ISO_SOUTHEAST.x;
        velocity.y += ISO_NORTHEAST.y + ISO_SOUTHEAST.y;
      }
      if (this.cursors.down?.isDown) {
        velocity.x += ISO_SOUTHEAST.x + ISO_SOUTHWEST.x;
        velocity.y += ISO_SOUTHEAST.y + ISO_SOUTHWEST.y;
      }
      if (this.cursors.left?.isDown) {
        velocity.x += ISO_SOUTHWEST.x + ISO_NORTHWEST.x;
        velocity.y += ISO_SOUTHWEST.y + ISO_NORTHWEST.y;
      }

      // Normalize diagonal movement
      if (velocity.length() > 0) {
        velocity.normalize();
        velocity.scale(MOVE_SPEED * (delta / 1000));

        // Calculate intended new position
        const newX = this.localPlayer.x + velocity.x;
        const newY = this.localPlayer.y + velocity.y;

        // If on ship, use full speed (no tile speed modifier)
        if (this.onShip) {
          // Player is on ship deck - move at full speed
          this.localPlayer.x += velocity.x;
          this.localPlayer.y += velocity.y;
        } else {
          // Player is on land - check tile collision and apply speed modifier
          const collision = this.checkTileCollision(newX, newY);

          if (collision.walkable) {
            // Apply movement with speed modifier from terrain
            this.localPlayer.x += velocity.x * collision.speedModifier;
            this.localPlayer.y += velocity.y * collision.speedModifier;
          }
          // If not walkable, don't move (collision!)
        }

        // Update animation based on movement direction and store facing
        this.lastFacing = this.updatePlayerAnimation(this.localPlayer, velocity);
      } else {
        // Stop animation when idle
        this.localPlayer.anims.stop();
      }
    } else {
      // Player is controlling ship - stop player animation
      this.localPlayer.anims.stop();
    }

    // Apply wave bobbing to local player if in water (not on ship)
    if (!this.onShip) {
      // Check if player is standing in water
      const tilePos = this.map.worldToTileXY(this.localPlayer.x, this.localPlayer.y);
      if (tilePos) {
        const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));
        if (tile && tile.properties?.navigable === true) {
          // Player is in water, apply wave offset delta
          const currentWaveOffset = this.calculateWaveHeightAtPosition(this.localPlayer.x, this.localPlayer.y, time);
          const waveDelta = currentWaveOffset - this.lastPlayerWaveOffset;
          this.localPlayer.y += waveDelta;
          this.lastPlayerWaveOffset = currentWaveOffset;
        } else {
          // Player is not in water, reset wave offset
          this.lastPlayerWaveOffset = 0;
        }
      } else {
        // Out of bounds, reset wave offset
        this.lastPlayerWaveOffset = 0;
      }
    } else {
      // Player is on ship, reset wave offset (ship handles bobbing)
      this.lastPlayerWaveOffset = 0;
    }

    // Publish position update at regular intervals
    if (time - this.lastPositionUpdate > POSITION_UPDATE_RATE) {
      this.publishPosition(velocity);
      this.lastPositionUpdate = time;
    }

    // Phase 6c: Update ships and move players on ships
    this.ships.forEach((ship) => {
      const dx = ship.targetPosition.x - ship.sprite.x;
      const dy = ship.targetPosition.y - ship.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 1) {
        // Calculate ship movement delta
        const factor = Math.min(1, (delta / 1000) * 5);
        const shipDx = dx * factor;
        const shipDy = dy * factor;

        // Move ship
        ship.sprite.x += shipDx;
        ship.sprite.y += shipDy;

        // Move local player if on this ship (move with ship delta)
        if (this.onShip === ship.id) {
          this.localPlayer.x += shipDx;
          this.localPlayer.y += shipDy;
        }

        // Move remote players if on this ship
        this.remotePlayers.forEach((player) => {
          if (player.onShip === ship.id) {
            player.sprite.x += shipDx;
            player.sprite.y += shipDy;
          }
        });
      }

      // Apply wave bobbing to ship at its current position
      const currentWaveOffset = this.calculateWaveHeightAtPosition(ship.sprite.x, ship.sprite.y, time);
      const waveYDelta = currentWaveOffset - ship.lastWaveOffset;
      ship.sprite.y += waveYDelta;
      ship.lastWaveOffset = currentWaveOffset;

      // Move local player with wave delta if on this ship
      if (this.onShip === ship.id) {
        this.localPlayer.y += waveYDelta;
      }

      // Move remote players with wave delta if on this ship
      this.remotePlayers.forEach((player) => {
        if (player.onShip === ship.id) {
          player.sprite.y += waveYDelta;
        }
      });

      // Update shipRelativePosition from current player world position
      // This needs to happen every frame so player movement updates the relative position
      // BUT skip this frame if we just applied a rotation (to avoid overwriting the rotated position)
      if (this.onShip === ship.id && !this.applyingShipRotation) {
        const dx = this.localPlayer.x - ship.sprite.x;
        const dy = this.localPlayer.y - ship.sprite.y;

        // Rotate to ship-local coordinates using isometric rotation (i2m-true-isometric Phase 3)
        const offset = { x: dx, y: dy };
        this.shipRelativePosition = this.rotatePointIsometric(offset, -ship.rotation);
      }

      // Always redraw control points and ship boundary at their current positions (they move with ship sprite)
      this.drawShipBoundary(ship.boundaryGraphics, ship.sprite, ship.deckBoundary, ship.rotation);
      this.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite, this.nearControlPoints.has(`${ship.id}:wheel`));
      this.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite, this.nearControlPoints.has(`${ship.id}:sails`));
      this.drawControlPoint(ship.controlPoints.mast.sprite, ship.controlPoints.mast, ship.sprite, this.nearControlPoints.has(`${ship.id}:mast`), 'mast');

      // c5x-ship-combat: Draw cannon control points
      if (ship.cannons) {
        ship.cannons.port.forEach((cannon, index) => {
          const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-port-${index}`);
          const isControlledByUs = this.controllingShip === ship.id &&
                                    this.controllingPoint === 'cannon' &&
                                    this.controllingCannon?.side === 'port' &&
                                    this.controllingCannon?.index === index;
          this.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs);
        });
        ship.cannons.starboard.forEach((cannon, index) => {
          const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-starboard-${index}`);
          const isControlledByUs = this.controllingShip === ship.id &&
                                    this.controllingPoint === 'cannon' &&
                                    this.controllingCannon?.side === 'starboard' &&
                                    this.controllingCannon?.index === index;
          this.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs);
        });
      }
    });

    // Clear the rotation flag after all ships are processed
    this.applyingShipRotation = false;

    // Check for ship boundary detection AFTER ship position updates
    // (so player can walk off the ship)
    this.checkShipBoundary();

    // Check for ship control point interactions
    this.checkShipInteractions();

    // Interpolate remote players toward their target positions
    this.remotePlayers.forEach((player) => {
      // Update depth dynamically - check if south of Layer 2 tiles
      const remoteTilePos = this.map.worldToTileXY(player.sprite.x, player.sprite.y);
      let remoteRenderAbove = false;

      if (remoteTilePos && this.secondLayer) {
        const tileNorth = this.secondLayer.getTileAt(
          Math.floor(remoteTilePos.x),
          Math.floor(remoteTilePos.y) - 1
        );
        if (tileNorth) {
          remoteRenderAbove = true;
        }
      }

      player.sprite.setDepth(remoteRenderAbove ? 20000 : 1000);

      const dx = player.targetPosition.x - player.sprite.x;
      const dy = player.targetPosition.y - player.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 1) {
        // Smooth interpolation
        const factor = Math.min(1, (delta / 1000) * 5); // Adjust speed as needed
        player.sprite.x += dx * factor;
        player.sprite.y += dy * factor;
      }

      // Apply wave bobbing if remote player is in water (not on ship)
      if (!player.onShip) {
        const tilePos = this.map.worldToTileXY(player.sprite.x, player.sprite.y);
        if (tilePos) {
          const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));
          if (tile && tile.properties?.navigable === true) {
            // Remote player is in water, apply wave offset delta
            const currentWaveOffset = this.calculateWaveHeightAtPosition(player.sprite.x, player.sprite.y, time);
            const waveDelta = currentWaveOffset - player.lastWaveOffset;
            player.sprite.y += waveDelta;
            player.lastWaveOffset = currentWaveOffset;
          } else {
            // Remote player is not in water, reset wave offset
            player.lastWaveOffset = 0;
          }
        } else {
          // Out of bounds, reset wave offset
          player.lastWaveOffset = 0;
        }
      } else {
        // Remote player is on ship, reset wave offset (ship handles bobbing)
        player.lastWaveOffset = 0;
      }
    });
  }

  /**
   * Rotate a point by the given angle (Cartesian rotation)
   * @param point Point to rotate
   * @param angle Rotation angle in radians
   * @returns Rotated point
   */
  private rotatePoint(point: { x: number; y: number }, angle: number): { x: number; y: number } {
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
  private isometricToCartesian(isoPoint: { x: number; y: number }): { x: number; y: number } {
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
  private cartesianToIsometric(cartPoint: { x: number; y: number }): { x: number; y: number } {
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
  private rotatePointIsometric(point: { x: number; y: number }, angle: number): { x: number; y: number } {
    // Transform to Cartesian
    const cart = this.isometricToCartesian(point);

    // Apply Cartesian rotation
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotatedCart = {
      x: cart.x * cos - cart.y * sin,
      y: cart.x * sin + cart.y * cos,
    };

    // Transform back to isometric
    return this.cartesianToIsometric(rotatedCart);
  }

  /**
   * Check if a point is inside a rotated rectangle using OBB (Oriented Bounding Box) collision
   * Uses isometric rotation to match how players rotate on ships (i2m-true-isometric)
   * @param point Point to test in world coordinates
   * @param rectCenter Center of rectangle in world coordinates
   * @param rectSize Size of rectangle (width, height)
   * @param rotation Rotation angle in radians
   * @returns true if point is inside rotated rectangle
   */
  private isPointInRotatedRect(
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
    const localPos = this.rotatePointIsometric(offset, -rotation);

    // Check if point is inside axis-aligned rect
    const halfWidth = rectSize.width / 2;
    const halfHeight = rectSize.height / 2;

    return Math.abs(localPos.x) <= halfWidth && Math.abs(localPos.y) <= halfHeight;
  }

  private checkShipBoundary() {
    // Check if player is within any ship's deck boundary (using OBB for rotated ships)
    let foundShip: string | null = null;
    let shipRelativePos: { x: number; y: number } | null = null;

    this.ships.forEach((ship) => {
      // Use OBB collision to check if player is on rotated ship deck
      const isOnDeck = this.isPointInRotatedRect(
        { x: this.localPlayer.x, y: this.localPlayer.y },
        { x: ship.sprite.x, y: ship.sprite.y },
        ship.deckBoundary,
        ship.rotation
      );

      if (isOnDeck) {
        // Calculate position relative to ship center (in ship's local space)
        const dx = this.localPlayer.x - ship.sprite.x;
        const dy = this.localPlayer.y - ship.sprite.y;

        // Rotate to ship-local coordinates using isometric rotation (i2m-true-isometric)
        const offset = { x: dx, y: dy };
        const localPos = this.rotatePointIsometric(offset, -ship.rotation);

        foundShip = ship.id;
        shipRelativePos = { x: localPos.x, y: localPos.y }; // Store in ship-local coords
      }
    });

    // Update onShip state
    if (foundShip !== this.onShip) {
      if (foundShip) {
        console.log(`Player boarded ship: ${foundShip}`);
        this.onShip = foundShip;
        this.shipRelativePosition = shipRelativePos;
      } else {
        console.log(`Player left ship: ${this.onShip}`);
        this.onShip = null;
        this.shipRelativePosition = null;
      }
    }
    // DON'T update shipRelativePosition while on ship - it gets rotated when ship turns
    // and recalculated from world position each frame in the update loop
  }

  private checkTileCollision(worldX: number, worldY: number): {
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

  private publishPosition(velocity: Phaser.Math.Vector2) {
    const update: PositionUpdate = {
      participantId: this.playerId,
      worldCoords: {
        x: this.localPlayer.x,
        y: this.localPlayer.y,
      },
      tileCoords: {
        x: Math.floor(this.localPlayer.x / TILE_WIDTH),
        y: Math.floor(this.localPlayer.y / TILE_HEIGHT),
      },
      velocity: {
        x: velocity.x,
        y: velocity.y,
      },
      facing: this.lastFacing, // Include current facing direction
      timestamp: Date.now(),
      platformRef: null,
    };

    // Broadcast position to all players
    this.client.send({
      kind: 'game/position',
      to: [], // Broadcast to all
      payload: update,
    });
  }

  private checkShipInteractions() {
    const INTERACTION_DISTANCE = 30; // pixels
    let nearestControlPoint: {
      shipId: string;
      controlPoint: 'wheel' | 'sails' | 'mast' | 'cannon';
      cannonSide?: 'port' | 'starboard';
      cannonIndex?: number;
      distance: number;
    } | null = null;

    // Clear previous near control points
    this.nearControlPoints.clear();

    // Find closest control point
    this.ships.forEach((ship) => {
      // Phase D: Calculate wheel world position with isometric rotation (i2m-true-isometric)
      const rotatedWheelPos = this.rotatePointIsometric(ship.controlPoints.wheel.relativePosition, ship.rotation);
      const wheelWorldX = ship.sprite.x + rotatedWheelPos.x;
      const wheelWorldY = ship.sprite.y + rotatedWheelPos.y;
      const wheelDx = wheelWorldX - this.localPlayer.x;
      const wheelDy = wheelWorldY - this.localPlayer.y;
      const wheelDistance = Math.sqrt(wheelDx * wheelDx + wheelDy * wheelDy);

      if (wheelDistance < INTERACTION_DISTANCE) {
        const isControlledByUs = this.controllingShip === ship.id && this.controllingPoint === 'wheel';
        const isControlledByOther = ship.controlPoints.wheel.controlledBy && ship.controlPoints.wheel.controlledBy !== this.playerId;

        // Track as interactable for E key (can grab if free, or release if we're controlling)
        if (isControlledByUs || !isControlledByOther) {
          if (!nearestControlPoint || wheelDistance < nearestControlPoint.distance) {
            nearestControlPoint = {
              shipId: ship.id,
              controlPoint: 'wheel',
              distance: wheelDistance,
            };
          }
        }
      }

      // Phase D: Calculate sails world position with isometric rotation (i2m-true-isometric)
      const rotatedSailsPos = this.rotatePointIsometric(ship.controlPoints.sails.relativePosition, ship.rotation);
      const sailsWorldX = ship.sprite.x + rotatedSailsPos.x;
      const sailsWorldY = ship.sprite.y + rotatedSailsPos.y;
      const sailsDx = sailsWorldX - this.localPlayer.x;
      const sailsDy = sailsWorldY - this.localPlayer.y;
      const sailsDistance = Math.sqrt(sailsDx * sailsDx + sailsDy * sailsDy);

      if (sailsDistance < INTERACTION_DISTANCE) {
        const isControlledByUs = this.controllingShip === ship.id && this.controllingPoint === 'sails';
        const isControlledByOther = ship.controlPoints.sails.controlledBy && ship.controlPoints.sails.controlledBy !== this.playerId;

        // Track as interactable for E key (can grab if free, or release if we're controlling)
        if (isControlledByUs || !isControlledByOther) {
          if (!nearestControlPoint || sailsDistance < nearestControlPoint.distance) {
            nearestControlPoint = {
              shipId: ship.id,
              controlPoint: 'sails',
              distance: sailsDistance,
            };
          }
        }
      }

      // Check mast (crow's nest at center of ship for zooming out view)
      const rotatedMastPos = this.rotatePointIsometric(ship.controlPoints.mast.relativePosition, ship.rotation);
      const mastWorldX = ship.sprite.x + rotatedMastPos.x;
      const mastWorldY = ship.sprite.y + rotatedMastPos.y;
      const mastDx = mastWorldX - this.localPlayer.x;
      const mastDy = mastWorldY - this.localPlayer.y;
      const mastDistance = Math.sqrt(mastDx * mastDx + mastDy * mastDy);

      if (mastDistance < INTERACTION_DISTANCE) {
        const isControlledByUs = this.controllingShip === ship.id && this.controllingPoint === 'mast';

        // Mast is client-side only, always available (no isControlledByOther check)
        if (isControlledByUs || true) {
          if (!nearestControlPoint || mastDistance < nearestControlPoint.distance) {
            nearestControlPoint = {
              shipId: ship.id,
              controlPoint: 'mast',
              distance: mastDistance,
            };
          }
        }
      }

      // Check cannons (c5x-ship-combat)
      if (ship.cannons) {
        // Check port cannons
        ship.cannons.port.forEach((cannon, index) => {
          const rotatedCannonPos = this.rotatePointIsometric(cannon.relativePosition, ship.rotation);
          const cannonWorldX = ship.sprite.x + rotatedCannonPos.x;
          const cannonWorldY = ship.sprite.y + rotatedCannonPos.y;
          const cannonDx = cannonWorldX - this.localPlayer.x;
          const cannonDy = cannonWorldY - this.localPlayer.y;
          const cannonDistance = Math.sqrt(cannonDx * cannonDx + cannonDy * cannonDy);

          if (cannonDistance < INTERACTION_DISTANCE) {
            const isControlledByUs = this.controllingShip === ship.id &&
                                      this.controllingPoint === 'cannon' &&
                                      this.controllingCannon?.side === 'port' &&
                                      this.controllingCannon?.index === index;
            const isControlledByOther = cannon.controlledBy && cannon.controlledBy !== this.playerId;

            if (isControlledByUs || !isControlledByOther) {
              if (!nearestControlPoint || cannonDistance < nearestControlPoint.distance) {
                nearestControlPoint = {
                  shipId: ship.id,
                  controlPoint: 'cannon',
                  cannonSide: 'port',
                  cannonIndex: index,
                  distance: cannonDistance,
                };
              }
            }
          }
        });

        // Check starboard cannons
        ship.cannons.starboard.forEach((cannon, index) => {
          const rotatedCannonPos = this.rotatePointIsometric(cannon.relativePosition, ship.rotation);
          const cannonWorldX = ship.sprite.x + rotatedCannonPos.x;
          const cannonWorldY = ship.sprite.y + rotatedCannonPos.y;
          const cannonDx = cannonWorldX - this.localPlayer.x;
          const cannonDy = cannonWorldY - this.localPlayer.y;
          const cannonDistance = Math.sqrt(cannonDx * cannonDx + cannonDy * cannonDy);

          if (cannonDistance < INTERACTION_DISTANCE) {
            const isControlledByUs = this.controllingShip === ship.id &&
                                      this.controllingPoint === 'cannon' &&
                                      this.controllingCannon?.side === 'starboard' &&
                                      this.controllingCannon?.index === index;
            const isControlledByOther = cannon.controlledBy && cannon.controlledBy !== this.playerId;

            if (isControlledByUs || !isControlledByOther) {
              if (!nearestControlPoint || cannonDistance < nearestControlPoint.distance) {
                nearestControlPoint = {
                  shipId: ship.id,
                  controlPoint: 'cannon',
                  cannonSide: 'starboard',
                  cannonIndex: index,
                  distance: cannonDistance,
                };
              }
            }
          }
        });
      }
    });

    // Only add the nearest control point to the yellow indicator set (if not controlled)
    if (nearestControlPoint) {
      // Check if the nearest control point is controlled by us
      const ship = this.ships.get(nearestControlPoint.shipId);
      if (ship) {
        const isControlledByUs = this.controllingShip === nearestControlPoint.shipId && this.controllingPoint === nearestControlPoint.controlPoint;

        // Only show yellow if we're not controlling it (otherwise it will show red)
        if (!isControlledByUs) {
          this.nearControlPoints.add(`${nearestControlPoint.shipId}:${nearestControlPoint.controlPoint}`);
        }
      }
    }

    // Handle E key press
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (this.controllingPoint) {
        // Release current control (no distance check - always allow disengagement)
        this.sendReleaseControl();
      } else if (nearestControlPoint) {
        // Grab nearest control point (only if within range)
        if (nearestControlPoint.controlPoint === 'cannon' &&
            nearestControlPoint.cannonSide !== undefined &&
            nearestControlPoint.cannonIndex !== undefined) {
          // Grab cannon
          this.sendGrabCannon(
            nearestControlPoint.shipId,
            nearestControlPoint.cannonSide,
            nearestControlPoint.cannonIndex
          );
        } else {
          // Grab wheel, sails, or mast
          this.sendGrabControl(nearestControlPoint.shipId, nearestControlPoint.controlPoint as 'wheel' | 'sails' | 'mast');
        }
      }
    }

    // Handle ship control inputs (when controlling wheel or sails)
    if (this.controllingShip && this.controllingPoint) {
      if (this.controllingPoint === 'wheel') {
        // w3l-wheel-steering: Use isDown for continuous wheel turning
        if (this.cursors.left?.isDown) {
          if (!this.currentWheelDirection || this.currentWheelDirection !== 'left') {
            this.sendWheelTurnStart(this.controllingShip, 'left');
            this.currentWheelDirection = 'left';
          }
        } else if (this.cursors.right?.isDown) {
          if (!this.currentWheelDirection || this.currentWheelDirection !== 'right') {
            this.sendWheelTurnStart(this.controllingShip, 'right');
            this.currentWheelDirection = 'right';
          }
        } else {
          // Neither key pressed - stop turning if we were turning
          if (this.currentWheelDirection) {
            this.sendWheelTurnStop(this.controllingShip);
            this.currentWheelDirection = null;
          }
        }
      } else if (this.controllingPoint === 'sails') {
        // Up/down arrows to adjust speed
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
          this.sendAdjustSails(this.controllingShip, 'up');
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
          this.sendAdjustSails(this.controllingShip, 'down');
        }
      } else if (this.controllingPoint === 'cannon' && this.controllingCannon) {
        // c5x-ship-combat: Left/right arrows to aim cannon
        const aimSpeed = 0.02; // radians per frame (about 1.15 degrees)
        const maxAim = Math.PI / 4; // ±45°
        let aimChanged = false;

        if (this.cursors.left?.isDown) {
          this.currentCannonAim = Math.max(-maxAim, this.currentCannonAim - aimSpeed);
          aimChanged = true;
        } else if (this.cursors.right?.isDown) {
          this.currentCannonAim = Math.min(maxAim, this.currentCannonAim + aimSpeed);
          aimChanged = true;
        }

        // Send aim update to server if changed
        if (aimChanged) {
          console.log(`Aiming cannon: ${(this.currentCannonAim * 180 / Math.PI).toFixed(1)}°`);
          this.sendAimCannon(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            this.currentCannonAim
          );
        }

        // Space bar to fire cannon
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
          this.sendFireCannon(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index
          );
        }
      }
    }
  }

  private sendGrabControl(shipId: string, controlPoint: 'wheel' | 'sails' | 'mast') {
    // Mast is client-side only (for camera zoom), don't send to ship server
    if (controlPoint !== 'mast') {
      this.client.send({
        kind: 'ship/grab_control',
        to: [shipId],
        payload: {
          controlPoint,
          playerId: this.playerId,
        },
      });
    }

    this.controllingShip = shipId;
    this.controllingPoint = controlPoint;

    // If grabbing mast, zoom camera out for better view
    if (controlPoint === 'mast') {
      const ship = this.ships.get(shipId);
      if (ship) {
        ship.controlPoints.mast.controlledBy = this.playerId;
      }
      this.cameras.main.zoomTo(0.8, 500); // Zoom out to 0.8x over 500ms
      console.log(`Climbed mast on ship ${shipId} - zooming out for better view`);
    } else {
      console.log(`Grabbed ${controlPoint} on ship ${shipId}`);
    }
  }

  private sendReleaseControl() {
    if (!this.controllingShip || !this.controllingPoint) return;

    // Handle cannon release separately (c5x-ship-combat)
    if (this.controllingPoint === 'cannon' && this.controllingCannon) {
      this.sendReleaseCannon(
        this.controllingShip,
        this.controllingCannon.side,
        this.controllingCannon.index
      );
      this.controllingCannon = null;
      this.currentCannonAim = 0;
    }
    // Mast is client-side only, don't send to ship server
    else if (this.controllingPoint === 'mast') {
      const ship = this.ships.get(this.controllingShip);
      if (ship) {
        ship.controlPoints.mast.controlledBy = null;
      }
      this.cameras.main.zoomTo(1.5, 500); // Zoom back to 1.5x over 500ms
      console.log(`Climbed down mast - zooming back to normal view`);
    }
    // Wheel or sails
    else {
      this.client.send({
        kind: 'ship/release_control',
        to: [this.controllingShip],
        payload: {
          controlPoint: this.controllingPoint as 'wheel' | 'sails',
          playerId: this.playerId,
        },
      });
      console.log(`Released ${this.controllingPoint} on ship ${this.controllingShip}`);
    }

    this.controllingShip = null;
    this.controllingPoint = null;
  }

  private sendSteer(shipId: string, direction: 'left' | 'right') {
    this.client.send({
      kind: 'ship/steer',
      to: [shipId],
      payload: {
        direction,
        playerId: this.playerId,
      },
    });

    console.log(`Steering ${direction}`);
  }

  /**
   * Start turning wheel (w3l-wheel-steering)
   * Player holds left/right to continuously rotate wheel
   */
  private sendWheelTurnStart(shipId: string, direction: 'left' | 'right') {
    this.client.send({
      kind: 'ship/wheel_turn_start',
      to: [shipId],
      payload: {
        direction,
        playerId: this.playerId,
      },
    });

    console.log(`Started turning wheel ${direction}`);
  }

  /**
   * Stop turning wheel (w3l-wheel-steering)
   * Wheel locks at current angle, ship continues turning
   */
  private sendWheelTurnStop(shipId: string) {
    this.client.send({
      kind: 'ship/wheel_turn_stop',
      to: [shipId],
      payload: {
        playerId: this.playerId,
      },
    });

    console.log(`Stopped turning wheel`);
  }

  private sendAdjustSails(shipId: string, adjustment: 'up' | 'down') {
    this.client.send({
      kind: 'ship/adjust_sails',
      to: [shipId],
      payload: {
        adjustment,
        playerId: this.playerId,
      },
    });

    console.log(`Adjusting sails ${adjustment}`);
  }

  /**
   * Cannon control methods (c5x-ship-combat)
   */
  private sendGrabCannon(shipId: string, side: 'port' | 'starboard', index: number) {
    this.client.send({
      kind: 'ship/grab_cannon',
      to: [shipId],
      payload: {
        side,
        index,
        playerId: this.playerId,
      },
    });

    this.controllingShip = shipId;
    this.controllingPoint = 'cannon';
    this.controllingCannon = { side, index };
    this.currentCannonAim = 0; // Reset aim when grabbing

    console.log(`Grabbed ${side} cannon ${index} on ship ${shipId}`);
  }

  private sendReleaseCannon(shipId: string, side: 'port' | 'starboard', index: number) {
    this.client.send({
      kind: 'ship/release_cannon',
      to: [shipId],
      payload: {
        side,
        index,
        playerId: this.playerId,
      },
    });

    console.log(`Released ${side} cannon ${index}`);
  }

  private sendAimCannon(shipId: string, side: 'port' | 'starboard', index: number, aimAngle: number) {
    this.client.send({
      kind: 'ship/aim_cannon',
      to: [shipId],
      payload: {
        side,
        index,
        aimAngle,
        playerId: this.playerId,
      },
    });
  }

  private sendFireCannon(shipId: string, side: 'port' | 'starboard', index: number) {
    this.client.send({
      kind: 'ship/fire_cannon',
      to: [shipId],
      payload: {
        side,
        index,
        playerId: this.playerId,
      },
    });

    console.log(`Fired ${side} cannon ${index}!`);
  }
}
