/**
 * Ship Participant - MEW protocol integration for ship entities
 *
 * Connects ship to MEW space and broadcasts position updates
 */

import { MEWClient } from '../../client/MEWClient.js';
import { ShipServer } from './ShipServer.js';
import {
  ShipState,
  GrabControlPayload,
  ReleaseControlPayload,
  SteerPayload,
  WheelTurnStartPayload,
  WheelTurnStopPayload,
  AdjustSailsPayload,
  MapDataPayload,
  GrabCannonPayload,
  ReleaseCannonPayload,
  AimCannonPayload,
  FireCannonPayload,
} from './types.js';

export interface ShipParticipantConfig {
  gatewayUrl: string;
  spaceName: string;
  participantId: string;
  token: string;
  updateRate: number; // Position updates per second
}

export class ShipParticipant {
  private client: MEWClient;
  private server: ShipServer;
  private config: ShipParticipantConfig;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(client: MEWClient, server: ShipServer, config: ShipParticipantConfig) {
    this.client = client;
    this.server = server;
    this.config = config;
  }

  /**
   * Connect to MEW space
   */
  async connect() {
    console.log(`Connecting ship ${this.config.participantId} to MEW space...`);

    await this.client.connect();

    console.log(`Ship connected to space: ${this.config.spaceName}`);

    // Subscribe to relevant messages
    this.setupMessageHandlers();
  }

  private setupMessageHandlers() {
    this.client.onMessage((envelope: any) => {
      // Process messages addressed to this ship OR broadcast messages
      const isAddressedToMe = envelope.to && Array.isArray(envelope.to) && envelope.to.includes(this.config.participantId);
      const isBroadcast = !envelope.to || (Array.isArray(envelope.to) && envelope.to.length === 0);

      if (!isAddressedToMe && !isBroadcast) {
        return;
      }

      // Only log non-position messages to reduce noise
      if (envelope.kind !== 'game/position') {
        console.log(`[ShipParticipant] Ship received message:`, envelope);
      }

      // Handle different message kinds
      switch (envelope.kind) {
        case 'ship/map_data':
          this.handleMapData(envelope.payload as MapDataPayload);
          break;

        case 'ship/grab_control':
          this.handleGrabControl(envelope.payload as GrabControlPayload);
          break;

        case 'ship/release_control':
          this.handleReleaseControl(envelope.payload as ReleaseControlPayload);
          break;

        case 'ship/steer':
          this.handleSteer(envelope.payload as SteerPayload);
          break;

        case 'ship/wheel_turn_start':
          this.handleWheelTurnStart(envelope.payload as WheelTurnStartPayload);
          break;

        case 'ship/wheel_turn_stop':
          this.handleWheelTurnStop(envelope.payload as WheelTurnStopPayload);
          break;

        case 'ship/adjust_sails':
          this.handleAdjustSails(envelope.payload as AdjustSailsPayload);
          break;

        case 'ship/grab_cannon':
          this.handleGrabCannon(envelope.payload as GrabCannonPayload);
          break;

        case 'ship/release_cannon':
          this.handleReleaseCannon(envelope.payload as ReleaseCannonPayload);
          break;

        case 'ship/aim_cannon':
          this.handleAimCannon(envelope.payload as AimCannonPayload);
          break;

        case 'ship/fire_cannon':
          this.handleFireCannon(envelope.payload as FireCannonPayload);
          break;

        case 'game/position':
          // Ignore position updates from players (we only care about ship control messages)
          break;

        default:
          console.log(`Unhandled message kind: ${envelope.kind}`);
      }
    });
  }

  private handleMapData(payload: MapDataPayload) {
    console.log(`Received map data: ${payload.mapWidth}x${payload.mapHeight} tiles, orientation: ${payload.orientation}`);
    this.server.setMapData(payload);
  }

