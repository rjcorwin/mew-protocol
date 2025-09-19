#!/usr/bin/env node
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');
const fs = require('fs');
const path = require('path');

const participantId = process.env.MEW_PARTICIPANT_ID || 'calculator-agent';
const logPath = process.env.CALCULATOR_LOG || null;

function appendLog(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (error) {
    // Ignore logging errors in tests
  }
}

const tools = [
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'multiply',
    description: 'Multiply two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'evaluate',
    description: 'Evaluate a mathematical expression',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string' },
      },
      required: ['expression'],
    },
  },
];

function send(envelope) {
  process.stdout.write(encodeEnvelope({ protocol: 'mew/v0.3', ...envelope }));
}

function isTargeted(envelope) {
  if (!envelope.to || envelope.to.length === 0) {
    return true;
  }
  return envelope.to.includes(participantId);
}

function handleRequest(envelope) {
  const requestId = envelope.id || envelope.correlation_id || `req-${Date.now()}`;
  const context = envelope.context;
  const responseBase = {
    kind: 'mcp/response',
    correlation_id: requestId ? [requestId] : undefined,
    context,
  };

  if (!isTargeted(envelope)) {
    return;
  }

  const method = envelope.payload?.method;
  const params = envelope.payload?.params || {};
  appendLog(`REQUEST ${method}`);

  switch (method) {
    case 'tools/list':
      send({
        ...responseBase,
        payload: {
          success: true,
          result: {
            tools,
          },
        },
      });
      break;
    case 'tools/call': {
      const toolName = params.name;
      const args = params.arguments || {};
      handleToolCall(toolName, args, responseBase);
      break;
    }
    default:
      send({
        ...responseBase,
        payload: {
          success: false,
          error: `Unsupported method: ${method}`,
        },
      });
  }
}

function handleToolCall(toolName, args, responseBase) {
  try {
    let result;
    switch (toolName) {
      case 'add':
        result = (Number(args.a) || 0) + (Number(args.b) || 0);
        break;
      case 'multiply':
        result = (Number(args.a) || 0) * (Number(args.b) || 0);
        break;
      case 'evaluate':
        result = evaluateExpression(args.expression);
        break;
      default:
        send({
          ...responseBase,
          payload: {
            success: false,
            error: `Tool not found: ${toolName}`,
          },
        });
        return;
    }

    send({
      ...responseBase,
      payload: {
        success: true,
        result,
      },
    });
  } catch (error) {
    send({
      ...responseBase,
      payload: {
        success: false,
        error: error.message,
      },
    });
  }
}

function evaluateExpression(expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Invalid expression');
  }

  // Basic validation: allow numbers, operators, parentheses, whitespace
  if (!/^[-+*/()0-9.\s]+$/.test(expression)) {
    throw new Error('Expression contains unsupported characters');
  }

  const result = Function(`"use strict"; return (${expression})`)();
  if (Number.isFinite(result)) {
    return result;
  }
  return result.toString();
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'mcp/request') {
    handleRequest(envelope);
  }
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    appendLog(`ERROR ${error.message}`);
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
