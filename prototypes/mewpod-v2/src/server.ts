import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { PodSnapshot, WorkspaceMessage } from './types.js';

/** The caller binds postMessage to the configured local human. HTTP never chooses an actor. */
export interface ConsoleApi {
  snapshot(): PodSnapshot;
  postMessage(input: { text: string; conversationId: string; threadId: string }): Promise<WorkspaceMessage>;
  setCapacity(maxActive: number): void;
  cancelTask(id: string): Promise<unknown>;
  endScope(id: string): Promise<void> | void;
}

const MAX_BODY_BYTES = 16_384;
const MAX_CAPACITY = 32;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function json(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(body);
}

function checkLocalRequest(request: IncomingMessage): void {
  const origin = `http://127.0.0.1:${request.socket.localPort}`;
  // Deliberately accept only the literal address printed by the CLI. This also
  // prevents DNS rebinding through attacker-controlled hostnames.
  if (request.headers.host !== origin.slice('http://'.length)) {
    throw new HttpError(403, 'Use this console through its 127.0.0.1 URL.');
  }
  if (request.socket.remoteAddress !== '127.0.0.1' && request.socket.remoteAddress !== '::ffff:127.0.0.1') {
    throw new HttpError(403, 'Only local requests are allowed.');
  }
  if (request.headers.origin !== undefined && request.headers.origin !== origin) {
    throw new HttpError(403, 'Cross-origin requests are not allowed.');
  }
  const site = request.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') {
    throw new HttpError(403, 'Cross-origin requests are not allowed.');
  }
  if (request.headers.referer !== undefined) {
    try {
      if (new URL(request.headers.referer).origin !== origin) throw new Error('origin mismatch');
    } catch {
      throw new HttpError(403, 'Cross-origin requests are not allowed.');
    }
  }
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) {
    throw new HttpError(415, 'Mutations require application/json.');
  }
  if (request.headers['content-encoding'] !== undefined) {
    throw new HttpError(415, 'Encoded request bodies are not supported.');
  }
  const declaredLength = request.headers['content-length'];
  if (declaredLength !== undefined && Number(declaredLength) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large.');
  }
  return new Promise((resolve, reject) => {
    let length = 0;
    const chunks: Buffer[] = [];
    const cleanup = (): void => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAbort);
    };
    const fail = (error: Error): void => {
      cleanup();
      request.resume();
      reject(error);
    };
    const onError = (): void => fail(new HttpError(400, 'Could not read request body.'));
    const onAbort = (): void => fail(new HttpError(400, 'Request body was interrupted.'));
    const onData = (chunk: Buffer): void => {
      length += chunk.length;
      if (length > MAX_BODY_BYTES) fail(new HttpError(413, 'Request body is too large.'));
      else chunks.push(chunk);
    };
    const onEnd = (): void => {
      cleanup();
      try {
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        const value: unknown = JSON.parse(decoded);
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Expected object');
        }
        resolve(value as Record<string, unknown>);
      } catch {
        reject(new HttpError(400, 'Request body must be a JSON object.'));
      }
    };
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('error', onError);
    request.once('aborted', onAbort);
  });
}

