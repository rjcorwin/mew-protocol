import WebSocket from 'ws';
import { EventEmitter } from 'eventemitter3';
import Debug from 'debug';
import { z } from 'zod';

const debug = Debug('mcpxp:client');

// Core types for the base SDK
export interface MCPxConfig {
  serverUrl: string;
  topic: string;
  participantId: string;
  participantName?: string;
  authToken?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface Envelope {
  id: string;
  topic: string;
  from: string;
  to?: string | string[];
  timestamp: string;
  data: any;
}

export interface MCPxEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  message: (envelope: Envelope) => void;
  envelope: (envelope: Envelope) => void;
  chat: (message: any) => void;
  presence: (event: any) => void;
  welcome: (data: any) => void;
  [key: string]: (...args: any[]) => void;
}

// Base envelope schema
const EnvelopeSchema = z.object({
  id: z.string(),
  topic: z.string(),
  from: z.string(),
  to: z.union([z.string(), z.array(z.string())]).optional(),
  timestamp: z.string(),
  data: z.any()
});

/**
 * Base MCPx client for protocol communication
 * Handles WebSocket connection, envelope wrapping/unwrapping, and basic messaging
 */
export class MCPxClient extends EventEmitter<MCPxEvents> {
  protected ws: WebSocket | null = null;
  protected config: MCPxConfig;
  protected connected = false;
  protected reconnectTimer?: NodeJS.Timeout;
  protected heartbeatTimer?: NodeJS.Timeout;
  protected reconnectAttempt = 0;
  protected messageId = 0;

  constructor(config: MCPxConfig) {
    super();
    this.config = {
      reconnect: true,
      reconnectDelay: 1000,
      reconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    };
  }

  // Connection Management
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.serverUrl}/v0/ws?topic=${encodeURIComponent(this.config.topic)}`;
      
      debug('Connecting to', wsUrl);
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.authToken || ''}`
        }
      });
      
      this.ws.on('open', () => {
        debug('Connected');
        this.connected = true;
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.emit('connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });
      
      this.ws.on('error', (error) => {
        debug('WebSocket error:', error);
        this.emit('error', error);
        if (!this.connected) reject(error);
      });
      
      this.ws.on('close', (code, reason) => {
        debug('Disconnected:', code, reason?.toString());
        this.handleDisconnect();
      });
    });
  }

  disconnect(): void {
    this.connected = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.emit('disconnected');
  }

  // Message Handling
  protected handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Validate envelope structure
      const result = EnvelopeSchema.safeParse(message);
      if (!result.success) {
        debug('Invalid envelope:', result.error);
        return;
      }
      
      const envelope = result.data as Envelope;
      debug('Received envelope:', envelope.id, envelope.data?.type || 'unknown');
      
      // Emit raw envelope event
      this.emit('envelope', envelope);
      
      // Handle different message types
      const messageType = envelope.data?.type;
      if (messageType) {
        // Special handling for common types
        switch (messageType) {
          case 'chat':
            this.emit('chat', envelope.data);
            break;
          case 'presence':
            this.emit('presence', envelope.data);
            break;
          case 'system.welcome':
            this.emit('welcome', envelope.data);
            break;
          default:
            // Emit type-specific event
            this.emit(messageType, envelope.data);
        }
      }
      
      // Always emit general message event
      this.emit('message', envelope);
      
    } catch (error) {
      debug('Failed to parse message:', error);
      this.emit('error', error as Error);
    }
  }

  // Send Methods
  send(data: any, to?: string | string[]): void {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected');
    }
    
    const envelope: Envelope = {
      id: this.generateMessageId(),
      topic: this.config.topic,
      from: this.config.participantId,
      to,
      timestamp: new Date().toISOString(),
      data
    };
    
    debug('Sending envelope:', envelope.id, data.type || 'unknown');
    this.ws.send(JSON.stringify(envelope));
  }

  sendChat(content: string, to?: string | string[]): void {
    this.send({
      type: 'chat',
      content,
      participantName: this.config.participantName || this.config.participantId
    }, to);
  }

  // Utility Methods
  protected generateMessageId(): string {
    return `${this.config.participantId}-${Date.now()}-${++this.messageId}`;
  }

  protected handleDisconnect(): void {
    this.connected = false;
    this.stopHeartbeat();
    this.emit('disconnected');
    
    if (this.config.reconnect && this.reconnectAttempt < (this.config.reconnectAttempts || 10)) {
      this.scheduleReconnect();
    }
  }

  protected scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    const delay = Math.min(
      (this.config.reconnectDelay || 1000) * Math.pow(2, this.reconnectAttempt),
      30000
    );
    
    debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.reconnectAttempt++;
      this.connect().catch(error => {
        debug('Reconnection failed:', error);
      });
    }, delay);
  }

  protected startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && this.ws) {
        this.ws.ping();
      }
    }, this.config.heartbeatInterval);
  }

  protected stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.connected;
  }

  get participantId(): string {
    return this.config.participantId;
  }

  get topic(): string {
    return this.config.topic;
  }
}