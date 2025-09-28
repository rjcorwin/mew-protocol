#!/usr/bin/env node
/**
 * Scenario 14 narrator check - ensure the cat maze narrator relays move results.
 */

const { spawn } = require('child_process');
const readline = require('readline');
const { WebSocketServer } = require('ws');
const fs = require('fs');

const WALL = '🟫';
const WALKWAY = '◻️';

const graphemeSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function splitGraphemes(value) {
  if (!value) {
    return [];
  }
  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(value), (segment) => segment.segment);
  }
  return Array.from(value);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--server') {
      options.server = args[++i];
    } else if (arg === '--narrator') {
      options.narrator = args[++i];
    } else if (arg === '--log') {
      options.logPath = args[++i];
    } else if (arg === '--timeout') {
      options.timeoutMs = Number(args[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.server) {
    throw new Error('Missing required --server path');
  }
  if (!options.narrator) {
    throw new Error('Missing required --narrator path');
  }

  options.timeoutMs = options.timeoutMs || 7000;
  return options;
}

function createLogger(logPath) {
  if (!logPath) {
    return { info: () => {}, error: () => {}, close: () => {} };
  }
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  return {
    info(message, extra) {
      if (extra) {
        stream.write(`[INFO] ${message} ${JSON.stringify(extra)}\n`);
      } else {
        stream.write(`[INFO] ${message}\n`);
      }
    },
    error(message, extra) {
      if (extra) {
        stream.write(`[ERROR] ${message} ${JSON.stringify(extra)}\n`);
      } else {
        stream.write(`[ERROR] ${message}\n`);
      }
    },
    close() {
      stream.end();
    },
  };
}

function waitWithTimeout(promise, ms, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timeout));
}

function findPath(board) {
  const rows = board.split('\n');
  const height = rows.length;
  const grid = rows.map((row) => splitGraphemes(row));
  const width = grid[0]?.length || 0;
  let start = null;
  let goal = null;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const cell = grid[row][col];
      if (cell === '🐈') {
        start = { row, col };
        grid[row][col] = WALKWAY;
      } else if (cell === '🏁') {
        goal = { row, col };
        grid[row][col] = WALKWAY;
      }
    }
  }

  if (!start || !goal) {
    throw new Error('Board missing start or goal');
  }

  const deltas = [
    { name: 'up', row: -1, col: 0 },
    { name: 'down', row: 1, col: 0 },
    { name: 'left', row: 0, col: -1 },
    { name: 'right', row: 0, col: 1 },
  ];

  const queue = [start];
  const visited = new Set([`${start.row},${start.col}`]);
  const prev = new Map();

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.row === goal.row && current.col === goal.col) {
      break;
    }
    for (const delta of deltas) {
      const next = { row: current.row + delta.row, col: current.col + delta.col };
      if (
        next.row < 0 ||
        next.row >= height ||
        next.col < 0 ||
        next.col >= width ||
        grid[next.row][next.col] === WALL
      ) {
        continue;
      }
      const key = `${next.row},${next.col}`;
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      prev.set(key, { from: current, dir: delta.name });
      queue.push(next);
    }
  }

  const goalKey = `${goal.row},${goal.col}`;
  if (!visited.has(goalKey)) {
    throw new Error('No path from start to goal on board');
  }

  const path = [];
  let cursorKey = goalKey;
  while (cursorKey !== `${start.row},${start.col}`) {
    const step = prev.get(cursorKey);
    if (!step) {
      throw new Error('Failed to reconstruct path');
    }
    path.push(step.dir);
    cursorKey = `${step.from.row},${step.from.col}`;
  }

  return path.reverse();
}

