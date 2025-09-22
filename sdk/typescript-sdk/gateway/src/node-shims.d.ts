declare namespace NodeJS {
  type Timeout = number;
  interface MemoryUsage {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  }
}

declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): NodeJS.Timeout;

declare function clearTimeout(handle?: NodeJS.Timeout): void;

declare function setInterval(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): NodeJS.Timeout;

declare function clearInterval(handle?: NodeJS.Timeout): void;

declare const console: {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  memoryUsage(): NodeJS.MemoryUsage;
};

declare const URL: {
  new (input: string, base?: string): {
    pathname: string;
    searchParams: {
      get(name: string): string | null;
    };
  };
};

type Buffer = Uint8Array & {
  toString(encoding?: string): string;
};

declare module 'uuid' {
  export function v4(): string;
}

declare module 'events' {
  type Listener = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  class EventEmitter {
    addListener(event: string | symbol, listener: Listener): this;
    on(event: string | symbol, listener: Listener): this;
    once(event: string | symbol, listener: Listener): this;
    off(event: string | symbol, listener: Listener): this;
    removeListener(event: string | symbol, listener: Listener): this;
    removeAllListeners(event?: string | symbol): this;
    emit(event: string | symbol, ...args: any[]): boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  export { EventEmitter };
  export default EventEmitter;
}

declare module 'http' {
  import { EventEmitter } from 'events';

  export interface IncomingMessage extends EventEmitter {
    headers: Record<string, string | string[] | undefined>;
    url?: string | null;
  }

  export interface Server extends EventEmitter {
    listen(port: number, host: string, callback: () => void): void;
  }

  export function createServer(
    handler?: (...args: any[]) => void // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Server;
}

declare module 'express' {
  type Handler = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  interface ExpressApp {
    (...args: any[]): void; // eslint-disable-line @typescript-eslint/no-explicit-any
    use(...handlers: Handler[]): void;
    get(path: string, handler: Handler): void;
  }

  interface ExpressFactory {
    (): ExpressApp;
    json(): Handler;
  }

  const express: ExpressFactory;
  export default express;
}

declare module 'cors' {
  type Handler = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
  function cors(): Handler;
  export default cors;
}

declare module 'dotenv' {
  const dotenv: {
    config(): void;
  };
  export default dotenv;
}

declare module 'ws' {
  import { EventEmitter } from 'events';
  import { IncomingMessage } from 'http';

  export type RawData = string | Buffer | ArrayBuffer | ArrayBufferView;

  export default class WebSocket extends EventEmitter {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;

    readonly readyState: number;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSING: number;
    readonly CLOSED: number;

    constructor(address: string, protocols?: string | string[]);

    send(data: RawData, cb?: (error?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;

    on(event: 'open', listener: () => void): this;
    on(event: 'message', listener: (...args: any[]) => void): this; // eslint-disable-line @typescript-eslint/no-explicit-any
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export interface ServerOptions {
    port?: number;
    server?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    noServer?: boolean;
    path?: string;
    host?: string;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: ServerOptions);
    clients: Set<WebSocket>;
    handleUpgrade(
      request: IncomingMessage,
      socket: any, // eslint-disable-line @typescript-eslint/no-explicit-any
      head: Buffer,
      callback: (socket: WebSocket) => void
    ): void;
    close(callback?: (error?: Error) => void): void;
  }

  export { WebSocket };
}
