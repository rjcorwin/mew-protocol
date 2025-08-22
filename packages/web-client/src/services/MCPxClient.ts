import { 
  Envelope, 
  Participant, 
  ConnectionState, 
  SystemWelcomePayload, 
  PresencePayload,
  createEnvelope
} from '@/types/mcpx';

export interface MCPxClientConfig {
  serverUrl: string;
  authToken: string;
  topic: string;
  participantId: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface MCPxClientEvents {
  'connected': () => void;
  'disconnected': () => void;
  'error': (error: Error) => void;
  'message': (envelope: Envelope) => void;
  'presence': (event: PresencePayload) => void;
  'welcome': (welcome: SystemWelcomePayload) => void;
}

export class MCPxClient {
  private ws: WebSocket | null = null;
  private config: MCPxClientConfig;
  private listeners: Map<keyof MCPxClientEvents, Function[]> = new Map();
  private connectionState: ConnectionState = { status: 'disconnected' };
  private reconnectTimeout: number | null = null;
  private reconnectAttempt = 0;

  constructor(config: MCPxClientConfig) {
    this.config = {
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      ...config
    };
    
    // Initialize listener maps
    (['connected', 'disconnected', 'error', 'message', 'presence', 'welcome'] as const)
      .forEach(event => this.listeners.set(event, []));
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setConnectionState({ status: 'connecting', topic: this.config.topic });

      try {
        // Convert http to ws protocol
        const serverUrl = this.config.serverUrl
          .replace('http://', 'ws://')
          .replace('https://', 'wss://');
        
        // Pass auth token as query parameter since browser WebSocket doesn't support headers
        const wsUrl = `${serverUrl}/v0/ws?topic=${encodeURIComponent(this.config.topic)}&token=${encodeURIComponent(this.config.authToken)}`;
        this.ws = new WebSocket(wsUrl);

        const onOpen = () => {
          this.setConnectionState({ 
            status: 'connected', 
            topic: this.config.topic, 
            participantId: this.config.participantId 
          });
          this.reconnectAttempt = 0;
          this.emit('connected');
          resolve();
        };

        const onMessage = (event: MessageEvent) => {
          try {
            const envelope: Envelope = JSON.parse(event.data);
            this.handleMessage(envelope);
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        };

        const onError = (error: Event) => {
          const errorMsg = `WebSocket error: ${error}`;
          console.error(errorMsg);
          this.setConnectionState({ 
            status: 'error', 
            error: errorMsg 
          });
          this.emit('error', new Error(errorMsg));
          reject(new Error(errorMsg));
        };

        const onClose = (event: CloseEvent) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          this.setConnectionState({ status: 'disconnected' });
          this.emit('disconnected');
          
          // Attempt reconnection
          this.attemptReconnect();
        };

        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('message', onMessage);
        this.ws.addEventListener('error', onError);
        this.ws.addEventListener('close', onClose);

      } catch (error) {
        const errorMsg = `Failed to create WebSocket: ${error}`;
        this.setConnectionState({ status: 'error', error: errorMsg });
        this.emit('error', error as Error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setConnectionState({ status: 'disconnected' });
  }

  sendMessage(envelope: Envelope): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Ensure the message is from the correct participant
    envelope.from = this.config.participantId;

    this.ws.send(JSON.stringify(envelope));
  }

  sendChatMessage(text: string, format: 'plain' | 'markdown' = 'plain'): void {
    const envelope = createEnvelope(this.config.participantId, 'mcp', {
      jsonrpc: '2.0',
      method: 'notifications/chat/message',
      params: { text, format }
    });

    this.sendMessage(envelope);
  }

  sendMCPRequest(
    to: string, 
    method: string, 
    params?: Record<string, any>, 
    id: string | number = crypto.randomUUID()
  ): void {
    const envelope = createEnvelope(this.config.participantId, 'mcp', {
      jsonrpc: '2.0',
      id,
      method,
      params
    }, [to]);

    this.sendMessage(envelope);
  }

  on<K extends keyof MCPxClientEvents>(event: K, listener: MCPxClientEvents[K]): void {
    const listeners = this.listeners.get(event) || [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
  }

  off<K extends keyof MCPxClientEvents>(event: K, listener: MCPxClientEvents[K]): void {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
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

  private setConnectionState(state: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...state };
  }

  private emit<K extends keyof MCPxClientEvents>(event: K, ...args: Parameters<MCPxClientEvents[K]>): void {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        (listener as any)(...args);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempt >= (this.config.reconnectAttempts || 5)) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempt++;
    const delay = (this.config.reconnectDelay || 1000) * Math.pow(2, this.reconnectAttempt - 1);
    
    console.log(`Attempting reconnection ${this.reconnectAttempt} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay) as any;
  }
}