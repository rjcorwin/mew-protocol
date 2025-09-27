#!/usr/bin/env node
/**
 * Scenario 3 calculator agent implemented with a minimal WebSocket client.
 * It exposes MCP tools (add, multiply, evaluate) and responds to requests.
 */

const WebSocket = require('ws');

const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'scenario-5-reasoning',
  token: 'calculator-token'
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

const participantId = 'calculator-agent';
const PROTOCOL_VERSION = 'mew/v0.4';
let messageCounter = 0;

const tools = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'First number' },
        b: { type: 'number', description: 'Second number' }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'evaluate',
    description: 'Evaluate a mathematical expression',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Expression to evaluate' }
      },
      required: ['expression']
    }
  }
];

const ws = new WebSocket(options.gateway, {
  handshakeTimeout: 15000
});

function sendEnvelope(envelope) {
  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket is not open');
  }

  const fullEnvelope = {
    protocol: PROTOCOL_VERSION,
    id: `${participantId}-${Date.now()}-${messageCounter += 1}`,
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope
  };

  ws.send(JSON.stringify(fullEnvelope));
}

function respond(request, payload) {
  try {
    sendEnvelope({
      kind: 'mcp/response',
      correlation_id: request.id,
      payload
    });
  } catch (error) {
    console.error('Failed to send response:', error);
  }
}

function handleToolsCall(request) {
  const name = request?.payload?.params?.name;
  const args = request?.payload?.params?.arguments ?? {};

  if (!name) {
    respond(request, {
      error: {
        code: 'INVALID_ARGUMENT',
        message: 'Tool name missing'
      }
    });
    return;
  }

  if (name === 'add') {
    const result = Number(args.a) + Number(args.b);
    respond(request, { result });
    return;
  }

  if (name === 'multiply') {
    const result = Number(args.a) * Number(args.b);
    respond(request, { result });
    return;
  }

  if (name === 'evaluate') {
    try {
      const expression = String(args.expression ?? '');
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + expression + ')')();
      if (!Number.isFinite(result)) {
        respond(request, { result: result.toString() });
      } else {
        respond(request, { result });
      }
    } catch (error) {
      respond(request, {
        error: {
          code: 'EVALUATION_ERROR',
          message: `Invalid expression: ${error.message}`
        }
      });
    }
    return;
  }

  respond(request, {
    error: {
      code: 'NOT_FOUND',
      message: `Tool not found: ${name}`
    }
  });
}

ws.on('open', () => {
  console.log(`Calculator agent connected to ${options.gateway}`);
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
    console.error('Failed to parse message from gateway:', error);
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

  if (message.kind === 'mcp/request') {
    const method = message?.payload?.method;
    if (method === 'tools/list') {
      respond(message, {
        result: {
          tools
        }
      });
      return;
    }

    if (method === 'tools/call') {
      handleToolsCall(message);
      return;
    }

    respond(message, {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Unsupported method: ${method}`
      }
    });
  }
});

ws.on('error', (error) => {
  console.error('Calculator agent WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`Calculator agent disconnected (code ${code}) ${reason?.toString?.() ?? ''}`);
  process.exit(0);
});

const shutdown = () => {
  console.log('Shutting down calculator agent...');
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
