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

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Get client and player ID from registry
    this.client = this.registry.get('mewClient') as MEWClient;
    this.playerId = this.registry.get('playerId') as string;

    // Set up camera
    const camera = this.cameras.main;
    // Isometric grid extends from negative X to positive X
    // Leftmost point: (0, WORLD_HEIGHT-1) → screenX = (0 - 19) * 32 = -608
    // Rightmost point: (WORLD_WIDTH-1, 0) → screenX = (19 - 0) * 32 = 608
    // Total width: 1216 pixels, centered around X=0
    const minX = -(WORLD_HEIGHT - 1) * (TILE_WIDTH / 2);
    const maxX = (WORLD_WIDTH - 1) * (TILE_WIDTH / 2);
    const maxY = (WORLD_WIDTH + WORLD_HEIGHT - 1) * (TILE_HEIGHT / 2);
    camera.setBounds(minX, 0, maxX - minX, maxY);

    // Create isometric grid (visual only, for now just a simple ground)
    this.createIsometricGround();

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

  private createIsometricGround() {
    const graphics = this.add.graphics();

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const screenX = (x - y) * (TILE_WIDTH / 2);
        const screenY = (x + y) * (TILE_HEIGHT / 2);

        // Draw diamond-shaped tiles
        graphics.lineStyle(1, 0x333333, 0.5);
        graphics.fillStyle((x + y) % 2 === 0 ? 0x3a6e2f : 0x4a7e3f, 1);

        graphics.beginPath();
        graphics.moveTo(screenX, screenY);
        graphics.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        graphics.lineTo(screenX, screenY + TILE_HEIGHT);
        graphics.lineTo(screenX - TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
        graphics.closePath();
        graphics.fillPath();
        graphics.strokePath();
      }
    }
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
