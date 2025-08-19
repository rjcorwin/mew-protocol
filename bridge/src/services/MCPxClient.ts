import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { 
  Envelope, 
  Participant, 
  createEnvelope, 
  SystemWelcomePayload, 
  PresencePayload 
} from '../types/mcpx';
import { MCPxConfig, ParticipantConfig } from '../types/config';

export interface MCPxClientEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  message: (envelope: Envelope) => void;
  welcome: (payload: SystemWelcomePayload) => void;
  presence: (payload: PresencePayload) => void;
}

export declare interface MCPxClient {
  on<U extends keyof MCPxClientEvents>(event: U, listener: MCPxClientEvents[U]): this;
  emit<U extends keyof MCPxClientEvents>(event: U, ...args: Parameters<MCPxClientEvents[U]>): boolean;
}

export class MCPxClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: MCPxConfig & { participant: ParticipantConfig };
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor(
    config: MCPxConfig & { participant: ParticipantConfig },
    options: { maxReconnectAttempts?: number; reconnectDelay?: number } = {}
  ) {
    super();
    this.config = config;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = `${this.config.server.replace(/^http/, 'ws')}/v0/ws?topic=${encodeURIComponent(this.config.topic)}`;
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.token}`
        }
      });

      await this.setupWebSocketHandlers();
      this.isConnecting = false;
      this.reconnectAttempts = 0;

    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.emit('disconnected');
  }

  sendMessage(envelope: Envelope): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('MCPx client not connected');
    }

    // Ensure message is from the correct participant
    envelope.from = this.config.participant.id;
    
    this.ws.send(JSON.stringify(envelope));
  }

  sendMCPMessage(payload: any, to?: string[], correlationId?: string): void {
    const envelope = createEnvelope(
      this.config.participant.id,
      'mcp',
      payload,
      to,
      correlationId
    );

    this.sendMessage(envelope);
  }

  private async setupWebSocketHandlers(): Promise<void> {
    if (!this.ws) return;

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      this.ws.on('open', () => {
        console.log(`Connected to MCPx server: ${this.config.server}`);
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const envelope: Envelope = JSON.parse(data.toString());
          this.handleMessage(envelope);
        } catch (error) {
          console.error('Failed to parse MCPx message:', error);
        }
      });

      this.ws.on('error', (error: Error) => {
        console.error('MCPx WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        console.log(`MCPx connection closed: ${code} ${reason.toString()}`);
        this.emit('disconnected');
        
        // Attempt reconnection
        this.attemptReconnect();
      });
    });
  }

  private handleMessage(envelope: Envelope): void {
    this.emit('message', envelope);

    switch (envelope.kind) {
      case 'system':
        if (envelope.payload.event === 'welcome') {
          this.emit('welcome', envelope.payload as SystemWelcomePayload);
        }
        break;
      case 'presence':
        this.emit('presence', envelope.payload as PresencePayload);
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectTimeout || this.isConnecting) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting MCPx reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch(error => {
        console.error('MCPx reconnection failed:', error);
      });
    }, delay);
  }
}