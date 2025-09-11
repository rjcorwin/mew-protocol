const { Command } = require('commander');
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const { spawn } = require('child_process');

const gateway = new Command('gateway').description('Gateway server management');

gateway
  .command('start')
  .description('Start a MEW gateway server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)', 'info')
  .option('-s, --space-config <path>', 'Path to space.yaml configuration', './space.yaml')
  .action(async (options) => {
    const port = parseInt(options.port);

    // If we're running as a detached process, redirect console output to a log file
    if (process.env.GATEWAY_LOG_FILE) {
      const fs = require('fs');
      const logStream = fs.createWriteStream(process.env.GATEWAY_LOG_FILE, { flags: 'a' });
      const originalLog = console.log;
      const originalError = console.error;

      console.log = function (...args) {
        const message = args.join(' ');
        logStream.write(`[${new Date().toISOString()}] ${message}\n`);
      };

      console.error = function (...args) {
        const message = args.join(' ');
        logStream.write(`[${new Date().toISOString()}] ERROR: ${message}\n`);
      };
    }

    console.log(`Starting MEW gateway on port ${port}...`);

    // Load space configuration (CLI responsibility, not gateway)
    let spaceConfig = null;
    try {
      const configPath = path.resolve(options.spaceConfig);
      const configContent = fs.readFileSync(configPath, 'utf8');
      spaceConfig = yaml.load(configContent);
      console.log(`Loaded space configuration from ${configPath}`);
      console.log(`Space ID: ${spaceConfig.space.id}`);
      console.log(`Participants configured: ${Object.keys(spaceConfig.participants).length}`);
    } catch (error) {
      console.error(`Failed to load space configuration: ${error.message}`);
      console.log('Continuing with default configuration...');
    }

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
        features: ['capabilities', 'context', 'validation', 'http-io'],
      });
    });

    // HTTP API for message injection
    app.post('/participants/:participantId/messages', (req, res) => {
      const { participantId } = req.params;
      const authHeader = req.headers.authorization;
      const spaceName = req.query.space || 'default';
      
      // Extract token from Authorization header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }
      
      const token = authHeader.substring(7);
      
      // Verify token matches participant
      const expectedToken = participantTokens.get(participantId);
      if (!expectedToken || expectedToken !== token) {
        return res.status(403).json({ error: 'Invalid token for participant' });
      }
      
      // Use configured space ID as default, or fallback to query param
      const actualSpaceName = spaceName === 'default' && spaceConfig?.space?.id 
        ? spaceConfig.space.id 
        : spaceName;
      
      // Get or create space
      let space = spaces.get(actualSpaceName);
      if (!space) {
        space = { participants: new Map() };
        spaces.set(actualSpaceName, space);
      }
      
      // Build complete envelope
      const envelope = {
        protocol: 'mew/v0.3',
        id: `http-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ts: new Date().toISOString(),
        from: participantId,
        ...req.body
      };
      
      // Validate capabilities (skip for now - participant is already authenticated)
      // TODO: Implement capability check for HTTP-injected messages
      
      // Broadcast message to space
      const envelopeStr = JSON.stringify(envelope);
      for (const [pid, ws] of space.participants) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(envelopeStr);
        }
      }
      
      res.json({
        id: envelope.id,
        status: 'accepted',
        timestamp: envelope.ts
      });
    });
    
    // List participants endpoint
    app.get('/participants', (req, res) => {
      const spaceName = req.query.space || 'default';
      const space = spaces.get(spaceName);
      
      if (!space) {
        return res.json({ participants: [] });
      }
      
      const participants = Array.from(space.participants.keys()).map(id => ({
        id,
        connected: space.participants.get(id).readyState === WebSocket.OPEN,
        capabilities: participantCapabilities.get(id) || []
      }));
      
      res.json({ participants });
    });

    // Create HTTP server
    const server = http.createServer(app);

    // Create WebSocket server
    const wss = new WebSocket.Server({ server });

    // Track spaces and participants
    const spaces = new Map(); // spaceId -> { participants: Map(participantId -> ws) }

    // Track participant info
    const participantTokens = new Map(); // participantId -> token
    const participantCapabilities = new Map(); // participantId -> capabilities array
    const runtimeCapabilities = new Map(); // participantId -> Map(grantId -> capabilities)

    // Track spawned processes
    const spawnedProcesses = new Map(); // participantId -> ChildProcess

    // Gateway hooks for external configuration
    let capabilityResolver = null;
    let participantJoinedCallback = null;
    let authorizationHook = null;

    // Set capability resolver hook
    gateway.setCapabilityResolver = function (resolver) {
      capabilityResolver = resolver;
    };

    // Set participant joined callback
    gateway.onParticipantJoined = function (callback) {
      participantJoinedCallback = callback;
    };

    // Set authorization hook
    gateway.setAuthorizationHook = function (hook) {
      authorizationHook = hook;
    };

    // Default capability resolver using space.yaml
    async function defaultCapabilityResolver(token, participantId, messageKind) {
      if (!spaceConfig) {
        // Fallback to basic defaults
        return [{ kind: 'chat' }];
      }

      // Find participant by token
      for (const [pid, config] of Object.entries(spaceConfig.participants)) {
        if (config.tokens && config.tokens.includes(token)) {
          return config.capabilities || spaceConfig.defaults?.capabilities || [];
        }
      }

      // Return default capabilities if no match
      return spaceConfig.defaults?.capabilities || [{ kind: 'chat' }];
    }

    // Use custom resolver if set, otherwise use default
    async function resolveCapabilities(token, participantId, messageKind) {
      if (capabilityResolver) {
        return await capabilityResolver(token, participantId, messageKind);
      }
      return await defaultCapabilityResolver(token, participantId, messageKind);
    }

    // Check if message matches capability pattern
    function matchesCapability(message, capability) {
      // Simple kind matching first
      if (capability.kind === '*') return true;

      // Wildcard pattern matching
      if (capability.kind && capability.kind.endsWith('/*')) {
        const prefix = capability.kind.slice(0, -2);
        if (message.kind && message.kind.startsWith(prefix + '/')) {
          // Check payload patterns if specified
          if (capability.payload) {
            return matchesPayloadPattern(message.payload, capability.payload);
          }
          return true;
        }
      }

      // Exact kind match
      if (capability.kind === message.kind) {
        // If capability has payload pattern, it must match
        if (capability.payload) {
          return matchesPayloadPattern(message.payload, capability.payload);
        }
        // No payload pattern means any payload is allowed
        return true;
      }

      return false;
    }

    // Match payload patterns (simplified version)
    function matchesPayloadPattern(payload, pattern) {
      if (!payload || !pattern) return false;

      for (const [key, value] of Object.entries(pattern)) {
        if (typeof value === 'string') {
          // Handle wildcards in strings
          if (value.endsWith('*')) {
            const prefix = value.slice(0, -1);
            if (!payload[key] || !payload[key].startsWith(prefix)) {
              return false;
            }
          } else if (payload[key] !== value) {
            return false;
          }
        } else if (typeof value === 'object') {
          // Recursive matching for nested objects
          if (!matchesPayloadPattern(payload[key], value)) {
            return false;
          }
        }
      }

      return true;
    }

    // Check if participant has capability for message
    async function hasCapabilityForMessage(participantId, message) {
      // Get static capabilities from config
      const staticCapabilities = participantCapabilities.get(participantId) || [];

      // Get runtime capabilities (granted dynamically)
      const runtimeCaps = runtimeCapabilities.get(participantId);
      const dynamicCapabilities = runtimeCaps ? Array.from(runtimeCaps.values()).flat() : [];

      // Merge static and dynamic capabilities
      const allCapabilities = [...staticCapabilities, ...dynamicCapabilities];

      if (options.logLevel === 'debug' && dynamicCapabilities.length > 0) {
        console.log(`Checking capabilities for ${participantId}:`, {
          static: staticCapabilities,
          dynamic: dynamicCapabilities,
          message: { kind: message.kind, payload: message.payload },
        });
      }

      // Check each capability pattern
      for (const cap of allCapabilities) {
        if (matchesCapability(message, cap)) {
          return true;
        }
      }

      return false;
    }

    // Register HTTP-only participants from config
    function registerHttpParticipants() {
      if (!spaceConfig || !spaceConfig.participants) return;
      
      for (const [participantId, config] of Object.entries(spaceConfig.participants)) {
        // Register tokens and capabilities for HTTP participants
        if (config.tokens && config.tokens.length > 0) {
          const token = config.tokens[0]; // Use first token
          participantTokens.set(participantId, token);
          participantCapabilities.set(participantId, config.capabilities || []);
          
          if (config.io === 'http') {
            console.log(`Registered HTTP participant: ${participantId}`);
          }
          
          // Auto-connect participants with output_log
          if (config.output_log && config.auto_connect) {
            console.log(`Auto-connecting participant with output log: ${participantId}`);
            autoConnectOutputLogParticipant(participantId, config);
          }
        }
      }
    }
    
    // Auto-connect a participant that writes to output_log
    function autoConnectOutputLogParticipant(participantId, config) {
      const fs = require('fs');
      const path = require('path');
      
      // Resolve output log path
      const outputPath = path.resolve(process.cwd(), config.output_log);
      const outputDir = path.dirname(outputPath);
      
      // Ensure directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Create a virtual WebSocket connection for this participant
      const virtualWs = {
        send: (data) => {
          // Write received messages to output log
          try {
            const message = typeof data === 'string' ? JSON.parse(data) : data;
            // Append to output log
            fs.appendFileSync(outputPath, JSON.stringify(message) + '\n');
          } catch (error) {
            console.error(`Error writing to output log for ${participantId}:`, error);
          }
        },
        readyState: WebSocket.OPEN,
        close: () => {},
      };
      
      // Get or create space - use the configured space ID
      const spaceId = spaceConfig.space.id || 'default';
      if (!spaces.has(spaceId)) {
        spaces.set(spaceId, { participants: new Map() });
      }
      
      // Register this virtual connection in the space
      const space = spaces.get(spaceId);
      space.participants.set(participantId, virtualWs);
      
      console.log(`${participantId} auto-connected with output to ${config.output_log}`);
    }

    // Auto-start agents with auto_start: true
    function autoStartAgents() {
      if (!spaceConfig || !spaceConfig.participants) return;

      for (const [participantId, config] of Object.entries(spaceConfig.participants)) {
        if (config.auto_start && config.command) {
          console.log(`Auto-starting agent: ${participantId}`);

          // Substitute ${PORT} in args
          const args = (config.args || []).map(arg => 
            arg.replace('${PORT}', port.toString())
          );

          const child = spawn(config.command, args, {
            env: { ...process.env, PORT: port.toString(), ...config.env },
            stdio: 'inherit',
          });

          spawnedProcesses.set(participantId, child);

          child.on('error', (error) => {
            console.error(`Failed to start ${participantId}:`, error);
          });

          child.on('exit', (code, signal) => {
            console.log(`${participantId} exited with code ${code}, signal ${signal}`);
            spawnedProcesses.delete(participantId);

            // Handle restart policy
            if (config.restart_policy === 'on-failure' && code !== 0) {
              console.log(`Restarting ${participantId} due to failure...`);
              setTimeout(() => autoStartAgents(), 5000);
            }
          });
        }
      }
    }

    // Validate message structure
    function validateMessage(message) {
      if (!message || typeof message !== 'object') {
        return 'Message must be an object';
      }

      // Protocol version check
      if (message.protocol && message.protocol !== 'mew/v0.3') {
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

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Validate message
          const validationError = validateMessage(message);
          if (validationError) {
            ws.send(
              JSON.stringify({
                protocol: 'mew/v0.3',
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
            spaceId =
              message.space || message.payload?.space || spaceConfig?.space?.id || 'default';
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

            // Store token and resolve capabilities
            participantTokens.set(participantId, token);
            const capabilities = await resolveCapabilities(token, participantId, null);
            participantCapabilities.set(participantId, capabilities);

            // Send welcome message per MEW v0.2 spec
            const welcomeMessage = {
              protocol: 'mew/v0.3',
              id: `welcome-${Date.now()}`,
              ts: new Date().toISOString(),
              from: 'system:gateway',
              to: [participantId],
              kind: 'system/welcome',
              payload: {
                you: {
                  id: participantId,
                  capabilities: capabilities,
                },
                participants: Array.from(space.participants.keys())
                  .filter((pid) => pid !== participantId)
                  .map((pid) => ({
                    id: pid,
                    capabilities: participantCapabilities.get(pid) || [],
                  })),
              },
            };

            ws.send(JSON.stringify(welcomeMessage));

            // Broadcast presence to others
            const presenceMessage = {
              protocol: 'mew/v0.3',
              id: `presence-${Date.now()}`,
              ts: new Date().toISOString(),
              from: 'system:gateway',
              kind: 'system/presence',
              payload: {
                event: 'join',
                participant: {
                  id: participantId,
                  capabilities: capabilities,
                },
              },
            };

            for (const [pid, pws] of space.participants.entries()) {
              if (pid !== participantId && pws.readyState === WebSocket.OPEN) {
                pws.send(JSON.stringify(presenceMessage));
              }
            }

            // Call participant joined callback if set
            if (participantJoinedCallback) {
              await participantJoinedCallback(participantId, token, {
                space: spaceId,
                capabilities: capabilities,
              });
            }

            console.log(`${participantId} joined space ${spaceId} with token ${token || 'none'}`);
            return;
          }

          // Check capabilities for non-join messages
          if (!(await hasCapabilityForMessage(participantId, message))) {
            const errorMessage = {
              protocol: 'mew/v0.3',
              id: `error-${Date.now()}`,
              ts: new Date().toISOString(),
              from: 'system:gateway',
              to: [participantId],
              kind: 'system/error',
              correlation_id: message.id ? [message.id] : undefined,
              payload: {
                error: 'capability_violation',
                attempted_kind: message.kind,
                your_capabilities: participantCapabilities.get(participantId) || [],
              },
            };

            ws.send(JSON.stringify(errorMessage));

            if (options.logLevel === 'debug') {
              console.log(`Capability denied for ${participantId}: ${message.kind}`);
            }
            return;
          }

          // Handle capability management messages
          if (message.kind === 'capability/grant') {
            // Check if sender has capability to grant capabilities
            const canGrant = await hasCapabilityForMessage(participantId, {
              kind: 'capability/grant',
            });
            if (!canGrant) {
              const errorMessage = {
                protocol: 'mew/v0.3',
                id: `error-${Date.now()}`,
                ts: new Date().toISOString(),
                from: 'system:gateway',
                to: [participantId],
                kind: 'system/error',
                correlation_id: message.id ? [message.id] : undefined,
                payload: {
                  error: 'capability_violation',
                  message: 'You do not have permission to grant capabilities',
                  attempted_kind: message.kind,
                },
              };
              ws.send(JSON.stringify(errorMessage));
              return;
            }

            const recipient = message.payload?.recipient;
            const grantCapabilities = message.payload?.capabilities || [];
            const grantId = message.id || `grant-${Date.now()}`;

            if (recipient && grantCapabilities.length > 0) {
              // Initialize runtime capabilities for recipient if needed
              if (!runtimeCapabilities.has(recipient)) {
                runtimeCapabilities.set(recipient, new Map());
              }

              // Store the granted capabilities
              const recipientCaps = runtimeCapabilities.get(recipient);
              recipientCaps.set(grantId, grantCapabilities);

              console.log(
                `Granted capabilities to ${recipient}: ${JSON.stringify(grantCapabilities)}`,
              );
              console.log(
                `Runtime capabilities for ${recipient}:`,
                Array.from(recipientCaps.entries()),
              );

              // Send acknowledgment to recipient
              const space = spaces.get(spaceId);
              const recipientWs = space?.participants.get(recipient);
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                const ackMessage = {
                  protocol: 'mew/v0.3',
                  id: `ack-${Date.now()}`,
                  ts: new Date().toISOString(),
                  from: 'system:gateway',
                  to: [recipient],
                  kind: 'capability/grant-ack',
                  correlation_id: [grantId],
                  payload: {
                    status: 'accepted',
                    grant_id: grantId,
                    capabilities: grantCapabilities,
                  },
                };
                recipientWs.send(JSON.stringify(ackMessage));
              }
            }
          } else if (message.kind === 'capability/revoke') {
            // Check if sender has capability to revoke capabilities
            const canRevoke = await hasCapabilityForMessage(participantId, {
              kind: 'capability/revoke',
            });
            if (!canRevoke) {
              const errorMessage = {
                protocol: 'mew/v0.3',
                id: `error-${Date.now()}`,
                ts: new Date().toISOString(),
                from: 'system:gateway',
                to: [participantId],
                kind: 'system/error',
                correlation_id: message.id ? [message.id] : undefined,
                payload: {
                  error: 'capability_violation',
                  message: 'You do not have permission to revoke capabilities',
                  attempted_kind: message.kind,
                },
              };
              ws.send(JSON.stringify(errorMessage));
              return;
            }

            const recipient = message.payload?.recipient;
            const grantIdToRevoke = message.payload?.grant_id;
            const capabilitiesToRevoke = message.payload?.capabilities;

            if (recipient) {
              const recipientCaps = runtimeCapabilities.get(recipient);

              if (recipientCaps) {
                if (grantIdToRevoke) {
                  // Revoke by grant ID
                  if (recipientCaps.has(grantIdToRevoke)) {
                    recipientCaps.delete(grantIdToRevoke);
                    console.log(`Revoked grant ${grantIdToRevoke} from ${recipient}`);
                  }
                } else if (capabilitiesToRevoke) {
                  // Revoke by capability patterns - remove all matching grants
                  for (const [grantId, caps] of recipientCaps.entries()) {
                    const remainingCaps = caps.filter((cap) => {
                      // Check if this capability should be revoked
                      for (const revokePattern of capabilitiesToRevoke) {
                        if (JSON.stringify(cap) === JSON.stringify(revokePattern)) {
                          return false; // Remove this capability
                        }
                      }
                      return true; // Keep this capability
                    });

                    if (remainingCaps.length === 0) {
                      recipientCaps.delete(grantId);
                    } else {
                      recipientCaps.set(grantId, remainingCaps);
                    }
                  }
                  console.log(
                    `Revoked capabilities from ${recipient}: ${JSON.stringify(capabilitiesToRevoke)}`,
                  );
                }

                // Clean up empty entries
                if (recipientCaps.size === 0) {
                  runtimeCapabilities.delete(recipient);
                }
              }
            }
          }

          // Add protocol envelope fields if missing
          const envelope = {
            protocol: message.protocol || 'mew/v0.3',
            id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ts: message.ts || new Date().toISOString(),
            from: participantId,
            ...message,
          };

          // Ensure correlation_id is always an array if present
          if (envelope.correlation_id && !Array.isArray(envelope.correlation_id)) {
            envelope.correlation_id = [envelope.correlation_id];
          }

          // Route message based on 'to' field
          if (spaceId && spaces.has(spaceId)) {
            const space = spaces.get(spaceId);

            if (envelope.to && Array.isArray(envelope.to)) {
              // Send to specific participants
              for (const targetId of envelope.to) {
                const targetWs = space.participants.get(targetId);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify(envelope));
                }
              }
            } else {
              // Broadcast to all participants
              for (const [pid, pws] of space.participants.entries()) {
                if (pws.readyState === WebSocket.OPEN) {
                  pws.send(JSON.stringify(envelope));
                }
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
              protocol: 'mew/v0.3',
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
          participantTokens.delete(participantId);
          participantCapabilities.delete(participantId);
          runtimeCapabilities.delete(participantId);

          // Broadcast leave presence
          const presenceMessage = {
            protocol: 'mew/v0.3',
            id: `presence-${Date.now()}`,
            ts: new Date().toISOString(),
            from: 'system:gateway',
            kind: 'system/presence',
            payload: {
              event: 'leave',
              participant: {
                id: participantId,
              },
            },
          };

          for (const [pid, pws] of space.participants.entries()) {
            if (pws.readyState === WebSocket.OPEN) {
              pws.send(JSON.stringify(presenceMessage));
            }
          }

          if (options.logLevel === 'debug') {
            console.log(`${participantId} disconnected from ${spaceId}`);
          }
        }
      });
    });

    // Start server
    server.listen(port, () => {
      console.log(`Gateway listening on port ${port}`);
      console.log(`Health endpoint: http://localhost:${port}/health`);
      console.log(`HTTP API: http://localhost:${port}/participants/{id}/messages`);
      console.log(`WebSocket endpoint: ws://localhost:${port}`);
      if (spaceConfig) {
        console.log(`Space configuration loaded: ${spaceConfig.space.name}`);
      }

      // Register HTTP participants and auto-start agents
      registerHttpParticipants();
      autoStartAgents();
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Shutting down gateway...');

      // Stop spawned processes
      for (const [pid, child] of spawnedProcesses.entries()) {
        console.log(`Stopping ${pid}...`);
        child.kill('SIGTERM');
      }

      // Close WebSocket server
      wss.close(() => {
        server.close(() => {
          process.exit(0);
        });
      });
    });

    // Handle SIGINT (Ctrl+C) as well
    process.on('SIGINT', () => {
      console.log('\nShutting down gateway...');

      // Stop spawned processes
      for (const [pid, child] of spawnedProcesses.entries()) {
        console.log(`Stopping ${pid}...`);
        child.kill('SIGTERM');
      }

      // Close WebSocket server
      wss.close(() => {
        server.close(() => {
          process.exit(0);
        });
      });
    });

    // Keep the process alive
    // The server.listen() callback doesn't prevent Node from exiting
    // When spawned with detached and stdio: ['ignore'], stdin is closed
    // Create an interval that won't be garbage collected
    const keepAlive = setInterval(() => {
      // This empty function keeps the event loop active
    }, 2147483647); // Maximum 32-bit signed integer (~24.8 days)

    // Make sure the interval is not optimized away
    keepAlive.unref = () => {};

    // Return a promise that never resolves to keep the process alive
    // This is needed when the gateway is started as a detached process
    return new Promise(() => {
      // This promise intentionally never resolves
    });
  });

module.exports = gateway;
