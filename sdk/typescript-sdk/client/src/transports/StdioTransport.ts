import { Readable, Writable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { Envelope } from '../types';
import { Transport, MessageHandler, CloseHandler, ErrorHandler } from './Transport';

interface StdioTransportOptions {
  input?: Readable;
  output?: Writable;
}

class FrameParser {
  private buffer: Buffer = Buffer.alloc(0);
  private expectedLength: number | null = null;
  private readonly onMessage: (envelope: Envelope) => void;

  constructor(onMessage: (envelope: Envelope) => void) {
    this.onMessage = onMessage;
  }

  push(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.process();
  }

  private process() {
    while (true) {
      if (this.expectedLength === null) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const header = this.buffer.slice(0, headerEnd).toString('utf8');
        const match = header.match(/Content-Length: (\d+)/i);
        if (!match) {
          throw new Error('Invalid frame header');
        }
        this.expectedLength = Number(match[1]);
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.expectedLength === null) continue;
      if (this.buffer.length < this.expectedLength) return;

      const messageBuffer = this.buffer.slice(0, this.expectedLength);
      this.buffer = this.buffer.slice(this.expectedLength);
      this.expectedLength = null;

      const json = messageBuffer.toString('utf8');
      const envelope = JSON.parse(json) as Envelope;
      this.onMessage(envelope);
    }
  }
}

function encodeEnvelope(envelope: Envelope): string {
  const json = JSON.stringify(envelope);
  const length = Buffer.byteLength(json, 'utf8');
  return `Content-Length: ${length}\r\n\r\n${json}`;
}

export class StdioTransport implements Transport {
  public readonly kind = 'stdio' as const;
  private readonly input: Readable;
  private readonly output: Writable;
  private started = false;
  private readonly emitter = new EventEmitter();
  private parser?: FrameParser;
  private boundData?: (chunk: Buffer) => void;
  private boundError?: (error: Error) => void;
  private boundEnd?: () => void;

  constructor(options: StdioTransportOptions = {}) {
    this.input = options.input ?? process.stdin;
    this.output = options.output ?? process.stdout;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.parser = new FrameParser((envelope) => {
      this.emitter.emit('message', envelope);
    });

    this.boundData = (chunk: Buffer) => {
      try {
        this.parser?.push(chunk);
      } catch (error) {
        this.emitter.emit('error', error);
      }
    };
    this.boundError = (error: Error) => {
      this.emitter.emit('error', error);
    };
    this.boundEnd = () => {
      this.emitter.emit('close');
    };

    this.input.on('data', this.boundData);
    this.input.on('error', this.boundError);
    this.input.on('end', this.boundEnd);
  }

  async send(envelope: Envelope): Promise<void> {
    if (!this.started) {
      throw new Error('STDIO transport not started');
    }
    const payload = encodeEnvelope(envelope);
    return new Promise((resolve, reject) => {
      this.output.write(payload, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (!this.started) return;
    this.started = false;

    if (this.boundData) this.input.off('data', this.boundData);
    if (this.boundError) this.input.off('error', this.boundError);
    if (this.boundEnd) this.input.off('end', this.boundEnd);

    this.emitter.emit('close');
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
