import { describe, it, expect, vi } from 'vitest';
import {
  Envelope,
  PROTOCOL_VERSION,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from '../src/types';
import { MEWClient } from '../src/MEWClient';
import WebSocket from 'ws';

describe('Envelope Creation and Validation', () => {
  describe('Envelope Structure', () => {
    it('should create valid MCP request envelope', () => {
      const envelope: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'env-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha'],
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          id: 42,
          method: 'tools/call',
          params: {
            name: 'move',
            arguments: { x: 10, y: 20 },
          },
        } as JsonRpcRequest,
      };

      expect(envelope.protocol).toBe('mew/v0.4');
      expect(envelope.kind).toBe('mcp/request');
      expect(envelope.to).toHaveLength(1);
      expect(envelope.payload.id).toBe(42);
    });

    it('should create valid MCP response envelope with correlation_id', () => {
      const envelope: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'env-2',
        ts: '2025-08-17T14:00:01Z',
        from: 'robot-alpha',
        to: ['coordinator'],
        kind: 'mcp/response',
        correlation_id: ['env-1'],
        payload: {
          jsonrpc: '2.0',
          id: 42,
          result: { status: 'ok' },
        } as JsonRpcResponse,
      };

      expect(envelope.correlation_id).toEqual(['env-1']);
      expect(envelope.payload.result).toEqual({ status: 'ok' });
    });

    it('should create valid broadcast notification envelope', () => {
      const envelope: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'env-3',
        ts: '2025-08-17T14:00:02Z',
        from: 'coordinator',
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/chat/message',
          params: {
            text: 'Hello everyone!',
            format: 'plain',
          },
        } as JsonRpcNotification,
      };

      expect(envelope.to).toBeUndefined();
      expect(envelope.payload.method).toBe('notifications/chat/message');
    });

    it('should create valid presence envelope', () => {
      const envelope: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'presence-1',
        ts: '2025-08-17T14:00:03Z',
        from: 'system:gateway',
        kind: 'system/presence',
        payload: {
          event: 'join',
          participant: {
            id: 'robot-alpha',
            name: 'Robot Alpha',
            kind: 'robot',
            mcp: { version: '2025-06-18' },
          },
        },
      };

      expect(envelope.kind).toBe('system/presence');
      expect(envelope.from).toBe('system:gateway');
      expect(envelope.payload.event).toBe('join');
    });

    it('should create valid system welcome envelope', () => {
      const envelope: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'system-1',
        ts: '2025-08-17T14:00:04Z',
        from: 'system:gateway',
        kind: 'system/welcome',
        payload: {
          you: {
            id: 'client-123',
            capabilities: [{ kind: 'chat' }],
          },
          participants: [
            { id: 'robot-alpha', capabilities: [{ kind: 'chat' }] },
            { id: 'coordinator', capabilities: [{ kind: 'mcp/request' }] },
          ],
        },
      };

      expect(envelope.kind).toBe('system/welcome');
      expect(envelope.payload.participants).toHaveLength(2);
    });
  });

  describe('Request Validation Rules', () => {
    it('should enforce single recipient for requests', () => {
      const validRequest: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'req-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha'], // Exactly one recipient
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
        },
      };

      expect(validRequest.to).toHaveLength(1);
      expect(validRequest.payload.id).toBeDefined();
    });

    it('should allow multiple recipients for notifications', () => {
      const notification: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'notif-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha', 'robot-beta', 'robot-gamma'],
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/progress',
          params: { progress: 50 },
        },
      };

      expect(notification.to).toHaveLength(3);
      expect(notification.payload.id).toBeUndefined();
    });

    it('should allow empty recipients for broadcast', () => {
      const broadcast: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'broadcast-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/chat/message',
          params: { text: 'Hello all!' },
        },
      };

      expect(broadcast.to).toBeUndefined();
    });
  });

  describe('MCP Initialize Handshake', () => {
    it('should create valid initialize request envelope', () => {
      const initRequest: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'env-init-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha'],
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {
              sampling: {},
              elicitation: {},
              roots: {},
            },
            clientInfo: {
              name: 'Coordinator',
              version: '1.0.0',
            },
          },
        },
      };

      expect(initRequest.payload.method).toBe('initialize');
      expect(initRequest.payload.params.protocolVersion).toBe('2025-06-18');
      expect(initRequest.to).toHaveLength(1);
    });

    it('should create valid initialize response envelope', () => {
      const initResponse: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'env-init-2',
        ts: '2025-08-17T14:00:01Z',
        from: 'robot-alpha',
        to: ['coordinator'],
        kind: 'mcp/response',
        correlation_id: ['env-init-1'],
        payload: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: {
              tools: { list: true },
            },
            serverInfo: {
              name: 'Robot Alpha',
              version: '1.0.0',
            },
          },
        },
      };

      expect(initResponse.correlation_id).toEqual(['env-init-1']);
      expect(initResponse.payload.result.capabilities.tools).toBeDefined();
    });

    it('should create valid initialized notification envelope', () => {
      const initializedNotif: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'env-init-3',
        ts: '2025-08-17T14:00:02Z',
        from: 'coordinator',
        to: ['robot-alpha'],
        kind: 'mcp/request',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        },
      };

      expect(initializedNotif.payload.method).toBe('notifications/initialized');
      expect(initializedNotif.payload.id).toBeUndefined();
    });
  });

  describe('Progress and Cancellation', () => {
    it('should create valid progress notification with correlation_id', () => {
      const progressNotif: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'progress-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'robot-alpha',
        to: ['coordinator'],
        kind: 'mcp/response',
        correlation_id: ['env-request-1'],
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/progress',
          params: {
            progressToken: 'move-123',
            progress: 50,
            total: 100,
          },
        },
      };

      expect(progressNotif.correlation_id).toEqual(['env-request-1']);
      expect(progressNotif.payload.params.progress).toBe(50);
    });

    it('should create valid cancellation notification', () => {
      const cancelNotif: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: 'cancel-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha'],
        kind: 'mcp',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/cancelled',
          params: {
            requestId: 42,
            reason: 'timeout',
          },
        },
      };

      expect(cancelNotif.payload.method).toBe('notifications/cancelled');
      expect(cancelNotif.payload.params.reason).toBe('timeout');
    });
  });

  describe('JSON-RPC ID Type Preservation', () => {
    it('should preserve string JSON-RPC id', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'string-id-123',
        method: 'test',
      };

      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 'string-id-123',
        result: { ok: true },
      };

      expect(typeof request.id).toBe('string');
      expect(request.id).toBe(response.id);
    });

    it('should preserve number JSON-RPC id', () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 42,
        method: 'test',
      };

      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 42,
        result: { ok: true },
      };

      expect(typeof request.id).toBe('number');
      expect(request.id).toBe(response.id);
    });
  });
});

describe('MEWClient runtime validation', () => {
  it('rejects string correlation_id values', () => {
    const client = new MEWClient({
      gateway: 'ws://localhost:8080',
      space: 'test-space',
      token: 'test-token',
      participant_id: 'test-client',
    });

    const mockSend = vi.fn();
    (client as any).ws = {
      readyState: WebSocket.OPEN,
      send: mockSend,
    };

    expect(() =>
      client.send({
        kind: 'chat',
        payload: { text: 'hello' },
        correlation_id: 'bad-id' as any,
      }),
    ).toThrow('correlation_id must be an array per MEW Protocol v0.4');

    expect(mockSend).not.toHaveBeenCalled();
  });
});
