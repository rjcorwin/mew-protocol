declare namespace NodeJS {
  type Timeout = number;
}

declare function setTimeout(
  handler: (...args: unknown[]) => void,
  timeout?: number,
  ...args: unknown[]
): NodeJS.Timeout;

declare function clearTimeout(handle?: NodeJS.Timeout): void;

declare const console: {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

declare module 'debug' {
  type Debugger = (...args: unknown[]) => void;
  function createDebugger(namespace: string): Debugger;
  export default createDebugger;
}

declare module 'events' {
  type Listener = (...args: any[]) => void; // eslint-disable-line @typescript-eslint/no-explicit-any

  class EventEmitter {
    addListener(event: string | symbol, listener: Listener): this;
    on(event: string | symbol, listener: Listener): this;
    once(event: string | symbol, listener: Listener): this;
    off(event: string | symbol, listener: Listener): this;
    removeListener(event: string | symbol, listener: Listener): this;
    emit(event: string | symbol, ...args: any[]): boolean; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  export { EventEmitter };
  export default EventEmitter;
}

declare module 'child_process' {
  import { EventEmitter } from 'events';

  export interface SpawnOptions {
    cwd?: string;
    env?: Record<string, string | undefined>;
    stdio?: Array<'pipe' | 'ignore' | 'inherit'>;
  }

  export interface ChildProcess extends EventEmitter {
    stdin?: {
      write(data: string): void;
      end(): void;
    } | null;
    stdout?: EventEmitter | null;
    stderr?: EventEmitter | null;
    killed: boolean;
    exitCode: number | null;
    kill(signal?: string): void;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'exit', listener: (code: number | null, signal: string | null) => void): this;
  }

  export function spawn(
    command: string,
    args?: string[],
    options?: SpawnOptions
  ): ChildProcess;
}

declare module 'readline' {
  import { EventEmitter } from 'events';

  export interface Interface extends EventEmitter {
    on(event: 'line', listener: (input: string) => void): this;
    close(): void;
  }

  export function createInterface(options: {
    input: EventEmitter;
    output?: EventEmitter;
    crlfDelay?: number;
  }): Interface;
}
