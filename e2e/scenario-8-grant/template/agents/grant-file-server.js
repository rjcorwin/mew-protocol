#!/usr/bin/env node
/**
 * File server participant for scenario 8. Handles MCP tools/call write_file requests.
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-8-grant',
  token: 'file-server-token',
  id: 'file-server',
  log: './logs/file-server.log',
  outputDir: './workspace-files'
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
    case '--output-dir':
      options.outputDir = args[i + 1];
      i += 1;
      break;
    default:
      break;
  }
}

const participantId = options.id;
const logPath = path.resolve(process.cwd(), options.log);
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const outputDir = path.resolve(process.cwd(), options.outputDir);
fs.mkdirSync(outputDir, { recursive: true });

function log(message, extra) {
  const entry = { timestamp: new Date().toISOString(), level: 'info', message };
  if (extra) {
    entry.extra = extra;
  }
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  console.log(`[file-server] ${message}`, extra ?? '');
}

let envelopeCounter = 0;

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

function handleWriteFile(request) {
  const args = request?.payload?.params?.arguments || {};
  const relativePath = typeof args.path === 'string' ? args.path : null;
  const content = typeof args.content === 'string' ? args.content : '';
  if (!relativePath) {
    throw new Error('write_file requires a string path argument');
  }

  const destination = path.resolve(outputDir, relativePath);
  if (!destination.startsWith(outputDir)) {
    throw new Error('write_file path escapes output directory');
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, 'utf8');
  log('Wrote file', { destination, bytes: Buffer.byteLength(content, 'utf8') });

  return {
    jsonrpc: '2.0',
    id: request.payload?.id ?? nextEnvelopeId('resp'),
    result: {
      content: [
        {
          type: 'text',
          text: `Successfully wrote ${relativePath}`
        }
      ]
    }
  };
}

ws.on('message', (data) => {
  let message;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    log('Failed to parse inbound message', { error: error.message, data: data.toString() });
    return;
  }

  if (message.kind === 'mcp/request' && Array.isArray(message.to) && message.to.includes(participantId)) {
    const method = message.payload?.method;
    if (method === 'tools/call' && message.payload?.params?.name === 'write_file') {
      try {
        const responsePayload = handleWriteFile(message);
        sendEnvelope({
          kind: 'mcp/response',
          to: [message.from],
          correlation_id: [message.id],
          payload: responsePayload
        });
      } catch (error) {
        sendEnvelope({
          kind: 'mcp/response',
          to: [message.from],
          correlation_id: [message.id],
          payload: {
            jsonrpc: '2.0',
            id: message.payload?.id ?? nextEnvelopeId('err'),
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : String(error)
            }
          }
        });
      }
      return;
    }

    sendEnvelope({
      kind: 'mcp/response',
      to: [message.from],
      correlation_id: [message.id],
      payload: {
        jsonrpc: '2.0',
        id: message.payload?.id ?? nextEnvelopeId('err'),
        error: {
          code: -32601,
          message: `Unsupported method: ${method}`
        }
      }
    });
  }
});

process.on('SIGINT', () => {
  ws.close();
});

process.on('SIGTERM', () => {
  ws.close();
});
