const { Command } = require('commander');
const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const gateway = new Command('gateway').description('Gateway server management');

gateway
  .command('start')
  .description('Start a MEW gateway server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)', 'info')
  .action(async (options) => {
    const port = parseInt(options.port);
    console.log(`Starting Enhanced MEW gateway on port ${port}...`);

    // Create Express app for health endpoint
    const app = express();
    app.use(express.json());

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        spaces: spaces.size,
        clients: Array.from(spaces.values()).reduce(
          (sum, space) => sum + space.participants.size,
          0,
        ),
        uptime: process.uptime(),
        features: ['capabilities', 'context', 'validation'],
      });
    });

    // Create HTTP server
    const server = http.createServer(app);

    // Create WebSocket server
    const wss = new WebSocket.Server({ server });

    // Track spaces and participants
    const spaces = new Map(); // spaceId -> { participants: Map(participantId -> ws) }

    // Track participant capabilities
    const capabilities = new Map(); // participantId -> Set of capability patterns

    // Track context stacks
    const contextStacks = new Map(); // participantId -> array of context objects

    // Default capabilities by token type
    const defaultCapabilities = {
      'admin-token': ['*'], // All capabilities
      'calculator-token': ['mcp/*', 'chat'],
      'fulfiller-token': ['mcp/*', 'chat', 'proposal/accept'],
      'proposer-token': ['chat', 'mcp/proposal'], // Can only chat and propose
      'limited-token': ['chat'], // Very limited
      'echo-token': ['chat'],
      'research-token': ['chat', 'context/*', 'mcp/*'],
    };

    // Check if participant has capability
    function hasCapability(participantId, requiredCapability) {
      const participantCaps = capabilities.get(participantId);
      if (!participantCaps) return false;

      // Check each capability pattern
      for (const pattern of participantCaps) {
        if (pattern === '*') return true; // Wildcard - all capabilities
        if (pattern === requiredCapability) return true; // Exact match

        // Wildcard pattern matching (e.g., 'mcp/*' matches 'mcp/request')
        if (pattern.endsWith('/*')) {
          const prefix = pattern.slice(0, -2);
          if (requiredCapability.startsWith(prefix + '/')) return true;
        }
      }

      return false;
    }

    // Get required capability for a message kind
    function getRequiredCapability(kind) {
      const capabilityMap = {
        'mcp/request': 'mcp/request',
        'mcp/response': 'mcp/response',
        'mcp/proposal': 'mcp/proposal',
        'capability/grant': 'capability/admin',
        'capability/revoke': 'capability/admin',
        'context/push': 'context/push',
        'context/pop': 'context/pop',
        chat: 'chat',
      };

      return capabilityMap[kind] || null;
    }

    // Validate message structure
    function validateMessage(message) {
      if (!message || typeof message !== 'object') {
        return 'Message must be an object';
      }

      // Protocol version check
      if (message.protocol && message.protocol !== 'mew/v0.4') {
        return `Invalid protocol version: ${message.protocol}`;
      }

      // Check required fields based on kind
      if (message.kind === 'chat' && !message.payload?.text) {
        return 'Chat message requires payload.text';
      }

      if (message.kind === 'mcp/request' && !message.payload?.method) {
        return 'MCP request requires payload.method';
      }

      return null; // Valid
    }

    // Handle WebSocket connections
    wss.on('connection', (ws, req) => {
      let participantId = null;
      let spaceId = null;

      if (options.logLevel === 'debug') {
        console.log('New WebSocket connection');
      }

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Validate message
          const validationError = validateMessage(message);
          if (validationError) {
            ws.send(
              JSON.stringify({
                protocol: 'mew/v0.4',
                kind: 'system/error',
                payload: {
                  error: validationError,
                  code: 'VALIDATION_ERROR',
                },
              }),
            );
            return;
          }

          // Handle join (special case - before capability check)
          if (message.kind === 'system/join' || message.type === 'join') {
            participantId =
              message.participantId ||
              message.payload?.participantId ||
              `participant-${Date.now()}`;
            spaceId = message.space || message.payload?.space || 'default';
            const token = message.token || message.payload?.token;

            // Create space if it doesn't exist
            if (!spaces.has(spaceId)) {
              spaces.set(spaceId, { participants: new Map() });
            }

            // Add participant to space
            const space = spaces.get(spaceId);
            space.participants.set(participantId, ws);
            ws.participantId = participantId;
            ws.spaceId = spaceId;

            // Set capabilities based on token
            const capabilitySet = new Set(defaultCapabilities[token] || ['chat']);
            capabilities.set(participantId, capabilitySet);

            // Initialize context stack
            contextStacks.set(participantId, []);

            // Send welcome message with capabilities
            ws.send(
              JSON.stringify({
                protocol: 'mew/v0.4',
                kind: 'system/welcome',
                payload: {
                  participantId,
                  space: spaceId,
                  capabilities: Array.from(capabilitySet),
                },
              }),
            );

            console.log(`${participantId} joined space ${spaceId} with token ${token || 'none'}`);
            return;
          }

          // Check capabilities for non-join messages
          const requiredCapability = getRequiredCapability(message.kind);
          if (requiredCapability && !hasCapability(participantId, requiredCapability)) {
            ws.send(
              JSON.stringify({
                protocol: 'mew/v0.4',
                kind: 'system/error',
                payload: {
                  error: `Insufficient capability: ${requiredCapability} required`,
                  code: 'CAPABILITY_DENIED',
                },
              }),
            );
            if (options.logLevel === 'debug') {
              console.log(`Capability denied for ${participantId}: ${requiredCapability}`);
            }
            return;
          }

          // Handle capability management
          if (message.kind === 'capability/grant') {
            handleCapabilityGrant(message, ws, participantId, spaces, capabilities, options);
            return;
          } else if (message.kind === 'capability/revoke') {
            handleCapabilityRevoke(message, ws, participantId, spaces, capabilities, options);
            return;
          }

          // Handle context management
          if (message.kind === 'context/push') {
            handleContextPush(message, ws, participantId, contextStacks, spaces, options);
            return;
          } else if (message.kind === 'context/pop') {
            handleContextPop(message, ws, participantId, contextStacks, spaces, options);
            return;
          }

          // Route regular messages to all participants in space
          if (spaceId && spaces.has(spaceId)) {
            const space = spaces.get(spaceId);

            // Add context correlation if in a context
            const contextStack = contextStacks.get(participantId) || [];
            const correlationId =
              contextStack.length > 0
                ? contextStack[contextStack.length - 1].correlationId
                : message.correlation_id;

            const envelope = {
              protocol: 'mew/v0.4',
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              ts: new Date().toISOString(),
              from: participantId,
              ...message,
            };

            // Preserve correlation_id if in context
            if (correlationId) {
              envelope.correlation_id = Array.isArray(correlationId)
                ? correlationId
                : [correlationId];
            }

            // Broadcast to all participants in the space
            for (const [pid, pws] of space.participants.entries()) {
              if (pws.readyState === WebSocket.OPEN) {
                pws.send(JSON.stringify(envelope));
              }
            }

            if (options.logLevel === 'debug') {
              console.log(`Message from ${participantId} in ${spaceId}:`, message.kind);
            }
          }
        } catch (error) {
          console.error('Error handling message:', error);
          ws.send(
            JSON.stringify({
              protocol: 'mew/v0.4',
              kind: 'system/error',
              payload: {
                error: error.message,
                code: 'PROCESSING_ERROR',
              },
            }),
          );
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      ws.on('close', () => {
        if (participantId && spaceId && spaces.has(spaceId)) {
          const space = spaces.get(spaceId);
          space.participants.delete(participantId);
          capabilities.delete(participantId);
          contextStacks.delete(participantId);

          if (options.logLevel === 'debug') {
            console.log(`${participantId} disconnected from ${spaceId}`);
          }
        }
      });
    });

    // Start server
    server.listen(port, () => {
      console.log(`Enhanced Gateway listening on port ${port}`);
      console.log(`Health endpoint: http://localhost:${port}/health`);
      console.log(`WebSocket endpoint: ws://localhost:${port}`);
      console.log('Features: Capability enforcement, Context management, Message validation');
    });
  });

