#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rootArg = process.argv[2];
const ROOT = rootArg ? path.resolve(rootArg) : process.cwd();

function normalizePath(p) {
  if (!p) return ROOT;
  if (p.startsWith('/private/tmp/')) {
    return path.join('/tmp', p.slice('/private/tmp/'.length));
  }
  return path.resolve(ROOT, path.isAbsolute(p) ? path.relative(ROOT, p) : p);
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    return;
  }

  if (message.id !== undefined && message.method) {
    handleRequest(message);
  } else if (message.method) {
    handleNotification(message);
  }
});

function handleNotification(_notification) {
  // No-op for now
}

function handleRequest(message) {
  const { id, method, params } = message;
  try {
    switch (method) {
      case 'initialize': {
        send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '0.1.0',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'local-filesystem-stub',
              version: '0.1.0',
            },
          },
        });
        break;
      }
      case 'tools/list': {
        send({
          jsonrpc: '2.0',
          id,
          result: {
            tools: [
              {
                name: 'read_text_file',
                description: 'Read a UTF-8 text file from disk',
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
                description: 'List files within a directory',
                inputSchema: {
                  type: 'object',
                  properties: {
                    path: { type: 'string' },
                  },
                  required: ['path'],
                },
              },
            ],
          },
        });
        break;
      }
      case 'tools/call': {
        const toolName = params?.name;
        if (toolName === 'read_text_file') {
          const targetPath = normalizePath(params?.arguments?.path);
          const content = fs.readFileSync(targetPath, 'utf8');
          send({
            jsonrpc: '2.0',
            id,
            result: {
              content,
            },
          });
        } else if (toolName === 'list_directory') {
          const targetPath = normalizePath(params?.arguments?.path);
          const entries = fs.readdirSync(targetPath, { withFileTypes: true });
          send({
            jsonrpc: '2.0',
            id,
            result: {
              items: entries.map((entry) => ({
                name: entry.name,
                kind: entry.isDirectory() ? 'directory' : 'file',
              })),
            },
          });
        } else {
          throw new Error(`Unknown tool: ${toolName}`);
        }
        break;
      }
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  } catch (error) {
    send({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message || 'Internal error',
      },
    });
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
