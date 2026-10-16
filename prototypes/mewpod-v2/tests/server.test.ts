import { request as httpRequest, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Script } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConsoleServer, type ConsoleApi } from '../src/server.js';
import type { PodSnapshot, WorkspaceMessage } from '../src/types.js';

const message = (text = 'Hello'): WorkspaceMessage => ({
  id: 'message-1', workspaceId: 'local', conversationId: 'project', threadId: 'main',
  authorId: 'local-human', sequence: 1, at: '2026-01-01T00:00:00.000Z', text, kind: 'message',
});

function fixture(): PodSnapshot {
  return {
    version: 1,
    capacity: { maxActive: 2, maxUnits: 4, active: 1, usedUnits: 1 },
    entities: [{
      desired: {
        id: 'builder', displayName: 'Builder', role: 'build', instructions: 'Build mock demos.', runtimeId: 'mock', model: 'deterministic',
        conversationIds: ['project'], revision: 2, requiredResources: [], resourceUnits: 1, secretRefs: [], repositories: [],
      },
      observed: { appliedRevision: 1, sessionId: 'session-1', state: 'busy' },
    }],
    scopes: [{ id: 'scope-1', generation: 1, conversationIds: ['project'], entityIds: ['builder'], startSequence: 0, status: 'active' }],
    tasks: [{
      id: 'task-1', entityId: 'builder', scopeId: 'scope-1', scopeGeneration: 1, sourceMessageId: 'message-1', conversationId: 'project', threadId: 'main',
      chainId: 'chain-1', depth: 0, status: 'running', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', progress: ['Preparing mock output.'],
    }],
    messages: [message()],
    runtimes: [{ id: 'mock', capabilities: { modalities: ['text'], instructionUpdates: 'next-turn', permissions: 'mock only', steering: 'queued-only', cancellation: 'requested-only', persistence: 'none', sessionMobility: false } }],
    notices: ['Local simulation.'],
  };
}

interface Response { status: number; headers: IncomingHttpHeaders; body: string }

