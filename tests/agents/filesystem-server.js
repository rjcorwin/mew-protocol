#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'file-server';
const rootDir = path.resolve(process.env.FS_ROOT || process.cwd());
const logPath = process.env.FS_LOG ? path.resolve(process.env.FS_LOG) : null;

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
  } catch (_) {
    // ignore logging errors in tests
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

function safeJoin(relativePath) {
  const target = path.resolve(rootDir, relativePath || '');
  if (!target.startsWith(rootDir)) {
    throw new Error('Path escapes root directory');
  }
  return target;
}

const tools = [
  {
    name: 'write_file',
    description: 'Write text content to a file path relative to the configured root directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files in a directory relative to the configured root directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', default: '.' },
      },
    },
  },
];

function sendSuccess({ correlationId, to, result }) {
  send({
    kind: 'mcp/response',
    correlation_id: correlationId ? [correlationId] : undefined,
    to,
    payload: {
      success: true,
      result,
    },
  });
}

function sendError({ correlationId, to, message }) {
  send({
    kind: 'mcp/response',
    correlation_id: correlationId ? [correlationId] : undefined,
    to,
    payload: {
      success: false,
      error: message,
    },
  });
}

function handleRequest(envelope) {
  if (envelope.to && !envelope.to.includes(participantId)) {
    return;
  }

  const { method, params = {} } = envelope.payload || {};
  const correlationId = envelope.id || envelope.correlation_id?.[0];
  const replyTo = envelope.from ? [envelope.from] : undefined;

  append(`REQUEST ${method} from ${envelope.from || 'unknown'}`);

  try {
    if (method === 'tools/list') {
      sendSuccess({
        correlationId,
        to: replyTo,
        result: { tools },
      });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: args = {} } = params;
      if (name === 'write_file') {
        const target = safeJoin(args.path || '');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, args.content || '');
        append(`WRITE ${target}`);
        sendSuccess({
          correlationId,
          to: replyTo,
          result: {
            message: `Wrote ${args.content?.length || 0} bytes to ${args.path}`,
          },
        });
        return;
      }

      if (name === 'list_directory') {
        const target = safeJoin(args.path || '.');
        const listing = fs.existsSync(target) ? fs.readdirSync(target) : [];
        append(`LIST ${target}`);
        sendSuccess({
          correlationId,
          to: replyTo,
          result: listing,
        });
        return;
      }

      throw new Error(`Unsupported tool: ${name}`);
    }

    throw new Error(`Unsupported method: ${method}`);
  } catch (error) {
    append(`ERROR ${error.message}`);
    sendError({
      correlationId,
      to: replyTo,
      message: error.message,
    });
  }
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
    append(`PARSE_ERROR ${error.message}`);
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
