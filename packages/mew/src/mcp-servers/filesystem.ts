#!/usr/bin/env node

/**
 * Filesystem MCP Server Wrapper
 *
 * Wraps @modelcontextprotocol/sdk to provide filesystem operations
 * via the Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

// Get the directory path from command line args
const targetPath = process.argv[2] || process.cwd();
const absolutePath = path.resolve(targetPath);

// Create MCP server
const server = new Server(
  {
    name: 'filesystem-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define filesystem tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_file',
        description: 'Read the complete contents of a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read (relative to allowed directory)',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file, creating it if it doesn\'t exist',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to write (relative to allowed directory)',
            },
            content: {
              type: 'string',
              description: 'Content to write to the file',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'list_directory',
        description: 'List the contents of a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the directory to list (relative to allowed directory)',
            },
          },
          required: ['path'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Resolve the path relative to the allowed directory
    const requestedPath = path.resolve(absolutePath, (args as { path?: string }).path || '.');

    // Security check: ensure the path is within the allowed directory
    if (!requestedPath.startsWith(absolutePath)) {
      throw new Error('Access denied: path is outside allowed directory');
    }

    switch (name) {
      case 'read_file': {
        const content = await fs.readFile(requestedPath, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      }

      case 'write_file': {
        const { content } = args as { path: string; content: string };
        await fs.writeFile(requestedPath, content, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `Successfully wrote to ${(args as { path: string }).path}`,
            },
          ],
        };
      }

      case 'list_directory': {
        const entries = await fs.readdir(requestedPath, { withFileTypes: true });
        const items = entries.map((entry) => {
          return `${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${entry.name}`;
        });
        return {
          content: [
            {
              type: 'text',
              text: items.join('\n'),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main(): Promise<void> {
  console.error(`Filesystem MCP server starting on: ${absolutePath}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Filesystem MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});