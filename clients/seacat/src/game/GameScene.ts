import Phaser from 'phaser';
import { Howl } from 'howler';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Player, Ship, Direction, Projectile } from '../types.js';
import * as Constants from './utils/Constants.js';
import * as IsoMath from './utils/IsometricMath.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { MapManager } from './managers/MapManager.js';
import { PlayerManager } from './managers/PlayerManager.js';
import { ProjectileManager } from './managers/ProjectileManager.js';
import { ShipManager } from './managers/ShipManager.js';
import { EffectsRenderer } from './rendering/EffectsRenderer.js';
import { WaterRenderer } from './rendering/WaterRenderer.js';
import { PlayerRenderer } from './rendering/PlayerRenderer.js';
import { ShipRenderer } from './rendering/ShipRenderer.js';
import { ShipCommands } from './network/ShipCommands.js';

const {
  TILE_WIDTH,
  TILE_HEIGHT,
  TILE_VISUAL_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  MOVE_SPEED,
  POSITION_UPDATE_RATE,
  ISO_NORTHEAST,
  ISO_SOUTHEAST,
  ISO_SOUTHWEST,
  ISO_NORTHWEST
} = Constants;

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
  private mapManager!: MapManager;
  private collisionManager!: CollisionManager;
  private playerManager!: PlayerManager;
  private projectileManager!: ProjectileManager;
  private shipManager!: ShipManager;
  private shipCommands!: ShipCommands;
  private effectsRenderer!: EffectsRenderer;
  private waterRenderer!: WaterRenderer;
  private playerRenderer!: PlayerRenderer;
  private shipRenderer!: ShipRenderer;
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
    this.load.tilemapTiledJSON('map', 'assets/maps/map1.tmj');

    // Load player sprite sheet (8 directions, 4 frames each)
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Load ship sprite sheet (s6r-ship-sprite-rendering)
    // 64 rotation frames (5.625° per frame) in 8×8 grid
    // Frames are 256x256 (increased from 128 for sharper rendering when scaled)
    this.load.spritesheet('ship1', 'assets/sprites/ship1.png', {
      frameWidth: 256,
      frameHeight: 256,
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

    // Initialize MapManager and load map
    this.mapManager = new MapManager(this, this.client);
    this.mapManager.loadTiledMap();

    // Get map layers from MapManager
    this.map = this.mapManager.getMap();
    this.groundLayer = this.mapManager.getGroundLayer();
    this.secondLayer = this.mapManager.getSecondLayer();
    this.secondLayerSprites = this.mapManager.getSecondLayerSprites();
    this.obstacleLayer = this.mapManager.getObstacleLayer();
    this.waterLayer = this.mapManager.getWaterLayer();

    // Initialize collision manager
    this.collisionManager = new CollisionManager(
      this,
      this.map,
      this.groundLayer,
      this.secondLayer,
      this.obstacleLayer,
      this.waterLayer
    );

    // Initialize renderers
    this.waterRenderer = new WaterRenderer(this, this.map);
    this.effectsRenderer = new EffectsRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.shipRenderer = new ShipRenderer(this);

    // Initialize ship commands first (needed by other managers)
    this.shipCommands = new ShipCommands(
      this,
      this.client,
      this.playerId,
      this.ships,
      (shipId) => { this.controllingShip = shipId; },
      (point) => { this.controllingPoint = point; },
      (cannon) => { this.controllingCannon = cannon; },
      (aim) => { this.currentCannonAim = aim; }
    );

    // Initialize managers
    this.playerManager = new PlayerManager(this, this.map, this.groundLayer, this.secondLayer, this.waterRenderer, this.remotePlayers);
    this.projectileManager = new ProjectileManager(
      this,
      this.map,
      this.groundLayer,
      this.projectiles,
      this.collisionManager,
      this.effectsRenderer,
      this.sounds,
      () => this.onShip,
      this.shipCommands
    );
    this.shipManager = new ShipManager(
      this,
      this.ships,
      this.mapManager,
      this.playerManager,
      this.shipRenderer,
      this.waterRenderer,
      this.effectsRenderer,
      this.sounds,
      this.nearControlPoints,
      this.controllingShip,
      this.controllingPoint,
      this.controllingCannon,
      this.currentCannonAim,
      () => this.onShip,
      (shipId) => { this.onShip = shipId; this.shipRelativePosition = null; },
      (rotating) => { this.applyingShipRotation = rotating; }
    );

    // Create graphics for shallow water overlay (renders on top of sand)
    this.shallowWaterGraphics = this.add.graphics();
    this.shallowWaterGraphics.setDepth(0.5); // Between ground (0) and ships (0)

    // Create 8-direction walk animations
    this.playerRenderer.createPlayerAnimations();

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
            this.shipRelativePosition = this.shipManager.updateShip(
              update,
              this.playerId,
              this.localPlayer,
              this.shipRelativePosition
            );
          } else {
            // Update or create remote player
            this.playerManager.updateRemotePlayer(update);
          }
        } catch (error) {
          console.error('Failed to parse position update:', error);
        }
      } else if (envelope.kind === 'game/projectile_spawn') {
        // c5x-ship-combat Phase 2: Handle projectile spawn
        this.projectileManager.spawnProjectile(envelope.payload);
      }
    });
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
          const collision = this.collisionManager.checkTileCollision(newX, newY);

          if (collision.walkable) {
            // Apply movement with speed modifier from terrain
            this.localPlayer.x += velocity.x * collision.speedModifier;
            this.localPlayer.y += velocity.y * collision.speedModifier;
          }
          // If not walkable, don't move (collision!)
        }

        // Update animation based on movement direction and store facing
        this.lastFacing = this.playerRenderer.updatePlayerAnimation(this.localPlayer, velocity);
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
          const currentWaveOffset = this.waterRenderer.calculateWaveHeightAtPosition(this.localPlayer.x, this.localPlayer.y, time);
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
    this.shipRelativePosition = this.shipManager.interpolateShips(
      delta,
      time,
      this.localPlayer,
      this.shipRelativePosition,
      this.applyingShipRotation
    );

    // Clear the rotation flag after all ships are processed
    this.applyingShipRotation = false;

    // Check for ship boundary detection AFTER ship position updates
    // (so player can walk off the ship)
    this.checkShipBoundary();

    // Check for ship control point interactions
    this.checkShipInteractions();

    // Interpolate remote players toward their target positions
    this.playerManager.interpolateRemotePlayers(delta, time);

    // c5x-ship-combat Phase 2: Update projectile physics
    this.projectileManager.updateProjectiles(delta, this.ships);
  }


  private checkShipBoundary() {
    // Check if player is within any ship's deck boundary (using OBB for rotated ships)
    const result = this.collisionManager.checkShipBoundary(
      { x: this.localPlayer.x, y: this.localPlayer.y },
      this.ships
    );

    const foundShip = result ? result.shipId : null;
    const shipRelativePos = result ? result.relativePosition : null;

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
      const rotatedWheelPos = IsoMath.rotatePointIsometric(ship.controlPoints.wheel.relativePosition, ship.rotation);
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
      const rotatedSailsPos = IsoMath.rotatePointIsometric(ship.controlPoints.sails.relativePosition, ship.rotation);
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
      const rotatedMastPos = IsoMath.rotatePointIsometric(ship.controlPoints.mast.relativePosition, ship.rotation);
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
          const rotatedCannonPos = IsoMath.rotatePointIsometric(cannon.relativePosition, ship.rotation);
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
          const rotatedCannonPos = IsoMath.rotatePointIsometric(cannon.relativePosition, ship.rotation);
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
        this.shipCommands.releaseControl(this.controllingShip, this.controllingPoint, this.controllingCannon);
      } else if (nearestControlPoint) {
        // Grab nearest control point (only if within range)
        if (nearestControlPoint.controlPoint === 'cannon' &&
          nearestControlPoint.cannonSide !== undefined &&
          nearestControlPoint.cannonIndex !== undefined) {
          // Grab cannon
          this.shipCommands.grabCannon(
            nearestControlPoint.shipId,
            nearestControlPoint.cannonSide,
            nearestControlPoint.cannonIndex
          );
        } else {
          // Grab wheel, sails, or mast
          this.shipCommands.grabControl(nearestControlPoint.shipId, nearestControlPoint.controlPoint as 'wheel' | 'sails' | 'mast');
        }
      }
    }

    // Handle ship control inputs (when controlling wheel or sails)
    if (this.controllingShip && this.controllingPoint) {
      if (this.controllingPoint === 'wheel') {
        // w3l-wheel-steering: Use isDown for continuous wheel turning
        if (this.cursors.left?.isDown) {
          if (!this.currentWheelDirection || this.currentWheelDirection !== 'left') {
            this.shipCommands.wheelTurnStart(this.controllingShip, 'left');
            this.currentWheelDirection = 'left';
          }
        } else if (this.cursors.right?.isDown) {
          if (!this.currentWheelDirection || this.currentWheelDirection !== 'right') {
            this.shipCommands.wheelTurnStart(this.controllingShip, 'right');
            this.currentWheelDirection = 'right';
          }
        } else {
          // Neither key pressed - stop turning if we were turning
          if (this.currentWheelDirection) {
            this.shipCommands.wheelTurnStop(this.controllingShip);
            this.currentWheelDirection = null;
          }
        }
      } else if (this.controllingPoint === 'sails') {
        // Up/down arrows to adjust speed
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
          this.shipCommands.adjustSails(this.controllingShip, 'up');
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
          this.shipCommands.adjustSails(this.controllingShip, 'down');
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
          this.shipCommands.aimCannon(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            this.currentCannonAim
          );
        }

        // Up/down arrows to adjust elevation (Option 3: True elevation control)
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
          this.shipCommands.adjustElevation(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            'up'
          );
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
          this.shipCommands.adjustElevation(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            'down'
          );
        }

        // Space bar to fire cannon
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
          this.shipCommands.fireCannon(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index
          );
        }
      }
    }
  }

}
