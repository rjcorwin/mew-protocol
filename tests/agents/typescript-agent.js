#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'typescript-agent';
const logPath = process.env.TS_AGENT_LOG ? path.resolve(process.env.TS_AGENT_LOG) : null;

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {
    // ignore logging errors
  }
}

function send(envelope) {
  process.stdout.write(
    encodeEnvelope({
      protocol: 'mew/v0.3',
      ...envelope,
    }),
  );
}

const tools = [
  {
    name: 'calculate',
    description: 'Perform a math operation (add or multiply)',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['add', 'multiply'] },
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['operation', 'a', 'b'],
    },
  },
  {
    name: 'echo',
    description: 'Echo a message back',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
  },
];

function respondWithTools(envelope) {
  append('LIST tools');
  send({
    kind: 'mcp/response',
    correlation_id: envelope.id ? [envelope.id] : undefined,
    to: [envelope.from],
    payload: {
      success: true,
      result: {
        tools,
      },
    },
  });
}

function handleCalculate(envelope, args) {
  const { operation, a, b } = args;
  let result;
  if (operation === 'add') {
    result = a + b;
  } else if (operation === 'multiply') {
    result = a * b;
  } else {
    send({
      kind: 'mcp/response',
      correlation_id: envelope.id ? [envelope.id] : undefined,
      to: [envelope.from],
      payload: {
        success: false,
        error: `Unsupported operation: ${operation}`,
      },
    });
    return;
  }

  append(`CALC ${a} ${operation} ${b} = ${result}`);
  send({
    kind: 'mcp/response',
    correlation_id: envelope.id ? [envelope.id] : undefined,
    to: [envelope.from],
    payload: {
      success: true,
      result: `Result: ${a} ${operation} ${b} = ${result}`,
    },
  });
}

function handleEcho(envelope, args) {
  const message = `Echo: ${args.message || ''}`;
  append(`ECHO ${args.message || ''}`);
  send({
    kind: 'mcp/response',
    correlation_id: envelope.id ? [envelope.id] : undefined,
    to: [envelope.from],
    payload: {
      success: true,
      result: message,
    },
  });
}

function handleMcpRequest(envelope) {
  if (envelope.to && !envelope.to.includes(participantId)) {
    return;
  }

  const { method, params = {} } = envelope.payload || {};
  if (method === 'tools/list') {
    respondWithTools(envelope);
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params;
    if (name === 'calculate') {
      handleCalculate(envelope, args);
      return;
    }
    if (name === 'echo') {
      handleEcho(envelope, args);
      return;
    }
    send({
      kind: 'mcp/response',
      correlation_id: envelope.id ? [envelope.id] : undefined,
      to: [envelope.from],
      payload: {
        success: false,
        error: `Unknown tool: ${name}`,
      },
    });
  }
}

function handleChat(envelope) {
  if (envelope.to && !envelope.to.includes(participantId)) return;
  const incoming = envelope.payload?.text || '';
  append(`CHAT ${incoming}`);
  send({
    kind: 'chat',
    to: [envelope.from],
    payload: {
      text: `Hello! I received: ${incoming}`,
      format: 'plain',
    },
  });
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    return;
  }
  if (envelope.kind === 'mcp/request') {
    handleMcpRequest(envelope);
    return;
  }
  if (envelope.kind === 'chat') {
    handleChat(envelope);
  }
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    append(`ERROR ${error.message}`);
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
