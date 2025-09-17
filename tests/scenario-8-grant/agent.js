#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://localhost:3000/ws';
const SPACE_ID = 'scenario-8-grant';
const PARTICIPANT_ID = 'test-agent';
const TOKEN = 'agent-token';
const LOG_FILE = path.join(__dirname, 'logs', 'agent.log');

// Ensure log directory exists
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(`[Agent] ${message}`);
  fs.appendFileSync(LOG_FILE, logLine);
}

// Message ID counter
let messageId = 1;
let hasWriteCapability = false;
let proposalSent = false;
let grantReceived = false;

// Connect to gateway
const ws = new WebSocket(`${GATEWAY_URL}?space=${SPACE_ID}`, {
  headers: {
    'Authorization': `Bearer ${TOKEN}`
  }
});

ws.on('open', () => {
  log('Connected to gateway');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  // Log all messages for debugging
  fs.appendFileSync(
    path.join(__dirname, 'logs', 'agent-messages.log'),
    JSON.stringify(msg) + '\n'
  );

  // Handle welcome message
  if (msg.kind === 'system/welcome') {
    log(`Received welcome, my ID: ${msg.payload.you.id}`);

    // Wait a bit then send first proposal
    setTimeout(() => {
      if (!proposalSent) {
        sendProposal('foo.txt', 'foo');
        proposalSent = true;
      }
    }, 2000);
  }

  // Handle capability grant
  if (msg.kind === 'capability/grant' && msg.to?.includes(PARTICIPANT_ID)) {
    log('✅ RECEIVED CAPABILITY GRANT!');
    log(`Capabilities: ${JSON.stringify(msg.payload.capabilities, null, 2)}`);
    hasWriteCapability = true;
    grantReceived = true;

    // Send acknowledgment
    const ack = {
      protocol: 'mew/v0.3',
      id: `ack-${messageId++}`,
      ts: new Date().toISOString(),
      from: PARTICIPANT_ID,
      correlation_id: [msg.id],
      kind: 'capability/grant-ack',
      payload: { status: 'accepted' }
    };
    ws.send(JSON.stringify(ack));
    log('Sent grant acknowledgment');

    // Now send direct request to write bar.txt
    setTimeout(() => {
      log('Now sending DIRECT request to write bar.txt...');
      sendDirectRequest('bar.txt', 'bar');
    }, 1500);
  }

  // Handle MCP responses
  if (msg.kind === 'mcp/response' && msg.to?.includes(PARTICIPANT_ID)) {
    log(`Received response: ${JSON.stringify(msg.payload.result?.content?.[0]?.text)}`);
  }

  // Handle errors
  if (msg.kind === 'system/error' && msg.to?.includes(PARTICIPANT_ID)) {
    log(`ERROR: ${msg.payload.error}`);
    if (msg.payload.error === 'capability_violation') {
      log('Capability violation - I don\'t have permission for this operation');
    }
  }
});

ws.on('error', (err) => {
  log(`WebSocket error: ${err.message}`);
});

ws.on('close', () => {
  log('Connection closed');
  process.exit(0);
});

function sendProposal(filename, content) {
  log(`Sending PROPOSAL to write "${content}" to ${filename}`);
  const proposal = {
    protocol: 'mew/v0.3',
    id: `proposal-${messageId++}`,
    ts: new Date().toISOString(),
    from: PARTICIPANT_ID,
    to: ['file-server'],
    kind: 'mcp/proposal',
    payload: {
      method: 'tools/call',
      params: {
        name: 'write_file',
        arguments: {
          path: filename,
          content: content
        }
      }
    }
  };
  ws.send(JSON.stringify(proposal));
  log('Proposal sent, waiting for human to fulfill...');
}

function sendDirectRequest(filename, content) {
  log(`Sending DIRECT REQUEST to write "${content}" to ${filename}`);
  const request = {
    protocol: 'mew/v0.3',
    id: `request-${messageId++}`,
    ts: new Date().toISOString(),
    from: PARTICIPANT_ID,
    to: ['file-server'],
    kind: 'mcp/request',
    payload: {
      jsonrpc: '2.0',
      id: messageId,
      method: 'tools/call',
      params: {
        name: 'write_file',
        arguments: {
          path: filename,
          content: content
        }
      }
    }
  };
  ws.send(JSON.stringify(request));
  log('Direct request sent!');

  // Exit after a delay to allow response to be received
  setTimeout(() => {
    log('Test sequence complete, exiting...');
    process.exit(0);
  }, 3000);
}

// Handle process termination
process.on('SIGTERM', () => {
  log('Received SIGTERM, closing...');
  ws.close();
});

process.on('SIGINT', () => {
  log('Received SIGINT, closing...');
  ws.close();
});