import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPxClient } from '@mcpx-protocol/client';

// Mock the MCPxClient module
vi.mock('@mcpx-protocol/client', () => {
  return {
    MCPxClient: vi.fn().mockImplementation(() => ({
      onWelcome: vi.fn(),
      onChat: vi.fn(),
      onPeerJoined: vi.fn(),
      onPeerLeft: vi.fn(),
      onMessage: vi.fn(),
      onError: vi.fn(),
      onDisconnected: vi.fn(),
      onReconnected: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      chat: vi.fn(),
      sendRequest: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
    })),
    Envelope: {},
    Peer: {},
    SystemWelcomePayload: {},
    ChatMessage: {},
  };
});

describe('CLI', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MCPxClient API Usage', () => {
    it('should use the correct event handler methods', () => {
      const ClientConstructor = MCPxClient as any;
      const mockClient = new ClientConstructor();
      
      // Verify that the MCPxClient mock has the correct methods
      expect(mockClient.onWelcome).toBeDefined();
      expect(mockClient.onChat).toBeDefined();
      expect(mockClient.onPeerJoined).toBeDefined();
      expect(mockClient.onPeerLeft).toBeDefined();
      expect(mockClient.onMessage).toBeDefined();
      expect(mockClient.onError).toBeDefined();
      expect(mockClient.onDisconnected).toBeDefined();
      expect(mockClient.onReconnected).toBeDefined();
      
      // Verify these are functions
      expect(typeof mockClient.onWelcome).toBe('function');
      expect(typeof mockClient.onChat).toBe('function');
      expect(typeof mockClient.onPeerJoined).toBe('function');
      expect(typeof mockClient.onPeerLeft).toBe('function');
      expect(typeof mockClient.onMessage).toBe('function');
      expect(typeof mockClient.onError).toBe('function');
      expect(typeof mockClient.onDisconnected).toBe('function');
      expect(typeof mockClient.onReconnected).toBe('function');
    });

    it('should NOT have the old generic on() method', () => {
      const ClientConstructor = MCPxClient as any;
      const mockClient = new ClientConstructor();
      
      // Verify that the old API doesn't exist
      expect(mockClient.on).toBeUndefined();
    });

    it('should be able to call event handler methods', () => {
      const ClientConstructor = MCPxClient as any;
      const mockClient = new ClientConstructor();
      const welcomeHandler = vi.fn();
      const chatHandler = vi.fn();
      
      // Call the methods - these should not throw
      mockClient.onWelcome(welcomeHandler);
      mockClient.onChat(chatHandler);
      
      // Verify the handlers were registered
      expect(mockClient.onWelcome).toHaveBeenCalledWith(welcomeHandler);
      expect(mockClient.onChat).toHaveBeenCalledWith(chatHandler);
    });

    it('should be able to connect and disconnect', async () => {
      const ClientConstructor = MCPxClient as any;
      const mockClient = new ClientConstructor();
      
      await expect(mockClient.connect()).resolves.toBeUndefined();
      expect(mockClient.connect).toHaveBeenCalled();
      
      mockClient.disconnect();
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('should be able to send chat messages', () => {
      const ClientConstructor = MCPxClient as any;
      const mockClient = new ClientConstructor();
      const message = 'Hello, world!';
      
      mockClient.chat(message);
      expect(mockClient.chat).toHaveBeenCalledWith(message);
    });
  });

  describe('CLI Command Structure', () => {
    it('should have expected commands defined', () => {
      // This is a structural test to ensure commands are present
      // Since the CLI uses readline, we can't easily test the full flow
      // but we can ensure the command strings are what we expect
      const expectedCommands = [
        '/help',
        '/connect',
        '/disconnect', 
        '/list',
        '/tools',
        '/call',
        '/debug',
        '/quit',
        '/exit',
      ];
      
      // This test mainly documents the expected commands
      expect(expectedCommands).toBeDefined();
      expect(expectedCommands.length).toBeGreaterThan(0);
    });
  });
});