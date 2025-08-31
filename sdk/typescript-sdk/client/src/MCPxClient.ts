import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import {
  Envelope,
  PartialEnvelope,
  Peer,
  PresencePayload,
  SystemWelcomePayload,
  SystemErrorPayload,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcMessage,
  ChatPayload,
  ConnectionOptions,
  PendingRequest,
  HistoryOptions,
  PROTOCOL_VERSION,
} from './types';

/**
 * Event names emitted by MCPxClient
 */
export const ClientEvents = {
  /** Emitted when WebSocket connection is established */
  CONNECTED: 'connected',
  
  /** Emitted when WebSocket connection is closed */
  DISCONNECTED: 'disconnected',
  
  /** Emitted when connection is re-established after disconnect */
  RECONNECTED: 'reconnected',
  
  /** Emitted when any envelope is received */
  MESSAGE: 'message',
  
  /** Emitted when welcome message is received from gateway */
  WELCOME: 'welcome',
  
  /** Emitted when an error occurs */
  ERROR: 'error',
  
  /** Emitted when a peer joins the topic */
  PEER_JOINED: 'peer-joined',
  
  /** Emitted when a peer leaves the topic */
  PEER_LEFT: 'peer-left',
  
  /** Emitted when a chat message is received (kind='chat' in v0.1) */
  CHAT: 'chat',
} as const;

/**
 * Type-safe event parameter types
 * Maps each event name to its corresponding parameter types
 * 
 * Usage example:
 * ```typescript
 * client.on(ClientEvents.CHAT, (message, from) => {
 *   // message is typed as ChatMessage
 *   // from is typed as string
 * });
 * ```
 */
export type ClientEventParams = {
  [ClientEvents.CONNECTED]: [];
  [ClientEvents.DISCONNECTED]: [];
  [ClientEvents.RECONNECTED]: [];
  [ClientEvents.MESSAGE]: [envelope: Envelope];
  [ClientEvents.WELCOME]: [data: SystemWelcomePayload];
  [ClientEvents.ERROR]: [error: Error];
  [ClientEvents.PEER_JOINED]: [peer: Peer];
  [ClientEvents.PEER_LEFT]: [peer: Peer];
  [ClientEvents.CHAT]: [message: ChatPayload, from: string];
};

/**
 * Type definitions for event handlers
 */
export type ChatHandler = (message: ChatPayload, from: string) => void;
export type ErrorHandler = (error: Error) => void;
export type WelcomeHandler = (data: SystemWelcomePayload) => void;
export type PeerHandler = (peer: Peer) => void;
export type MessageHandler = (envelope: Envelope) => void;
export type VoidHandler = () => void;

export class MCPxClient {
  private ws: WebSocket | null = null;
  private options: Required<ConnectionOptions>;
  private participantId: string | null = null;
  private peers: Map<string, Peer> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  
  // Event handlers
  private handlers = {
    chat: new Set<ChatHandler>(),
    error: new Set<ErrorHandler>(),
    welcome: new Set<WelcomeHandler>(),
    peerJoined: new Set<PeerHandler>(),
    peerLeft: new Set<PeerHandler>(),
    message: new Set<MessageHandler>(),
    connected: new Set<VoidHandler>(),
    disconnected: new Set<VoidHandler>(),
    reconnected: new Set<VoidHandler>(),
  };

  constructor(options: ConnectionOptions) {
    this.options = {
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
      requestTimeout: 30000,
      ...options,
    };
  }

  /**
   * Event handler registration methods
   */
  
  onChat(handler: ChatHandler): () => void {
    this.handlers.chat.add(handler);
    return () => this.handlers.chat.delete(handler);
  }

  onError(handler: ErrorHandler): () => void {
    this.handlers.error.add(handler);
    return () => this.handlers.error.delete(handler);
  }

  onWelcome(handler: WelcomeHandler): () => void {
    this.handlers.welcome.add(handler);
    return () => this.handlers.welcome.delete(handler);
  }

  onPeerJoined(handler: PeerHandler): () => void {
    this.handlers.peerJoined.add(handler);
    return () => this.handlers.peerJoined.delete(handler);
  }

  onPeerLeft(handler: PeerHandler): () => void {
    this.handlers.peerLeft.add(handler);
    return () => this.handlers.peerLeft.delete(handler);
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.message.add(handler);
    return () => this.handlers.message.delete(handler);
  }

