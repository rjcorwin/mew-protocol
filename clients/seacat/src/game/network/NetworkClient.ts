import Phaser from 'phaser';
import { MEWClient } from '@mew-protocol/mew/client';
import { PositionUpdate, Direction } from '../../types.js';
import { ShipManager } from '../managers/ShipManager.js';
import { PlayerManager } from '../managers/PlayerManager.js';
import { ProjectileManager } from '../managers/ProjectileManager.js';
import * as Constants from '../utils/Constants.js';

const { POSITION_UPDATE_RATE } = Constants;

/**
 * Handles all network communication for the game.
 *
 * Responsibilities:
 * - Publishing player position updates at regular intervals
 * - Subscribing to and processing position updates from other players
 * - Handling ship and projectile network events
 */
export class NetworkClient {
  private client: MEWClient;
  private playerId: string;
  private localPlayer: Phaser.GameObjects.Sprite;
  private shipManager: ShipManager;
  private playerManager: PlayerManager;
  private projectileManager: ProjectileManager;

  private streamId: string | null = null;
  private lastPositionUpdate = 0;

  // Getters for state that NetworkClient needs to read
  private getLastFacing: () => Direction;
  private getTileWidth: () => number;
  private getTileHeight: () => number;
  private getShipRelativePosition: () => { x: number; y: number } | null;

  // Setter for state that NetworkClient needs to update
  private setShipRelativePosition: (pos: { x: number; y: number } | null) => void;

  constructor(
    client: MEWClient,
    playerId: string,
    localPlayer: Phaser.GameObjects.Sprite,
    shipManager: ShipManager,
    playerManager: PlayerManager,
    projectileManager: ProjectileManager,
    getLastFacing: () => Direction,
    getTileWidth: () => number,
    getTileHeight: () => number,
    getShipRelativePosition: () => { x: number; y: number } | null,
    setShipRelativePosition: (pos: { x: number; y: number } | null) => void
  ) {
    this.client = client;
    this.playerId = playerId;
    this.localPlayer = localPlayer;
    this.shipManager = shipManager;
    this.playerManager = playerManager;
    this.projectileManager = projectileManager;
    this.getLastFacing = getLastFacing;
    this.getTileWidth = getTileWidth;
    this.getTileHeight = getTileHeight;
    this.getShipRelativePosition = getShipRelativePosition;
    this.setShipRelativePosition = setShipRelativePosition;
  }

  /**
   * Initialize network streams and subscriptions
   */
  public async initialize(): Promise<void> {
    await this.requestPositionStream();
    this.subscribeToPositionUpdates();
  }

  /**
   * Update loop - publishes position at regular intervals
   */
  public update(time: number, velocity: Phaser.Math.Vector2): void {
    if (time - this.lastPositionUpdate > POSITION_UPDATE_RATE) {
      this.publishPosition(velocity);
      this.lastPositionUpdate = time;
    }
  }

  private async requestPositionStream(): Promise<void> {
    // Use a shared stream name for all players
    this.streamId = 'seacat-positions';
    console.log(`Using shared position stream: ${this.streamId}`);
  }

  private subscribeToPositionUpdates(): void {
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
            const updatedShipRelativePos = this.shipManager.updateShip(
              update,
              this.playerId,
              this.localPlayer,
              this.getShipRelativePosition()
            );
            this.setShipRelativePosition(updatedShipRelativePos);
          } else {
            // Update or create remote player
            this.playerManager.updateRemotePlayer(update);
          }
        } catch (error) {
          console.error('Failed to parse position update:', error);
        }
      } else if (envelope.kind === 'game/projectile_spawn') {
        // c5x-ship-combat Phase 2: Handle projectile spawn
        this.projectileManager.spawnProjectile(envelope.payload);
      }
    });
  }

  private publishPosition(velocity: Phaser.Math.Vector2): void {
    const TILE_WIDTH = this.getTileWidth();
    const TILE_HEIGHT = this.getTileHeight();

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
      facing: this.getLastFacing(), // Include current facing direction
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
