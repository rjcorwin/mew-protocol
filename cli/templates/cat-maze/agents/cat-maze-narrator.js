#!/usr/bin/env node

const WebSocket = require('ws');

const gateway = process.env.MEW_GATEWAY || 'ws://localhost:8080';
const space = process.env.MEW_SPACE || process.argv[2] || 'cat-maze';
const token = process.env.MEW_TOKEN || process.argv[3] || 'narrator-token';
const participantId = process.env.MEW_PARTICIPANT_ID || 'cat-maze-narrator';
const targetParticipant = process.env.CAT_MAZE_PARTICIPANT || 'cat-maze';

const moveTools = new Set(['up', 'down', 'left', 'right']);
const watchTools = new Set([...moveTools, 'restart']);

function extractResultText(result) {
  if (!result) {
    return null;
  }

  if (Array.isArray(result.content)) {
    const text = result.content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n\n');
    if (text) {
      return text;
    }
  }

  return null;
}

let envelopeCounter = 0;
const observedMoves = new Set();
const narratorRequests = new Set();
let viewInFlight = null;
let initialViewRequested = false;

function nextId(prefix) {
  envelopeCounter += 1;
  return `${participantId}-${prefix}-${Date.now()}-${envelopeCounter}`;
}

function log(message, extra) {
  if (extra) {
    console.log(`[${participantId}] ${message}`, extra);
  } else {
    console.log(`[${participantId}] ${message}`);
  }
}

const ws = new WebSocket(`${gateway}?space=${encodeURIComponent(space)}`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
  handshakeTimeout: 15000,
});

function sendEnvelope(envelope) {
  if (ws.readyState !== WebSocket.OPEN) {
    log('Attempted to send while socket closed', envelope);
    return undefined;
  }

  const id = envelope.id || nextId('env');
  const payload = {
    protocol: 'mew/v0.4',
    id,
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope,
  };

  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  }

  ws.send(JSON.stringify(payload));
  return id;
}

function sendChat(text, correlationId) {
  const envelope = {
    kind: 'chat',
    payload: {
      text,
      format: 'plain',
    },
  };
  if (correlationId) {
    envelope.correlation_id = [correlationId];
  }
  sendEnvelope(envelope);
}

function requestView(reason) {
  if (viewInFlight) {
    log(`View already in flight (${viewInFlight}), skipping ${reason}`);
    return;
  }

  const requestId = sendEnvelope({
    kind: 'mcp/request',
    to: [targetParticipant],
    payload: {
      method: 'tools/call',
      params: {
        name: 'view',
        arguments: {},
      },
    },
  });

  if (requestId) {
    log(`Requested view (${reason}) with id ${requestId}`);
    narratorRequests.add(requestId);
    viewInFlight = requestId;
  }
}

function extractViewText(result) {
  if (!result) {
    return null;
  }

  const text = extractResultText(result);
  if (text) {
    return text;
  }

  if (result.state && typeof result.state.board === 'string') {
    const lines = [`Level ${result.state.level}/${result.state.totalLevels}: ${result.state.levelName}`, result.state.board];
    lines.push(
      `Moves this level: ${result.state.movesThisLevel} | Total moves: ${result.state.totalMoves}`,
    );
    lines.push(`Runs completed: ${result.state.runsCompleted}`);
    return lines.join('\n');
  }

  return null;
}

function handleViewResponse(message) {
  const correlationId = message.correlation_id?.[0];
  if (!correlationId) {
    return;
  }

  narratorRequests.delete(correlationId);
  viewInFlight = null;

  const result = message.payload?.result;
  if (!result) {
    log('View response missing result payload');
    return;
  }

  const viewText = extractViewText(result);
  if (!viewText) {
    log('Unable to extract text from view result');
    return;
  }

  const decorated = `👁️ Maze update\n${viewText}`;
  sendChat(decorated, correlationId);
}

function scheduleInitialView() {
  if (initialViewRequested) {
    return;
  }
  initialViewRequested = true;
  setTimeout(() => requestView('initial'), 500);
}

function handleMoveResponse(message) {
  const correlationId = message.correlation_id?.[0];
  if (!correlationId) {
    return;
  }

  if (observedMoves.has(correlationId)) {
    observedMoves.delete(correlationId);
    const result = message.payload?.result;
    const errorMessage = message.payload?.error?.message;
    if (result) {
      const moveText = extractResultText(result);
      if (moveText) {
        const decorated = `🎙️ Move update\n${moveText}`;
        sendChat(decorated, correlationId);
      } else {
        log('Move response missing relay text', { correlationId });
      }
    } else if (errorMessage) {
      sendChat(`🚫 Move failed: ${errorMessage}`, correlationId);
    } else {
      log('Move response missing result payload', { correlationId });
    }
    requestView('move');
  }
}

ws.on('open', () => {
  log('Connected to gateway', { gateway, space, participantId });
  sendEnvelope({
    kind: 'system/join',
    payload: {},
  });
  scheduleInitialView();
});

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    log('Failed to parse message', { error: error.message });
    return;
  }

  if (message.kind === 'system/ping') {
    sendEnvelope({
      kind: 'system/pong',
      correlation_id: message.id ? [message.id] : undefined,
    });
    return;
  }

  if (message.kind === 'system/welcome') {
    scheduleInitialView();
    return;
  }

  if (message.kind === 'system/error') {
    log('Received system error', message.payload);
    return;
  }

  if (message.kind === 'mcp/request') {
    if (message.from === participantId) {
      return;
    }
    if (!Array.isArray(message.to) || !message.to.includes(targetParticipant)) {
      return;
    }
    const name = message.payload?.params?.name;
    if (typeof name !== 'string' || !watchTools.has(name)) {
      return;
    }
    if (message.id) {
      observedMoves.add(message.id);
    }
    return;
  }

  if (message.kind === 'mcp/response') {
    const correlationId = message.correlation_id?.[0];
    if (!correlationId) {
      return;
    }
    if (narratorRequests.has(correlationId)) {
      handleViewResponse(message);
      return;
    }
    if (message.from === targetParticipant) {
      handleMoveResponse(message);
    }
    return;
  }

  if (message.kind === 'system/log' && message.payload?.category === 'cat-maze/move') {
    requestView('notification');
    return;
  }
});

ws.on('close', (code, reason) => {
  log(`Disconnected (code ${code}) ${reason?.toString?.() ?? ''}`);
  process.exit(0);
});

ws.on('error', (error) => {
  log('WebSocket error', { message: error.message });
});

function shutdown() {
  log('Shutting down narrator');
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