  onConnected(handler: VoidHandler): () => void {
    this.handlers.connected.add(handler);
    return () => this.handlers.connected.delete(handler);
  }

  onDisconnected(handler: VoidHandler): () => void {
    this.handlers.disconnected.add(handler);
    return () => this.handlers.disconnected.delete(handler);
  }

  onReconnected(handler: VoidHandler): () => void {
    this.handlers.reconnected.add(handler);
    return () => this.handlers.reconnected.delete(handler);
  }

  /**
   * Internal event emission methods
   */
  
  private emitChat(message: ChatPayload, from: string): void {
    this.handlers.chat.forEach(handler => handler(message, from));
  }

  private emitError(error: Error): void {
    this.handlers.error.forEach(handler => handler(error));
  }

  private emitWelcome(data: SystemWelcomePayload): void {
    this.handlers.welcome.forEach(handler => handler(data));
  }

  private emitPeerJoined(peer: Peer): void {
    this.handlers.peerJoined.forEach(handler => handler(peer));
  }

  private emitPeerLeft(peer: Peer): void {
    this.handlers.peerLeft.forEach(handler => handler(peer));
  }

  private emitMessage(envelope: Envelope): void {
    this.handlers.message.forEach(handler => handler(envelope));
  }

  private emitConnected(): void {
    this.handlers.connected.forEach(handler => handler());
  }

  private emitDisconnected(): void {
    this.handlers.disconnected.forEach(handler => handler());
  }

  private emitReconnected(): void {
    this.handlers.reconnected.forEach(handler => handler());
  }

  /**
   * Connect to MCPx gateway
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = this.doConnect();
    
    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.options.gateway}/ws?topic=${encodeURIComponent(this.options.topic)}`;
      
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${this.options.token}`,
        },
      });

      const connectionTimeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        this.setupHeartbeat();
        this.emitConnected();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const envelope = JSON.parse(data.toString()) as Envelope;
          this.handleEnvelope(envelope);
          
          // Resolve on welcome message (v0.1)
          if (envelope.kind === 'system/welcome') {
            resolve();
          }
        } catch (error) {
          this.emitError(error as Error);
        }
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(connectionTimeout);
        this.emitError(error);
        reject(error);
      });

      this.ws.on('close', () => {
        clearTimeout(connectionTimeout);
        this.cleanup();
        this.emitDisconnected();
        
        if (this.options.reconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('ping', () => {
        this.ws?.pong();
      });
    });
  }

  /**
   * Disconnect from gateway
   */
  disconnect(): void {
    this.options.reconnect = false;
    this.cleanup();
    this.ws?.close();
    this.ws = null;
  }

  /**
   * Reconnect to gateway
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    this.options.reconnect = true;
    await this.connect();
    
    // Fetch and reconcile history
    await this.getHistory();
    // Process any messages we might have missed
    // This is simplified - in production you'd track last seen message
    
    // Retry outstanding requests
    for (const [, pending] of this.pendingRequests) {
      if (Date.now() - pending.timestamp < this.options.requestTimeout) {
        await this.send(pending.envelope);
      } else {
        pending.reject(new Error('Request timeout after reconnect'));
        // Find and delete the pending request by searching for it
        for (const [reqId, req] of this.pendingRequests) {
          if (req === pending) {
            this.pendingRequests.delete(reqId);
            break;
          }
        }
      }
    }
    
    this.emitReconnected();
  }

  private scheduleReconnect(): void {
    if (!this.options.reconnect || this.reconnectTimer) return;
    
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        this.reconnectAttempts = 0;
      } catch (error) {
        // Will retry automatically
      }
    }, delay);
  }

  private setupHeartbeat(): void {
    this.clearHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.options.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanup(): void {
    this.clearHeartbeat();
    
    // Cancel all pending requests
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeout) clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Get current participant ID
   */
  getParticipantId(): string {
    if (!this.participantId) {
      throw new Error('Not connected');
    }
    return this.participantId;
  }

