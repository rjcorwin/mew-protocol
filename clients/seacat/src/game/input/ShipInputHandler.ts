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
  private gamepad: (() => Phaser.Input.Gamepad.Gamepad | null) | null = null; // g4p Phase 1

  // Control state
  private controllingShip: string | null = null;
  private controllingPoint: 'wheel' | 'sails' | 'mast' | 'cannon' | null = null;
  private controllingCannon: { side: 'port' | 'starboard', index: number } | null = null;
  private currentWheelDirection: 'left' | 'right' | null = null;
  private currentCannonAim: number = 0;

  // Gamepad button state tracking (g4p Phase 1)
  private lastInteractButtonState = false;
  private lastFireButtonState = false;
  private lastSailUpState = false;
  private lastSailDownState = false;
  private lastElevationUpState = false;
  private lastElevationDownState = false;

  // UI indicators
  public nearControlPoints: Set<string> = new Set();

  private static readonly INTERACTION_DISTANCE = 30; // pixels
  private static readonly DPAD_THRESHOLD = 0.5; // D-pad axis threshold

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
   * Set gamepad accessor function (g4p Phase 1)
   */
  public setGamepadAccessor(accessor: () => Phaser.Input.Gamepad.Gamepad | null): void {
    this.gamepad = accessor;
  }

  /**
   * Check if interact button was just pressed (keyboard E or gamepad A) (g4p Phase 1)
   */
  private isInteractJustPressed(): boolean {
    // Check keyboard
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      return true;
    }

    // Check gamepad A button (button 0)
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.A) {
        const pressed = pad.A;
        const justPressed = pressed && !this.lastInteractButtonState;
        this.lastInteractButtonState = pressed;
        return justPressed;
      }
    }

    this.lastInteractButtonState = false;
    return false;
  }

  /**
   * Check if fire button was just pressed (keyboard Space or gamepad R2) (g4p Phase 1)
   */
  private isFireJustPressed(): boolean {
    // Check keyboard
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      return true;
    }

    // Check gamepad R2 trigger (threshold for "pressed")
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.R2 > 0.5) {
        const pressed = true;
        const justPressed = pressed && !this.lastFireButtonState;
        this.lastFireButtonState = pressed;
        return justPressed;
      }
    }

    this.lastFireButtonState = false;
    return false;
  }

  /**
   * Get steering input (keyboard arrows or gamepad left stick) (g4p Phase 1)
   * @returns 'left', 'right', or null
   */
  private getSteeringInput(): 'left' | 'right' | null {
    // Check keyboard
    if (this.cursors.left?.isDown) return 'left';
    if (this.cursors.right?.isDown) return 'right';

    // Check gamepad left stick horizontal
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.leftStick) {
        if (pad.leftStick.x < -ShipInputHandler.DPAD_THRESHOLD) return 'left';
        if (pad.leftStick.x > ShipInputHandler.DPAD_THRESHOLD) return 'right';
      }
    }

    return null;
  }

  /**
   * Get cannon aiming input (keyboard arrows or gamepad left stick) (g4p Phase 1)
   * @returns analog value -1 to 1, or 0 for no input
   */
  private getCannonAimInput(): number {
    // Check keyboard (discrete input)
    if (this.cursors.left?.isDown) return -1;
    if (this.cursors.right?.isDown) return 1;

    // Check gamepad left stick horizontal (analog input)
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.leftStick) {
        const value = pad.leftStick.x;
        if (Math.abs(value) > 0.15) { // Small deadzone
          return value;
        }
      }
    }

    return 0;
  }

  /**
   * Check if sail up was just pressed (keyboard up or gamepad D-pad up) (g4p Phase 1)
   */
  private isSailUpJustPressed(): boolean {
    // Check keyboard
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      return true;
    }

    // Check gamepad D-pad up (button 12)
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.up) {
        const pressed = pad.up;
        const justPressed = pressed && !this.lastSailUpState;
        this.lastSailUpState = pressed;
        return justPressed;
      }
    }

    this.lastSailUpState = false;
    return false;
  }

  /**
   * Check if sail down was just pressed (keyboard down or gamepad D-pad down) (g4p Phase 1)
   */
  private isSailDownJustPressed(): boolean {
    // Check keyboard
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      return true;
    }

    // Check gamepad D-pad down (button 13)
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.down) {
        const pressed = pad.down;
        const justPressed = pressed && !this.lastSailDownState;
        this.lastSailDownState = pressed;
        return justPressed;
      }
    }

    this.lastSailDownState = false;
    return false;
  }

  /**
   * Get cannon elevation input (keyboard arrows, D-pad, or left stick vertical) (g4p Phase 1)
   * @returns 'up', 'down', or null
   */
  private getElevationInput(): 'up' | 'down' | null {
    // Check keyboard (discrete)
    if (this.cursors.up?.isDown) return 'up';
    if (this.cursors.down?.isDown) return 'down';

    // Check gamepad left stick vertical (analog - continuous adjustment)
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.leftStick) {
        const value = pad.leftStick.y;
        // Inverted: negative Y = up, positive Y = down (typical gamepad convention)
        if (value < -ShipInputHandler.DPAD_THRESHOLD) return 'up';
        if (value > ShipInputHandler.DPAD_THRESHOLD) return 'down';
      }

      // Fallback to D-pad for discrete control
      if (pad && pad.up) return 'up';
      if (pad && pad.down) return 'down';
    }

    return null;
  }

  /**
   * Check if elevation up was just pressed (for discrete adjustments) (g4p Phase 1)
   */
  private isElevationUpJustPressed(): boolean {
    // Check keyboard
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) {
      return true;
    }

    // Check gamepad D-pad up
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.up) {
        const pressed = pad.up;
        const justPressed = pressed && !this.lastElevationUpState;
        this.lastElevationUpState = pressed;
        return justPressed;
      }
    }

    this.lastElevationUpState = false;
    return false;
  }

  /**
   * Check if elevation down was just pressed (for discrete adjustments) (g4p Phase 1)
   */
  private isElevationDownJustPressed(): boolean {
    // Check keyboard
    if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) {
      return true;
    }

    // Check gamepad D-pad down
    if (this.gamepad) {
      const pad = this.gamepad();
      if (pad && pad.down) {
        const pressed = pad.down;
        const justPressed = pressed && !this.lastElevationDownState;
        this.lastElevationDownState = pressed;
        return justPressed;
      }
    }

    this.lastElevationDownState = false;
    return false;
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

    // Handle E key or gamepad A button press (g4p Phase 1)
    if (this.isInteractJustPressed()) {
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

    // Handle ship control inputs (when controlling wheel or sails) (g4p Phase 1: keyboard + gamepad)
    if (this.controllingShip && this.controllingPoint) {
      if (this.controllingPoint === 'wheel') {
        // w3l-wheel-steering: Use isDown for continuous wheel turning (keyboard or left stick)
        const steerInput = this.getSteeringInput();

        if (steerInput === 'left') {
          if (!this.currentWheelDirection || this.currentWheelDirection !== 'left') {
            this.shipCommands.wheelTurnStart(this.controllingShip, 'left');
            this.currentWheelDirection = 'left';
          }
        } else if (steerInput === 'right') {
          if (!this.currentWheelDirection || this.currentWheelDirection !== 'right') {
            this.shipCommands.wheelTurnStart(this.controllingShip, 'right');
            this.currentWheelDirection = 'right';
          }
        } else {
          // No input - stop turning if we were turning
          if (this.currentWheelDirection) {
            this.shipCommands.wheelTurnStop(this.controllingShip);
            this.currentWheelDirection = null;
          }
        }
      } else if (this.controllingPoint === 'sails') {
        // Up/down arrows or D-pad to adjust speed
        if (this.isSailUpJustPressed()) {
          this.shipCommands.adjustSails(this.controllingShip, 'up');
        }
        if (this.isSailDownJustPressed()) {
          this.shipCommands.adjustSails(this.controllingShip, 'down');
        }
      } else if (this.controllingPoint === 'cannon' && this.controllingCannon) {
        // c5x-ship-combat: Left/right arrows or right stick to aim cannon (g4p Phase 1)
        const aimSpeed = 0.02; // radians per frame (about 1.15 degrees)
        const maxAim = Math.PI / 4; // ±45°
        let aimChanged = false;

        const aimInput = this.getCannonAimInput();
        if (aimInput < 0) {
          // Aim left (analog value -1 to 0)
          this.currentCannonAim = Math.max(-maxAim, this.currentCannonAim + (aimInput * aimSpeed));
          aimChanged = true;
        } else if (aimInput > 0) {
          // Aim right (analog value 0 to 1)
          this.currentCannonAim = Math.min(maxAim, this.currentCannonAim + (aimInput * aimSpeed));
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

        // Up/down arrows, D-pad, or left stick vertical to adjust elevation (g4p Phase 1)
        const elevationInput = this.getElevationInput();
        if (elevationInput === 'up') {
          this.shipCommands.adjustElevation(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            'up'
          );
        } else if (elevationInput === 'down') {
          this.shipCommands.adjustElevation(
            this.controllingShip,
            this.controllingCannon.side,
            this.controllingCannon.index,
            'down'
          );
        }

        // Space bar or R2 trigger to fire cannon (g4p Phase 1)
        if (this.isFireJustPressed()) {
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
