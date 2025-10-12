import { EventEmitter } from 'events';
import { Envelope } from '../../../types/index.js';
import { MEWClient } from '../../MEWClient.js';
import {
  MovementFrame,
  MovementStreamMessage,
  ShipFrame,
  GameStateSnapshot,
  MovementUpdateMessage,
  ShipUpdateMessage,
  SnapshotMessage
} from '../types.js';

export interface MovementStreamOptions {
  description?: string;
}

type PendingResolver = (streamId: string) => void;

export class MovementStream extends EventEmitter {
  private readonly client: MEWClient;
  private readonly description?: string;
  private streamId?: string;
  private pendingRequestId?: string;
  private pendingResolver?: PendingResolver;

  constructor(client: MEWClient, options: MovementStreamOptions = {}) {
    super();
    this.client = client;
    this.description = options.description;

    this.client.on('stream/open', (envelope: Envelope) => this.handleStreamOpen(envelope));
    this.client.onStreamData((frame) => this.handleStreamData(frame.streamId, frame.payload));
  }

  async open(): Promise<string> {
    if (this.streamId) {
      return this.streamId;
    }

    return new Promise<string>((resolve) => {
      this.pendingResolver = resolve;
      const requestId = `movement-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      this.pendingRequestId = requestId;
      this.client.send({
        id: requestId,
        kind: 'stream/request',
        to: ['gateway'],
        payload: {
          direction: 'bidirectional',
          description: this.description ?? 'Isometric movement stream'
        }
      });
    });
  }

  sendMovementUpdate(frame: MovementFrame): void {
    if (!this.streamId) {
      throw new Error('Movement stream not open');
    }

    const message: MovementUpdateMessage = {
      type: 'movement-update',
      payload: frame
    };

    this.client.sendStreamData(this.streamId, JSON.stringify(message));
  }

  sendShipUpdate(frame: ShipFrame): void {
    if (!this.streamId) {
      throw new Error('Movement stream not open');
    }

    const message: ShipUpdateMessage = {
      type: 'ship-update',
      payload: frame
    };

    this.client.sendStreamData(this.streamId, JSON.stringify(message));
  }

  sendSnapshot(snapshot: GameStateSnapshot): void {
    if (!this.streamId) {
      throw new Error('Movement stream not open');
    }

    const message: SnapshotMessage = {
      type: 'snapshot',
      payload: snapshot
    };
    this.client.sendStreamData(this.streamId, JSON.stringify(message));
  }

  private handleStreamOpen(envelope: Envelope): void {
    if (!this.pendingRequestId || !envelope.correlation_id?.includes(this.pendingRequestId)) {
      return;
    }

    const payload = envelope.payload as { stream_id?: string } | undefined;
    if (!payload?.stream_id) {
      return;
    }

    this.streamId = payload.stream_id;
    if (this.pendingResolver) {
      this.pendingResolver(payload.stream_id);
      this.pendingResolver = undefined;
    }
  }

  private handleStreamData(streamId: string, payload: string): void {
    if (!this.streamId || streamId !== this.streamId) {
      return;
    }

    try {
      const message = JSON.parse(payload) as MovementStreamMessage;
      switch (message.type) {
        case 'movement-update':
          this.emit('movement', message.payload);
          break;
        case 'ship-update':
          this.emit('ship', message.payload);
          break;
        case 'snapshot':
          this.emit('snapshot', message.payload);
          break;
        default:
          break;
      }
    } catch (error) {
      console.warn('[MovementStream] Failed to parse payload', error);
    }
  }
}