describe('local work console', () => {
  let server: Server;
  let state: PodSnapshot;
  let api: ConsoleApi;
  let port: number;

  beforeEach(async () => {
    state = fixture();
    api = {
      snapshot: vi.fn(() => state),
      postMessage: vi.fn(async input => ({ ...message(input.text), conversationId: input.conversationId, threadId: input.threadId })),
      setCapacity: vi.fn(value => { state.capacity.maxActive = value; }),
      cancelTask: vi.fn(async () => 'requested'),
      endScope: vi.fn(async () => undefined),
    };
    server = createConsoleServer(api);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  function request(path: string, options: { method?: string; headers?: Record<string, string>; body?: string | Buffer; chunks?: string[] } = {}): Promise<Response> {
    return new Promise((resolve, reject) => {
      const req = httpRequest({ hostname: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: options.headers }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
        response.on('error', reject);
      });
      req.on('error', reject);
      for (const chunk of options.chunks ?? []) req.write(chunk);
      req.end(options.body);
    });
  }

  function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}`, ...headers }, body: JSON.stringify(body) });
  }

  it('serves the snapshot without cookies, caching, or CORS', async () => {
    const response = await request('/api/state');
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(state);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves a standalone dashboard with nonce CSP and no injected snapshot', async () => {
    state.messages[0].text = '</script><script>alert("injected")</script>';
    const response = await request('/');
    expect(response.status).toBe(200);
    expect(response.body).toContain('Local reference demo. Entity replies and runtime behavior are scripted');
    expect(response.body).toContain('Desired configuration and observed application');
    expect(response.body).toContain('setInterval(refresh, 1000)');
    expect(response.body).not.toContain(state.messages[0].text);
    expect(response.body).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
    expect(response.body).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    const nonce = /<script nonce="([^"]+)">/.exec(response.body)![1];
    expect(response.headers['content-security-policy']).toContain(`script-src 'nonce-${nonce}'`);
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['content-security-policy']).not.toContain('unsafe-inline');
    expect(response.headers['x-frame-options']).toBe('DENY');
    const second = await request('/');
    expect(second.headers['content-security-policy']).not.toBe(response.headers['content-security-policy']);
  });

  it('frames Catbox as an inspectable reference demo with a passive pattern guide', async () => {
    const response = await request('/');
    expect(response.body).toContain('<title>Catbox · collaboration reference demo</title>');
    expect(response.body).toContain('<h1>Catbox</h1>');
    expect(response.body).toContain('Inspect, adapt, or replace the implementation.');
    expect(response.body).toContain('<summary>Explore the collaboration patterns</summary>');
    expect(response.body).toContain('Requirement: handoffs happen through shared messages.');
    expect(response.body).toContain('Requirement: report verified outcomes and actual adapter capabilities.');
    expect(response.body).toContain('prototypes/mewpod-v2/DESIGN.md');
    expect(response.body).toContain('Try @builder prepare a change and watch the visible review handoff.');
    expect(api.postMessage).not.toHaveBeenCalled();
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it('posts only text and routing fields through the fixed local-human callback', async () => {
    const input = { text: '@builder build a demo', conversationId: 'project', threadId: 'new-thread' };
    const response = await post('/api/messages', input);
    expect(response.status).toBe(201);
    expect(api.postMessage).toHaveBeenCalledTimes(1);
    expect(api.postMessage).toHaveBeenCalledWith(input);
    expect(JSON.parse(response.body).authorId).toBe('local-human');
  });

  it.each(['authorId', 'actorId', 'identity', 'kind', 'origin', '__proto__'])('rejects caller-controlled %s', async field => {
    const input = { text: 'hello', conversationId: 'project', threadId: 'main', [field]: 'administrator' };
    expect((await post('/api/messages', input)).status).toBe(400);
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it.each([
    {}, { text: '', conversationId: 'project', threadId: 'main' },
    { text: '   ', conversationId: 'project', threadId: 'main' },
    { text: 'a'.repeat(8001), conversationId: 'project', threadId: 'main' },
    { text: 'hello', conversationId: '../project', threadId: 'main' },
    { text: 'hello', conversationId: 'project', threadId: 'a/b' },
    { text: 'hello', conversationId: 'project', threadId: '<img>' },
    { text: 'hello', conversationId: 'project', threadId: 'x'.repeat(129) },
    { text: 123, conversationId: 'project', threadId: 'main' },
    { text: 'hello', conversationId: null, threadId: 'main' },
  ])('rejects invalid message schema %#', async body => {
    expect((await post('/api/messages', body)).status).toBe(400);
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it.each(['[]', 'null', '"text"', 'true', '{broken', ''])('rejects a non-object or malformed body %s', async body => {
    const response = await request('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    expect(response.status).toBe(400);
    expect(api.postMessage).not.toHaveBeenCalled();
  });

  it('rejects invalid UTF-8 instead of replacing it', async () => {
    const response = await request('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]) });
    expect(response.status).toBe(400);
  });

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/jsonp', ''])('rejects non-JSON mutation content type %s', async type => {
    const response = await request('/api/capacity', { method: 'POST', headers: { 'Content-Type': type }, body: '{"maxActive":0}' });
    expect(response.status).toBe(415);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it('accepts JSON UTF-8 and pauses new work at capacity zero', async () => {
    expect((await post('/api/capacity', { maxActive: 0 }, { 'Content-Type': 'application/json; charset=utf-8' })).status).toBe(200);
    expect(api.setCapacity).toHaveBeenCalledTimes(1);
    expect(api.setCapacity).toHaveBeenCalledWith(0);
    expect(state.capacity.maxActive).toBe(0);
  });

  it.each([-1, 5, 33, 0.5, '2', null])('rejects invalid capacity %s', async maxActive => {
    expect((await post('/api/capacity', { maxActive })).status).toBe(400);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it('rejects unexpected capacity fields', async () => {
    expect((await post('/api/capacity', { maxActive: 2, maxUnits: 1000 })).status).toBe(400);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it.each([[8, 8, 200], [8, 9, 400], [0, 0, 200], [0, 1, 400], [64, 32, 200], [64, 33, 400]])('honors authorized ceiling %i for requested capacity %i', async (authorized, requested, status) => {
    state.capacity.authorizedMaxActive = authorized;
    expect((await post('/api/capacity', { maxActive: requested })).status).toBe(status);
    if (status === 200) expect(api.setCapacity).toHaveBeenCalledWith(requested);
    else expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it.each(['https://example.invalid', 'null', 'http://localhost', 'http://127.0.0.1:1'])('rejects foreign Origin %s', async origin => {
    expect((await post('/api/capacity', { maxActive: 0 }, { Origin: origin })).status).toBe(403);
    expect((await request('/api/state', { headers: { Origin: origin } })).status).toBe(403);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it.each(['example.invalid', 'localhost', '127.0.0.1', '127.0.0.1:1', '127.0.0.1.example.invalid'])('rejects invalid Host %s', async host => {
    expect((await request('/api/state', { headers: { Host: host } })).status).toBe(403);
  });

  it.each(['cross-site', 'same-site'])('rejects %s fetch metadata even without Origin', async site => {
    const response = await request('/api/capacity', { method: 'POST', headers: { 'Sec-Fetch-Site': site, 'Content-Type': 'application/json' }, body: '{"maxActive":0}' });
    expect(response.status).toBe(403);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it('rejects foreign or malformed referrers and accepts same-origin metadata', async () => {
    expect((await request('/api/state', { headers: { Referer: 'https://example.invalid/' } })).status).toBe(403);
    expect((await request('/api/state', { headers: { Referer: 'invalid' } })).status).toBe(403);
    expect((await post('/api/capacity', { maxActive: 1 }, { Referer: `http://127.0.0.1:${port}/`, 'Sec-Fetch-Site': 'same-origin' })).status).toBe(200);
  });

  it('rejects oversized bodies with declared length', async () => {
    const body = JSON.stringify({ maxActive: 0, padding: 'x'.repeat(17_000) });
    const response = await request('/api/capacity', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) }, body });
    expect(response.status).toBe(413);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it('rejects oversized streamed bodies without buffering them indefinitely', async () => {
    const response = await request('/api/capacity', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' }, chunks: ['{"padding":"', 'x'.repeat(10_000), 'x'.repeat(10_000), '"}'] });
    expect(response.status).toBe(413);
    expect(api.setCapacity).not.toHaveBeenCalled();
  });

  it('rejects encoded bodies', async () => {
    expect((await post('/api/capacity', { maxActive: 0 }, { 'Content-Encoding': 'gzip' })).status).toBe(415);
  });

  it('dispatches cancellation without claiming the runtime has stopped', async () => {
    const response = await post('/api/tasks/task-1/cancel', {});
    expect(response.status).toBe(202);
    expect(JSON.parse(response.body)).toEqual({ accepted: true });
    expect(api.cancelTask).toHaveBeenCalledTimes(1);
    expect(api.cancelTask).toHaveBeenCalledWith('task-1');
    expect(state.tasks[0].status).toBe('running');
  });

  it('ends an existing work scope through the supplied callback', async () => {
    expect((await post('/api/scopes/scope-1/end', {})).status).toBe(202);
    expect(api.endScope).toHaveBeenCalledTimes(1);
    expect(api.endScope).toHaveBeenCalledWith('scope-1');
  });

  it('rejects unknown and wrong-type task/scope targets', async () => {
    expect((await post('/api/tasks/missing/cancel', {})).status).toBe(404);
    expect((await post('/api/tasks/scope-1/cancel', {})).status).toBe(404);
    expect((await post('/api/scopes/task-1/end', {})).status).toBe(404);
    expect(api.cancelTask).not.toHaveBeenCalled();
    expect(api.endScope).not.toHaveBeenCalled();
  });

  it('rejects unknown fields on cancellation and scope end', async () => {
    expect((await post('/api/tasks/task-1/cancel', { force: true })).status).toBe(400);
    expect((await post('/api/scopes/scope-1/end', { purge: true })).status).toBe(400);
    expect(api.cancelTask).not.toHaveBeenCalled();
    expect(api.endScope).not.toHaveBeenCalled();
  });

  it.each(['/../package.json', '/api/state?anything=1', '/api/tasks/../cancel', '/api/tasks/task-1%2Fother/cancel', '/api/tasks/%2e%2e/cancel', 'http://example.invalid/api/state'])('does not normalize arbitrary paths into endpoints: %s', async path => {
    expect((await request(path)).status).toBe(404);
  });

  it('rejects mutation via GET and does not enable preflight requests', async () => {
    expect((await request('/api/tasks/task-1/cancel')).status).toBe(404);
    const response = await request('/api/capacity', { method: 'OPTIONS' });
    expect(response.status).toBe(405);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(api.cancelTask).not.toHaveBeenCalled();
  });

  it('returns generic errors without leaking callback secrets', async () => {
    vi.mocked(api.cancelTask).mockRejectedValue(new Error('private-secret-value'));
    const response = await post('/api/tasks/task-1/cancel', {});
    expect(response.status).toBe(500);
    expect(response.body).not.toContain('private-secret-value');
  });

  it('renders untrusted message, entity, progress and notice data only as DOM text', async () => {
    const payload = '</script><img src=x onerror=alert(1)>';
    state.messages[0].text = payload;
    state.messages[0].authorId = payload;
    state.tasks[0].progress = [payload];
    state.tasks[0].completionMessageId = 'javascript:alert(1)';
    state.entities[0].desired.displayName = payload;
    state.notices = [payload];
    const response = await request('/');
    const source = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(response.body)![1];
    const page = fakePage();
    const fetch = vi.fn(async () => ({ ok: true, json: async () => state }));
    const setInterval = vi.fn();
    new Script(source).runInNewContext({ document: page.document, fetch, setInterval, Map, Set, JSON, String, Number, encodeURIComponent });
    await vi.waitFor(() => expect(page.get('connection').textContent).toBe('Local · connected'));
    const all = page.all();
    expect(all.filter(node => node.textContent === payload)).toHaveLength(5);
    expect(all.some(node => node.tag === 'img' || node.tag === 'script')).toBe(false);
    expect(all.find(node => node.tag === 'a')?.href).toBe('#message-javascript%3Aalert(1)');
    expect(all.some(node => node.textContent.includes('Desired revision 2 / applied 1'))).toBe(true);
    expect(all.some(node => node.textContent.includes('Cancellation: requested-only'))).toBe(true);
    expect(page.get('capacity').max).toBe('4');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/state', { cache: 'no-store', credentials: 'omit' });
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('prevents duplicate sends and preserves a newer draft while an earlier send finishes', async () => {
    const response = await request('/');
    const source = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(response.body)![1];
    const page = fakePage();
    let finish: (() => void) | undefined;
    const fetch = vi.fn(async (path: string) => {
      if (path === '/api/messages') await new Promise<void>(resolve => { finish = resolve; });
      return { ok: true, json: async () => state };
    });
    new Script(source).runInNewContext({ document: page.document, fetch, setInterval: vi.fn(), Map, Set, JSON, String, Number, encodeURIComponent });
    await vi.waitFor(() => expect(page.get('connection').textContent).toBe('Local · connected'));
    page.get('text').value = 'Original request';
    page.get('conversation').value = 'project';
    page.get('thread').value = 'main';
    const submit = page.get('composer').listeners.get('submit')!;
    const first = submit({ preventDefault: vi.fn() });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(page.get('send').disabled).toBe(true);
    await submit({ preventDefault: vi.fn() });
    expect(fetch.mock.calls.filter(call => call[0] === '/api/messages')).toHaveLength(1);
    page.get('text').value = 'Newer draft';
    finish!();
    await first;
    expect(page.get('text').value).toBe('Newer draft');
    expect(page.get('send').disabled).toBe(false);
    expect(fetch).toHaveBeenCalledWith('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Original request', conversationId: 'project', threadId: 'main' }),
      cache: 'no-store', credentials: 'omit',
    });
  });

  it('keeps failed message drafts and allows a successful retry', async () => {
    const response = await request('/');
    const source = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(response.body)![1];
    const page = fakePage();
    let fails = true;
    const fetch = vi.fn(async (path: string) => ({ ok: path !== '/api/messages' || !fails, json: async () => path === '/api/messages' && fails ? { error: 'Local operation failed.' } : state }));
    new Script(source).runInNewContext({ document: page.document, fetch, setInterval: vi.fn(), Map, Set, JSON, String, Number, encodeURIComponent });
    await vi.waitFor(() => expect(page.get('connection').textContent).toBe('Local · connected'));
    page.get('text').value = 'Keep this draft';
    const submit = page.get('composer').listeners.get('submit')!;
    await submit({ preventDefault: vi.fn() });
    expect(page.get('text').value).toBe('Keep this draft');
    expect(page.get('notice').textContent).toBe('Local operation failed.');
    expect(page.get('send').disabled).toBe(false);
    fails = false;
    await submit({ preventDefault: vi.fn() });
    expect(page.get('text').value).toBe('');
    expect(page.get('notice').textContent).toBe('');
  });

  it('connects pause, cancellation and scope controls to their same-origin endpoints', async () => {
    const response = await request('/');
    const source = /<script nonce="[^"]+">([\s\S]*?)<\/script>/.exec(response.body)![1];
    const page = fakePage();
    const fetch = vi.fn(async () => ({ ok: true, json: async () => state }));
    new Script(source).runInNewContext({ document: page.document, fetch, setInterval: vi.fn(), Map, Set, JSON, String, Number, encodeURIComponent });
    await vi.waitFor(() => expect(page.get('connection').textContent).toBe('Local · connected'));
    await page.get('pause').listeners.get('click')!();
    await page.all().find(node => node.textContent === 'Request cancellation')!.listeners.get('click')!();
    await page.all().find(node => node.textContent === 'End scope')!.listeners.get('click')!();
    expect(fetch).toHaveBeenCalledWith('/api/capacity', expect.objectContaining({ method: 'POST', body: '{"maxActive":0}' }));
    expect(fetch).toHaveBeenCalledWith('/api/tasks/task-1/cancel', expect.objectContaining({ method: 'POST', body: '{}' }));
    expect(fetch).toHaveBeenCalledWith('/api/scopes/scope-1/end', expect.objectContaining({ method: 'POST', body: '{}' }));
  });
});

