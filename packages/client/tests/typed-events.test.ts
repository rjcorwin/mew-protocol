import { describe, it, expect, beforeEach } from 'vitest';
import { MCPxClient } from '../src/MCPxClient';
import { ChatMessage, SystemWelcomePayload, Envelope, Peer } from '../src/types';

describe('MCPxClient Typed Events', () => {
  let client: MCPxClient;

  beforeEach(() => {
    // Create client without connecting (to avoid WebSocket complexity)
    client = new MCPxClient({
      gateway: 'ws://localhost:3000',
      topic: 'test-topic',
      token: 'test-token',
      reconnect: false,
    });
  });

  describe('Event Handler Registration', () => {
    it('should register and unregister chat handlers', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      
      // Register handlers
      const unsub1 = client.onChat(handler1);
      const unsub2 = client.onChat(handler2);
      
      // Check handlers are registered
      const handlers = (client as any).handlers.chat;
      expect(handlers.has(handler1)).toBe(true);
      expect(handlers.has(handler2)).toBe(true);
      expect(handlers.size).toBe(2);
      
      // Unregister first handler
      unsub1();
      expect(handlers.has(handler1)).toBe(false);
      expect(handlers.has(handler2)).toBe(true);
      expect(handlers.size).toBe(1);
      
      // Unregister second handler
      unsub2();
      expect(handlers.has(handler2)).toBe(false);
      expect(handlers.size).toBe(0);
    });

    it('should register and unregister error handlers', () => {
      const handler = () => {};
      const unsub = client.onError(handler);
      
      const handlers = (client as any).handlers.error;
      expect(handlers.has(handler)).toBe(true);
      
      unsub();
      expect(handlers.has(handler)).toBe(false);
    });

    it('should register all event types', () => {
      const handlers = {
        chat: () => {},
        error: () => {},
        welcome: () => {},
        peerJoined: () => {},
        peerLeft: () => {},
        message: () => {},
        connected: () => {},
        disconnected: () => {},
        reconnected: () => {},
      };

      // Register all handlers
      const unsubs = [
        client.onChat(handlers.chat as any),
        client.onError(handlers.error as any),
        client.onWelcome(handlers.welcome as any),
        client.onPeerJoined(handlers.peerJoined as any),
        client.onPeerLeft(handlers.peerLeft as any),
        client.onMessage(handlers.message as any),
        client.onConnected(handlers.connected),
        client.onDisconnected(handlers.disconnected),
        client.onReconnected(handlers.reconnected),
      ];

      // Check all handlers are registered
      const clientHandlers = (client as any).handlers;
      expect(clientHandlers.chat.has(handlers.chat)).toBe(true);
      expect(clientHandlers.error.has(handlers.error)).toBe(true);
      expect(clientHandlers.welcome.has(handlers.welcome)).toBe(true);
      expect(clientHandlers.peerJoined.has(handlers.peerJoined)).toBe(true);
      expect(clientHandlers.peerLeft.has(handlers.peerLeft)).toBe(true);
      expect(clientHandlers.message.has(handlers.message)).toBe(true);
      expect(clientHandlers.connected.has(handlers.connected)).toBe(true);
      expect(clientHandlers.disconnected.has(handlers.disconnected)).toBe(true);
      expect(clientHandlers.reconnected.has(handlers.reconnected)).toBe(true);

      // Unregister all
      unsubs.forEach(unsub => unsub());

      // Check all are unregistered
      expect(clientHandlers.chat.size).toBe(0);
      expect(clientHandlers.error.size).toBe(0);
      expect(clientHandlers.welcome.size).toBe(0);
      expect(clientHandlers.peerJoined.size).toBe(0);
      expect(clientHandlers.peerLeft.size).toBe(0);
      expect(clientHandlers.message.size).toBe(0);
      expect(clientHandlers.connected.size).toBe(0);
      expect(clientHandlers.disconnected.size).toBe(0);
      expect(clientHandlers.reconnected.size).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit chat events to all handlers', () => {
      const results: Array<{ message: ChatMessage; from: string }> = [];
      
      const handler1 = (message: ChatMessage, from: string) => {
        results.push({ message, from });
      };
      
      const handler2 = (message: ChatMessage, from: string) => {
        results.push({ message, from });
      };
      
      client.onChat(handler1);
      client.onChat(handler2);
      
      const testMessage: ChatMessage = {
        jsonrpc: '2.0',
        method: 'notifications/message/chat',
        params: { text: 'Hello', format: 'plain' },
      };
      
      (client as any).emitChat(testMessage, 'user123');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ message: testMessage, from: 'user123' });
      expect(results[1]).toEqual({ message: testMessage, from: 'user123' });
    });

    it('should emit error events', () => {
      const errors: Error[] = [];
      
      client.onError((error) => {
        errors.push(error);
      });
      
      const testError = new Error('Test error');
      (client as any).emitError(testError);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(testError);
    });

    it('should emit welcome events', () => {
      let receivedData: SystemWelcomePayload | null = null;
      
      client.onWelcome((data) => {
        receivedData = data;
      });
      
      const welcomeData: SystemWelcomePayload = {
        event: 'welcome',
        participant: { id: 'test', token: 'token' },
        topic: { name: 'test-topic', created: '2025-08-24T00:00:00Z' },
        participants: [],
      };
      
      (client as any).emitWelcome(welcomeData);
      
      expect(receivedData).toEqual(welcomeData);
    });

    it('should emit peer events', () => {
      const joinedPeers: Peer[] = [];
      const leftPeers: Peer[] = [];
      
      client.onPeerJoined((peer) => {
        joinedPeers.push(peer);
      });
      
      client.onPeerLeft((peer) => {
        leftPeers.push(peer);
      });
      
      const peer1: Peer = { id: 'peer1', name: 'Peer 1' };
      const peer2: Peer = { id: 'peer2', name: 'Peer 2' };
      
      (client as any).emitPeerJoined(peer1);
      (client as any).emitPeerJoined(peer2);
      (client as any).emitPeerLeft(peer1);
      
      expect(joinedPeers).toEqual([peer1, peer2]);
      expect(leftPeers).toEqual([peer1]);
    });

    it('should emit connection lifecycle events', () => {
      const events: string[] = [];
      
      client.onConnected(() => events.push('connected'));
      client.onDisconnected(() => events.push('disconnected'));
      client.onReconnected(() => events.push('reconnected'));
      
      (client as any).emitConnected();
      (client as any).emitDisconnected();
      (client as any).emitReconnected();
      
      expect(events).toEqual(['connected', 'disconnected', 'reconnected']);
    });

    it('should handle unsubscription correctly', () => {
      const results: string[] = [];
      
      const handler1 = () => results.push('handler1');
      const handler2 = () => results.push('handler2');
      const handler3 = () => results.push('handler3');
      
      const unsub1 = client.onConnected(handler1);
      const unsub2 = client.onConnected(handler2);
      const unsub3 = client.onConnected(handler3);
      
      // All handlers should fire
      (client as any).emitConnected();
      expect(results).toEqual(['handler1', 'handler2', 'handler3']);
      
      // Unsubscribe handler2
      results.length = 0;
      unsub2();
      (client as any).emitConnected();
      expect(results).toEqual(['handler1', 'handler3']);
      
      // Unsubscribe remaining
      results.length = 0;
      unsub1();
      unsub3();
      (client as any).emitConnected();
      expect(results).toEqual([]);
    });

    it('should not throw when emitting with no handlers', () => {
      // Should not throw even with no handlers registered
      expect(() => {
        (client as any).emitChat({} as ChatMessage, 'user');
        (client as any).emitError(new Error('test'));
        (client as any).emitWelcome({} as SystemWelcomePayload);
        (client as any).emitPeerJoined({} as Peer);
        (client as any).emitPeerLeft({} as Peer);
        (client as any).emitMessage({} as Envelope);
        (client as any).emitConnected();
        (client as any).emitDisconnected();
        (client as any).emitReconnected();
      }).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should provide proper types for chat handler', () => {
      // This test mainly verifies TypeScript compilation
      client.onChat((message, from) => {
        // TypeScript should know these types
        const text: string = message.params.text;
        const format: string | undefined = message.params.format;
        const sender: string = from;
        
        expect(text).toBeDefined();
        expect(sender).toBeDefined();
      });
    });

    it('should provide proper types for error handler', () => {
      client.onError((error) => {
        // TypeScript should know this is an Error
        const message: string = error.message;
        const stack: string | undefined = error.stack;
        
        expect(message).toBeDefined();
      });
    });

    it('should provide proper types for welcome handler', () => {
      client.onWelcome((data) => {
        // TypeScript should know the structure
        const participantId: string = data.participant.id;
        const topicName: string = data.topic.name;
        const participants: any[] = data.participants;
        
        expect(participantId).toBeDefined();
        expect(topicName).toBeDefined();
        expect(participants).toBeDefined();
      });
    });
  });
});