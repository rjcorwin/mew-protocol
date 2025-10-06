// @ts-nocheck
import { Writable } from 'node:stream';

export class ControlPlaneStdout extends Writable {
  #target;
  #buffer = '';
  #frames = 0;
  #lastFrame = new Date(0);
  #maxBuffer;
  #cursor;

  constructor(target) {
    super();
    this.#target = target;
    this.columns = target?.columns;
    this.rows = target?.rows;
    const envValue = Number(process.env.CONTROL_PLANE_BUFFER);
    this.#maxBuffer = Number.isFinite(envValue) && envValue > 0 ? envValue : 4000;

    target?.on?.('resize', () => {
      this.columns = target?.columns;
      this.rows = target?.rows;
    });
  }

  _write(chunk, encoding, callback) {
    this.#frames += 1;
    this.#lastFrame = new Date();

    const text = typeof chunk === 'string'
      ? chunk
      : Buffer.isBuffer(chunk)
        ? chunk.toString(typeof encoding === 'string' && encoding !== 'buffer' ? encoding : 'utf8')
        : '';

    if (text) {
      this.#buffer += text;
      if (this.#buffer.length > this.#maxBuffer) {
        this.#buffer = this.#buffer.slice(-this.#maxBuffer);
      }
    }

    if (typeof this.#target?.write === 'function') {
      if (Buffer.isBuffer(chunk)) {
        this.#target.write(chunk, callback);
      } else {
        this.#target.write(chunk, encoding, callback);
      }
    } else if (callback) {
      callback();
    }
  }

  snapshot() {
    const width = this.columns ?? this.#target?.columns ?? 0;
    const height = this.rows ?? this.#target?.rows ?? 0;

    return {
      raw: this.#buffer,
      lastFrame: this.#lastFrame,
      framesRendered: this.#frames,
      bufferSize: this.#buffer.length,
      truncated: this.#buffer.length >= this.#maxBuffer,
      dimensions: {
        width,
        height
      },
      cursor: this.#cursor
    };
  }

  setCursor(cursor) {
    this.#cursor = cursor ? { x: cursor.x ?? 0, y: cursor.y ?? 0 } : undefined;
  }
}

export function createEmptyScreenSnapshot() {
  const width = typeof process.stdout?.columns === 'number' ? process.stdout.columns : 0;
  const height = typeof process.stdout?.rows === 'number' ? process.stdout.rows : 0;
  return {
    raw: '',
    lastFrame: new Date(0),
    framesRendered: 0,
    bufferSize: 0,
    truncated: false,
    dimensions: { width, height },
    cursor: { x: 0, y: 0 }
  };
}