  /**
   * Handle incoming envelope
   */
  private handleEnvelope(envelope: Envelope): void {
    // Validate envelope
    if (envelope.protocol !== PROTOCOL_VERSION) {
      this.emitError(new Error(`Invalid protocol version: ${envelope.protocol}`));
      return;
    }

    // Special case: always process system messages (includes welcome)
    if (envelope.kind.startsWith('system/')) {
      this.emitMessage(envelope);
      this.handleSystemMessage(envelope);
      return;
    }
    
    // IMPORTANT: In MCPx v0.1, the gateway broadcasts ALL messages to ALL participants
    // This is essential for the protocol to work correctly - participants need to see
    // all interactions to understand the conversation context.
    // We no longer filter messages based on the 'to' field.
    
    this.emitMessage(envelope);

    // Handle different message kinds (v0.1)
    if (envelope.kind === 'system/presence') {
      this.handlePresenceMessage(envelope);
    } else if (envelope.kind.startsWith('mcp/')) {
      this.handleMCPMessage(envelope);
    } else if (envelope.kind === 'chat') {
      this.handleChatMessage(envelope);
    }
  }

  private handleSystemMessage(envelope: Envelope): void {
    if (envelope.kind === 'system/welcome') {
      const welcome = envelope.payload as SystemWelcomePayload;
      this.participantId = welcome.you.id;
      
      // Update peer registry
      this.peers.clear();
      for (const participant of welcome.participants) {
        this.peers.set(participant.id, participant);
      }
      
      this.emitWelcome(welcome);
    } else if (envelope.kind === 'system/error') {
      const error = envelope.payload as SystemErrorPayload;
      this.emitError(new Error(error.message));
    }
  }

  private handlePresenceMessage(envelope: Envelope): void {
    const payload = envelope.payload as PresencePayload;
    
    switch (payload.event) {
      case 'join':
        this.peers.set(payload.participant.id, payload.participant);
        this.emitPeerJoined(payload.participant);
        break;
      
      case 'leave':
        this.peers.delete(payload.participant.id);
        this.emitPeerLeft(payload.participant);
        break;
      
      // v0.1 removed heartbeat from presence events
    }
  }

  private handleMCPMessage(envelope: Envelope): void {
    const message = envelope.payload as JsonRpcMessage;
    
    // Debug log all MCP messages
    if (envelope.correlation_id) {
      // Debug: Received MCP response with correlation_id
    }
    
    // Handle response to our request
    if (envelope.correlation_id && this.pendingRequests.has(envelope.correlation_id)) {
      const pending = this.pendingRequests.get(envelope.correlation_id)!;
      this.pendingRequests.delete(envelope.correlation_id);
      
      if (pending.timeout) clearTimeout(pending.timeout);
      
      if ('error' in message && message.error) {
        pending.reject(new Error(message.error.message));
      } else if ('result' in message) {
        pending.resolve(message.result);
      }
    }
  }

  private handleChatMessage(envelope: Envelope): void {
    const payload = envelope.payload as ChatPayload;
    this.emitChat(payload, envelope.from);
  }

  /**
   * Send a generic envelope
   */
  async send(envelope: PartialEnvelope): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    if (!this.participantId) {
      throw new Error('Not authenticated yet - waiting for welcome message');
    }