// Handle capability grant
function handleCapabilityGrant(message, ws, fromParticipant, spaces, capabilities, options) {
  // Check admin permission
  if (!hasCapability(fromParticipant, 'capability/admin')) {
    ws.send(
      JSON.stringify({
        protocol: 'mew/v0.4',
        kind: 'system/error',
        payload: {
          error: 'Not authorized to grant capabilities',
          code: 'UNAUTHORIZED',
        },
      }),
    );
    return;
  }

  const targetParticipant = message.payload?.to;
  const newCapabilities = message.payload?.capabilities || [];

  // Add capabilities
  const targetCaps = capabilities.get(targetParticipant) || new Set();
  for (const cap of newCapabilities) {
    targetCaps.add(cap);
  }
  capabilities.set(targetParticipant, targetCaps);

  // Find and notify target
  for (const space of spaces.values()) {
    const targetWs = space.participants.get(targetParticipant);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(
        JSON.stringify({
          protocol: 'mew/v0.4',
          kind: 'capability/granted',
          from: fromParticipant,
          payload: {
            capabilities: newCapabilities,
          },
        }),
      );
      break;
    }
  }

  if (options.logLevel === 'debug') {
    console.log(`Granted capabilities to ${targetParticipant}:`, newCapabilities);
  }
}

