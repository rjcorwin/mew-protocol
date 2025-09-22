import { EventEmitter } from 'node:events';
import { Envelope, Capability } from '@mew-protocol/types';
import { Transport } from './transports/Transport';
import { StdioTransport } from './transports/StdioTransport';
import { WebSocketTransport } from './transports/WebSocketTransport';

const PROTOCOL_VERSION = 'mew/v0.3';

type ClientState = 'disconnected' | 'connecting' | 'connected' | 'joined' | 'ready';
export type TransportKind = 'stdio' | 'websocket';

export interface ClientOptions {
  space: string;
  token: string;
  participant_id?: string;
  reconnect?: boolean;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  capabilities?: Capability[];
  transport?: TransportKind;
  gateway?: string; // Back-compat alias for websocketUrl
  websocketUrl?: string;
  forceJoin?: boolean;
}

export class MEWClient extends EventEmitter {
  protected options: ClientOptions;
  protected state: ClientState = 'disconnected';
  protected reconnectAttempts = 0;
  protected heartbeatTimer?: NodeJS.Timeout;
  protected reconnectTimer?: NodeJS.Timeout;
  protected messageCounter = 0;
  protected transport: Transport;
  private readonly shouldSendJoin: boolean;

  constructor(options: ClientOptions) {
    super();
    this.options = {
      reconnect: true,
      heartbeatInterval: 30000,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
      ...options,
    };

    if (!this.options.participant_id) {
      this.options.participant_id = `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }

    const transportKind = this.resolveTransportKind();
    if (transportKind === 'websocket') {
      const url = this.options.gateway ?? this.options.websocketUrl;
      if (!url) {
        throw new Error('WebSocket transport selected but no gateway URL provided');
      }
      this.transport = new WebSocketTransport({ url });
    } else {
      this.transport = new StdioTransport();
    }

    this.shouldSendJoin = this.options.forceJoin ?? this.transport.kind !== 'stdio';
  }

  protected resolveTransportKind(): TransportKind {
    if (this.options.transport) return this.options.transport;
    if (this.options.gateway || this.options.websocketUrl) return 'websocket';
    return 'stdio';
  }

  async connect(): Promise<void> {
    if (this.state !== 'disconnected') return;
    this.state = 'connecting';

    this.transport.onMessage((envelope) => this.handleMessage(envelope));
    this.transport.onError((error) => this.emit('error', error));
    this.transport.onClose(() => this.handleDisconnect());

    try {
      await this.transport.start();
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this.emit('connected');

      await this.sendJoin();
      if (this.transport.kind === 'websocket') {
        this.startHeartbeat();
      }
    } catch (error) {
      this.state = 'disconnected';
      throw error;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.state = 'disconnected';
    this.transport.close().catch(() => {});
    this.emit('disconnected');
  }

  async send(envelope: Envelope | Partial<Envelope>): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'connecting') {
      throw new Error('Client is not connected');
    }

    const fullEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `${this.options.participant_id}-${++this.messageCounter}`,
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      ...envelope,
    } as Envelope;

    await this.transport.send(fullEnvelope);
  }

  onConnected(handler: () => void): void {
    this.on('connected', handler);
  }

  onDisconnected(handler: () => void): void {
    this.on('disconnected', handler);
  }

  onMessage(handler: (envelope: Envelope) => void): void {
    this.on('message', handler);
  }

  onWelcome(handler: (payload: any) => void): void {
    this.on('welcome', handler);
  }

  onError(handler: (error: Error) => void): void {
    this.on('error', handler);
  }

  protected async sendJoin(): Promise<void> {
    if (!this.shouldSendJoin) {
      this.state = 'joined';
      return;
    }

    const joinEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `join-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      kind: 'system/join',
      payload: {
        space: this.options.space,
        participantId: this.options.participant_id,
        token: this.options.token,
        capabilities: this.options.capabilities || [],
      },
    } as Envelope;

    await this.transport.send(joinEnvelope);
    this.state = 'joined';
  }

  protected handleMessage(message: Envelope): void {
    if (message.kind === 'system/welcome') {
      this.state = 'ready';
      this.emit('welcome', message.payload);
      return;
    }

    if (message.kind === 'system/error') {
      const err = new Error((message.payload as any)?.message || 'Unknown error');
      this.emit('error', err);
      return;
    }

    this.emit('message', message);
    if (message.kind) {
      this.emit(message.kind, message);
    }
  }

  protected handleDisconnect(): void {
    this.stopHeartbeat();
    const shouldReconnect =
      this.options.reconnect &&
      this.transport.kind === 'websocket' &&
      this.reconnectAttempts < (this.options.maxReconnectAttempts ?? 5);

    this.state = 'disconnected';
    this.emit('disconnected');

    if (shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    const baseDelay = this.options.reconnectDelay ?? 1000;
    const delay = baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts += 1;

    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('error', error);
        if (this.reconnectAttempts < (this.options.maxReconnectAttempts ?? 5)) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const heartbeat: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: `heartbeat-${Date.now()}`,
        ts: new Date().toISOString(),
        from: this.options.participant_id!,
        kind: 'system/heartbeat',
        space: this.options.space,
        payload: {},
      } as Envelope;

      this.transport.send(heartbeat).catch(() => {
        // ignore heartbeat failures
      });
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
