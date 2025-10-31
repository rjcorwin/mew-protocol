import Phaser from 'phaser';
import { Howl } from 'howler';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Player, Ship, Direction, Projectile } from '../types.js';

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
  private projectiles: Map<string, Projectile> = new Map(); // c5x-ship-combat Phase 2
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
  // Phase 5: Sound effect instances using Howler.js (c5x-ship-combat)
  private sounds!: {
    cannonFire: Howl;
    hitImpact: Howl;
    waterSplash: Howl;
    shipSinking: Howl;
    shipRespawn: Howl;
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    console.log('[GameScene] Starting preload...');

    // Load actual tileset image
    this.load.image('terrain', 'assets/maps/terrain.png');

    // Load Tiled map
    this.load.tilemapTiledJSON('map', 'assets/maps/small-map.tmj');

    // Load player sprite sheet (8 directions, 4 frames each)
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Load ship sprite sheet (s6r-ship-sprite-rendering)
    // 64 rotation frames (5.625° per frame) in 8×8 grid
    // NOTE: This file doesn't exist yet - Phaser will warn but continue with fallback rendering
    this.load.spritesheet('ship1', 'assets/sprites/ship1.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

    // Handle load errors for optional assets (don't crash the game)
    this.load.on('loaderror', (fileObj: any) => {
      if (fileObj.key === 'ship1') {
        console.warn('⚠ Ship sprite sheet not found, will use fallback rectangle rendering');
      } else if (fileObj.type === 'audio') {
        console.warn(`⚠ Failed to load audio: ${fileObj.key} - sounds will be disabled`);
      } else {
        console.error(`[GameScene] Load error for ${fileObj.key}:`, fileObj);
      }
    });

    // Track successfully loaded audio files
    this.load.on('filecomplete', (key: string) => {
      if (key.includes('fire') || key.includes('impact') || key.includes('splash') || key.includes('sinking') || key.includes('respawn')) {
        console.log(`[GameScene] Audio loaded: ${key}`);
      }
    });

    console.log('[GameScene] Preload complete');
  }

  create() {
    // Get client and player ID from registry
    this.client = this.registry.get('mewClient') as MEWClient;
    this.playerId = this.registry.get('playerId') as string;

    // Verify ship sprite sheet loaded (s6r-ship-sprite-rendering)
    if (this.textures.exists('ship1')) {
      console.log('✓ Ship sprite sheet loaded: ship1.png (64 frames)');
    } else {
      console.warn('⚠ Ship sprite sheet not found: assets/sprites/ship1.png');
      console.warn('  Ships will use fallback placeholder rendering');
    }

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

    // Phase 5: Create sound instances using Howler.js (c5x-ship-combat)
    // Howler.js works in Electron where Phaser's audio loader crashes
    // Key fix: absolute paths via window.location (relative paths fail in Electron)
    const basePath = window.location.href.replace('index.html', '');

    try {
      this.sounds = {
        cannonFire: new Howl({
          src: [basePath + 'assets/sounds/cannon-fire.mp3'],
          volume: 0.5,
          html5: true,
          preload: true,
          onloaderror: (id, err) => console.error('Failed to load cannon-fire.mp3:', err)
        }),
        hitImpact: new Howl({
          src: [basePath + 'assets/sounds/hit-impact.mp3'],
          volume: 0.6,
          html5: true,
          preload: true,
          onloaderror: (id, err) => console.error('Failed to load hit-impact.mp3:', err)
        }),
        waterSplash: new Howl({
          src: [basePath + 'assets/sounds/water-splash.mp3'],
          volume: 0.4,
          html5: true,
          preload: true,
          onloaderror: (id, err) => console.error('Failed to load water-splash.mp3:', err)
        }),
        shipSinking: new Howl({
          src: [basePath + 'assets/sounds/ship-sinking.mp3'],
          volume: 0.5,
          loop: true,
          html5: true,
          preload: true,
          onloaderror: (id, err) => console.error('Failed to load ship-sinking.mp3:', err)
        }),
        shipRespawn: new Howl({
          src: [basePath + 'assets/sounds/ship-respawn.mp3'],
          volume: 0.7,
          html5: true,
          preload: true,
          onloaderror: (id, err) => console.error('Failed to load ship-respawn.mp3:', err)
        })
      };
      console.log('✓ Combat sound effects loaded via Howler.js (Phase 5)');
    } catch (err) {
      console.error('Failed to initialize Howler audio:', err);
    }

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
    this.streamId = 'seacat-positions';
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
      } else if (envelope.kind === 'game/projectile_spawn') {
        // c5x-ship-combat Phase 2: Handle projectile spawn
        this.spawnProjectile(envelope.payload);
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

      // Create ship sprite (s6r-ship-sprite-rendering)
      // Use ship1 sprite sheet with 64 rotation frames
      const shipSprite = this.add.sprite(
        update.worldCoords.x,
        update.worldCoords.y,
        'ship1',
        0 // Start with frame 0 (0° rotation, facing east)
      );
      shipSprite.setOrigin(0.5, 0.5);
      shipSprite.setDepth(1); // Above ground tiles

      // Set initial sprite frame based on ship rotation
      // TEMP: Disabled until sprite sheet is generated
      // const initialFrameIndex = this.calculateShipSpriteFrame(update.shipData.rotation);
      // shipSprite.setFrame(initialFrameIndex);

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
            elevationAngle: cannonData.elevationAngle || Math.PI / 6, // Default 30° if not present
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
            elevationAngle: cannonData.elevationAngle || Math.PI / 6, // Default 30° if not present
            cooldownRemaining: cannonData.cooldownRemaining,
          })),
        } : undefined,
        speedLevel: update.shipData.speedLevel,
        deckBoundary: update.shipData.deckBoundary,
        lastWaveOffset: 0, // Initialize wave offset tracking
        // Phase 3: Initialize health
        health: update.shipData.health || 100,
        maxHealth: update.shipData.maxHealth || 100,
        // Phase 4: Initialize sinking state
        sinking: update.shipData.sinking || false,
        sinkStartTime: 0,
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
            cannon.elevationAngle = serverCannon.elevationAngle || cannon.elevationAngle; // Update if present
            cannon.cooldownRemaining = serverCannon.cooldownRemaining;
          }
        });
        ship.cannons.starboard.forEach((cannon, index) => {
          if (update.shipData.cannons!.starboard[index]) {
            const serverCannon = update.shipData.cannons!.starboard[index];
            cannon.controlledBy = serverCannon.controlledBy;
            cannon.aimAngle = serverCannon.aimAngle;
            cannon.elevationAngle = serverCannon.elevationAngle || cannon.elevationAngle; // Update if present
            cannon.cooldownRemaining = serverCannon.cooldownRemaining;
          }
        });
      }

      // Phase 3: Sync health from server
      ship.health = update.shipData.health || ship.health || 100;
      ship.maxHealth = update.shipData.maxHealth || ship.maxHealth || 100;

      // Phase 4: Detect sinking transition
      if (update.shipData.sinking && !ship.sinking) {
        // Ship just started sinking
        ship.sinking = true;
        ship.sinkStartTime = Date.now();
        console.log(`Ship ${ship.id} is sinking!`);

        // Phase 5: Play sinking sound (looped) (c5x-ship-combat)
        this.sounds?.shipSinking?.play();

        // Teleport players off ship to water
        if (this.onShip === ship.id) {
          this.onShip = null;
          this.shipRelativePosition = null;
          // Player will fall into water and bob
        }

        // Teleport remote players off ship
        this.remotePlayers.forEach((player) => {
          if (player.onShip === ship.id) {
            player.onShip = null;
          }
        });
      }

      // Phase 4: Detect respawn (sinking → not sinking)
      if (!update.shipData.sinking && ship.sinking) {
        console.log(`Ship ${ship.id} respawned!`);
        ship.sinking = false;
        ship.sinkStartTime = 0;

        // Phase 5: Stop sinking sound, play respawn sound (c5x-ship-combat)
        this.sounds?.shipSinking?.stop();
        this.sounds?.shipRespawn?.play();

        // Reset visual state
        ship.sprite.setAlpha(1.0);
        ship.boundaryGraphics.setAlpha(1.0);
        ship.controlPoints.wheel.sprite.setAlpha(1.0);
        ship.controlPoints.sails.sprite.setAlpha(1.0);
        ship.controlPoints.mast.sprite.setAlpha(1.0);
        if (ship.cannons) {
          ship.cannons.port.forEach(c => c.sprite.setAlpha(1.0));
          ship.cannons.starboard.forEach(c => c.sprite.setAlpha(1.0));
        }
      }

      // Update ship sprite rotation (stores rotation for other calculations)
      ship.sprite.setRotation(update.shipData.rotation);

      // Update ship sprite frame to match rotation (s6r-ship-sprite-rendering)
      // TEMP: Disabled until sprite sheet is generated
      // const frameIndex = this.calculateShipSpriteFrame(update.shipData.rotation);
      // ship.sprite.setFrame(frameIndex);

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

  /**
   * Spawn a projectile from a cannon (c5x-ship-combat Phase 2)
   */
  private spawnProjectile(payload: any) {
    const { id, position, velocity, timestamp, sourceShip } = payload;

    // Check for duplicate (idempotency)
    if (this.projectiles.has(id)) {
      console.log(`Projectile ${id} already exists, ignoring duplicate spawn`);
      return;
    }

    console.log(`[GameScene] Spawning projectile ${id} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
    console.log(`  Velocity: (${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}) px/s`);

    // Create cannonball sprite (black circle, 8px diameter)
    const sprite = this.add.circle(
      position.x,
      position.y,
      4, // radius = 4px (8px diameter)
      0x222222, // Dark gray/black
      1.0 // Full opacity
    );
    sprite.setDepth(100); // Above ships and players

    // Store projectile
    const projectile: Projectile = {
      id,
      sprite,
      velocity: { ...velocity }, // Copy velocity
      spawnTime: timestamp,
      sourceShip,
      minFlightTime: 200, // 200ms grace period before water collision check (prevents instant despawn from deck-level shots)
    };

    this.projectiles.set(id, projectile);
    console.log(`[GameScene] Projectile ${id} spawned successfully. Total projectiles: ${this.projectiles.size}`);

    // Phase 5: Play cannon fire sound (c5x-ship-combat)
    this.sounds?.cannonFire?.play();

    // Phase 5: Camera shake if local player is on the firing ship (c5x-ship-combat)
    if (sourceShip === this.onShip) {
      this.cameras.main.shake(100, 0.005); // 100ms duration, 0.005 intensity
    }

    // Show cannon blast effect at spawn position (Phase 2c)
    this.createCannonBlast(position.x, position.y);
  }

  /**
   * Create cannon blast effect when cannon fires (c5x-ship-combat Phase 2c)
   */
  private createCannonBlast(x: number, y: number) {
    // Orange flash
    const flash = this.add.circle(x, y, 15, 0xFFAA00, 0.9);
    flash.setDepth(100);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy()
    });

    // Smoke puffs expanding outward
    const smokeCount = 5;
    for (let i = 0; i < smokeCount; i++) {
      const angle = (Math.PI * 2 / smokeCount) * i;
      const smoke = this.add.circle(
        x + Math.cos(angle) * 10,
        y + Math.sin(angle) * 10,
        6,
        0x666666,
        0.6
      );
      smoke.setDepth(100);

      this.tweens.add({
        targets: smoke,
        x: smoke.x + Math.cos(angle) * 20,
        y: smoke.y + Math.sin(angle) * 20,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => smoke.destroy()
      });
    }
  }

  /**
   * Create water splash effect when cannonball hits water (c5x-ship-combat Phase 2c)
   */
  private createWaterSplash(x: number, y: number) {
    // Create blue particle fountain effect
    const particleCount = 8;
    const splashRadius = 20;
    const splashDuration = 800; // ms

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 / particleCount) * i;
      const distance = Math.random() * splashRadius;

      const particle = this.add.circle(
        x + Math.cos(angle) * 5,
        y + Math.sin(angle) * 5,
        3 + Math.random() * 2, // Random size 3-5px
        0x4488ff, // Blue water color
        0.7
      );
      particle.setDepth(100); // Same as projectiles

      // Animate particle outward and fade
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 10, // Slight upward arc
        alpha: 0,
        scale: 1.5,
        duration: splashDuration,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy()
      });
    }

    // Add a central splash circle that expands
    const splashCircle = this.add.circle(x, y, 5, 0x6699ff, 0.5);
    splashCircle.setDepth(100);

    this.tweens.add({
      targets: splashCircle,
      scale: 3,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => splashCircle.destroy()
    });
  }

  /**
   * Phase 3: Draw health bar above ship
   */
  private drawHealthBar(x: number, y: number, health: number, maxHealth: number) {
    const width = 100;
    const height = 8;
    const healthPercent = health / maxHealth;

    // Background (dark gray)
    const bg = this.add.rectangle(x, y, width, height, 0x333333, 0.8);
    bg.setDepth(200);

    // Health fill (color based on health)
    let color: number;
    if (healthPercent > 0.5) color = 0x00ff00; // Green
    else if (healthPercent > 0.2) color = 0xffff00; // Yellow
    else color = 0xff0000; // Red

    const fill = this.add.rectangle(
      x - (width / 2) + (width * healthPercent / 2),
      y,
      width * healthPercent,
      height,
      color,
      0.9
    );
    fill.setDepth(201);

    // Destroy after this frame (will be redrawn next frame)
    this.time.delayedCall(0, () => {
      bg.destroy();
      fill.destroy();
    });
  }

  /**
   * Phase 3: Create hit effect when cannonball hits ship
   */
  private createHitEffect(x: number, y: number) {
    // Phase 5: Enhanced wood splinters (brown particles, radial burst) (c5x-ship-combat)
    // Increased from 20 to 30 particles with rotation animation
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      const particle = this.add.circle(x, y, 2 + Math.random() * 3, 0x8B4513, 0.8);
      particle.setDepth(100);

      // Phase 5: Add rotation speed for spinning particles
      const rotationSpeed = (Math.random() - 0.5) * 0.2;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        angle: rotationSpeed * 360, // Rotate while flying
        duration: 800,
        onComplete: () => particle.destroy()
      });
    }

    // Smoke burst (gray particles)
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const particle = this.add.circle(x, y, 4, 0x666666, 0.6);
      particle.setDepth(100);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        alpha: 0,
        scale: 2,
        duration: 1000,
        onComplete: () => particle.destroy()
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
    cannon: { relativePosition: { x: number; y: number }; controlledBy: string | null; aimAngle: number; elevationAngle: number; cooldownRemaining: number },
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

      // Draw elevation indicator (Option 3: Show elevation angle)
      const elevationDegrees = Math.round(cannon.elevationAngle * 180 / Math.PI);
      const elevationText = `${elevationDegrees}°`;

      // Create text above cannon (elevation display)
      const textStyle = {
        fontSize: '14px',
        color: '#00ffff',
        fontFamily: 'monospace',
        backgroundColor: '#000000',
        padding: { x: 4, y: 2 }
      };

      // Note: We'll use the graphics to draw simple text representation
      // Draw a small elevation bar indicator instead (3 segments for 15°/30°/45°/60°)
      const elevBarX = worldX - 20;
      const elevBarY = worldY - 25;
      const segmentHeight = 4;
      const numSegments = Math.round((cannon.elevationAngle - Math.PI / 12) / (Math.PI / 36)); // 0-9 segments (15°-60° in 5° steps)

      for (let i = 0; i < 9; i++) {
        const alpha = i < numSegments ? 0.8 : 0.2;
        const segColor = i < numSegments ? 0x00ff00 : 0x333333;
        graphics.fillStyle(segColor, alpha);
        graphics.fillRect(elevBarX, elevBarY - (i * segmentHeight), 40, segmentHeight - 1);
      }

      // Draw elevation number
      graphics.fillStyle(0x000000, 0.8);
      graphics.fillRect(elevBarX - 2, elevBarY - 42, 44, 14);
      // Note: Phaser Graphics doesn't support text, we'd need a Text object for actual numbers
      // For now, the bar indicator shows elevation visually
    }

    // Draw cooldown indicator if reloading
    if (cannon.cooldownRemaining > 0) {
      const cooldownProgress = cannon.cooldownRemaining / 4000; // Assume 4s cooldown
      // console.log(`Drawing cooldown: ${cannon.cooldownRemaining}ms remaining (${(cooldownProgress * 100).toFixed(0)}%)`);
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

  /**
   * Calculate sprite sheet frame index from ship rotation (s6r-ship-sprite-rendering)
   * @param rotation Ship rotation in radians
   * @returns Frame index (0-63) corresponding to rotation angle
   */
  private calculateShipSpriteFrame(rotation: number): number {
    // Normalize rotation to 0-2π range
    const normalizedRotation = ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // Convert to frame index (0-63)
    // 64 frames cover 360° (2π radians), so each frame is 5.625° (π/32 radians)
    const frameIndex = Math.round((normalizedRotation / (Math.PI * 2)) * 64) % 64;

    return frameIndex;
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

      // Phase 3: Draw health bar above ship
      this.drawHealthBar(ship.sprite.x, ship.sprite.y - 40, ship.health, ship.maxHealth);

      // Phase 4: Apply sinking animation
      if (ship.sinking && ship.sinkStartTime > 0) {
        const SINK_DURATION = 5000; // 5 seconds
        const elapsed = Date.now() - ship.sinkStartTime;
        const sinkProgress = Math.min(elapsed / SINK_DURATION, 1.0);

        // Sink downward (move sprite Y down)
        const SINK_DISTANCE = 100; // pixels below water surface
        ship.sprite.y = ship.targetPosition.y + (sinkProgress * SINK_DISTANCE);

        // Fade out
        ship.sprite.setAlpha(1.0 - (sinkProgress * 0.8)); // Fade to 0.2 alpha

        // Optionally hide control points and boundary during sinking
        if (sinkProgress > 0.5) {
          ship.boundaryGraphics.setAlpha(0);
          ship.controlPoints.wheel.sprite.setAlpha(0);
          ship.controlPoints.sails.sprite.setAlpha(0);
          ship.controlPoints.mast.sprite.setAlpha(0);
          if (ship.cannons) {
            ship.cannons.port.forEach(c => c.sprite.setAlpha(0));
            ship.cannons.starboard.forEach(c => c.sprite.setAlpha(0));
          }
        }
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

    // c5x-ship-combat Phase 2: Update projectile physics
    const GRAVITY = 150; // px/s² (must match server)
    const LIFETIME = 2000; // ms
    const deltaS = delta / 1000; // Convert to seconds

    this.projectiles.forEach((proj, id) => {
      // Check lifetime (safety net)
      const age = Date.now() - proj.spawnTime;
      if (age > LIFETIME) {
        proj.sprite.destroy();
        this.projectiles.delete(id);
        console.log(`[GameScene] Projectile ${id} despawned (lifetime expired). Total: ${this.projectiles.size}`);
        return;
      }

      // Apply gravity (downward acceleration)
      proj.velocity.y += GRAVITY * deltaS;

      // Update position (Euler integration)
      proj.sprite.x += proj.velocity.x * deltaS;
      proj.sprite.y += proj.velocity.y * deltaS;

      // Phase 2c: Add smoke trail effect (30% chance per frame ~18 puffs/sec at 60fps)
      if (Math.random() < 0.3) {
        const trail = this.add.circle(
          proj.sprite.x,
          proj.sprite.y,
          3,
          0x888888,
          0.5
        );
        trail.setDepth(100);

        this.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 1.5,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => trail.destroy()
        });
      }

      // Phase 3: Check collision with ships (except source ship)
      let hitShip = false;
      this.ships.forEach((ship) => {
        if (ship.id === proj.sourceShip) return; // Don't hit own ship
        if (hitShip) return; // Already hit a ship this frame

        // Use existing OBB collision with generous hitbox
        const hitboxPadding = 1.2; // 20% generous hitbox
        const paddedBoundary = {
          width: ship.deckBoundary.width * hitboxPadding,
          height: ship.deckBoundary.height * hitboxPadding
        };

        if (this.isPointInRotatedRect(
          { x: proj.sprite.x, y: proj.sprite.y },
          { x: ship.sprite.x, y: ship.sprite.y },
          paddedBoundary,
          ship.rotation
        )) {
          // HIT! Show effect immediately (client prediction)
          this.createHitEffect(proj.sprite.x, proj.sprite.y);

          // Phase 5: Play hit impact sound (c5x-ship-combat)
          this.sounds?.hitImpact?.play();

          // Send hit claim to target ship for validation (include target's position/boundary for server validation)
          this.sendProjectileHitClaim(
            ship.id,
            proj.id,
            Date.now(),
            ship.sprite.x,
            ship.sprite.y,
            ship.rotation,
            ship.deckBoundary
          );

          // Despawn projectile locally
          proj.sprite.destroy();
          this.projectiles.delete(id);
          console.log(`[GameScene] Projectile ${id} hit ship ${ship.id}. Total: ${this.projectiles.size}`);
          hitShip = true;
          return;
        }
      });

      if (hitShip) return; // Skip water check if we hit a ship

      // Phase 2c: Check for water surface collision
      // ONLY check if: (1) past grace period AND (2) descending
      // Grace period prevents instant despawn from deck-level downward shots
      if (age > proj.minFlightTime && proj.velocity.y > 0) {
        const tilePos = this.map.worldToTileXY(proj.sprite.x, proj.sprite.y);
        if (tilePos) {
          const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));

          if (tile && tile.properties?.navigable === true) {
            // Projectile is over water - calculate water surface Y coordinate
            const worldPos = this.map.tileToWorldXY(Math.floor(tilePos.x), Math.floor(tilePos.y));
            if (worldPos) {
              // Water surface is at the tile's world Y position
              // Add half tile visual height to get the center/surface of the water tile
              const waterSurfaceY = worldPos.y + (TILE_VISUAL_HEIGHT / 2);

              // Check if cannonball has hit the water (with small margin for cannonball radius)
              if (proj.sprite.y >= waterSurfaceY - 5) {
                // HIT WATER! Show splash and despawn
                this.createWaterSplash(proj.sprite.x, proj.sprite.y);

                // Phase 5: Play water splash sound (c5x-ship-combat)
                this.sounds?.waterSplash?.play();

                proj.sprite.destroy();
                this.projectiles.delete(id);
                console.log(`[GameScene] Projectile ${id} hit water at (${proj.sprite.x.toFixed(1)}, ${proj.sprite.y.toFixed(1)}). Total: ${this.projectiles.size}`);
                return;
              }
            }
          }
        }
      }

      // Check if off-screen (optimization)
      const bounds = this.cameras.main.worldView;
      const margin = 100;
      if (proj.sprite.x < bounds.x - margin ||
        proj.sprite.x > bounds.right + margin ||
        proj.sprite.y < bounds.y - margin ||
        proj.sprite.y > bounds.bottom + margin) {
        proj.sprite.destroy();
        this.projectiles.delete(id);
        console.log(`[GameScene] Projectile ${id} despawned (off-screen). Total: ${this.projectiles.size}`);
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

        // Up/down arrows to adjust elevation (Option 3: True elevation control)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
          this.sendAdjustElevation(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            'up'
          );
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
          this.sendAdjustElevation(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            'down'
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

  private sendAdjustElevation(shipId: string, side: 'port' | 'starboard', index: number, adjustment: 'up' | 'down') {
    this.client.send({
      kind: 'ship/adjust_elevation',
      to: [shipId],
      payload: {
        side,
        index,
        adjustment,
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

  /**
   * Phase 3: Send projectile hit claim to SOURCE ship for validation
   * The source ship owns the projectile and can validate physics.
   * If valid, it will apply damage to the target ship.
   */
  private sendProjectileHitClaim(
    targetShipId: string,
    projectileId: string,
    timestamp: number,
    targetX: number,
    targetY: number,
    targetRotation: number,
    targetBoundary: { width: number; height: number }
  ) {
    // Extract source ship from projectile ID (format: "ship1-port-0-timestamp")
    const sourceShipId = projectileId.split('-')[0];

    this.client.send({
      kind: 'game/projectile_hit_claim',
      to: [sourceShipId], // Send to SOURCE ship (not target!)
      payload: {
        projectileId,
        targetShipId, // Include target so source knows who got hit
        targetPosition: { x: targetX, y: targetY },
        targetRotation,
        targetBoundary,
        claimedDamage: 25, // Standard cannonball damage
        timestamp,
      },
    });
    console.log(`Claimed hit on ${targetShipId} with projectile ${projectileId} (sent to ${sourceShipId})`);
  }
}
