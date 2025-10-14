import Phaser from 'phaser';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Player } from '../types.js';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 20;
const MOVE_SPEED = 100; // pixels per second
const POSITION_UPDATE_RATE = 100; // ms between position updates

export class GameScene extends Phaser.Scene {
  private client!: MEWClient;
  private playerId!: string;
  private localPlayer!: Phaser.GameObjects.Sprite;
  private remotePlayers: Map<string, Player> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private streamId: string | null = null;
  private lastPositionUpdate = 0;
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private obstacleLayer?: Phaser.Tilemaps.TilemapLayer;
  private waterLayer?: Phaser.Tilemaps.TilemapLayer;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Generate procedural tileset texture
    this.generateTilesetTexture();

    // Load Tiled map
    this.load.tilemapTiledJSON('map', 'assets/maps/example-map.tmj');
  }

  create() {
    // Get client and player ID from registry
    this.client = this.registry.get('mewClient') as MEWClient;
    this.playerId = this.registry.get('playerId') as string;

    // Load Tiled map
    this.loadTiledMap();

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
    this.localPlayer.setTint(0x00ff00); // Green for local player

    // Create a simple circle as placeholder sprite
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 24, 12);
    graphics.lineStyle(2, 0x000000, 1);
    graphics.strokeCircle(16, 24, 12);
    graphics.generateTexture('player', 32, 32);
    graphics.destroy();

    // Set up camera to follow player
    camera.startFollow(this.localPlayer, true, 0.1, 0.1);

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();

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

    // Tile colors: grass, sand, water, wall, stone
    const tileColors = [
      0x3a6e2f, // 0: grass (green)
      0xc2b280, // 1: sand (tan)
      0x4a90e2, // 2: water (blue)
      0x666666, // 3: wall (gray)
      0x808080  // 4: stone (light gray)
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

    // Create layers
    const ground = this.map.createLayer('Ground', tileset, 0, 0);
    if (ground) {
      this.groundLayer = ground;
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

          // Update or create remote player
          this.updateRemotePlayer(update);
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

      player = {
        id: update.participantId,
        sprite,
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
        lastUpdate: update.timestamp,
        velocity: update.velocity,
        platformRef: update.platformRef,
      };

      this.remotePlayers.set(update.participantId, player);
      console.log(`Remote player joined: ${update.participantId}`);
    } else {
      // Update existing player's target position
      player.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
      player.lastUpdate = update.timestamp;
      player.velocity = update.velocity;
    }
  }

  update(time: number, delta: number) {
    // Handle local player movement
    const velocity = new Phaser.Math.Vector2(0, 0);

    if (this.cursors.left?.isDown) {
      velocity.x -= 1;
    }
    if (this.cursors.right?.isDown) {
      velocity.x += 1;
    }
    if (this.cursors.up?.isDown) {
      velocity.y -= 1;
    }
    if (this.cursors.down?.isDown) {
      velocity.y += 1;
    }

    // Normalize diagonal movement
    if (velocity.length() > 0) {
      velocity.normalize();
      velocity.scale(MOVE_SPEED * (delta / 1000));

      this.localPlayer.x += velocity.x;
      this.localPlayer.y += velocity.y;
    }

    // Publish position update at regular intervals
    if (time - this.lastPositionUpdate > POSITION_UPDATE_RATE) {
      this.publishPosition(velocity);
      this.lastPositionUpdate = time;
    }

    // Interpolate remote players toward their target positions
    this.remotePlayers.forEach((player) => {
      const dx = player.targetPosition.x - player.sprite.x;
      const dy = player.targetPosition.y - player.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 1) {
        // Smooth interpolation
        const factor = Math.min(1, (delta / 1000) * 5); // Adjust speed as needed
        player.sprite.x += dx * factor;
        player.sprite.y += dy * factor;
      }
    });
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
}
