#!/usr/bin/env node
/**
 * Minimal MCP filesystem server for Scenario 7 tests.
 * Implements tools/list and tools/call for read_file and list_directory.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const baseDir = path.resolve(process.argv[2] || process.cwd());

const tools = [
  {
    name: 'read_file',
    description: 'Read a UTF-8 file relative to the workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file to read' }
      },
      required: ['path']
    }
  },
  {
    name: 'list_directory',
    description: 'List entries in a directory relative to the workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to list' }
      },
      required: ['path']
    }
  }
];

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendResponse(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function resolveWithinBase(targetPath) {
  const resolved = path.resolve(baseDir, targetPath || '.');
  if (!resolved.startsWith(baseDir)) {
    throw new Error('Path resolves outside of workspace');
  }
  return resolved;
}

async function handleToolCall(name, args) {
  switch (name) {
    case 'read_file': {
      const target = resolveWithinBase(args?.path);
      const data = await fs.promises.readFile(target, 'utf8');
      return {
        content: [
          {
            type: 'text',
            text: data
          }
        ]
      };
    }
    case 'list_directory': {
      const target = resolveWithinBase(args?.path);
      const entries = await fs.promises.readdir(target, { withFileTypes: true });
      const lines = entries.map((entry) => {
        const suffix = entry.isDirectory() ? '/' : '';
        return `${entry.name}${suffix}`;
      });
      return {
        content: [
          {
            type: 'text',
            text: lines.join('\n')
          }
        ]
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleRequest(message) {
  const { id, method, params } = message;
  try {
    switch (method) {
      case 'initialize': {
        sendResponse(id, {
          protocolVersion: '0.1.0',
          serverInfo: {
            name: 'scenario-7-filesystem',
            version: '0.1.0'
          },
          capabilities: {
            tools: {
              listChanged: true
            }
          }
        });
        break;
      }
      case 'tools/list': {
        sendResponse(id, { tools });
        break;
      }
      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        const result = await handleToolCall(toolName, toolArgs);
        sendResponse(id, result);
        break;
      }
      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    sendError(id, -32000, messageText);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  if (!line.trim()) {
    return;
  }
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    console.error('Failed to parse MCP input:', error);
    return;
  }

  if (message.id !== undefined && message.method) {
    handleRequest(message);
  }
  // Ignore notifications for this minimal server.
});

rl.on('close', () => {
  process.exit(0);
});
