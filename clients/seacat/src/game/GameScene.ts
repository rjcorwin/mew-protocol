import Phaser from 'phaser';
import { Howl } from 'howler';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Player, Ship, Direction, Projectile } from '../types.js';
import * as Constants from './utils/Constants.js';
import * as IsoMath from './utils/IsometricMath.js';
import { CollisionManager } from './managers/CollisionManager.js';
import { MapManager } from './managers/MapManager.js';
import { PlayerManager } from './managers/PlayerManager.js';
import { EffectsRenderer } from './rendering/EffectsRenderer.js';
import { WaterRenderer } from './rendering/WaterRenderer.js';
import { PlayerRenderer } from './rendering/PlayerRenderer.js';
import { ShipRenderer } from './rendering/ShipRenderer.js';

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

    // Initialize managers and renderers
    this.waterRenderer = new WaterRenderer(this, this.map);
    this.playerManager = new PlayerManager(this, this.map, this.groundLayer, this.secondLayer, this.waterRenderer, this.remotePlayers);
    this.effectsRenderer = new EffectsRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.shipRenderer = new ShipRenderer(this);

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
            this.updateShip(update);
          } else {
            // Update or create remote player
            this.playerManager.updateRemotePlayer(update);
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
      // Set origin to align deck/hull with center, not the entire sprite including mast
      // The mast extends upward, so we place origin lower (higher Y value)
      // Origin (0.5, 0.7) means: center horizontally, but 70% down vertically
      // This puts the hull/deck at the center, with mast extending above
      shipSprite.setOrigin(0.5, 0.7);
      shipSprite.setDepth(1); // Above ground tiles

      // Scale sprite to appropriate size for the ship
      // Sprite frames are 256x256, deck boundary is 128x48
      // Scale to fit: 128/256 = 0.5, then multiply by desired size (1.5x)
      const baseScale = (128 / 256) * 1.5; // 0.5 * 1.5 = 0.75
      shipSprite.setScale(baseScale); // Uniform scaling

      // Set initial sprite frame based on ship rotation (s6r-ship-sprite-rendering)
      const initialFrameIndex = this.shipRenderer.calculateShipSpriteFrame(update.shipData.rotation);
      shipSprite.setFrame(initialFrameIndex);

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

      // NOTE: Don't call setRotation() on sprite - rotation is shown via sprite frames (s6r-ship-sprite-rendering)
      // The frame was already set above via calculateShipSpriteFrame()

      this.ships.set(update.participantId, ship);
      console.log(`Ship joined: ${update.participantId}`);

      // Send map data to newly joined ship
      this.mapManager.sendMapDataToShips();
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
        this.playerManager.teleportPlayersOffShip(ship.id);
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

      // Update ship sprite frame to match rotation (s6r-ship-sprite-rendering)
      // NOTE: Don't call setRotation() - rotation is shown via sprite frames, not sprite rotation
      const frameIndex = this.shipRenderer.calculateShipSpriteFrame(update.shipData.rotation);
      ship.sprite.setFrame(frameIndex);

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
          const rotatedWorldPos = IsoMath.rotatePointIsometric(this.shipRelativePosition, ship.rotation);
          this.localPlayer.x = ship.sprite.x + rotatedWorldPos.x;
          this.localPlayer.y = ship.sprite.y + rotatedWorldPos.y;

          console.log(`Player rotated to world pos (${this.localPlayer.x.toFixed(1)}, ${this.localPlayer.y.toFixed(1)})`);
        }

        // Rotate remote players on this ship
        this.playerManager.rotatePlayersOnShip(ship.id, rotationDelta);
      }
    }

    // Draw ship boundary and control point indicators at current ship position
    this.shipRenderer.drawShipBoundary(ship.boundaryGraphics, ship.sprite, ship.deckBoundary, ship.rotation);
    this.shipRenderer.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite, this.nearControlPoints.has(`${ship.id}:wheel`), 'wheel', ship.rotation);
    this.shipRenderer.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite, this.nearControlPoints.has(`${ship.id}:sails`), 'sails', ship.rotation);
    this.shipRenderer.drawControlPoint(ship.controlPoints.mast.sprite, ship.controlPoints.mast, ship.sprite, this.nearControlPoints.has(`${ship.id}:mast`), 'mast', ship.rotation);

    // c5x-ship-combat: Draw cannon control points
    if (ship.cannons) {
      ship.cannons.port.forEach((cannon, index) => {
        const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-port-${index}`);
        const isControlledByUs = this.controllingShip === ship.id &&
          this.controllingPoint === 'cannon' &&
          this.controllingCannon?.side === 'port' &&
          this.controllingCannon?.index === index;
        this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.currentCannonAim);
      });
      ship.cannons.starboard.forEach((cannon, index) => {
        const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-starboard-${index}`);
        const isControlledByUs = this.controllingShip === ship.id &&
          this.controllingPoint === 'cannon' &&
          this.controllingCannon?.side === 'starboard' &&
          this.controllingCannon?.index === index;
        this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.currentCannonAim);
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
    this.effectsRenderer.createCannonBlast(position.x, position.y);
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
        this.playerManager.movePlayersOnShip(ship.id, shipDx, shipDy);
      }

      // Apply wave bobbing to ship at its current position
      const currentWaveOffset = this.waterRenderer.calculateWaveHeightAtPosition(ship.sprite.x, ship.sprite.y, time);
      const waveYDelta = currentWaveOffset - ship.lastWaveOffset;
      ship.sprite.y += waveYDelta;
      ship.lastWaveOffset = currentWaveOffset;

      // Move local player with wave delta if on this ship
      if (this.onShip === ship.id) {
        this.localPlayer.y += waveYDelta;
      }

      // Move remote players with wave delta if on this ship
      this.playerManager.movePlayersOnShip(ship.id, 0, waveYDelta);

      // Update shipRelativePosition from current player world position
      // This needs to happen every frame so player movement updates the relative position
      // BUT skip this frame if we just applied a rotation (to avoid overwriting the rotated position)
      if (this.onShip === ship.id && !this.applyingShipRotation) {
        const dx = this.localPlayer.x - ship.sprite.x;
        const dy = this.localPlayer.y - ship.sprite.y;

        // Rotate to ship-local coordinates using isometric rotation (i2m-true-isometric Phase 3)
        const offset = { x: dx, y: dy };
        this.shipRelativePosition = IsoMath.rotatePointIsometric(offset, -ship.rotation);
      }

      // Always redraw control points and ship boundary at their current positions (they move with ship sprite)
      this.shipRenderer.drawShipBoundary(ship.boundaryGraphics, ship.sprite, ship.deckBoundary, ship.rotation);
      this.shipRenderer.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite, this.nearControlPoints.has(`${ship.id}:wheel`), 'wheel', ship.rotation);
      this.shipRenderer.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite, this.nearControlPoints.has(`${ship.id}:sails`), 'sails', ship.rotation);
      this.shipRenderer.drawControlPoint(ship.controlPoints.mast.sprite, ship.controlPoints.mast, ship.sprite, this.nearControlPoints.has(`${ship.id}:mast`), 'mast', ship.rotation);

      // c5x-ship-combat: Draw cannon control points
      if (ship.cannons) {
        ship.cannons.port.forEach((cannon, index) => {
          const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-port-${index}`);
          const isControlledByUs = this.controllingShip === ship.id &&
            this.controllingPoint === 'cannon' &&
            this.controllingCannon?.side === 'port' &&
            this.controllingCannon?.index === index;
          this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.currentCannonAim);
        });
        ship.cannons.starboard.forEach((cannon, index) => {
          const isPlayerNear = this.nearControlPoints.has(`${ship.id}:cannon-starboard-${index}`);
          const isControlledByUs = this.controllingShip === ship.id &&
            this.controllingPoint === 'cannon' &&
            this.controllingCannon?.side === 'starboard' &&
            this.controllingCannon?.index === index;
          this.shipRenderer.drawCannon(cannon.sprite, cannon, ship.sprite, ship.rotation, isPlayerNear, isControlledByUs, this.currentCannonAim);
        });
      }

      // Phase 3: Draw health bar above ship
      this.effectsRenderer.drawHealthBar(ship.sprite.x, ship.sprite.y - 40, ship.health, ship.maxHealth);

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
    this.playerManager.interpolateRemotePlayers(delta, time);

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

        if (this.collisionManager.isPointInRotatedRect(
          { x: proj.sprite.x, y: proj.sprite.y },
          { x: ship.sprite.x, y: ship.sprite.y },
          paddedBoundary,
          ship.rotation
        )) {
          // HIT! Show effect immediately (client prediction)
          this.effectsRenderer.createHitEffect(proj.sprite.x, proj.sprite.y);

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
                this.effectsRenderer.createWaterSplash(proj.sprite.x, proj.sprite.y);

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
