import Phaser from 'phaser';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Player, Ship, Direction } from '../types.js';

const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;
const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 20;
const MOVE_SPEED = 100; // pixels per second
const POSITION_UPDATE_RATE = 100; // ms between position updates

export class GameScene extends Phaser.Scene {
  private client!: MEWClient;
  private playerId!: string;
  private localPlayer!: Phaser.GameObjects.Sprite;
  private remotePlayers: Map<string, Player> = new Map();
  private ships: Map<string, Ship> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private streamId: string | null = null;
  private lastPositionUpdate = 0;
  private lastFacing: Direction = 'south'; // Default facing direction
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private obstacleLayer?: Phaser.Tilemaps.TilemapLayer;
  private waterLayer?: Phaser.Tilemaps.TilemapLayer;
  private interactionPrompt!: Phaser.GameObjects.Text;
  private controllingShip: string | null = null;
  private controllingPoint: 'wheel' | 'sails' | null = null;
  private onShip: string | null = null; // Track if local player is on a ship
  private shipRelativePosition: { x: number; y: number } | null = null; // Position relative to ship center

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load actual tileset image
    this.load.image('terrain', 'assets/maps/terrain.png');

    // Load Tiled map
    this.load.tilemapTiledJSON('map', 'assets/maps/map2.tmj');

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
    this.localPlayer.setDepth(1); // Render above ships

