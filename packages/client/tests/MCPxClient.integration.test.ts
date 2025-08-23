import { describe, it, expect } from 'vitest';
import { MCPxClient } from '../src/MCPxClient';
import {
  Envelope,
  PROTOCOL_VERSION,
} from '../src/types';

describe('MCPxClient Integration', () => {
  describe('Client initialization', () => {
    it('should create client with options', () => {
      const client = new MCPxClient({
        gateway: 'ws://localhost:8080',
        topic: 'test-topic',
        token: 'test-token',
      });
      
      expect(client).toBeDefined();
      expect(client.getPeers).toBeDefined();
      expect(client.connect).toBeDefined();
      expect(client.disconnect).toBeDefined();
    });
  });

  describe('Envelope validation examples', () => {
    it('should validate spec example 13.1 - tool call request', () => {
      const envelope: Envelope = {
        protocol: 'mcp-x/v0',
        id: 'env-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha'],
        kind: 'mcp',
        payload: {
          jsonrpc: '2.0',
          id: 42,
          method: 'tools/call',
          params: {
            name: 'move',
            arguments: { x: 10, y: 20 },
          },
        },
      };

      expect(envelope.protocol).toBe(PROTOCOL_VERSION);
      expect(envelope.to).toHaveLength(1);
      expect(envelope.payload.method).toBe('tools/call');
    });

    it('should validate spec example 13.2 - presence join', () => {
      const envelope: Envelope = {
        protocol: 'mcp-x/v0',
        id: 'presence-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'system:gateway',
        kind: 'presence',
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

      expect(envelope.from).toBe('system:gateway');
      expect(envelope.kind).toBe('presence');
      expect(envelope.payload.event).toBe('join');
    });

    it('should validate spec example 13.3 - progress notification', () => {
      const envelope: Envelope = {
        protocol: 'mcp-x/v0',
        id: 'progress-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'robot-alpha',
        to: ['coordinator'],
        kind: 'mcp',
        correlation_id: 'env-1',
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

      expect(envelope.correlation_id).toBe('env-1');
      expect(envelope.payload.method).toBe('notifications/progress');
    });

    it('should validate spec example 13.4 - cancellation', () => {
      const envelope: Envelope = {
        protocol: 'mcp-x/v0',
        id: 'cancel-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        to: ['robot-alpha'],
        kind: 'mcp',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/cancelled',
          params: {
            requestId: 'req-123',
            reason: 'user_cancelled',
          },
        },
      };

      expect(envelope.payload.method).toBe('notifications/cancelled');
      expect(envelope.payload.params.reason).toBe('user_cancelled');
    });

    it('should validate spec example 8.1 - chat broadcast', () => {
      const envelope: Envelope = {
        protocol: 'mcp-x/v0',
        id: 'chat-1',
        ts: '2025-08-17T14:00:00Z',
        from: 'coordinator',
        kind: 'mcp',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/chat/message',
          params: {
            text: 'Hello everyone!',
            format: 'plain',
          },
        },
      };

      expect(envelope.to).toBeUndefined();
      expect(envelope.payload.method).toBe('notifications/chat/message');
    });
  });
});