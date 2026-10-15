import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, fsyncSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PodSnapshot, StateStore } from './types.js';

/** One process only. Durable local work record; no native runtime recovery. */
export class JsonFileStore implements StateStore {
  private lock: number;
  private closed = false;
  constructor(readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
    // A stale lock is deliberately not stolen. The operator must confirm its owner stopped.
    this.lock = openSync(`${path}.lock`, 'wx', 0o600);
    writeFileSync(this.lock, `${process.pid}\n`);
  }
  load(): PodSnapshot | undefined {
    if (!existsSync(this.path)) return undefined;
    const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || (parsed as PodSnapshot).version !== 1) throw new Error('Unsupported work-record version');
    const state = parsed as PodSnapshot;
    for (const field of ['entities', 'scopes', 'tasks', 'messages', 'runtimes', 'notices'] as const) {
      if (!Array.isArray(state[field])) throw new Error('Invalid work record');
    }
    return state;
  }
  save(state: PodSnapshot): void {
    if (this.closed) throw new Error('Store is closed');
    const temporary = `${this.path}.tmp`;
    const fd = openSync(temporary, 'w', 0o600);
    try { writeFileSync(fd, JSON.stringify(state, null, 2)); fsyncSync(fd); }
    finally { closeSync(fd); }
    renameSync(temporary, this.path);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    closeSync(this.lock);
    unlinkSync(`${this.path}.lock`);
  }
}

export class MemoryStore implements StateStore {
  private value?: PodSnapshot;
  load(): PodSnapshot | undefined { return this.value && structuredClone(this.value); }
  save(value: PodSnapshot): void { this.value = structuredClone(value); }
}
