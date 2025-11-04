import Phaser from 'phaser';
import { Howl } from 'howler';
import { MEWClient } from '@mew-protocol/mew/client';
import { Player, Ship, Direction, Projectile } from '../types.js';
import * as Constants from './utils/Constants.js';
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
import { NetworkClient } from './network/NetworkClient.js';
import { PlayerInputHandler } from './input/PlayerInputHandler.js';
import { ShipInputHandler } from './input/ShipInputHandler.js';

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
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private secondLayer?: Phaser.Tilemaps.TilemapLayer;
  private secondLayerSprites: Phaser.GameObjects.Sprite[] = []; // Individual sprites for depth sorting
  private obstacleLayer?: Phaser.Tilemaps.TilemapLayer;
  private waterLayer?: Phaser.Tilemaps.TilemapLayer;
  private shallowWaterGraphics!: Phaser.GameObjects.Graphics; // Semi-transparent water overlay for sand tiles

  // Managers
  private mapManager!: MapManager;
  private collisionManager!: CollisionManager;
  private playerManager!: PlayerManager;
  private projectileManager!: ProjectileManager;
  private shipManager!: ShipManager;

  // Renderers
  private effectsRenderer!: EffectsRenderer;
  private waterRenderer!: WaterRenderer;
  private playerRenderer!: PlayerRenderer;
  private shipRenderer!: ShipRenderer;

  // Network & Input
  private shipCommands!: ShipCommands;
  private networkClient!: NetworkClient;
  private playerInputHandler!: PlayerInputHandler;
  private shipInputHandler!: ShipInputHandler;

  // Controller support (g4p-controller-support Phase 1)
  private gamepad: Phaser.Input.Gamepad.Gamepad | null = null;
  private gamepadNotificationText?: Phaser.GameObjects.Text;

  // State
  private onShip: string | null = null; // Track if local player is on a ship
  private shipRelativePosition: { x: number; y: number } | null = null; // Position relative to ship center
  private applyingShipRotation = false; // Flag to prevent overwriting rotated position

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

    // Create graphics for shallow water overlay (renders on top of sand)
    this.shallowWaterGraphics = this.add.graphics();
    this.shallowWaterGraphics.setDepth(0.5); // Between ground (0) and ships (0)

    // Initialize renderers
    this.waterRenderer = new WaterRenderer(this, this.map, this.groundLayer, this.shallowWaterGraphics);
    this.effectsRenderer = new EffectsRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.shipRenderer = new ShipRenderer(this);

    // Create 8-direction walk animations
    this.playerRenderer.createPlayerAnimations();

    // Set up keyboard input (needed before creating input handlers)
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // Create local player sprite BEFORE input handlers need it
    const centerX = (10 - 10) * (TILE_WIDTH / 2); // = 0
    const centerY = (10 + 10) * (TILE_HEIGHT / 2); // = 320
    this.localPlayer = this.add.sprite(centerX, centerY, 'player');
    this.localPlayer.setOrigin(0.5, 0.8);
    // Depth is set dynamically in update() based on Y position

    // Set up camera to follow player
    const camera = this.cameras.main;
    const minX = -(this.map.height - 1) * (TILE_WIDTH / 2);
    const maxX = (this.map.width - 1) * (TILE_WIDTH / 2);
    const maxY = (this.map.width + this.map.height - 1) * (TILE_HEIGHT / 2);
    camera.setBounds(minX, 0, maxX - minX, maxY);
    camera.startFollow(this.localPlayer, true, 0.1, 0.1);
    camera.setZoom(1.5);

    // Create sound instances BEFORE managers that need them (c5x-ship-combat)
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

    // Initialize input handlers (now that localPlayer and cursors exist)
    this.shipInputHandler = new ShipInputHandler(
      this,
      this.ships,
      this.localPlayer,
      null as any, // Will set shipCommands after creation
      this.playerId,
      this.cursors,
      this.interactKey,
      this.spaceKey
    );

    // Initialize ship commands (uses shipInputHandler callbacks)
    this.shipCommands = new ShipCommands(
      this,
      this.client,
      this.playerId,
      this.ships,
      (shipId) => { this.shipInputHandler.setControllingShip(shipId); },
      (point) => { this.shipInputHandler.setControllingPoint(point); },
      (cannon) => { this.shipInputHandler.setControllingCannon(cannon); },
      (aim) => { this.shipInputHandler.setCurrentCannonAim(aim); }
    );

    // Connect shipCommands to shipInputHandler
    (this.shipInputHandler as any).shipCommands = this.shipCommands;

    // Connect gamepad to ship input handler (g4p Phase 1)
    this.shipInputHandler.setGamepadAccessor(() => this.gamepad);

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
      this.shipInputHandler.nearControlPoints,
      () => this.shipInputHandler.getControllingShip(),
      () => this.shipInputHandler.getControllingPoint(),
      () => this.shipInputHandler.getControllingCannon(),
      () => this.shipInputHandler.getCurrentCannonAim(),
      () => this.onShip,
      (shipId) => { this.onShip = shipId; this.shipRelativePosition = null; },
      (rotating) => { this.applyingShipRotation = rotating; }
    );

    // Initialize player input handler
    this.playerInputHandler = new PlayerInputHandler(
      this,
      this.map,
      this.groundLayer,
      this.secondLayer,
      this.localPlayer,
      this.collisionManager,
      this.playerRenderer,
      this.waterRenderer,
      this.cursors
    );

    // Connect gamepad to player input handler (g4p Phase 1)
    this.playerInputHandler.setGamepadAccessor(() => this.gamepad);

    // Initialize network client
    this.networkClient = new NetworkClient(
      this.client,
      this.playerId,
      this.localPlayer,
      this.shipManager,
      this.playerManager,
      this.projectileManager,
      () => this.playerInputHandler.getLastFacing(),
      () => TILE_WIDTH,
      () => TILE_HEIGHT,
      () => this.shipRelativePosition,
      (pos) => { this.shipRelativePosition = pos; }
    );

    // Initialize network communication
    this.networkClient.initialize();

    // Controller support (g4p-controller-support Phase 1)
    this.setupGamepadSupport();

    console.log(`Game started as ${this.playerId}`);
  }

  /**
   * Set up gamepad/controller support (g4p-controller-support Phase 1)
   */
  private setupGamepadSupport() {
    if (!this.input.gamepad) {
      console.warn('⚠ Gamepad plugin not available');
      return;
    }

    // Check for already-connected gamepads
    if (this.input.gamepad.total > 0) {
      this.gamepad = this.input.gamepad.getPad(0);
      this.onGamepadConnected(this.gamepad!);
    }

    // Listen for gamepad connections
    this.input.gamepad.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
      console.log('🎮 Gamepad connected:', pad.id);
      this.gamepad = pad;
      this.onGamepadConnected(pad);
    });

    // Listen for gamepad disconnections
    this.input.gamepad.on('disconnected', (pad: Phaser.Input.Gamepad.Gamepad) => {
      console.log('🎮 Gamepad disconnected');
      this.gamepad = null;
      this.showGamepadNotification('Controller disconnected', 3000);
    });
  }

  /**
   * Handle gamepad connection
   */
  private onGamepadConnected(pad: Phaser.Input.Gamepad.Gamepad) {
    console.log('🎮 Controller ready:', pad.id);
    console.log('   Buttons:', pad.buttons.length);
    console.log('   Axes:', pad.axes.length);

    this.showGamepadNotification('Controller connected!', 3000);
  }

  /**
   * Show gamepad notification message
   */
  private showGamepadNotification(message: string, duration: number) {
    // Remove existing notification if any
    if (this.gamepadNotificationText) {
      this.gamepadNotificationText.destroy();
    }

    // Create notification text (fixed to camera)
    const camera = this.cameras.main;
    this.gamepadNotificationText = this.add.text(
      camera.centerX,
      camera.height - 100,
      message,
      {
        fontSize: '24px',
        color: '#00ff00',
        backgroundColor: '#000000aa',
        padding: { x: 20, y: 10 },
      }
    );
    this.gamepadNotificationText.setOrigin(0.5, 0.5);
    this.gamepadNotificationText.setScrollFactor(0);
    this.gamepadNotificationText.setDepth(10000);

    // Auto-hide after duration
    this.time.delayedCall(duration, () => {
      if (this.gamepadNotificationText) {
        this.gamepadNotificationText.destroy();
        this.gamepadNotificationText = undefined;
      }
    });
  }

  update(time: number, delta: number) {
    // Rendering
    this.waterRenderer.animateVisibleWaterTiles(time);
    this.playerInputHandler.updatePlayerDepth();

    // Local player input & movement
    const velocity = this.playerInputHandler.handleMovement(
      delta,
      this.shipInputHandler.getControllingShip() !== null,
      this.onShip
    );
    this.playerInputHandler.applyWaveBobbing(time, this.onShip);

    // Network
    this.networkClient.update(time, velocity);

    // Managers update
    this.shipRelativePosition = this.shipManager.interpolateShips(
      delta,
      time,
      this.localPlayer,
      this.shipRelativePosition,
      this.applyingShipRotation
    );
    this.applyingShipRotation = false;

    this.checkShipBoundary();
    this.shipInputHandler.update();
    this.playerManager.interpolateRemotePlayers(delta, time);
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
}