/** Tiny DOM boundary, deliberately without an HTML parser or a writable HTML sink. */
function fakePage() {
  class Node {
    textContent = '';
    className = '';
    id = '';
    href = '';
    value = '';
    max = '';
    type = '';
    disabled = false;
    scrollTop = 0;
    scrollHeight = 0;
    clientHeight = 0;
    children: Node[] = [];
    listeners = new Map<string, (...args: unknown[]) => unknown>();
    constructor(readonly tag: string) {}
    append(...nodes: Node[]): void { this.children.push(...nodes); }
    replaceChildren(...nodes: Node[]): void { this.children = nodes; }
    addEventListener(name: string, listener: (...args: unknown[]) => unknown): void { this.listeners.set(name, listener); }
    focus(): void { /* Browser focus is irrelevant to the text-only rendering boundary. */ }
    set innerHTML(_value: string) { throw new Error('Unsafe HTML sink was used'); }
    set outerHTML(_value: string) { throw new Error('Unsafe HTML sink was used'); }
  }
  const roots = new Map<string, Node>();
  const get = (id: string): Node => {
    if (!roots.has(id)) roots.set(id, new Node('div'));
    return roots.get(id)!;
  };
  const descendants = (node: Node): Node[] => [node, ...node.children.flatMap(descendants)];
  return {
    get,
    document: { getElementById: get, createElement: (tag: string) => new Node(tag) },
    all: (): Node[] => [...roots.values()].flatMap(descendants),
  };
}
