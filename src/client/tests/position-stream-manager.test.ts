import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Envelope } from '../../types/protocol.js';
import type { MEWClient } from '../MEWClient.js';
import { PositionStreamManager } from '../../../clients/mew-world/src/network/PositionStreamManager.js';

class FakeClient extends EventEmitter {
  public sent: Array<Partial<Envelope>> = [];

  send(envelope: Partial<Envelope>): void {
    this.sent.push(envelope);
  }

  onMessage(handler: (envelope: Envelope) => void): void {
    this.on('message', handler);
  }

  emitMessage(envelope: Envelope): void {
    this.emit('message', envelope);
  }
}

describe('PositionStreamManager', () => {
  it('requests and resolves a local stream', async () => {
    const client = new FakeClient();
    const manager = new PositionStreamManager(client as unknown as MEWClient, 'player1');

    const ensurePromise = manager.ensureLocalStream();

    expect(client.sent).toHaveLength(1);
    const request = client.sent[0];
    expect(request.kind).toBe('stream/request');
    expect(request.id).toBeDefined();

    const openEnvelope: Envelope = {
      protocol: 'mew/v0.4',
      id: 'open-1',
      kind: 'stream/open',
      from: 'gateway',
      to: ['player1'],
      payload: { stream_id: 'stream-123', direction: 'bidirectional' },
      correlation_id: request.id,
    };

    client.emitMessage(openEnvelope);

    await expect(ensurePromise).resolves.toBe('stream-123');
    expect(manager.getLocalStreamId()).toBe('stream-123');
  });

  it('ignores frames with mismatched participant owner', () => {
    const client = new FakeClient();
    const manager = new PositionStreamManager(client as unknown as MEWClient, 'player1');

    const streamId = 'stream-abc';
    const validPayload = {
      participantId: 'player2',
      worldCoords: { x: 5, y: 6 },
      tileCoords: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      timestamp: Date.now(),
      platformRef: null,
    };

    const parsed = manager.parseFrame({ streamId, payload: JSON.stringify(validPayload) });
    expect(parsed).toEqual(validPayload);

    const mismatchedPayload = {
      ...validPayload,
      participantId: 'player3',
    };

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const second = manager.parseFrame({ streamId, payload: JSON.stringify(mismatchedPayload) });
    expect(second).toBeNull();
    spy.mockRestore();
  });
});