    const fullEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: this.participantId,
      ...envelope,
    };

    // Debug logging for MCP responses (v0.1)
    if (envelope.kind.startsWith('mcp/response:') && envelope.correlation_id) {
      // Debug: Sending MCP response with correlation_id
    }

    this.ws.send(JSON.stringify(fullEnvelope));
  }

  /**
   * Send an MCP request (single recipient only)
   */
  async request(to: string, method: string, params?: any): Promise<any> {
    if (!to) {
      throw new Error('Request must have exactly one recipient');
    }

    const jsonRpcId = Math.floor(Math.random() * 1000000);
    
    // Build kind with method (v0.1)
    // For v0.1, the kind should be mcp/request:METHOD where METHOD is the full method name
    let kind = `mcp/request:${method}`;
    
    // Add context for tool calls if available
    if (method === 'tools/call' && params?.name) {
      kind = `mcp/request:${method}:${params.name}`;
    }
    
    const envelope: PartialEnvelope = {
      to: [to],
      kind,
      payload: {
        jsonrpc: '2.0',
        id: jsonRpcId,
        method,
        params,
      } as JsonRpcRequest,
    };

    const fullEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: this.participantId!,
      ...envelope,
    };

    return new Promise((resolve, reject) => {
      const pending: PendingRequest = {
        envelope: fullEnvelope,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Set timeout
      pending.timeout = setTimeout(() => {
        this.pendingRequests.delete(fullEnvelope.id);
        
        // Send cancellation notification
        this.notify([to], 'notifications/cancelled', {
          requestId: jsonRpcId,
          reason: 'timeout',
        });
        
        reject(new Error(`Request timeout: ${method}`));
      }, this.options.requestTimeout);

      this.pendingRequests.set(fullEnvelope.id, pending);
      
      this.send(fullEnvelope).catch((error) => {
        this.pendingRequests.delete(fullEnvelope.id);
        if (pending.timeout) clearTimeout(pending.timeout);
        reject(error);
      });
    });
  }

  /**
   * Send an MCP notification
   */
  notify(to: string | string[] | null, method: string, params?: any): void {
    // Build kind with method (v0.1) 
    // For v0.1, the kind should be mcp/request:METHOD where METHOD is the full method name
    const kind = `mcp/request:${method}`;
    
    const envelope: PartialEnvelope = {
      to: to === null ? undefined : Array.isArray(to) ? to : [to],
      kind,
      payload: {
        jsonrpc: '2.0',
        method,
        params,
      } as JsonRpcNotification,
    };

    this.send(envelope).catch((error) => {
      this.emitError(error);
    });
  }

  /**
   * Send an MCP response (v0.1 - must include correlation_id)
   */
  respond(to: string, correlationId: string, method: string, result?: any, error?: any): void {
    // Build kind with method (v0.1)
    // For v0.1, the kind should be mcp/response:METHOD where METHOD is the full method name
    let kind = `mcp/response:${method}`;
    
    // Add context for tool calls if available
    if (method === 'tools/call' && result?.name) {
      kind = `mcp/response:${method}:${result.name}`;
    }
    
    const envelope: PartialEnvelope = {
      to: [to],
      kind,
      correlation_id: correlationId,
      payload: error ? {
        jsonrpc: '2.0',
        id: 0, // Response ID should match request
        error: {
          code: -32603,
          message: error.message || 'Internal error',
          data: error
        }
      } : {
        jsonrpc: '2.0',
        id: 0, // Response ID should match request
        result
      },
    };

    this.send(envelope).catch((err) => {
      this.emitError(err);
    });
  }

  /**
   * Broadcast a message to all participants
   */
  broadcast(kind: string, payload: any): void {
    const envelope: PartialEnvelope = {
      kind,
      payload,
    };

    this.send(envelope).catch((error) => {
      this.emitError(error);
    });
  }

  /**
   * Send a chat message (v0.1 - chat is now a separate kind)
   */
  chat(text: string, format: 'plain' | 'markdown' = 'plain'): void {
    const envelope: PartialEnvelope = {
      kind: 'chat',
      payload: { text, format } as ChatPayload,
    };
    
    this.send(envelope).catch((error) => {
      this.emitError(error);
    });
  }

  /**
   * Get all peers
   */
  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get a specific peer
   */
  getPeer(id: string): Peer | null {
    return this.peers.get(id) || null;
  }

  /**
   * Get pending requests
   */
  getPendingRequests(): Map<string, PendingRequest> {
    return new Map(this.pendingRequests);
  }

  /**
   * REST API: Get available topics
   */
  async getTopics(): Promise<string[]> {
    const response = await fetch(`${this.options.gateway}/v0.1/topics`, {
      headers: {
        Authorization: `Bearer ${this.options.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get topics: ${response.statusText}`);
    }

    const data = await response.json() as { topics?: string[] };
    return data.topics || [];
  }

  /**
   * REST API: Get participants in a topic
   */
  async getParticipants(topic?: string): Promise<Peer[]> {
    const targetTopic = topic || this.options.topic;
    const response = await fetch(
      `${this.options.gateway}/v0.1/topics/${encodeURIComponent(targetTopic)}/participants`,
      {
        headers: {
          Authorization: `Bearer ${this.options.token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get participants: ${response.statusText}`);
    }

    const data = await response.json() as { participants?: Peer[] };
    return data.participants || [];
  }

  /**
   * REST API: Get message history
   */
  async getHistory(options?: HistoryOptions): Promise<Envelope[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.before) params.set('before', options.before);

    const url = `${this.options.gateway}/v0.1/topics/${encodeURIComponent(this.options.topic)}/history${
      params.toString() ? `?${params}` : ''
    }`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.options.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }

    const data = await response.json() as { messages?: Envelope[] };
    return data.messages || [];
  }
}