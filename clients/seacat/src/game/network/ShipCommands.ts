import Phaser from 'phaser';
import { MEWClient } from '@mew-protocol/mew/client';
import { Ship } from '../../types.js';

/**
 * Handles all ship control network commands.
 *
 * Responsibilities:
 * - Send grab/release control commands for wheel, sails, mast, cannons
 * - Send steering and sail adjustment commands
 * - Send cannon aiming, elevation, and firing commands
 * - Send projectile hit claims
 * - Manage local control state (controlling ship, control point, cannon)
 * - Handle mast climbing (client-side camera zoom)
 */
export class ShipCommands {
  constructor(
    private scene: Phaser.Scene,
    private client: MEWClient,
    private playerId: string,
    private ships: Map<string, Ship>,
    private setControllingShip: (shipId: string | null) => void,
    private setControllingPoint: (point: 'wheel' | 'sails' | 'mast' | 'cannon' | null) => void,
    private setControllingCannon: (cannon: { side: 'port' | 'starboard', index: number } | null) => void,
    private setCurrentCannonAim: (aim: number) => void
  ) {}

  /**
   * Grab control of wheel, sails, or mast
   */
  grabControl(shipId: string, controlPoint: 'wheel' | 'sails' | 'mast'): void {
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

    this.setControllingShip(shipId);
    this.setControllingPoint(controlPoint);

    // If grabbing mast, zoom camera out for better view
    if (controlPoint === 'mast') {
      const ship = this.ships.get(shipId);
      if (ship) {
        ship.controlPoints.mast.controlledBy = this.playerId;
      }
      this.scene.cameras.main.zoomTo(0.8, 500); // Zoom out to 0.8x over 500ms
      console.log(`Climbed mast on ship ${shipId} - zooming out for better view`);
    } else {
      console.log(`Grabbed ${controlPoint} on ship ${shipId}`);
    }
  }

  /**
   * Release current control (wheel, sails, mast, or cannon)
   */
  releaseControl(
    controllingShip: string | null,
    controllingPoint: 'wheel' | 'sails' | 'mast' | 'cannon' | null,
    controllingCannon: { side: 'port' | 'starboard', index: number } | null
  ): void {
    if (!controllingShip || !controllingPoint) return;

    // Handle cannon release separately (c5x-ship-combat)
    if (controllingPoint === 'cannon' && controllingCannon) {
      this.releaseCannon(
        controllingShip,
        controllingCannon.side,
        controllingCannon.index
      );
      this.setControllingCannon(null);
      this.setCurrentCannonAim(0);
    }
    // Mast is client-side only, don't send to ship server
    else if (controllingPoint === 'mast') {
      const ship = this.ships.get(controllingShip);
      if (ship) {
        ship.controlPoints.mast.controlledBy = null;
      }
      this.scene.cameras.main.zoomTo(1.5, 500); // Zoom back to 1.5x over 500ms
      console.log(`Climbed down mast - zooming back to normal view`);
    }
    // Wheel or sails
    else {
      this.client.send({
        kind: 'ship/release_control',
        to: [controllingShip],
        payload: {
          controlPoint: controllingPoint as 'wheel' | 'sails',
          playerId: this.playerId,
        },
      });
      console.log(`Released ${controllingPoint} on ship ${controllingShip}`);
    }

    this.setControllingShip(null);
    this.setControllingPoint(null);
  }

  /**
   * Steer ship (legacy - replaced by wheel turn start/stop)
   */
  steer(shipId: string, direction: 'left' | 'right'): void {
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
  wheelTurnStart(shipId: string, direction: 'left' | 'right'): void {
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
  wheelTurnStop(shipId: string): void {
    this.client.send({
      kind: 'ship/wheel_turn_stop',
      to: [shipId],
      payload: {
        playerId: this.playerId,
      },
    });

    console.log(`Stopped turning wheel`);
  }

  /**
   * Adjust sails up or down
   */
  adjustSails(shipId: string, adjustment: 'up' | 'down'): void {
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
   * Grab cannon control (c5x-ship-combat)
   */
  grabCannon(shipId: string, side: 'port' | 'starboard', index: number): void {
    this.client.send({
      kind: 'ship/grab_cannon',
      to: [shipId],
      payload: {
        side,
        index,
        playerId: this.playerId,
      },
    });

    this.setControllingShip(shipId);
    this.setControllingPoint('cannon');
    this.setControllingCannon({ side, index });
    this.setCurrentCannonAim(0); // Reset aim when grabbing

    console.log(`Grabbed ${side} cannon ${index} on ship ${shipId}`);
  }

  /**
   * Release cannon control (c5x-ship-combat)
   */
  releaseCannon(shipId: string, side: 'port' | 'starboard', index: number): void {
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

  /**
   * Aim cannon (c5x-ship-combat)
   */
  aimCannon(shipId: string, side: 'port' | 'starboard', index: number, aimAngle: number): void {
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

  /**
   * Adjust cannon elevation (c5x-ship-combat)
   */
  adjustElevation(shipId: string, side: 'port' | 'starboard', index: number, adjustment: 'up' | 'down'): void {
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

  /**
   * Fire cannon (c5x-ship-combat)
   */
  fireCannon(shipId: string, side: 'port' | 'starboard', index: number): void {
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
   * Send projectile hit claim to SOURCE ship for validation
   * The source ship owns the projectile and can validate physics.
   * If valid, it will apply damage to the target ship.
   */
  sendProjectileHitClaim(
    targetShipId: string,
    projectileId: string,
    timestamp: number,
    targetX: number,
    targetY: number,
    targetRotation: number,
    targetBoundary: { width: number; height: number }
  ): void {
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
