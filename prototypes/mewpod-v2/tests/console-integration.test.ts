import { describe, it, expect } from 'vitest';
import { createDemo } from '../src/demo.js';
import { createConsoleServer } from '../src/server.js';
import { MemoryStore } from '../src/store.js';
import type { AddressInfo } from 'node:net';
import type { PodSnapshot } from '../src/types.js';

describe('HTTP console to visible work record', () => {
  it('accepts a human message, exposes background progress, and verifies a peer result in the same thread', async () => {
    const store = new MemoryStore(); const pod = createDemo({ store, delayMs: 50 });
    const server = createConsoleServer({ snapshot: () => pod.snapshot(), postMessage: input => pod.postMessage(input), setCapacity: value => pod.setCapacity(value), cancelTask: id => pod.cancelTask(id), endScope: id => pod.endScope(id) });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const result = await fetch(`${base}/api/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ conversationId: 'project', threadId: 'http-ticket', text: '@builder make a change' }) });
      expect(result.status).toBe(201);
      const running = await (await fetch(`${base}/api/state`)).json() as PodSnapshot;
      expect(running.tasks.some(task => ['running', 'queued'].includes(task.status))).toBe(true);
      const human = running.messages.find(message => message.text === '@builder make a change')!; expect(human.authorId).toBe('human');
      await pod.idle();
      const done = await (await fetch(`${base}/api/state`)).json() as PodSnapshot;
      expect(done.tasks.map(task => task.entityId)).toEqual(['builder', 'reviewer']);
      for (const task of done.tasks) {
        expect(task.status).toBe('completed'); const message = done.messages.find(message => message.id === task.completionMessageId)!;
        expect(message.authorId).toBe(task.entityId); expect(message.threadId).toBe('http-ticket'); expect(pod.workspace.verify(message)).toBe(true);
      }
      const handoff = done.messages.find(message => message.authorId === 'builder' && message.text.includes('@reviewer'))!;
      expect(done.tasks[1].sourceMessageId).toBe(handoff.id); expect(store.load()!.tasks).toEqual(done.tasks);
    } finally {
      pod.dispose(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
