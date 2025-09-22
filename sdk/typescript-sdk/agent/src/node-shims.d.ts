declare namespace NodeJS {
  type Timeout = number;
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
  argv: string[];
  exit(code?: number): never;
  on(event: string, listener: (...args: unknown[]) => void): void;
};

declare const require: {
  main?: { filename?: string };
};

declare const module: {
  exports: unknown;
};

declare module 'uuid' {
  export function v4(): string;
}

type Buffer = Uint8Array & {
  toString(encoding?: string): string;
};

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

declare module 'ws' {
  import { EventEmitter } from 'events';

  export type RawData = string | Buffer | ArrayBuffer | ArrayBufferView;

  export default class WebSocket extends EventEmitter {
    static readonly CONNECTING: number;
    static readonly OPEN: number;
    static readonly CLOSING: number;
    static readonly CLOSED: number;

    readonly readyState: number;

    constructor(address: string, protocols?: string | string[]);

    send(data: RawData, cb?: (error?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(data?: RawData, mask?: boolean, cb?: (error?: Error) => void): void;

    on(event: 'open', listener: () => void): this;
    on(event: 'message', listener: (data: RawData) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export namespace WebSocket {
    export type Data = RawData;
  }
}

declare module 'openai' {
  interface ChatCompletionCreateParams {
    model: string;
    messages: Array<{ role: string; content: unknown }>;
    [key: string]: unknown;
  }

  interface ChatCompletionClient {
    create(params: ChatCompletionCreateParams): Promise<any>;
  }

  interface ChatClient {
    completions: ChatCompletionClient;
  }

  export default class OpenAI {
    constructor(config?: { apiKey?: string; baseURL?: string });
    chat: ChatClient;
  }
}

declare module 'fs' {
  const fs: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = fs;
}

declare module 'path' {
  const path: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = path;
}

declare module 'js-yaml' {
  export function load(content: string): unknown;
}
