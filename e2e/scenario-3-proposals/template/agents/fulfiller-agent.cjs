#!/usr/bin/env node
/**
 * Scenario 3 fulfiller agent - listens for MCP proposals and fulfils them using
 * the calculator agent's tools before replying to the proposer via chat.
 */

const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-3-proposals',
  token: 'fulfiller-token'
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--gateway' || arg === '-g') {
    options.gateway = args[i + 1];
    i += 1;
  } else if (arg === '--space' || arg === '-s') {
    options.space = args[i + 1];
    i += 1;
  } else if (arg === '--token' || arg === '-t') {
    options.token = args[i + 1];
    i += 1;
  }
}

const participantId = 'fulfiller';
const PROTOCOL_VERSION = 'mew/v0.4';
let messageCounter = 0;

const pendingRequests = new Map();

const ws = new WebSocket(options.gateway, {
  handshakeTimeout: 15000
});

function sendEnvelope(envelope) {
  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not open');
  }

  const id = `${participantId}-${Date.now()}-${messageCounter += 1}`;
  const fullEnvelope = {
    protocol: PROTOCOL_VERSION,
    id,
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope
  };

  ws.send(JSON.stringify(fullEnvelope));
  return id;
}

function getCorrelationIds(message) {
  const { correlation_id: correlationId } = message;
  if (!correlationId) {
    return [];
  }
  if (Array.isArray(correlationId)) {
    return correlationId;
  }
  return [correlationId];
}

function sendChat(text, recipient) {
  try {
    sendEnvelope({
      kind: 'chat',
      to: recipient ? [recipient] : undefined,
      payload: { text }
    });
  } catch (error) {
    console.error('Failed to send chat message:', error);
  }
}

function requestCalculator(payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let messageId;
    const timer = setTimeout(() => {
      if (messageId) {
        pendingRequests.delete(messageId);
      }
      reject(new Error('Timed out waiting for calculator response'));
    }, timeoutMs);

    try {
      messageId = sendEnvelope({
        kind: 'mcp/request',
        to: ['calculator-agent'],
        payload
      });
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }

    pendingRequests.set(messageId, {
      resolve: (message) => {
        clearTimeout(timer);
        resolve(message);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      }
    });
  });
}

async function handleProposal(message) {
  const method = message?.payload?.method;
  if (method !== 'tools/call') {
    console.log(`Ignoring unsupported proposal method: ${method}`);
    return;
  }

  const name = message?.payload?.params?.name;
  const args = message?.payload?.params?.arguments ?? {};

  console.log(`Fulfilling proposal ${message.id} for tool ${name}`);

  try {
    const response = await requestCalculator({
      method: 'tools/call',
      params: { name, arguments: args }
    });

    const payload = response?.payload ?? {};
    if (payload.error) {
      console.log(`Calculator returned error for proposal ${message.id}:`, payload.error);
      sendChat(`Error fulfilling proposal: ${payload.error.message || payload.error.code || 'Unknown error'}`, message.from);
      return;
    }

    let resultText = 'Unknown result';
    if (payload.result !== undefined) {
      resultText = String(payload.result);
    } else if (Array.isArray(payload.content) && payload.content[0]?.text) {
      resultText = payload.content[0].text;
    }

    console.log(`Proposal ${message.id} result: ${resultText}`);
    sendChat(resultText, message.from);
  } catch (error) {
    console.error(`Failed to fulfil proposal ${message.id}:`, error);
    sendChat(`Error fulfilling proposal: ${error.message}`, message.from);
  }
}

ws.on('open', () => {
  console.log(`Fulfiller agent connected to ${options.gateway}`);
  const joinMessage = {
    type: 'join',
    space: options.space,
    token: options.token,
    participantId,
    capabilities: []
  };
  ws.send(JSON.stringify(joinMessage));
});

ws.on('message', (raw) => {
  const data = raw.toString();
  if (data.startsWith('#')) {
    return;
  }

  let message;
  try {
    message = JSON.parse(data);
  } catch (error) {
    console.error('Failed to parse gateway message:', error);
    return;
  }

  if (message.type === 'welcome') {
    console.log('Received welcome event from gateway');
    return;
  }

  if (message.kind === 'system/ping') {
    sendEnvelope({
      kind: 'system/pong',
      correlation_id: message.id
    });
    return;
  }

  if (message.kind === 'mcp/response') {
    const ids = getCorrelationIds(message);
    ids.forEach((id) => {
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        pending.resolve(message);
      }
    });
    return;
  }

  if (message.kind === 'mcp/proposal') {
    handleProposal(message).catch((error) => {
      console.error('Unhandled proposal error:', error);
    });
  }
});

ws.on('error', (error) => {
  console.error('Fulfiller agent WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`Fulfiller agent disconnected (code ${code}) ${reason?.toString?.() ?? ''}`);
  process.exit(0);
});

const shutdown = () => {
  console.log('Shutting down fulfiller agent...');
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
