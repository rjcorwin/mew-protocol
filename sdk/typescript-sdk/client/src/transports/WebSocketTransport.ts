import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { Envelope } from '../types';
import { Transport, MessageHandler, CloseHandler, ErrorHandler } from './Transport';

interface WebSocketTransportOptions {
  url: string;
  headers?: Record<string, string>;
}

export class WebSocketTransport implements Transport {
  public readonly kind = 'websocket' as const;
  private readonly url: string;
  private readonly headers?: Record<string, string>;
  private readonly emitter = new EventEmitter();
  private socket?: WebSocket;

  constructor(options: WebSocketTransportOptions) {
    this.url = options.url;
    this.headers = options.headers;
  }

  async start(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    await new Promise<void>((resolve, reject) => {
      this.socket = new WebSocket(this.url, { headers: this.headers });

      this.socket.once('open', () => {
        this.socket?.on('message', (data: WebSocket.RawData) => {
          try {
            const envelope = JSON.parse(data.toString()) as Envelope;
            this.emitter.emit('message', envelope);
          } catch (error) {
            this.emitter.emit('error', error);
          }
        });

        this.socket?.on('close', () => {
          this.emitter.emit('close');
        });

        this.socket?.on('error', (error: Error) => {
          this.emitter.emit('error', error);
        });

        resolve();
      });

      this.socket?.once('error', reject);
    });
  }

  async send(envelope: Envelope): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    await new Promise<void>((resolve, reject) => {
      this.socket?.send(JSON.stringify(envelope), (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.socket) return;

    await new Promise<void>((resolve) => {
      if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      this.socket.once('close', () => resolve());
      this.socket.close();
    });
  }

  onMessage(handler: MessageHandler): void {
    this.emitter.on('message', handler);
  }

  onClose(handler: CloseHandler): void {
    this.emitter.on('close', handler);
  }

  onError(handler: ErrorHandler): void {
    this.emitter.on('error', handler);
  }
}
