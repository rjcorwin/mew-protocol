import Phaser from 'phaser';
import { Direction } from '../../types.js';
import { CollisionManager } from '../managers/CollisionManager.js';
import { PlayerRenderer } from '../rendering/PlayerRenderer.js';
import { WaterRenderer } from '../rendering/WaterRenderer.js';
import * as Constants from '../utils/Constants.js';

const {
  MOVE_SPEED,
  ISO_NORTHEAST,
  ISO_SOUTHEAST,
  ISO_SOUTHWEST,
  ISO_NORTHWEST
} = Constants;

/**
 * Handles local player keyboard input, movement physics, and visual updates.
 *
 * This handler processes arrow key input and translates it to movement in isometric
 * space, handling collision detection, terrain speed modifiers, animations, and
 * water bobbing effects. It manages all aspects of local player control when not
 * controlling a ship.
 *
 * Responsibilities:
 * - Process arrow key input for 4-directional movement
 * - Calculate velocity vectors in isometric coordinate space
 * - Check tile collision and apply terrain-based speed modifiers (water, grass, etc.)
 * - Update player animations based on movement direction
 * - Apply realistic wave bobbing effects when player is in water
 * - Handle depth sorting relative to Layer 2 environmental tiles
 * - Disable movement when player is controlling a ship
 *
 * Dependencies:
 * - CollisionManager for tile collision checks
 * - PlayerRenderer for animation updates
 * - WaterRenderer for wave height calculations
 * - Phaser keyboard input system
 *
 * @example
 * ```typescript
 * const playerInputHandler = new PlayerInputHandler(
 *   scene,
 *   map,
 *   groundLayer,
 *   secondLayer,
 *   playerSprite,
 *   collisionManager,
 *   playerRenderer,
 *   waterRenderer,
 *   cursors
 * );
 *
 * // In game loop:
 * const velocity = playerInputHandler.handleMovement(
 *   delta,
 *   controllingShip,
 *   onShip
 * );
 * playerInputHandler.applyWaveBobbing(time, onShip);
 * playerInputHandler.updatePlayerDepth();
 * ```
 */
export class PlayerInputHandler {
  private scene: Phaser.Scene;
  private map: Phaser.Tilemaps.Tilemap;
  private groundLayer: Phaser.Tilemaps.TilemapLayer;
  private secondLayer?: Phaser.Tilemaps.TilemapLayer;
  private localPlayer: Phaser.GameObjects.Sprite;
  private collisionManager: CollisionManager;
  private playerRenderer: PlayerRenderer;
  private waterRenderer: WaterRenderer;

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private gamepad: (() => Phaser.Input.Gamepad.Gamepad | null) | null = null; // g4p Phase 1
  private lastFacing: Direction = 'south';
  private lastPlayerWaveOffset: number = 0;

  // Deadzone for analog stick (g4p Phase 1)
  private static readonly STICK_DEADZONE = 0.15;

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    groundLayer: Phaser.Tilemaps.TilemapLayer,
    secondLayer: Phaser.Tilemaps.TilemapLayer | undefined,
    localPlayer: Phaser.GameObjects.Sprite,
    collisionManager: CollisionManager,
    playerRenderer: PlayerRenderer,
    waterRenderer: WaterRenderer,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys
  ) {
    this.scene = scene;
    this.map = map;
    this.groundLayer = groundLayer;
    this.secondLayer = secondLayer;
    this.localPlayer = localPlayer;
    this.collisionManager = collisionManager;
    this.playerRenderer = playerRenderer;
    this.waterRenderer = waterRenderer;
    this.cursors = cursors;
  }

  /**
   * Set gamepad accessor function (g4p Phase 1)
   */
  public setGamepadAccessor(accessor: () => Phaser.Input.Gamepad.Gamepad | null): void {
    this.gamepad = accessor;
  }

  /**
   * Update player depth based on Layer 2 tiles
   */
  public updatePlayerDepth(): void {
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
  }

  /**
   * Get gamepad left stick input with deadzone (g4p Phase 1)
   * @returns stick vector or null if no gamepad/within deadzone
   */
  private getGamepadStick(): { x: number; y: number } | null {
    if (!this.gamepad) return null;

    const pad = this.gamepad();
    if (!pad) return null;

    const stick = pad.leftStick;
    const length = Math.sqrt(stick.x * stick.x + stick.y * stick.y);

    // Apply deadzone
    if (length < PlayerInputHandler.STICK_DEADZONE) {
      return null;
    }

    return { x: stick.x, y: stick.y };
  }

  /**
   * Handle player movement input and return velocity
   * @returns velocity vector for this frame
   */
  public handleMovement(
    delta: number,
    controllingShip: boolean,
    onShip: string | null
  ): Phaser.Math.Vector2 {
    const velocity = new Phaser.Math.Vector2(0, 0);

    // Only allow player movement if NOT currently controlling ship
    if (!controllingShip) {
      // g4p Phase 1: Check gamepad stick first (takes priority if detected)
      const stickInput = this.getGamepadStick();

      if (stickInput) {
        // Gamepad stick input detected - convert to screen-space velocity
        // Stick X = horizontal screen movement (left/right)
        // Stick Y = vertical screen movement (up/down)
        // Each screen direction combines isometric diamond axes
        velocity.x = stickInput.x * (ISO_NORTHEAST.x + ISO_SOUTHEAST.x) +
                     stickInput.y * (ISO_SOUTHEAST.x + ISO_SOUTHWEST.x);
        velocity.y = stickInput.x * (ISO_NORTHEAST.y + ISO_SOUTHEAST.y) +
                     stickInput.y * (ISO_SOUTHEAST.y + ISO_SOUTHWEST.y);
      } else {
        // No gamepad input - use keyboard
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
      }

      // Normalize diagonal movement
      if (velocity.length() > 0) {
        velocity.normalize();
        velocity.scale(MOVE_SPEED * (delta / 1000));

        // Calculate intended new position
        const newX = this.localPlayer.x + velocity.x;
        const newY = this.localPlayer.y + velocity.y;

        // If on ship, use full speed (no tile speed modifier)
        if (onShip) {
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

    return velocity;
  }

  /**
   * Apply wave bobbing effect to player when in water
   */
  public applyWaveBobbing(time: number, onShip: string | null): void {
    if (!onShip) {
      // Check if player is standing in water
      const tilePos = this.map.worldToTileXY(this.localPlayer.x, this.localPlayer.y);
      if (tilePos) {
        const tile = this.groundLayer.getTileAt(Math.floor(tilePos.x), Math.floor(tilePos.y));
        if (tile && tile.properties?.navigable === true) {
          // Player is in water, apply wave offset delta
          const currentWaveOffset = this.waterRenderer.calculateWaveHeightAtPosition(
            this.localPlayer.x,
            this.localPlayer.y,
            time
          );
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
  }

  /**
   * Get the last facing direction (needed for network updates)
   */
  public getLastFacing(): Direction {
    return this.lastFacing;
  }
}
