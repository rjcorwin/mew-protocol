#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://localhost:3000/ws';
const SPACE_ID = 'scenario-8-grant';
const PARTICIPANT_ID = 'file-server';
const TOKEN = 'file-server-token';
const LOG_FILE = path.join(__dirname, 'logs', 'file-server.log');

// Ensure log directory exists
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

// Logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(`[FileServer] ${message}`);
  fs.appendFileSync(LOG_FILE, logLine);
}

// Message ID counter
let messageId = 1;

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
    path.join(__dirname, 'logs', 'file-server-messages.log'),
    JSON.stringify(msg) + '\n'
  );

  // Handle welcome
  if (msg.kind === 'system/welcome') {
    log(`Ready to handle file operations, my ID: ${msg.payload.you.id}`);
  }

  // Handle MCP requests
  if (msg.kind === 'mcp/request' && msg.to?.includes(PARTICIPANT_ID)) {
    log(`Received MCP request from ${msg.from}: ${msg.payload.method}`);

    if (msg.payload.method === 'tools/call' && msg.payload.params.name === 'write_file') {
      const { path: filepath, content } = msg.payload.params.arguments;
      log(`Writing "${content}" to ${filepath}`);

      // Actually write the file
      const fullPath = path.join(__dirname, filepath);
      try {
        fs.writeFileSync(fullPath, content);
        log(`✅ Successfully wrote ${filepath}`);

        // Send success response
        const response = {
          protocol: 'mew/v0.4',
          id: `response-${messageId++}`,
          ts: new Date().toISOString(),
          from: PARTICIPANT_ID,
          to: [msg.from],
          kind: 'mcp/response',
          correlation_id: [msg.id],
          payload: {
            jsonrpc: '2.0',
            id: msg.payload.id,
            result: {
              content: [{
                type: 'text',
                text: `Successfully wrote "${content}" to ${filepath}`
              }]
            }
          }
        };
        ws.send(JSON.stringify(response));
        log(`Sent success response to ${msg.from}`);
      } catch (error) {
        log(`Error writing file: ${error.message}`);

        // Send error response
        const errorResponse = {
          protocol: 'mew/v0.4',
          id: `error-response-${messageId++}`,
          ts: new Date().toISOString(),
          from: PARTICIPANT_ID,
          to: [msg.from],
          kind: 'mcp/response',
          correlation_id: [msg.id],
          payload: {
            jsonrpc: '2.0',
            id: msg.payload.id,
            error: {
              code: -32603,
              message: `Failed to write file: ${error.message}`
            }
          }
        };
        ws.send(JSON.stringify(errorResponse));
      }
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

// Handle process termination
process.on('SIGTERM', () => {
  log('Received SIGTERM, closing...');
  ws.close();
});

process.on('SIGINT', () => {
  log('Received SIGINT, closing...');
  ws.close();
});