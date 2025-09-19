#!/usr/bin/env node
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'bridge-agent';

const tools = [
  {
    name: 'read_file',
    description: 'Read a file from the virtual filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files in the virtual filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
];

function send(envelope) {
  process.stdout.write(encodeEnvelope({ protocol: 'mew/v0.3', ...envelope }));
}

function handleRequest(envelope) {
  const id = envelope.id || `req-${Date.now()}`;
  const method = envelope.payload?.method;
  const params = envelope.payload?.params || {};

  if (method === 'tools/list') {
    send({
      kind: 'mcp/response',
      correlation_id: id,
      payload: {
        success: true,
        result: {
          tools,
        },
      },
    });
    return;
  }

  if (method === 'tools/call') {
    const name = params.name;
    const args = params.arguments || {};
    switch (name) {
      case 'read_file':
        send({
          kind: 'mcp/response',
          correlation_id: id,
          payload: {
            success: true,
            result: `Contents of ${args.path || 'unknown'}`,
          },
        });
        return;
      case 'list_directory':
        send({
          kind: 'mcp/response',
          correlation_id: id,
          payload: {
            success: true,
            result: ['file1.txt', 'file2.txt'],
          },
        });
        return;
      default:
        send({
          kind: 'mcp/response',
          correlation_id: id,
          payload: {
            success: false,
            error: `Bridge: unknown tool ${name}`,
          },
        });
        return;
    }
  }

  send({
    kind: 'mcp/response',
    correlation_id: id,
    payload: {
      success: false,
      error: `Bridge: unsupported method ${method}`,
    },
  });
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
    // ignore parse errors in bridge stub
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
