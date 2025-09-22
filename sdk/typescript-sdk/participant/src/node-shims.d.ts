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
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare const process: {
  env: Record<string, string | undefined>;
};

type Buffer = Uint8Array & {
  toString(encoding?: string): string;
};

declare module 'uuid' {
  export function v4(): string;
}
