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
  AdjustSailsPayload,
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
      // Only process messages addressed to this ship
      if (!envelope.to || !Array.isArray(envelope.to) || !envelope.to.includes(this.config.participantId)) {
        return;
      }

      console.log(`Ship received message:`, envelope);

      // Handle different message kinds
      switch (envelope.kind) {
        case 'ship/grab_control':
          this.handleGrabControl(envelope.payload as GrabControlPayload);
          break;

        case 'ship/release_control':
          this.handleReleaseControl(envelope.payload as ReleaseControlPayload);
          break;

        case 'ship/steer':
          this.handleSteer(envelope.payload as SteerPayload);
          break;

        case 'ship/adjust_sails':
          this.handleAdjustSails(envelope.payload as AdjustSailsPayload);
          break;

        default:
          console.log(`Unhandled message kind: ${envelope.kind}`);
      }
    });
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

  private handleAdjustSails(payload: AdjustSailsPayload) {
    this.server.adjustSails(payload.playerId, payload.adjustment);
    // Immediately broadcast updated state
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
        speedLevel: state.speedLevel,
        deckBoundary: state.deckBoundary,
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