  private handleGrabControl(payload: GrabControlPayload) {
    this.server.grabControlPublic(payload.playerId, payload.controlPoint);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleReleaseControl(payload: ReleaseControlPayload) {
    this.server.releaseControlPublic(payload.playerId);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleSteer(payload: SteerPayload) {
    this.server.steer(payload.playerId, payload.direction);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleWheelTurnStart(payload: WheelTurnStartPayload) {
    this.server.startTurningWheel(payload.playerId, payload.direction);
    // Broadcast updated state
    this.broadcastPosition();
  }

  private handleWheelTurnStop(payload: WheelTurnStopPayload) {
    this.server.stopTurningWheel(payload.playerId);
    // Broadcast updated state
    this.broadcastPosition();
  }

  private handleAdjustSails(payload: AdjustSailsPayload) {
    this.server.adjustSails(payload.playerId, payload.adjustment);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleGrabCannon(payload: GrabCannonPayload) {
    this.server.grabCannon(payload.playerId, payload.side, payload.index);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleReleaseCannon(payload: ReleaseCannonPayload) {
    this.server.releaseCannon(payload.playerId, payload.side, payload.index);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleAimCannon(payload: AimCannonPayload) {
    this.server.aimCannon(payload.playerId, payload.side, payload.index, payload.aimAngle);
    // Immediately broadcast updated state
    this.broadcastPosition();
  }

  private handleFireCannon(payload: FireCannonPayload) {
    console.log(`[ShipParticipant] Received fire_cannon message:`, payload);
    this.server.fireCannon(payload.playerId, payload.side, payload.index);
    // Broadcast updated state (includes new projectile if fired)
    this.broadcastPosition();
  }

  /**
   * Start broadcasting position updates
   */
  startBroadcasting() {
    const intervalMs = 1000 / this.config.updateRate;

    this.updateInterval = setInterval(() => {
      this.broadcastPosition();
    }, intervalMs);

    console.log(`Ship broadcasting position at ${this.config.updateRate} Hz`);
  }

  /**
   * Stop broadcasting position updates
   */
  stopBroadcasting() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Ship stopped broadcasting');
    }
  }

  /**
   * Broadcast current ship position to all participants
   */
  private broadcastPosition() {
    const state = this.server.getState();
    const rotationDelta = this.server.getRotationDelta(); // Get and clear rotation delta

    // Convert ship state to game/position message format
    // (matches the format used by player clients)
    const positionUpdate = {
      participantId: state.participantId,
      worldCoords: {
        x: state.position.x,
        y: state.position.y,
      },
      tileCoords: {
        x: Math.floor(state.position.x / 32), // Assuming 32px tiles
        y: Math.floor(state.position.y / 16), // Assuming 16px tiles
      },
      velocity: {
        x: state.velocity.x,
        y: state.velocity.y,
      },
      facing: state.heading, // Ship heading acts as facing direction
      timestamp: Date.now(),
      platformRef: null, // Ships are not on platforms
      shipData: {
        // Additional ship-specific data
        rotation: state.rotation,
        rotationDelta: rotationDelta, // Include rotation change for player rotation
        speedLevel: state.speedLevel,
        deckBoundary: state.deckBoundary,
        // Wheel steering state (w3l-wheel-steering)
        wheelAngle: state.wheelAngle,
        turnRate: state.turnRate,
        controlPoints: {
          wheel: {
            worldPosition: {
              x: state.position.x + state.controlPoints.wheel.relativePosition.x,
              y: state.position.y + state.controlPoints.wheel.relativePosition.y,
            },
            controlledBy: state.controlPoints.wheel.controlledBy,
          },
          sails: {
            worldPosition: {
              x: state.position.x + state.controlPoints.sails.relativePosition.x,
              y: state.position.y + state.controlPoints.sails.relativePosition.y,
            },
            controlledBy: state.controlPoints.sails.controlledBy,
          },
        },
        // Cannon state (c5x-ship-combat)
        cannons: {
          port: state.cannons.port.map(cannon => ({
            worldPosition: {
              x: state.position.x + cannon.relativePosition.x,
              y: state.position.y + cannon.relativePosition.y,
            },
            controlledBy: cannon.controlledBy,
            aimAngle: cannon.aimAngle,
            cooldownRemaining: cannon.cooldownRemaining,
          })),
          starboard: state.cannons.starboard.map(cannon => ({
            worldPosition: {
              x: state.position.x + cannon.relativePosition.x,
              y: state.position.y + cannon.relativePosition.y,
            },
            controlledBy: cannon.controlledBy,
            aimAngle: cannon.aimAngle,
            cooldownRemaining: cannon.cooldownRemaining,
          })),
        },
      },
    };

    this.client.send({
      kind: 'game/position',
      to: [], // Broadcast to all
      payload: positionUpdate,
    });
  }

  /**
   * Disconnect from MEW space
   */
  async disconnect() {
    this.stopBroadcasting();
    await this.client.disconnect();
    console.log('Ship disconnected from MEW space');
  }
}
