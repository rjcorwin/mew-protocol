import { describe, it, expect, afterEach, vi } from 'vitest';
import { startControlServer } from '../src/cli/control-server.js';

describe('control plane screen endpoint', () => {
  let server: Awaited<ReturnType<typeof startControlServer>> | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it('returns the current frame by default', async () => {
    const snapshot = {
      current: {
        raw: 'Line A\nLine B',
        plain: 'Line A\nLine B',
        lines: ['Line A', 'Line B'],
        cursor: { x: 5, y: 1 },
        dimensions: { width: 80, height: 24 }
      },
      history: {
        raw: 'Line A\nLine B',
        bufferSize: 14,
        truncated: false
      },
      lastFrame: new Date('2024-01-01T00:00:00Z'),
      framesRendered: 3
    };

    server = startControlServer({
      port: 0,
      sendInput: vi.fn(),
      getState: () => ({}),
      getScreen: () => structuredClone(snapshot)
    });

    await server.ready;

    const res = await fetch(`http://127.0.0.1:${server.port}/control/screen`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.mode).toBe('current');
    expect(body.plain).toBe('Line A\nLine B');
    expect(body.lines).toEqual(['Line A', 'Line B']);
    expect(body.cursor).toEqual({ x: 5, y: 1 });
    expect(body.width).toBe(80);
    expect(body.height).toBe(24);
    expect(body.scrollback.buffer_size).toBe(14);
    expect(body.scrollback.truncated).toBe(false);
    expect(body.frames_rendered).toBe(3);
  });

  it('sanitizes control sequences when history is requested', async () => {
    const raw = '\u001b[2K\u001b[1;32mPrompt\u001b[0m';
    const snapshot = {
      current: {
        raw,
        cursor: { x: 1, y: 0 },
        dimensions: { width: 90, height: 30 }
      },
      history: {
        raw,
        bufferSize: raw.length,
        truncated: false
      },
      lastFrame: new Date('2024-01-01T00:00:00Z'),
      framesRendered: 12
    };

    server = startControlServer({
      port: 0,
      sendInput: vi.fn(),
      getState: () => ({}),
      getScreen: () => structuredClone(snapshot)
    });

    await server.ready;

    const res = await fetch(`http://127.0.0.1:${server.port}/control/screen?history=1`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.mode).toBe('history');
    expect(body.raw).toBe(raw);
    expect(body.scrollback.raw).toBe(raw);
    expect(body.plain).toBe('Prompt');
    expect(body.lines).toEqual(['Prompt']);
    expect(body.cursor).toEqual({ x: 1, y: 0 });
    expect(body.width).toBe(90);
    expect(body.height).toBe(30);
    expect(body.frames_rendered).toBe(12);
  });
});
