#!/usr/bin/env node
/**
 * Scenario 8 grant agent.
 * Starts by proposing a write_file tool call. After receiving a capability grant
 * it acknowledges and sends a direct request using the granted capability.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-8-grant',
  token: 'agent-token',
  id: 'test-agent',
  log: './logs/test-agent.log',
  workDir: './workspace-files'
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  switch (arg) {
    case '--gateway':
    case '-g':
      options.gateway = args[i + 1];
      i += 1;
      break;
    case '--space':
    case '-s':
      options.space = args[i + 1];
      i += 1;
      break;
    case '--token':
    case '-t':
      options.token = args[i + 1];
      i += 1;
      break;
    case '--id':
      options.id = args[i + 1];
      i += 1;
      break;
    case '--log':
      options.log = args[i + 1];
      i += 1;
      break;
    case '--work-dir':
      options.workDir = args[i + 1];
      i += 1;
      break;
    default:
      break;
  }
}

const participantId = options.id;
const logPath = path.resolve(process.cwd(), options.log);
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const workDir = path.resolve(process.cwd(), options.workDir);
fs.mkdirSync(workDir, { recursive: true });

function log(message, extra) {
  const entry = { timestamp: new Date().toISOString(), level: 'info', message };
  if (extra) {
    entry.extra = extra;
  }
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  console.log(`[grant-agent] ${message}`, extra ?? '');
}

let envelopeCounter = 0;
let proposalSent = false;
let grantAcknowledged = false;
let directRequestSent = false;

function nextEnvelopeId(prefix) {
  envelopeCounter += 1;
  return `${participantId}-${prefix}-${Date.now()}-${envelopeCounter}`;
}

const ws = new WebSocket(options.gateway, { handshakeTimeout: 15000 });

ws.on('open', () => {
  log('Connected to gateway', { gateway: options.gateway });
  ws.send(JSON.stringify({
    type: 'join',
    space: options.space,
    token: options.token,
    participantId
  }));
});

ws.on('error', (error) => {
  log('WebSocket error', { error: error.message });
});

ws.on('close', (code, reason) => {
  log('Connection closed', { code, reason: reason?.toString() });
  process.exit(0);
});

function sendEnvelope(envelope) {
  const fullEnvelope = {
    protocol: 'mew/v0.4',
    id: envelope.id ?? nextEnvelopeId('env'),
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope
  };
  ws.send(JSON.stringify(fullEnvelope));
  log('Sent envelope', { kind: fullEnvelope.kind, id: fullEnvelope.id, to: fullEnvelope.to });
}

function sendProposal(filename, content) {
  if (proposalSent) {
    return;
  }
  proposalSent = true;
  log('Sending proposal to write file', { filename, content });
  sendEnvelope({
    kind: 'mcp/proposal',
    to: ['file-server'],
    payload: {
      method: 'tools/call',
      params: {
        name: 'write_file',
        arguments: {
          path: filename,
          content
        }
      }
    }
  });
}

function sendDirectRequest(filename, content) {
  if (directRequestSent) {
    return;
  }
  directRequestSent = true;
  log('Sending direct request to write file', { filename, content });
  sendEnvelope({
    kind: 'mcp/request',
    to: ['file-server'],
    payload: {
      jsonrpc: '2.0',
      id: nextEnvelopeId('req'),
      method: 'tools/call',
      params: {
        name: 'write_file',
        arguments: {
          path: filename,
          content
        }
      }
    }
  });
}

function handleGrant(message) {
  if (grantAcknowledged) {
    return;
  }
  grantAcknowledged = true;
  log('Received capability grant', { grant: message.payload });
  sendEnvelope({
    kind: 'capability/grant-ack',
    correlation_id: [message.id],
    payload: {
      status: 'accepted'
    }
  });

  setTimeout(() => {
    sendDirectRequest('bar.txt', 'bar');
  }, 3000);
}

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    log('Failed to parse inbound message', { error: error.message, data: data.toString() });
    return;
  }

  if (message.kind === 'system/welcome') {
    log('Received welcome', { you: message.payload?.you });
    setTimeout(() => sendProposal('foo.txt', 'foo'), 1500);
    return;
  }

  if (message.kind === 'capability/grant' && Array.isArray(message.to) && message.to.includes(participantId)) {
    handleGrant(message);
    return;
  }

  if (message.kind === 'system/error' && Array.isArray(message.to) && message.to.includes(participantId)) {
    log('Received system error', { error: message.payload });
    return;
  }

  if (message.kind === 'mcp/response' && Array.isArray(message.to) && message.to.includes(participantId)) {
    log('Received MCP response', { correlation_id: message.correlation_id, payload: message.payload });
    if (directRequestSent) {
      setTimeout(() => {
        log('Scenario complete, exiting');
        ws.close();
      }, 1500);
    }
  }
});

process.on('SIGINT', () => {
  log('Received SIGINT, closing connection');
  ws.close();
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, closing connection');
  ws.close();
});
