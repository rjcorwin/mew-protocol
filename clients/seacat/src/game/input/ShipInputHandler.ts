import Phaser from 'phaser';
import { Ship } from '../../types.js';
import { ShipCommands } from '../network/ShipCommands.js';
import * as IsoMath from '../utils/IsometricMath.js';

/**
 * Handles all ship interaction detection and control input processing.
 *
 * This is a complex input handler that detects when the player is near ship control
 * points, manages grabbing/releasing controls via E key, and processes all ship
 * control inputs including steering, sail adjustment, and cannon operation. It tracks
 * local control state and provides visual feedback for interactable control points.
 *
 * Responsibilities:
 * - Detect proximity to all ship control points (wheel, sails, mast, cannons)
 * - Calculate world positions of control points using isometric rotation
 * - Find and highlight nearest available control point for interaction
 * - Handle E key for grabbing/releasing ship controls
 * - Process wheel steering with continuous left/right input
 * - Process sail adjustment with up/down keys
 * - Process cannon aiming (left/right), elevation (up/down), and firing (space)
 * - Manage local control state (which ship, which control type, which cannon)
 * - Provide UI state for rendering yellow interaction indicators
 * - Validate control availability (not controlled by other players)
 *
 * Dependencies:
 * - ShipCommands for sending control commands to ship servers
 * - IsometricMath for rotating control point positions
 * - Phaser keyboard input system
 *
 * @example
 * ```typescript
 * const shipInputHandler = new ShipInputHandler(
 *   scene,
 *   ships,
 *   playerSprite,
 *   shipCommands,
 *   playerId,
 *   cursors,
 *   interactKey,
 *   spaceKey
 * );
 *
 * // In game loop:
 * shipInputHandler.update();
 *
 * // Get control state for other systems:
 * const controlling = shipInputHandler.getControllingShip();
 * const nearPoints = shipInputHandler.nearControlPoints;
 * ```
 */
export class ShipInputHandler {
  private scene: Phaser.Scene;
  private ships: Map<string, Ship>;
  private localPlayer: Phaser.GameObjects.Sprite;
  private shipCommands: ShipCommands;
  private playerId: string;

  // Input keys
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private interactKey: Phaser.Input.Keyboard.Key;
  private spaceKey: Phaser.Input.Keyboard.Key;

  // Control state
  private controllingShip: string | null = null;
  private controllingPoint: 'wheel' | 'sails' | 'mast' | 'cannon' | null = null;
  private controllingCannon: { side: 'port' | 'starboard', index: number } | null = null;
  private currentWheelDirection: 'left' | 'right' | null = null;
  private currentCannonAim: number = 0;

  // UI indicators
  public nearControlPoints: Set<string> = new Set();

  private static readonly INTERACTION_DISTANCE = 30; // pixels

  constructor(
    scene: Phaser.Scene,
    ships: Map<string, Ship>,
    localPlayer: Phaser.GameObjects.Sprite,
    shipCommands: ShipCommands,
    playerId: string,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    interactKey: Phaser.Input.Keyboard.Key,
    spaceKey: Phaser.Input.Keyboard.Key
  ) {
    this.scene = scene;
    this.ships = ships;
    this.localPlayer = localPlayer;
    this.shipCommands = shipCommands;
    this.playerId = playerId;
    this.cursors = cursors;
    this.interactKey = interactKey;
    this.spaceKey = spaceKey;
  }

  /**
   * Main update loop - checks for ship interactions and processes input
   */
  public update(): void {
    this.checkShipInteractions();
  }

  /**
   * Get current control state (used by GameScene)
   */
  public getControllingShip(): string | null {
    return this.controllingShip;
  }

  public getControllingPoint(): 'wheel' | 'sails' | 'mast' | 'cannon' | null {
    return this.controllingPoint;
  }

  public getControllingCannon(): { side: 'port' | 'starboard', index: number } | null {
    return this.controllingCannon;
  }

  public getCurrentCannonAim(): number {
    return this.currentCannonAim;
  }

  /**
   * Set control state (used by ShipCommands callbacks)
   */
  public setControllingShip(shipId: string | null): void {
    this.controllingShip = shipId;
  }

  public setControllingPoint(point: 'wheel' | 'sails' | 'mast' | 'cannon' | null): void {
    this.controllingPoint = point;
  }

  public setControllingCannon(cannon: { side: 'port' | 'starboard', index: number } | null): void {
    this.controllingCannon = cannon;
  }

  public setCurrentCannonAim(aim: number): void {
    this.currentCannonAim = aim;
  }

  private checkShipInteractions(): void {
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

      if (wheelDistance < ShipInputHandler.INTERACTION_DISTANCE) {
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

      if (sailsDistance < ShipInputHandler.INTERACTION_DISTANCE) {
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

      if (mastDistance < ShipInputHandler.INTERACTION_DISTANCE) {
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

          if (cannonDistance < ShipInputHandler.INTERACTION_DISTANCE) {
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

          if (cannonDistance < ShipInputHandler.INTERACTION_DISTANCE) {
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
