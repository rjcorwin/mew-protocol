import { Envelope } from '../types';

export type MessageHandler = (envelope: Envelope) => void;
export type CloseHandler = (reason?: Error) => void;
export type ErrorHandler = (error: Error) => void;

export interface Transport {
  readonly kind: 'stdio' | 'websocket';
  start(): Promise<void>;
  send(envelope: Envelope): Promise<void>;
  close(): Promise<void>;
  onMessage(handler: MessageHandler): void;
  onClose(handler: CloseHandler): void;
  onError(handler: ErrorHandler): void;
}
