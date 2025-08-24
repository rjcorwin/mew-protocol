import { describe, it, expect } from 'vitest';
import { 
  validateEnvelope,
  createEnvelope,
  generateMessageId,
  createChatNotification,
  MCPRequestSchema,
  MCPResponseSchema,
  MCPNotificationSchema,
  EnvelopeSchema,
  ParticipantSchema
} from '../../../src/types/mcpx';

describe('MCPx Types', () => {
  describe('validateEnvelope', () => {
    it('should validate a correct envelope', () => {
      const envelope = {
        protocol: 'mcp-x/v0',
        id: 'test-id',
        ts: '2025-01-01T00:00:00Z',
        from: 'test-user',
        kind: 'mcp',
        payload: { test: 'data' }
      };

      expect(() => validateEnvelope(envelope)).not.toThrow();
      const validated = validateEnvelope(envelope);
      expect(validated.protocol).toBe('mcp-x/v0');
    });

    it('should reject envelope with wrong protocol', () => {
      const envelope = {
        protocol: 'wrong-protocol',
        id: 'test-id',
        ts: '2025-01-01T00:00:00Z',
        from: 'test-user',
        kind: 'mcp',
        payload: { test: 'data' }
      };

      expect(() => validateEnvelope(envelope)).toThrow();
    });

    it('should reject envelope with missing required fields', () => {
      const envelope = {
        protocol: 'mcp-x/v0',
        // missing id
        ts: '2025-01-01T00:00:00Z',
        from: 'test-user',
        kind: 'mcp',
        payload: { test: 'data' }
      };

      expect(() => validateEnvelope(envelope)).toThrow();
    });

    it('should accept envelope with optional fields', () => {
      const envelope = {
        protocol: 'mcp-x/v0',
        id: 'test-id',
        ts: '2025-01-01T00:00:00Z',
        from: 'test-user',
        to: ['recipient'],
        kind: 'mcp',
        correlation_id: 'correlation-123',
        payload: { test: 'data' }
      };

      expect(() => validateEnvelope(envelope)).not.toThrow();
      const validated = validateEnvelope(envelope);
      expect(validated.to).toEqual(['recipient']);
      expect(validated.correlation_id).toBe('correlation-123');
    });
  });

  describe('createEnvelope', () => {
    it('should create a valid envelope', () => {
      const envelope = createEnvelope('test-user', 'mcp', { test: 'payload' });

      expect(envelope.protocol).toBe('mcp-x/v0');
      expect(envelope.from).toBe('test-user');
      expect(envelope.kind).toBe('mcp');
      expect(envelope.payload).toEqual({ test: 'payload' });
      expect(envelope.id).toBeTruthy();
      expect(envelope.ts).toBeTruthy();
    });

    it('should include optional fields when provided', () => {
      const envelope = createEnvelope(
        'test-user', 
        'mcp', 
        { test: 'payload' },
        ['recipient'],
        'correlation-123'
      );

      expect(envelope.to).toEqual(['recipient']);
      expect(envelope.correlation_id).toBe('correlation-123');
    });

    it('should generate unique IDs', () => {
      const envelope1 = createEnvelope('user1', 'mcp', {});
      const envelope2 = createEnvelope('user2', 'mcp', {});

      expect(envelope1.id).not.toBe(envelope2.id);
    });
  });

  describe('generateMessageId', () => {
    it('should generate a string ID', () => {
      const id = generateMessageId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createChatNotification', () => {
    it('should create a chat notification envelope', () => {
      const envelope = createChatNotification('test-user', { text: 'Hello world!' });

      expect(envelope.from).toBe('test-user');
      expect(envelope.kind).toBe('mcp');
      expect(envelope.payload.jsonrpc).toBe('2.0');
      expect(envelope.payload.method).toBe('notifications/chat/message');
      expect(envelope.payload.params.text).toBe('Hello world!');
      expect(envelope.payload.params.format).toBe('plain');
    });

    it('should support markdown format', () => {
      const envelope = createChatNotification('test-user', { 
        text: '**Bold text**', 
        format: 'markdown' 
      });

      expect(envelope.payload.params.format).toBe('markdown');
    });
  });

  describe('Schema validation', () => {
    describe('MCPRequestSchema', () => {
      it('should validate correct MCP request', () => {
        const request = {
          jsonrpc: '2.0',
          id: 'test-id',
          method: 'tools/list',
          params: { test: 'param' }
        };

        expect(() => MCPRequestSchema.parse(request)).not.toThrow();
      });

      it('should reject request without id', () => {
        const request = {
          jsonrpc: '2.0',
          method: 'tools/list'
        };

        expect(() => MCPRequestSchema.parse(request)).toThrow();
      });
    });

    describe('MCPResponseSchema', () => {
      it('should validate correct MCP response with result', () => {
        const response = {
          jsonrpc: '2.0',
          id: 'test-id',
          result: { tools: [] }
        };

        expect(() => MCPResponseSchema.parse(response)).not.toThrow();
      });

      it('should validate correct MCP response with error', () => {
        const response = {
          jsonrpc: '2.0',
          id: 'test-id',
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };

        expect(() => MCPResponseSchema.parse(response)).not.toThrow();
      });
    });

    describe('MCPNotificationSchema', () => {
      it('should validate correct MCP notification', () => {
        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/chat/message',
          params: { text: 'Hello' }
        };

        expect(() => MCPNotificationSchema.parse(notification)).not.toThrow();
      });

      it('should allow notification without params', () => {
        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/initialized'
        };

        expect(() => MCPNotificationSchema.parse(notification)).not.toThrow();
      });
    });

    describe('ParticipantSchema', () => {
      it('should validate correct participant', () => {
        const participant = {
          id: 'test-user',
          name: 'Test User',
          kind: 'human',
          mcp: {
            version: '2025-06-18'
          }
        };

        expect(() => ParticipantSchema.parse(participant)).not.toThrow();
      });

      it('should reject participant with invalid kind', () => {
        const participant = {
          id: 'test-user',
          name: 'Test User',
          kind: 'invalid-kind',
          mcp: {
            version: '2025-06-18'
          }
        };

        expect(() => ParticipantSchema.parse(participant)).toThrow();
      });
    });
  });
});