async function main() {
  const options = parseArgs();
  const logger = createLogger(options.logPath);

  const server = spawn('node', [options.server], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });

  const pendingServer = new Map();
  let serverCounter = 0;

  const serverRl = readline.createInterface({ input: server.stdout });

  function handleServerMessage(message) {
    if (typeof message.id !== 'undefined') {
      const entry = pendingServer.get(message.id);
      if (!entry) {
        logger.error(`No pending server request for id ${message.id}`);
        return;
      }
      pendingServer.delete(message.id);
      if (message.error) {
        entry.reject(new Error(message.error.message || 'Server error'));
      } else {
        entry.resolve(message.result);
      }
      return;
    }

    if (message.method === 'notifications/message') {
      if (narratorSocket) {
        emitToNarrator({
          kind: 'system/log',
          payload: message.params,
        });
      }
    }
  }

  serverRl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    try {
      const message = JSON.parse(trimmed);
      handleServerMessage(message);
    } catch (error) {
      logger.error('Failed to parse server output', { line: trimmed, error: error.message });
    }
  });

  server.stderr.on('data', (chunk) => {
    logger.error('Server stderr', { chunk: chunk.toString().trim() });
  });

  function sendToServer(request) {
    server.stdin.write(`${JSON.stringify(request)}\n`);
  }

  function callServer(method, params, id) {
    const requestId = typeof id !== 'undefined' ? id : `gw-${++serverCounter}`;
    return new Promise((resolve, reject) => {
      pendingServer.set(requestId, { resolve, reject });
      sendToServer({ jsonrpc: '2.0', id: requestId, method, params });
    });
  }

  await callServer('initialize', {});
  await callServer('tools/list', {});

  const initialView = await callServer('tools/call', { name: 'view', arguments: {} });
  if (!initialView?.state?.board?.includes(WALKWAY)) {
    throw new Error('Initial view missing walkway glyph ◻️');
  }

  const path = findPath(initialView.state.board);
  if (path.length === 0) {
    throw new Error('Solver found no path through first level');
  }

  const wss = new WebSocketServer({ port: 0 });
  const { port } = wss.address();
  logger.info('Gateway listening', { port });

  let narratorSocket = null;
  let gatewayCounter = 0;
  const moveChats = new Map();
  const chatWaiters = new Map();
  const viewRequestQueue = [];
  const viewRequestWaiters = [];
  const pendingMoveIds = [];

  function emitToNarrator(envelope) {
    if (!narratorSocket) {
      throw new Error('Narrator socket not connected');
    }
    const message = {
      protocol: 'mew/v0.4',
      ts: new Date().toISOString(),
      id: envelope.id || `gateway-${++gatewayCounter}`,
      from: envelope.from || 'gateway',
      ...envelope,
    };
    narratorSocket.send(JSON.stringify(message));
  }

  function resolveChat(correlationId, message) {
    if (!correlationId) {
      return;
    }
    if (chatWaiters.has(correlationId)) {
      const { resolve, timeout } = chatWaiters.get(correlationId);
      clearTimeout(timeout);
      chatWaiters.delete(correlationId);
      resolve(message);
    }
  }

  function waitForChat(correlationId, timeoutMs) {
    if (moveChats.has(correlationId)) {
      return Promise.resolve(moveChats.get(correlationId));
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chatWaiters.delete(correlationId);
        reject(new Error(`Timed out waiting for chat with correlation ${correlationId}`));
      }, timeoutMs);
      chatWaiters.set(correlationId, { resolve, timeout });
    });
  }

  function recordViewRequest(id) {
    if (viewRequestWaiters.length > 0) {
      const resolve = viewRequestWaiters.shift();
      resolve(id);
    } else {
      viewRequestQueue.push(id);
    }
  }

  function nextViewRequest(timeoutMs) {
    if (viewRequestQueue.length > 0) {
      return Promise.resolve(viewRequestQueue.shift());
    }
    return waitWithTimeout(
      new Promise((resolve) => {
        viewRequestWaiters.push(resolve);
      }),
      timeoutMs,
      'Timed out waiting for narrator view request',
    );
  }

  async function handleNarratorRequest(message) {
    if (message.payload?.method !== 'tools/call') {
      return;
    }
    const toolName = message.payload?.params?.name;
    if (!toolName) {
      return;
    }
    if (toolName === 'view') {
      recordViewRequest(message.id);
    }
    const result = await callServer('tools/call', {
      name: toolName,
      arguments: message.payload?.params?.arguments || {},
    }, message.id);
    emitToNarrator({
      kind: 'mcp/response',
      from: 'cat-maze',
      correlation_id: [message.id],
      payload: { result },
    });
  }

  wss.on('connection', (socket) => {
    narratorSocket = socket;
    logger.info('Narrator connected');

    socket.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        logger.error('Failed to parse narrator message', { error: error.message });
        return;
      }

      if (message.kind === 'system/join') {
        emitToNarrator({ kind: 'system/welcome', payload: { space: 'test-space' } });
        return;
      }

      if (message.kind === 'system/pong' || message.kind === 'system/log') {
        return;
      }

      if (message.kind === 'system/ping') {
        emitToNarrator({ kind: 'system/pong', correlation_id: message.id ? [message.id] : undefined });
        return;
      }

      if (message.kind === 'chat') {
        const correlationId = message.correlation_id?.[0];
        if (correlationId) {
          if (pendingMoveIds.includes(correlationId)) {
            moveChats.set(correlationId, message);
          }
          resolveChat(correlationId, message);
        }
        return;
      }

      if (message.kind === 'mcp/request') {
        handleNarratorRequest(message).catch((error) => {
          logger.error('Error handling narrator request', { error: error.message });
        });
        return;
      }
    });

    socket.on('close', () => {
      logger.info('Narrator socket closed');
    });
  });

  const narratorEnv = {
    ...process.env,
    MEW_GATEWAY: `ws://127.0.0.1:${port}`,
    MEW_SPACE: 'test-space',
    MEW_TOKEN: 'narrator-token',
    MEW_PARTICIPANT_ID: 'cat-maze-narrator',
    CAT_MAZE_PARTICIPANT: 'cat-maze',
  };

  const narrator = spawn('node', [options.narrator], {
    env: narratorEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  narrator.stdout.on('data', (chunk) => {
    logger.info('Narrator stdout', { chunk: chunk.toString().trim() });
  });

  narrator.stderr.on('data', (chunk) => {
    logger.error('Narrator stderr', { chunk: chunk.toString().trim() });
  });

  async function performMove(direction, timeoutMs) {
    const requestId = `human-${pendingMoveIds.length + 1}`;
    pendingMoveIds.push(requestId);
    emitToNarrator({
      kind: 'mcp/request',
      id: requestId,
      from: 'human',
      to: ['cat-maze'],
      payload: {
        method: 'tools/call',
        params: { name: direction, arguments: {} },
      },
    });

    const result = await callServer('tools/call', { name: direction, arguments: {} }, requestId);

    emitToNarrator({
      kind: 'mcp/response',
      from: 'cat-maze',
      correlation_id: [requestId],
      payload: { result },
    });

    const moveChat = await waitForChat(requestId, timeoutMs);
    if (!moveChat.payload?.text?.includes(direction)) {
      logger.info('Move chat text', { text: moveChat.payload?.text || '' });
    }
    if (!moveChat.payload?.text?.includes(WALKWAY)) {
      throw new Error(`Move chat for ${direction} missing walkway glyph ◻️`);
    }

    const viewRequestId = await nextViewRequest(timeoutMs);
    const viewChat = await waitForChat(viewRequestId, timeoutMs);
    if (!viewChat.payload?.text?.includes(WALKWAY)) {
      throw new Error('View chat missing walkway glyph ◻️');
    }

    return result;
  }

  // Wait for the narrator to issue the initial view request and respond.
  const firstViewId = await nextViewRequest(options.timeoutMs);
  const firstViewChatPromise = waitForChat(firstViewId, options.timeoutMs).catch((error) => {
    logger.error('Initial view chat error', { error: error.message });
    throw error;
  });
  const firstViewResponse = await callServer(
    'tools/call',
    { name: 'view', arguments: {} },
    firstViewId,
  );
  emitToNarrator({
    kind: 'mcp/response',
    from: 'cat-maze',
    correlation_id: [firstViewId],
    payload: { result: firstViewResponse },
  });
  await firstViewChatPromise;

  let lastState = initialView.state;
  for (const direction of path) {
    const result = await performMove(direction, options.timeoutMs);
    lastState = result.state || lastState;
    if (result.state && result.state.level !== initialView.state.level) {
      break;
    }
  }

  if (!lastState || lastState.level === initialView.state.level) {
    throw new Error('Expected to advance to the next level during narrator check');
  }

  for (const requestId of pendingMoveIds) {
    if (!moveChats.has(requestId)) {
      throw new Error(`Missing narrator chat relay for move request ${requestId}`);
    }
  }

  await callServer('shutdown', {});
  await waitWithTimeout(
    new Promise((resolve) => server.once('exit', resolve)),
    options.timeoutMs,
    'Server did not exit after shutdown',
  );
  logger.info('Narrator check completed successfully');

  narrator.kill('SIGTERM');
  await waitWithTimeout(
    new Promise((resolve) => narrator.once('exit', resolve)),
    options.timeoutMs,
    'Narrator did not exit after shutdown',
  );
  await new Promise((resolve) => wss.close(resolve));
  logger.close();
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
