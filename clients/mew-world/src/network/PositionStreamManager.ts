import { MEWClient } from '@mew-protocol/mew/client';
import type { Envelope } from '@mew-protocol/mew/types';
import { PositionUpdate } from '../types.js';

const POSITION_STREAM_DESCRIPTION = 'mew-world/positions';

interface StreamFrame {
  streamId: string;
  payload: string;
}

function isPositionUpdate(data: any): data is PositionUpdate {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.participantId === 'string' &&
    data.worldCoords &&
    typeof data.worldCoords.x === 'number' &&
    typeof data.worldCoords.y === 'number' &&
    data.tileCoords &&
    typeof data.tileCoords.x === 'number' &&
    typeof data.tileCoords.y === 'number' &&
    data.velocity &&
    typeof data.velocity.x === 'number' &&
    typeof data.velocity.y === 'number' &&
    typeof data.timestamp === 'number'
  );
}

export class PositionStreamManager {
  private pendingRequests = new Map<string, string>();
  private streamOwners = new Map<string, string>();
  private localStreamId: string | null = null;
  private awaitingLocalStream: Promise<string> | null = null;
  private resolveLocalStream: ((streamId: string) => void) | null = null;

  constructor(private client: MEWClient, private participantId: string) {
    this.client.onMessage((envelope: Envelope) => this.handleEnvelope(envelope));
  }

  async ensureLocalStream(): Promise<string> {
    if (this.localStreamId) {
      return this.localStreamId;
    }

    if (!this.awaitingLocalStream) {
      const requestId = `${this.participantId}-pos-stream-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      this.pendingRequests.set(requestId, this.participantId);
      this.issueStreamRequest(requestId);
      this.awaitingLocalStream = new Promise<string>((resolve) => {
        this.resolveLocalStream = resolve;
      });
    }

    return this.awaitingLocalStream;
  }

  getLocalStreamId(): string | null {
    return this.localStreamId;
  }

  parseFrame(frame: StreamFrame): PositionUpdate | null {
    if (!frame.payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(frame.payload);
      if (!isPositionUpdate(parsed)) {
        return null;
      }

      const owner = this.streamOwners.get(frame.streamId);
      if (owner && owner !== parsed.participantId) {
        console.warn(
          `Ignoring frame for stream ${frame.streamId} due to participant mismatch (${owner} vs ${parsed.participantId})`,
        );
        return null;
      }

      if (!owner) {
        this.streamOwners.set(frame.streamId, parsed.participantId);
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse position stream frame:', error);
      return null;
    }
  }

  private issueStreamRequest(requestId: string): void {
    this.client.send({
      id: requestId,
      kind: 'stream/request',
      to: ['gateway'],
      payload: {
        direction: 'bidirectional',
        description: POSITION_STREAM_DESCRIPTION,
      },
    });
  }

  private handleEnvelope(envelope: Envelope): void {
    if (envelope.kind === 'stream/request') {
      const description = (envelope.payload as any)?.description;
      if (description === POSITION_STREAM_DESCRIPTION && envelope.id && envelope.from) {
        this.pendingRequests.set(envelope.id, envelope.from);
      }
      return;
    }

    if (envelope.kind === 'stream/open') {
      const correlationIds = Array.isArray(envelope.correlation_id)
        ? envelope.correlation_id
        : envelope.correlation_id
          ? [envelope.correlation_id]
          : [];
      const streamId = (envelope.payload as any)?.stream_id;

      if (!streamId) {
        return;
      }

      for (const correlationId of correlationIds) {
        const owner = this.pendingRequests.get(correlationId);
        if (owner) {
          this.pendingRequests.delete(correlationId);
          this.streamOwners.set(streamId, owner);

          if (owner === this.participantId) {
            this.localStreamId = streamId;
            if (this.resolveLocalStream) {
              this.resolveLocalStream(streamId);
              this.resolveLocalStream = null;
              this.awaitingLocalStream = null;
            }
          }
          break;
        }
      }
      return;
    }

    if (envelope.kind === 'stream/close') {
      const streamId = (envelope.payload as any)?.stream_id;
      if (!streamId) {
        return;
      }

      const owner = this.streamOwners.get(streamId);
      if (owner) {
        this.streamOwners.delete(streamId);
        if (owner === this.participantId) {
          this.localStreamId = null;
          this.awaitingLocalStream = null;
          this.resolveLocalStream = null;
        }
      }
    }
  }
}