    // Set up camera to follow player
    camera.startFollow(this.localPlayer, true, 0.1, 0.1);

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // Create interaction prompt (initially hidden)
    this.interactionPrompt = this.add.text(0, 0, '', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 },
    });
    this.interactionPrompt.setOrigin(0.5, 1);
    this.interactionPrompt.setDepth(1000);
    this.interactionPrompt.setVisible(false);

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
      sprite.setDepth(1); // Render above ships

      player = {
        id: update.participantId,
        sprite,
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
        lastUpdate: update.timestamp,
        velocity: update.velocity,
        platformRef: update.platformRef,
        onShip: null,
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
      // Create new ship using graphics (large visible rectangle)
      const shipGraphics = this.add.graphics();
      shipGraphics.fillStyle(0x8b4513, 1); // Brown
      // Draw at (0,0) since generateTexture samples from (0,0)
      shipGraphics.fillRect(0, 0, update.shipData.deckBoundary.width, update.shipData.deckBoundary.height);
      shipGraphics.lineStyle(4, 0x000000, 1); // Black outline
      shipGraphics.strokeRect(0, 0, update.shipData.deckBoundary.width, update.shipData.deckBoundary.height);

      // Generate texture from graphics so we can use it as a sprite
      const key = `ship-${update.participantId}`;
      shipGraphics.generateTexture(key, update.shipData.deckBoundary.width, update.shipData.deckBoundary.height);
      shipGraphics.destroy();

      const shipSprite = this.add.sprite(
        update.worldCoords.x,
        update.worldCoords.y,
        key
      );
      // Origin at center so sprite position matches ship center
      shipSprite.setOrigin(0.5, 0.5);
      // Set depth below players but above tilemap (players are at default depth 0)
      shipSprite.setDepth(0);

      // Create control point indicators
      const wheelGraphics = this.add.graphics();
      const sailsGraphics = this.add.graphics();

      // Calculate relative positions from world positions
      const wheelRelative = {
        x: update.shipData.controlPoints.wheel.worldPosition.x - update.worldCoords.x,
        y: update.shipData.controlPoints.wheel.worldPosition.y - update.worldCoords.y,
      };
      const sailsRelative = {
        x: update.shipData.controlPoints.sails.worldPosition.x - update.worldCoords.x,
        y: update.shipData.controlPoints.sails.worldPosition.y - update.worldCoords.y,
      };

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
        targetPosition: { x: update.worldCoords.x, y: update.worldCoords.y },
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
        },
        speedLevel: update.shipData.speedLevel,
        deckBoundary: update.shipData.deckBoundary,
      };

      this.ships.set(update.participantId, ship);
      console.log(`Ship joined: ${update.participantId}`);
    } else {
      // Update existing ship
      ship.targetPosition = { x: update.worldCoords.x, y: update.worldCoords.y };
      ship.lastUpdate = update.timestamp;
      ship.velocity = update.velocity;
      ship.speedLevel = update.shipData.speedLevel;
      ship.controlPoints.wheel.controlledBy = update.shipData.controlPoints.wheel.controlledBy;
      ship.controlPoints.sails.controlledBy = update.shipData.controlPoints.sails.controlledBy;
    }

    // Draw control point indicators at current ship position
    this.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite);
    this.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite);
  }

  private drawControlPoint(
    graphics: Phaser.GameObjects.Graphics,
    controlPoint: { relativePosition: { x: number; y: number }; controlledBy: string | null },
    shipSprite: Phaser.GameObjects.Sprite
  ) {
    graphics.clear();

    // Calculate world position from ship's current position + relative offset
    const worldX = shipSprite.x + controlPoint.relativePosition.x;
    const worldY = shipSprite.y + controlPoint.relativePosition.y;

    // Draw a circle at the control point position
    const color = controlPoint.controlledBy ? 0xff0000 : 0x00ff00; // Red if controlled, green if free
    graphics.fillStyle(color, 0.5);
    graphics.fillCircle(worldX, worldY, 8);
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(worldX, worldY, 8);
  }

  update(time: number, delta: number) {
    // Handle local player movement (only if not controlling ship)
    const velocity = new Phaser.Math.Vector2(0, 0);

    // Only allow player movement if NOT currently controlling ship
    if (!this.controllingShip) {
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

        // Calculate intended new position
        const newX = this.localPlayer.x + velocity.x;
        const newY = this.localPlayer.y + velocity.y;

        // Check collision at new position
        const collision = this.checkTileCollision(newX, newY);

        if (collision.walkable) {
          // Apply movement with speed modifier
          this.localPlayer.x += velocity.x * collision.speedModifier;
          this.localPlayer.y += velocity.y * collision.speedModifier;
        }
        // If not walkable, don't move (collision!)

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

    // Publish position update at regular intervals
    if (time - this.lastPositionUpdate > POSITION_UPDATE_RATE) {
      this.publishPosition(velocity);
      this.lastPositionUpdate = time;
    }

    // Check for ship boundary detection (Phase 6a)
    this.checkShipBoundary();

    // Check for ship control point interactions
    this.checkShipInteractions();

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

        // Move local player if on this ship
        if (this.onShip === ship.id && this.shipRelativePosition) {
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

      // Always redraw control points at their current positions (they move with ship sprite)
      this.drawControlPoint(ship.controlPoints.wheel.sprite, ship.controlPoints.wheel, ship.sprite);
      this.drawControlPoint(ship.controlPoints.sails.sprite, ship.controlPoints.sails, ship.sprite);
    });

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

  private checkShipBoundary() {
    // Check if player is within any ship's deck boundary
    let foundShip: string | null = null;
    let shipRelativePos: { x: number; y: number } | null = null;

    this.ships.forEach((ship) => {
      // Calculate distance from ship center
      const dx = this.localPlayer.x - ship.sprite.x;
      const dy = this.localPlayer.y - ship.sprite.y;

      // Check if within deck boundary (rectangular area)
      const halfWidth = ship.deckBoundary.width / 2;
      const halfHeight = ship.deckBoundary.height / 2;

      if (Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight) {
        foundShip = ship.id;
        shipRelativePos = { x: dx, y: dy }; // Store position relative to ship center
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
    } else if (foundShip && shipRelativePos) {
      // Update relative position if still on same ship
      this.shipRelativePosition = shipRelativePos;
    }
  }

  private checkTileCollision(worldX: number, worldY: number): {
    walkable: boolean;
    speedModifier: number;
    terrain: string;
  } {
    // Convert world coordinates to tile coordinates
    const tilePos = this.map.worldToTileXY(worldX, worldY);

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
      controlPoint: 'wheel' | 'sails';
      distance: number;
      label: string;
    } | null = null;

    // Find closest control point
    this.ships.forEach((ship) => {
      // Calculate wheel world position from ship position + relative offset
      const wheelWorldX = ship.sprite.x + ship.controlPoints.wheel.relativePosition.x;
      const wheelWorldY = ship.sprite.y + ship.controlPoints.wheel.relativePosition.y;
      const wheelDx = wheelWorldX - this.localPlayer.x;
      const wheelDy = wheelWorldY - this.localPlayer.y;
      const wheelDistance = Math.sqrt(wheelDx * wheelDx + wheelDy * wheelDy);

      if (wheelDistance < INTERACTION_DISTANCE) {
        if (!nearestControlPoint || wheelDistance < nearestControlPoint.distance) {
          nearestControlPoint = {
            shipId: ship.id,
            controlPoint: 'wheel',
            distance: wheelDistance,
            label: 'Press E to grab wheel'
          };
        }
      }

      // Calculate sails world position from ship position + relative offset
      const sailsWorldX = ship.sprite.x + ship.controlPoints.sails.relativePosition.x;
      const sailsWorldY = ship.sprite.y + ship.controlPoints.sails.relativePosition.y;
      const sailsDx = sailsWorldX - this.localPlayer.x;
      const sailsDy = sailsWorldY - this.localPlayer.y;
      const sailsDistance = Math.sqrt(sailsDx * sailsDx + sailsDy * sailsDy);

      if (sailsDistance < INTERACTION_DISTANCE) {
        if (!nearestControlPoint || sailsDistance < nearestControlPoint.distance) {
          nearestControlPoint = {
            shipId: ship.id,
            controlPoint: 'sails',
            distance: sailsDistance,
            label: 'Press E to adjust sails'
          };
        }
      }
    });

    // Update UI prompt
    if (nearestControlPoint) {
      this.interactionPrompt.setVisible(true);
      this.interactionPrompt.setText(nearestControlPoint.label);
      this.interactionPrompt.setPosition(this.localPlayer.x, this.localPlayer.y - 30);

      // Handle E key press
      if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
        if (this.controllingPoint) {
          // Release current control
          this.sendReleaseControl();
        } else {
          // Grab new control
          this.sendGrabControl(nearestControlPoint.shipId, nearestControlPoint.controlPoint);
        }
      }
    } else {
      this.interactionPrompt.setVisible(false);
    }

    // Handle ship control inputs (when controlling wheel or sails)
    if (this.controllingShip && this.controllingPoint) {
      if (this.controllingPoint === 'wheel') {
        // Left/right arrows to steer
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
          this.sendSteer(this.controllingShip, 'left');
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
          this.sendSteer(this.controllingShip, 'right');
        }
      } else if (this.controllingPoint === 'sails') {
        // Up/down arrows to adjust speed
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
          this.sendAdjustSails(this.controllingShip, 'up');
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
          this.sendAdjustSails(this.controllingShip, 'down');
        }
      }
    }
  }

  private sendGrabControl(shipId: string, controlPoint: 'wheel' | 'sails') {
    this.client.send({
      kind: 'ship/grab_control',
      to: [shipId],
      payload: {
        controlPoint,
        playerId: this.playerId,
      },
    });

    this.controllingShip = shipId;
    this.controllingPoint = controlPoint;

    console.log(`Grabbed ${controlPoint} on ship ${shipId}`);
  }

  private sendReleaseControl() {
    if (!this.controllingShip || !this.controllingPoint) return;

    this.client.send({
      kind: 'ship/release_control',
      to: [this.controllingShip],
      payload: {
        controlPoint: this.controllingPoint,
        playerId: this.playerId,
      },
    });

    console.log(`Released ${this.controllingPoint} on ship ${this.controllingShip}`);

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
}