// Handle capability revoke
function handleCapabilityRevoke(message, ws, fromParticipant, spaces, capabilities, options) {
  // Check admin permission
  if (!hasCapability(fromParticipant, 'capability/admin')) {
    ws.send(
      JSON.stringify({
        protocol: 'mew/v0.4',
        kind: 'system/error',
        payload: {
          error: 'Not authorized to revoke capabilities',
          code: 'UNAUTHORIZED',
        },
      }),
    );
    return;
  }

  const targetParticipant = message.payload?.from;
  const revokeCapabilities = message.payload?.capabilities || [];

  // Remove capabilities
  const targetCaps = capabilities.get(targetParticipant);
  if (targetCaps) {
    for (const cap of revokeCapabilities) {
      targetCaps.delete(cap);
    }
  }

  // Find and notify target
  for (const space of spaces.values()) {
    const targetWs = space.participants.get(targetParticipant);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(
        JSON.stringify({
          protocol: 'mew/v0.4',
          kind: 'capability/revoked',
          from: fromParticipant,
          payload: {
            capabilities: revokeCapabilities,
          },
        }),
      );
      break;
    }
  }

  if (options.logLevel === 'debug') {
    console.log(`Revoked capabilities from ${targetParticipant}:`, revokeCapabilities);
  }
}

// Handle context push
function handleContextPush(message, ws, participantId, contextStacks, spaces, options) {
  const stack = contextStacks.get(participantId) || [];
  const newContext = {
    correlationId: message.correlation_id || `ctx-${Date.now()}`,
    topic: message.payload?.topic,
    pushedAt: new Date().toISOString(),
  };

  stack.push(newContext);
  contextStacks.set(participantId, stack);

  // Broadcast context push to space
  if (ws.spaceId && spaces.has(ws.spaceId)) {
    const space = spaces.get(ws.spaceId);
    const envelope = {
      protocol: 'mew/v0.4',
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ts: new Date().toISOString(),
      from: participantId,
      kind: 'context/push',
      correlation_id: newContext.correlationId,
      payload: message.payload,
    };

    for (const [pid, pws] of space.participants.entries()) {
      if (pws.readyState === WebSocket.OPEN) {
        pws.send(JSON.stringify(envelope));
      }
    }
  }

  if (options.logLevel === 'debug') {
    console.log(`Context pushed by ${participantId}:`, newContext);
  }
}

// Handle context pop
function handleContextPop(message, ws, participantId, contextStacks, spaces, options) {
  const stack = contextStacks.get(participantId) || [];

  if (stack.length === 0) {
    ws.send(
      JSON.stringify({
        protocol: 'mew/v0.4',
        kind: 'system/error',
        payload: {
          error: 'No context to pop',
          code: 'CONTEXT_EMPTY',
        },
      }),
    );
    return;
  }

  const poppedContext = stack.pop();

  // Broadcast context pop to space
  if (ws.spaceId && spaces.has(ws.spaceId)) {
    const space = spaces.get(ws.spaceId);
    const envelope = {
      protocol: 'mew/v0.4',
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ts: new Date().toISOString(),
      from: participantId,
      kind: 'context/pop',
      correlation_id: poppedContext.correlationId,
      payload: {
        topic: poppedContext.topic,
      },
    };

    for (const [pid, pws] of space.participants.entries()) {
      if (pws.readyState === WebSocket.OPEN) {
        pws.send(JSON.stringify(envelope));
      }
    }
  }

  if (options.logLevel === 'debug') {
    console.log(`Context popped by ${participantId}:`, poppedContext);
  }
}

// Helper to check if participant has a capability
function hasCapability(participantId, requiredCapability) {
  const participantCaps = capabilities.get(participantId);
  if (!participantCaps) return false;

  for (const pattern of participantCaps) {
    if (pattern === '*') return true;
    if (pattern === requiredCapability) return true;

    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (requiredCapability.startsWith(prefix + '/')) return true;
    }
  }

  return false;
}

module.exports = gateway;