function fields(body: Record<string, unknown>, expected: string[]): void {
  const keys = Object.keys(body);
  if (keys.length !== expected.length || keys.some(key => !expected.includes(key))) {
    throw new HttpError(400, `Expected only these fields: ${expected.join(', ') || '(none)'}.`);
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && identifier.test(value);
}

/** Local mock console. The CLI must listen on 127.0.0.1, never a public interface. */
export function createConsoleServer(api: ConsoleApi): Server {
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    void handle(request, response, api).catch((error: unknown) => {
      request.resume();
      // Close rejected connections instead of retaining an unread attacker body.
      if (!response.headersSent) {
        response.setHeader('Connection', 'close');
        json(response, error instanceof HttpError ? error.status : 500, {
          error: error instanceof HttpError ? error.message : 'The local operation failed. Check the prototype process.',
        });
      } else response.end();
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  return server;
}

async function handle(request: IncomingMessage, response: ServerResponse, api: ConsoleApi): Promise<void> {
  checkLocalRequest(request);
  const path = request.url ?? '';
  if (request.method === 'GET' && path === '/') {
    const nonce = randomBytes(18).toString('base64');
    response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(dashboard(nonce));
    return;
  }
  if (request.method === 'GET' && path === '/api/state') {
    json(response, 200, api.snapshot());
    return;
  }
  if (request.method !== 'POST') {
    if (request.method !== 'GET') response.setHeader('Allow', 'GET, POST');
    throw new HttpError(request.method === 'GET' ? 404 : 405, 'No such console endpoint or method.');
  }
  const cancel = /^\/api\/tasks\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/cancel$/.exec(path);
  const end = /^\/api\/scopes\/([A-Za-z0-9][A-Za-z0-9._:-]{0,127})\/end$/.exec(path);
  if (path !== '/api/messages' && path !== '/api/capacity' && !cancel && !end) {
    throw new HttpError(404, 'No such console endpoint.');
  }
  const body = await readJson(request);
  if (path === '/api/messages') {
    fields(body, ['text', 'conversationId', 'threadId']);
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 8_000 ||
        !validId(body.conversationId) || !validId(body.threadId)) {
      throw new HttpError(400, 'Supply message text (1–8000 characters) and valid conversation/thread IDs.');
    }
    const message = await api.postMessage({ text: body.text, conversationId: body.conversationId, threadId: body.threadId });
    json(response, 201, message);
  } else if (path === '/api/capacity') {
    fields(body, ['maxActive']);
    const authorized = api.snapshot().capacity.authorizedMaxActive ?? 4;
    const limit = Number.isInteger(authorized) && authorized >= 0 ? Math.min(MAX_CAPACITY, authorized) : 0;
    if (typeof body.maxActive !== 'number' || !Number.isInteger(body.maxActive) || body.maxActive < 0 || body.maxActive > limit) {
      throw new HttpError(400, `maxActive must be an integer from 0 to ${limit}.`);
    }
    api.setCapacity(body.maxActive);
    json(response, 200, { ok: true });
  } else if (cancel) {
    fields(body, []);
    if (!api.snapshot().tasks.some(task => task.id === cancel[1])) throw new HttpError(404, 'Unknown task.');
    await api.cancelTask(cancel[1]);
    // Acknowledges only dispatch, not confirmed runtime cancellation.
    json(response, 202, { accepted: true });
  } else if (end) {
    fields(body, []);
    if (!api.snapshot().scopes.some(scope => scope.id === end[1])) throw new HttpError(404, 'Unknown scope.');
    await api.endScope(end[1]);
    json(response, 202, { accepted: true });
  }
}

function dashboard(nonce: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mewpod · local work console</title>
<style nonce="${nonce}">
:root{color-scheme:dark;font:15px/1.5 system-ui,sans-serif;background:#101410;color:#e4ece3;--muted:#a6b4a5;--line:#334032;--accent:#b8e99a}*{box-sizing:border-box}body{margin:0}main{max-width:1440px;margin:auto;padding:28px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:20px}h1,h2,h3,p{margin:0}h1{font-size:28px;letter-spacing:-1px}h2{font-size:17px}h3{font-size:14px}small,.muted{color:var(--muted)}.eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--accent)}.status{display:inline-block;border:1px solid var(--line);border-radius:20px;padding:2px 9px;font-size:12px;color:var(--accent)}.warning{background:#2a251a;border:1px solid #615238;border-radius:12px;padding:12px 16px;margin-bottom:18px;color:#f0d8ad}.capacity{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#1b231a;border:1px solid var(--line);padding:16px;border-radius:12px;margin-bottom:18px}.capacity p{flex:1;min-width:220px}.capacity-controls{display:flex;gap:12px;align-items:center}input[type=range]{accent-color:var(--accent);width:150px}.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:18px}.panel{border:1px solid var(--line);border-radius:14px;background:#161c16;min-width:0;overflow:hidden}.panel-head{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}.feed{padding:16px 18px;height:430px;overflow:auto;scroll-behavior:smooth}.message{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #283227;scroll-margin-top:14px}.message:target{outline:2px solid var(--accent);outline-offset:5px}.message:last-child{border:0}.message-head{font-size:12px;color:var(--muted);margin-bottom:6px;display:flex;gap:8px;flex-wrap:wrap}.message-author{color:var(--accent);font-weight:650}.message p,.card p{white-space:pre-wrap;overflow-wrap:anywhere}.message.status-message p{color:#b9c5b7;font-size:13px}form{padding:16px 18px;border-top:1px solid var(--line)}.fields{display:flex;gap:12px;margin-bottom:12px}.fields label{flex:1;min-width:0}label{display:block;font-size:12px;color:var(--muted)}input,select,textarea{font:inherit;border:1px solid #465342;border-radius:7px;background:#11170f;color:#e4ece3;padding:8px;width:100%}textarea{resize:vertical;min-height:84px;max-height:260px;display:block;margin-top:5px}button{font:inherit;font-size:13px;cursor:pointer;border:1px solid #5a7050;border-radius:7px;background:#21311c;color:var(--accent);padding:7px 12px}button.primary{background:var(--accent);border-color:var(--accent);color:#1b2b14;font-weight:650}button:disabled{opacity:.5;cursor:wait}button:hover:not(:disabled){filter:brightness(1.2)}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #deefc7;outline-offset:3px}.compose-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}.cards{padding:16px;display:grid;gap:12px}.task-feed{height:637px;overflow:auto;align-content:start}.card{border:1px solid var(--line);background:#1c241a;border-radius:9px;padding:13px;min-width:0}.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:7px}.card small{display:block;overflow-wrap:anywhere}.card p{margin:7px 0;font-size:13px}.card .actions{margin-top:9px;display:flex;gap:12px;align-items:center}.card ul{margin:8px 0;padding-left:18px;color:#c1cebc;font-size:13px}.card li{overflow-wrap:anywhere}.bottom{margin-top:18px}.entity-grid{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}.runtime{padding:10px 0;border-top:1px solid var(--line);margin-top:10px;font-size:12px;color:var(--muted);white-space:pre-wrap;overflow-wrap:anywhere}.blocker{color:#f0c18a!important}a{color:var(--accent)}#notice{color:#f0c18a;min-height:22px;margin:8px 0}#notices{margin:16px 0 0;font-size:13px;color:var(--muted)}.empty{font-size:14px;color:var(--muted);padding:12px 0}footer{color:var(--muted);font-size:12px;margin-top:18px}.metrics{font-variant-numeric:tabular-nums}.scope-list{display:grid;gap:12px;padding:16px}@media(max-width:900px){main{padding:18px}.grid{grid-template-columns:1fr}.feed{height:360px}.task-feed{height:auto;max-height:540px}.fields{flex-wrap:wrap}.capacity-controls{flex-wrap:wrap}header{align-items:flex-start}}
</style></head><body><main>
<header><div><div class="eyebrow">Multi-entity workspace / v2</div><h1>Mewpod work console</h1><p class="muted">One shared conversation. Independent entities. Visible work.</p></div><span id="connection" class="status" aria-live="polite">Connecting</span></header>
<div class="warning">Local mock prototype, no live Slack/model/real repo access. All replies and runtime behavior are simulated.</div>
<section class="capacity" aria-label="Worker capacity"><p><strong>Worker capacity</strong><br><small id="capacity-status" class="metrics">Waiting for local state</small></p><div class="capacity-controls"><label for="capacity">Maximum active: <output id="capacity-value">0</output></label><input id="capacity" type="range" min="0" max="4" value="0"><button id="pause" type="button">Pause new work</button></div><small>Zero pauses new starts. Active work follows its runtime's cancellation policy.</small></section>
<p id="notice" role="status" aria-live="polite"></p>
<div class="grid"><section class="panel"><div class="panel-head"><h2>Shared conversation</h2><small id="message-count">0 messages</small></div><div id="messages" class="feed" aria-label="Conversation messages"></div>
<form id="composer"><div class="fields"><label>Conversation<select id="conversation" required></select></label><label>Thread<input id="thread" value="main" maxlength="128" pattern="[A-Za-z0-9][A-Za-z0-9._:\\-]{0,127}" required></label></div><label>Message<textarea id="text" placeholder="Try @builder build a small demo, then ask @reviewer to review it." maxlength="8000" required></textarea></label><div class="compose-foot"><small>Posting as the fixed local human</small><button class="primary" id="send" type="submit">Send message</button></div></form></section>
<section class="panel"><div class="panel-head"><h2>Background work</h2><small id="task-count">0 tasks</small></div><div id="tasks" class="cards task-feed"></div></section></div>
<section class="panel bottom"><div class="panel-head"><h2>Entities &amp; runtime state</h2><small>Desired configuration and observed application</small></div><div id="entities" class="cards entity-grid"></div></section>
<section class="panel bottom"><div class="panel-head"><h2>Work scopes</h2><small>Ending a scope closes routing; it does not prove a runtime stopped</small></div><div id="scopes" class="scope-list"></div></section>
<div id="notices"></div><footer>Loopback-only console · State refreshes every second · No credentials or external assets</footer>
</main><script nonce="${nonce}">
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = String(text); return node; };
  const empty = (target, text) => target.append(element('p', 'empty', text));
  const signatures = new Map();
  let loading = false;
  let pending = false;
  let sliderEditing = false;
  const changed = (key, value) => { const next = JSON.stringify(value); if (signatures.get(key) === next) return false; signatures.set(key, next); return true; };
  async function request(path, body) {
    const options = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const response = await fetch(path, { ...options, cache: 'no-store', credentials: 'omit' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The local request failed.');
    return result;
  }
  async function act(button, path, body) {
    if (pending) return false;
    pending = true; button.disabled = true; byId('notice').textContent = '';
    try { await request(path, body); await refresh(); return true; }
    catch (error) { byId('notice').textContent = error.message; return false; }
    finally { pending = false; button.disabled = false; }
  }
  function action(text, path) {
    const button = element('button', '', text); button.type = 'button';
    button.addEventListener('click', () => act(button, path, {})); return button;
  }
  function renderMessages(messages) {
    const target = byId('messages');
    const atEnd = target.scrollHeight - target.scrollTop - target.clientHeight < 90;
    target.replaceChildren();
    byId('message-count').textContent = messages.length + ' messages';
    if (!messages.length) empty(target, 'Start a shared conversation to give the mock entities work.');
    for (const message of messages) {
      const card = element('article', 'message' + (message.kind === 'status' ? ' status-message' : ''));
      card.id = 'message-' + message.id;
      const header = element('div', 'message-head');
      header.append(element('span', 'message-author', message.authorId), element('span', '', message.conversationId + ' / ' + message.threadId), element('span', '', '#' + message.sequence + ' · ' + message.kind));
      card.append(header, element('p', '', message.text)); target.append(card);
    }
    if (atEnd) target.scrollTop = target.scrollHeight;
  }
  function renderTasks(tasks) {
    const target = byId('tasks'); target.replaceChildren();
    byId('task-count').textContent = tasks.length + ' tasks';
    if (!tasks.length) empty(target, 'Tasks appear when an eligible entity engages.');
    for (const task of [...tasks].reverse()) {
      const card = element('article', 'card');
      const header = element('div', 'card-head'); header.append(element('h3', '', task.entityId), element('span', 'status', task.status));
      card.append(header, element('small', '', task.id + ' · ' + task.conversationId + ' / ' + task.threadId), element('small', '', 'Scope ' + task.scopeId + ' · generation ' + task.scopeGeneration));
      if (task.progress.length) { const list = element('ul'); for (const progress of task.progress) list.append(element('li', '', progress)); card.append(list); }
      if (task.blocker) card.append(element('p', 'blocker', task.blocker));
      const actions = element('div', 'actions');
      if (task.completionMessageId) { const link = element('a', '', 'View result in conversation'); link.href = '#message-' + encodeURIComponent(task.completionMessageId); actions.append(link); }
      if (['queued', 'running', 'blocked'].includes(task.status)) actions.append(action('Request cancellation', '/api/tasks/' + encodeURIComponent(task.id) + '/cancel'));
      card.append(actions); target.append(card);
    }
  }
  function renderEntities(entities, runtimes) {
    const target = byId('entities'); target.replaceChildren();
    if (!entities.length) empty(target, 'No entities configured.');
    for (const entity of entities) {
      const desired = entity.desired, observed = entity.observed;
      const card = element('article', 'card'), header = element('div', 'card-head');
      header.append(element('h3', '', desired.displayName), element('span', 'status', observed.state));
      card.append(header, element('small', '', desired.id + ' · ' + desired.role), element('p', '', 'Desired revision ' + desired.revision + ' / applied ' + (observed.appliedRevision === null ? 'none' : observed.appliedRevision)), element('small', '', 'Runtime: ' + desired.runtimeId + ' · model: ' + desired.model), element('small', '', 'Session: ' + (observed.sessionId || 'none')), element('small', '', 'Conversations: ' + desired.conversationIds.join(', ')));
      if (observed.blocker) card.append(element('p', 'blocker', observed.blocker));
      const runtime = runtimes.find(item => item.id === desired.runtimeId);
      if (runtime) {
        const c = runtime.capabilities;
        card.append(element('div', 'runtime', 'Instructions: ' + c.instructionUpdates + ' · steering: ' + c.steering + '\\nCancellation: ' + c.cancellation + ' · persistence: ' + c.persistence + '\\nPermissions: ' + c.permissions + '\\nModalities: ' + c.modalities.join(', ') + ' · live session mobility: ' + String(c.sessionMobility)));
      } else card.append(element('p', 'blocker', 'Runtime capabilities unavailable.'));
      target.append(card);
    }
  }
  function renderScopes(scopes) {
    const target = byId('scopes'); target.replaceChildren();
    if (!scopes.length) empty(target, 'No work scopes.');
    for (const scope of scopes) {
      const card = element('article', 'card'), header = element('div', 'card-head');
      header.append(element('h3', '', scope.id), element('span', 'status', scope.status));
      card.append(header, element('small', '', 'Generation ' + scope.generation + ' · input after sequence ' + scope.startSequence), element('small', '', 'Conversations: ' + scope.conversationIds.join(', ')), element('small', '', 'Entities: ' + scope.entityIds.join(', ')));
      if (scope.status === 'active') { const actions = element('div', 'actions'); actions.append(action('End scope', '/api/scopes/' + encodeURIComponent(scope.id) + '/end')); card.append(actions); }
      target.append(card);
    }
  }
  function render(state) {
    const c = state.capacity;
    const authorized = c.authorizedMaxActive === undefined ? 4 : c.authorizedMaxActive;
    byId('capacity').max = String(Number.isInteger(authorized) && authorized >= 0 ? Math.min(32, authorized) : 0);
    byId('capacity-status').textContent = c.active + ' active / ' + c.maxActive + ' allowed · ' + c.usedUnits + ' / ' + c.maxUnits + ' resource units' + (c.maxActive === 0 ? ' · new work paused' : '');
    if (!sliderEditing) { byId('capacity').value = String(c.maxActive); byId('capacity-value').textContent = String(c.maxActive); }
    const conversations = [...new Set(state.scopes.flatMap(scope => scope.conversationIds).concat(state.entities.flatMap(entity => entity.desired.conversationIds)))];
    if (changed('conversations', conversations)) {
      const select = byId('conversation'), previous = select.value; select.replaceChildren();
      for (const id of conversations) { const option = element('option', '', id); option.value = id; select.append(option); }
      if (conversations.includes(previous)) select.value = previous;
    }
    if (changed('messages', state.messages)) renderMessages(state.messages);
    if (changed('tasks', state.tasks)) renderTasks(state.tasks);
    if (changed('entities', [state.entities, state.runtimes])) renderEntities(state.entities, state.runtimes);
    if (changed('scopes', state.scopes)) renderScopes(state.scopes);
    if (changed('notices', state.notices)) { const notices = byId('notices'); notices.replaceChildren(); for (const notice of state.notices) notices.append(element('p', '', notice)); }
  }
  async function refresh() {
    if (loading) return;
    loading = true;
    try { render(await request('/api/state')); byId('connection').textContent = 'Local · connected'; }
    catch (error) { byId('connection').textContent = 'Disconnected'; byId('notice').textContent = error.message; }
    finally { loading = false; }
  }
  byId('composer').addEventListener('submit', async event => {
    event.preventDefault(); const input = byId('text'), original = input.value;
    if (await act(byId('send'), '/api/messages', { text: original, conversationId: byId('conversation').value, threadId: byId('thread').value })) {
      if (input.value === original) input.value = ''; input.focus();
    }
  });
  byId('capacity').addEventListener('input', event => { sliderEditing = true; byId('capacity-value').textContent = event.target.value; });
  byId('capacity').addEventListener('change', async event => { await act(event.target, '/api/capacity', { maxActive: Number(event.target.value) }); sliderEditing = false; await refresh(); });
  byId('pause').addEventListener('click', () => act(byId('pause'), '/api/capacity', { maxActive: 0 }));
  void refresh(); setInterval(refresh, 1000);
})();
</script></body></html>`;
}
