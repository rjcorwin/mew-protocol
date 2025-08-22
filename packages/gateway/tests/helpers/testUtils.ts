import { WebSocket } from 'ws';
import { AuthService } from '../../src/services/AuthService';
import { TopicService } from '../../src/services/TopicService';
import { ServerConfig } from '../../src/types/server';
import { Envelope, Participant } from '../../src/types/mcpx';

// Test configuration
export const testConfig: ServerConfig = {
  port: 0, // Use random available port
  auth: {
    secret: 'test-secret-key',
    tokenExpiry: '1h'
  },
  topics: {
    maxParticipants: 10,
    historyLimit: 100
  },
  rateLimit: {
    messagesPerMinute: 100,
    chatMessagesPerMinute: 20
  }
};

// Helper to create test participants
export function createTestParticipant(id: string = 'test-user'): Participant {
  return {
    id,
    name: `Test User ${id}`,
    kind: 'human',
    mcp: {
      version: '2025-06-18'
    }
  };
}

// Helper to create test envelopes
export function createTestEnvelope(
  from: string = 'test-user',
  kind: 'mcp' | 'presence' | 'system' = 'mcp',
  payload: any = { jsonrpc: '2.0', method: 'test', params: {} }
): Envelope {
  return {
    protocol: 'mcp-x/v0',
    id: 'test-envelope-id',
    ts: new Date().toISOString(),
    from,
    kind,
    payload
  };
}

// Helper to wait for WebSocket connection
export function waitForWebSocketOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.once('open', () => {
      clearTimeout(timeout);
      resolve();
    });

    ws.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Helper to wait for WebSocket message
export function waitForWebSocketMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket message timeout'));
    }, 5000);

    ws.once('message', (data) => {
      clearTimeout(timeout);
      try {
        const message = JSON.parse(data.toString());
        resolve(message);
      } catch (error) {
        reject(error);
      }
    });

    ws.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Helper to create auth token for testing
export function createTestAuthToken(
  participantId: string = 'test-user',
  topic: string = 'test-topic'
): string {
  const authService = new AuthService(testConfig.auth);
  return authService.generateToken(participantId, topic);
}

// Helper to find available port
export function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

// Helper to delay execution
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}