import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPxClient } from '../src/MCPxClient';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Integration test to verify the client works with the gateway
 * This test requires the gateway to be running
 */
describe.skip('Gateway Integration', () => {
  let client: MCPxClient;

  beforeAll(async () => {
    // Note: Gateway must be started manually before running this test
    // npm run dev:gateway (in the root directory)
    
    // Get a token from the gateway
    const response = await fetch('http://localhost:3000/v0/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participantId: 'test-client',
        topic: 'test-topic',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to get token from gateway. Is the gateway running?');
    }

    const { token } = await response.json();

    client = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-topic',
      token,
    });
  });

  afterAll(() => {
    if (client) {
      client.disconnect();
    }
  });

  it('should connect to gateway and receive welcome message', async () => {
    const welcomePromise = new Promise((resolve) => {
      client.onWelcome((data) => {
        resolve(data);
      });
    });

    await client.connect();
    const welcome = await welcomePromise;

    expect(welcome).toBeDefined();
    expect(welcome).toHaveProperty('participant');
    expect(welcome).toHaveProperty('topic');
    expect(welcome).toHaveProperty('participants');
    expect(client.getParticipantId()).toBe('test-client');
  });

  it('should send and receive chat messages', async () => {
    await client.connect();

    const messagePromise = new Promise((resolve) => {
      const unsubscribe = client.onChat((message, from) => {
        unsubscribe(); // Only listen once
        resolve({ message, from });
      });
    });

    // Send a chat message
    client.chat('Hello from test client!');

    // In a real test, another client would respond
    // For now, we're just testing that sending works
    expect(() => client.chat('Test message')).not.toThrow();
  });

  it('should track peers joining and leaving', async () => {
    await client.connect();

    // Create a second client
    const response = await fetch('http://localhost:3000/v0/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participantId: 'test-client-2',
        topic: 'test-topic',
      }),
    });

    const { token } = await response.json();

    const client2 = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-topic',
      token,
    });

    const peerJoinedPromise = new Promise((resolve) => {
      client.once('peer-joined', (peer) => {
        resolve(peer);
      });
    });

    await client2.connect();
    const joinedPeer = await peerJoinedPromise;

    expect(joinedPeer).toHaveProperty('id', 'test-client-2');

    // Check peer registry
    const peers = client.getPeers();
    expect(peers.some(p => p.id === 'test-client-2')).toBe(true);

    // Clean up
    client2.disconnect();
  });
});