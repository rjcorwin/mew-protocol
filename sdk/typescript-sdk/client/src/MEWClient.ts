import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Envelope, Capability } from '@mew-protocol/types';

const PROTOCOL_VERSION = 'mew/v0.3';

export interface ClientOptions {
  gateway: string;          // WebSocket URL
  space: string;           // Space to join
  token: string;           // Authentication token
  participant_id?: string;  // Unique identifier
  reconnect?: boolean;     // Auto-reconnect on disconnect
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  capabilities?: Capability[];  // Initial capabilities
}

type ClientState = 'disconnected' | 'connecting' | 'connected' | 'joined' | 'ready';

export class MEWClient extends EventEmitter {
  protected options: ClientOptions;
  protected ws?: WebSocket;
  protected state: ClientState = 'disconnected';
  protected reconnectAttempts = 0;
  protected heartbeatTimer?: NodeJS.Timeout;
  protected reconnectTimer?: NodeJS.Timeout;
  protected messageCounter = 0;

  constructor(options: ClientOptions) {
    super();
    this.options = {
      reconnect: true,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      ...options
    };
    
    // Generate participant_id if not provided
    if (!this.options.participant_id) {
      this.options.participant_id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Connect to the gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state !== 'disconnected') {
        return resolve();
      }

      this.state = 'connecting';
      
      try {
        this.ws = new WebSocket(this.options.gateway);
        
        this.ws.on('open', () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.emit('connected');
          
          // Send join message
          this.sendJoin();
          
          // Start heartbeat
          this.startHeartbeat();
          
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        });

        this.ws.on('close', () => {
          this.handleDisconnect();
        });

        this.ws.on('error', (error: Error) => {
          this.emit('error', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        });
      } catch (error) {
        this.state = 'disconnected';
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the gateway
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.state = 'disconnected';
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    this.emit('disconnected');
  }

  /**
   * Send an envelope
   */
  send(envelope: Envelope | Partial<Envelope>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to gateway');
    }

    // Fill in missing fields
    const fullEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `${this.options.participant_id}-${++this.messageCounter}`,
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      ...envelope
    } as Envelope;

    this.ws.send(JSON.stringify(fullEnvelope));
  }

  /**
   * Event handler helpers for subclasses
   */
  onConnected(handler: () => void): void {
    this.on('connected', handler);
  }

  onDisconnected(handler: () => void): void {
    this.on('disconnected', handler);
  }

  onMessage(handler: (envelope: Envelope) => void): void {
    this.on('message', handler);
  }

  onWelcome(handler: (data: any) => void): void {
    this.on('welcome', handler);
  }

  onError(handler: (error: Error) => void): void {
    this.on('error', handler);
  }

  /**
   * Send join message
   */
  private sendJoin(): void {
    if (!this.ws) return;

    const joinMessage = {
      type: 'join',
      space: this.options.space,
      token: this.options.token,
      participantId: this.options.participant_id,
      capabilities: this.options.capabilities || []
    };

    this.ws.send(JSON.stringify(joinMessage));
    this.state = 'joined';
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    // Handle welcome message
    if (message.type === 'welcome') {
      this.state = 'ready';
      this.emit('welcome', message);
      return;
    }

    // Handle error messages
    if (message.type === 'error') {
      this.emit('error', new Error(message.message || 'Unknown error'));
      return;
    }

    // Handle envelopes
    if (message.protocol && message.kind) {
      this.emit('message', message as Envelope);
      
      // Emit specific events for different kinds
      if (message.kind) {
        this.emit(message.kind, message);
      }
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    const wasReady = this.state === 'ready';
    this.state = 'disconnected';
    this.ws = undefined;
    
    this.emit('disconnected');

    // Attempt reconnection if enabled
    if (this.options.reconnect && wasReady && 
        this.reconnectAttempts < this.options.maxReconnectAttempts!) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const delay = this.options.reconnectDelay! * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        if (this.reconnectAttempts < this.options.maxReconnectAttempts!) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  /**
   * Get current state
   */
  getState(): ClientState {
    return this.state;
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.state === 'ready';
  }
}