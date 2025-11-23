// @ts-nocheck
import { Command } from 'commander';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import http from 'http';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

const gateway = new Command('gateway').description('Gateway server management');

gateway
  .command('start')
  .description('Start a MEW gateway server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)', 'info')
  .option('-s, --space-config <path>', 'Path to space.yaml configuration', './space.yaml')
  .option('--no-auto-start', 'Disable auto-starting participants defined in the space configuration')
  .action(async (options) => {
    const port = parseInt(options.port);
    const configPath = path.resolve(options.spaceConfig);
    const spaceDir = path.dirname(configPath);
    const mewDir = fs.existsSync(path.join(spaceDir, '.mew'))
      ? path.join(spaceDir, '.mew')
      : spaceDir;
    const logsDir = path.join(mewDir, 'logs');

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
    let tokenMap = new Map(); // Map of participantId -> token

    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      spaceConfig = yaml.load(configContent);
      console.log(`Loaded space configuration from ${configPath}`);
      console.log(`Space ID: ${spaceConfig.space.id}`);
      console.log(`Participants configured: ${Object.keys(spaceConfig.participants).length}`);

      // Load tokens from secure storage
      const tokensDir = path.join(mewDir, 'tokens');

      // Load tokens for all participants
      for (const participantId of Object.keys(spaceConfig.participants)) {
        const tokenPath = path.join(tokensDir, `${participantId}.token`);

        // Check environment variable override first
        const envVarName = `MEW_TOKEN_${participantId.toUpperCase().replace(/-/g, '_')}`;
        if (process.env[envVarName]) {
          tokenMap.set(participantId, process.env[envVarName]);
          console.log(`Loaded token for ${participantId} from environment variable`);
        } else if (fs.existsSync(tokenPath)) {
          // Load from file
          const token = fs.readFileSync(tokenPath, 'utf8').trim();
          tokenMap.set(participantId, token);
          console.log(`Loaded token for ${participantId} from secure storage`);
        } else {
          // Generate new token if not found
          const token = crypto.randomBytes(32).toString('base64url');

          // Ensure tokens directory exists
          if (!fs.existsSync(tokensDir)) {
            fs.mkdirSync(tokensDir, { recursive: true, mode: 0o700 });
            // Create .gitignore in tokens directory
            const tokenGitignore = path.join(tokensDir, '.gitignore');
            fs.writeFileSync(tokenGitignore, '*\n!.gitignore\n', { mode: 0o600 });
          }

          fs.writeFileSync(tokenPath, token, { mode: 0o600 });
          tokenMap.set(participantId, token);
          console.log(`Generated new token for ${participantId}`);
        }
      }
    } catch (error) {
      console.error(`Failed to load space configuration: ${error.message}`);
      console.log('Continuing with default configuration...');
    }

    const gatewayLogger = createGatewayLogger({
      logsDir,
      config: spaceConfig?.gateway_logging,
      env: process.env,
      logger: console,
    });
    const { logEnvelopeEvent, logCapabilityDecision } = gatewayLogger;

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
    app.post('/participants/:participantId/messages', async (req, res) => {
      const { participantId } = req.params;
      const authHeader = req.headers.authorization;
      const spaceName = req.query.space || 'default';
      
      // Extract token from Authorization header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }
      
      const token = authHeader.substring(7);

      // Verify token matches participant (check both runtime and config tokens)
      const expectedToken = participantTokens.get(participantId) || tokenMap.get(participantId);
      if (!expectedToken || expectedToken !== token) {
        return res.status(403).json({ error: 'Invalid token for participant' });
      }

      // Ensure participant has capabilities loaded from config
      if (!participantCapabilities.has(participantId) && spaceConfig?.participants?.[participantId]) {
        const capabilities = ensureBaselineCapabilities(
          spaceConfig.participants[participantId].capabilities || []
        );
        participantCapabilities.set(participantId, capabilities);
      }

      // Use configured space ID as default, or fallback to query param
      const actualSpaceName = spaceName === 'default' && spaceConfig?.space?.id 
        ? spaceConfig.space.id 
        : spaceName;
      
      // Get or create space
      let space = spaces.get(actualSpaceName);
      if (!space) {
        space = {
          participants: new Map(),
          streamCounter: 0,
          activeStreams: new Map()
        };
        spaces.set(actualSpaceName, space);
      }

      // Lazy auto-connect: if participant has output_log but not connected yet, connect them now
      if (spaceConfig && spaceConfig.participants && spaceConfig.participants[participantId]) {
        const participantConfig = spaceConfig.participants[participantId];
        if (participantConfig.output_log && !space.participants.has(participantId)) {
          if (options.logLevel === 'debug') {
            console.log(`[HTTP] Lazy auto-connecting ${participantId} on first message`);
          }
          autoConnectOutputLogParticipant(participantId, participantConfig);
        }
      }

      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Request body must be a JSON object' });
      }

      const { kind } = req.body;
      if (typeof kind !== 'string' || kind.trim() === '') {
        return res.status(400).json({ error: 'Message kind is required' });
      }

      // Build complete envelope
      const envelope = {
        protocol: 'mew/v0.4',
        id: `http-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        ts: new Date().toISOString(),
        from: participantId,
        ...req.body
      };

      logEnvelopeEvent({
        event: 'received',
        id: envelope.id,
        envelope,
        participant: participantId,
        space_id: actualSpaceName,
        direction: 'inbound',
        transport: 'http',
      });

      const emitError = (payload) => {
        const errorEnvelope = {
          protocol: 'mew/v0.4',
          id: `error-${Date.now()}`,
          ts: new Date().toISOString(),
          from: 'system:gateway',
          to: [participantId],
          kind: 'system/error',
          correlation_id: envelope.id ? [envelope.id] : undefined,
          payload,
        };

        const participantSocket = space.participants.get(participantId);
        if (participantSocket && participantSocket.readyState === WebSocket.OPEN) {
          participantSocket.send(JSON.stringify(errorEnvelope));
          logEnvelopeEvent({
            event: 'delivered',
            id: errorEnvelope.id,
            envelope: errorEnvelope,
            participant: participantId,
            space_id: actualSpaceName,
            direction: 'outbound',
            transport: 'websocket',
            metadata: {
              reason: payload?.error || 'unknown',
              source_envelope: envelope.id,
            },
          });
        }
      };

      if (envelope.kind === 'system/register') {
        emitError({
          error: 'invalid_request',
          message: 'system/register is reserved for the gateway. Use capability/grant instead.',
        });
        return res.status(400).json({
          error: 'invalid_request',
          message: 'system/register is reserved for the gateway. Use capability/grant instead.',
        });
      }

      if (
        !(await hasCapabilityForMessage(participantId, envelope, {
          source: 'http_api',
          spaceId: actualSpaceName,
          transport: 'http',
        }))
      ) {
        emitError({
          error: 'capability_violation',
          attempted_kind: envelope.kind,
          your_capabilities: participantCapabilities.get(participantId) || [],
        });
        logEnvelopeEvent({
          event: 'rejected',
          id: envelope.id,
          envelope,
          participant: participantId,
          space_id: actualSpaceName,
          direction: 'inbound',
          transport: 'http',
          metadata: {
            reason: 'capability_violation',
          },
        });
        return res.status(403).json({
          error: 'capability_violation',
          message: `Participant ${participantId} lacks capability for ${envelope.kind}`,
        });
      }

      // Handle capability/grant messages before broadcasting
      if (envelope.kind === 'capability/grant') {
        const recipient = envelope.payload?.recipient;
        const grantCapabilities = envelope.payload?.capabilities || [];
        const grantId = envelope.id || `grant-${Date.now()}`;

        if (recipient && grantCapabilities.length > 0) {
          // Resolve logical participant name to actual runtime client ID
          let recipientWs = null;
          let recipientClientId = null;

          // Find recipient by matching token (logical name -> token -> runtime client ID)
          const recipientToken = tokenMap.get(recipient);
          if (recipientToken) {
            for (const [pid, ws] of space.participants) {
              const pToken = participantTokens.get(pid);
              if (pToken === recipientToken) {
                recipientWs = ws;
                recipientClientId = pid;
                break;
              }
            }
          }

          // Store capabilities under runtime client ID
          if (recipientClientId) {
            // Initialize runtime capabilities for recipient if needed
            if (!runtimeCapabilities.has(recipientClientId)) {
              runtimeCapabilities.set(recipientClientId, new Map());
            }

            // Store the granted capabilities under runtime client ID
            const recipientCaps = runtimeCapabilities.get(recipientClientId);
            recipientCaps.set(grantId, grantCapabilities);

            console.log(
              `[HTTP] Granted capabilities to ${recipient} (${recipientClientId}): ${JSON.stringify(grantCapabilities)}`,
            );
            console.log(
              `[HTTP] Runtime capabilities for ${recipientClientId}:`,
              Array.from(recipientCaps.entries()),
            );

            // Send updated welcome message to recipient
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              const staticCapabilities = participantCapabilities.get(recipientClientId) || [];
              const runtimeCaps = runtimeCapabilities.get(recipientClientId);
              const dynamicCapabilities = runtimeCaps ? Array.from(runtimeCaps.values()).flat() : [];
              const updatedCapabilities = [...staticCapabilities, ...dynamicCapabilities];

              const updatedWelcomeMessage = {
                protocol: 'mew/v0.4',
                id: `welcome-update-${Date.now()}`,
                ts: new Date().toISOString(),
                from: 'system:gateway',
                to: [recipientClientId],
                kind: 'system/welcome',
                payload: {
                  you: {
                    id: recipientClientId,
                    capabilities: updatedCapabilities,
                  },
                  participants: Array.from(space.participants.keys())
                    .filter((pid) => pid !== recipientClientId)
                    .map((pid) => {
                      const otherStatic = participantCapabilities.get(pid) || [];
                      const otherRuntime = runtimeCapabilities.get(pid);
                      const otherDynamic = otherRuntime ? Array.from(otherRuntime.values()).flat() : [];
                      return {
                        id: pid,
                        capabilities: [...otherStatic, ...otherDynamic],
                      };
                    }),
                },
              };
              recipientWs.send(JSON.stringify(updatedWelcomeMessage));
              logEnvelopeEvent({
                event: 'delivered',
                id: updatedWelcomeMessage.id,
                envelope: updatedWelcomeMessage,
                participant: recipientClientId,
                space_id: actualSpaceName,
                direction: 'outbound',
                transport: 'websocket',
                metadata: {
                  type: 'system/welcome',
                  reason: 'capability_grant_update',
                  source_participant: participantId,
                },
              });
              console.log(`[HTTP] Sent updated welcome message to ${recipient} (${recipientClientId}) with ${updatedCapabilities.length} total capabilities`);
            }
          } else {
            console.error(`[HTTP] Failed to resolve logical name ${recipient} to runtime client ID`);
          }
        }
      }

      // Handle stream/request - gateway must respond with stream/open
      if (envelope.kind === 'stream/request') {
        // Generate unique stream ID
        space.streamCounter++;
        const streamId = `stream-${space.streamCounter}`;

        // Track the stream
        space.activeStreams.set(streamId, {
          requestId: envelope.id,
          participantId: participantId,
          direction: envelope.payload?.direction || 'unknown',
          created: new Date().toISOString()
        });

        // Send stream/open response
        const streamOpenResponse = {
          protocol: 'mew/v0.4',
          id: `stream-open-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ts: new Date().toISOString(),
          from: 'gateway',
          to: [participantId],
          kind: 'stream/open',
          correlation_id: [envelope.id],
          payload: {
            stream_id: streamId,
            encoding: 'text'
          }
        };

        // Broadcast stream/open to ALL participants (MEW Protocol visibility)
        for (const [pid, ws] of space.participants.entries()) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(streamOpenResponse));
            logEnvelopeEvent({
              event: 'delivered',
              id: streamOpenResponse.id,
              envelope: streamOpenResponse,
              participant: pid,
              space_id: actualSpaceName,
              direction: 'outbound',
              transport: 'websocket',
              metadata: {
                type: 'stream/open',
                source_participant: participantId,
                stream_id: streamId,
              },
            });
          }
        }

        if (options.logLevel === 'debug') {
          console.log(`[HTTP] Assigned stream ID ${streamId} for request from ${participantId}`);
        }

        // Return HTTP response
        return res.json({
          id: streamOpenResponse.id,
          status: 'stream_opened',
          stream_id: streamId,
          timestamp: streamOpenResponse.ts
        });
      }

      // Handle stream/close - clean up active streams
      if (envelope.kind === 'stream/close' && envelope.payload?.stream_id) {
        const streamId = envelope.payload.stream_id;
        if (space.activeStreams.has(streamId)) {
          space.activeStreams.delete(streamId);
          if (options.logLevel === 'debug') {
            console.log(`[HTTP] Closed stream ${streamId}`);
          }
        }
      }

      // Broadcast message to space
      const envelopeStr = JSON.stringify(envelope);
      for (const [pid, ws] of space.participants) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(envelopeStr);
          logEnvelopeEvent({
            event: 'delivered',
            id: envelope.id,
            envelope,
            participant: pid,
            space_id: actualSpaceName,
            direction: 'outbound',
            transport: 'websocket',
            metadata: {
              source_participant: participantId,
            },
          });
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
    const wss = new WebSocketServer({ server });

    // Track spaces and participants
    const spaces = new Map(); // spaceId -> { participants: Map(participantId -> ws), streamCounter: number, activeStreams: Map }

    // Track participant info
    const participantTokens = new Map(); // participantId -> token
    const participantCapabilities = new Map(); // participantId -> capabilities array
    const runtimeCapabilities = new Map(); // participantId -> Map(grantId -> capabilities)

    function serializeCapability(capability) {
      if (!capability || typeof capability !== 'object') {
        return null;
      }

      const normalized = {};
      for (const key of Object.keys(capability).sort()) {
        normalized[key] = capability[key];
      }

      try {
        return JSON.stringify(normalized);
      } catch (error) {
        if (options.logLevel === 'debug') {
          console.log('Failed to serialize capability for dedupe', capability, error);
        }
        return null;
      }
    }

    function ensureBaselineCapabilities(capabilities = []) {
      const deduped = new Map();

      for (const cap of capabilities) {
        if (!cap || typeof cap !== 'object' || typeof cap.kind !== 'string') {
          continue;
        }

        const key = serializeCapability(cap);
        if (key) {
          deduped.set(key, cap);
        }
      }

      const ensure = (capability) => {
        if (!capability || typeof capability.kind !== 'string') {
          return;
        }
        const key = serializeCapability(capability);
        if (key && !deduped.has(key)) {
          deduped.set(key, capability);
        }
      };

      ensure({ id: 'mcp-response', kind: 'mcp/response' });

      return Array.from(deduped.values());
    }

    function mergeCapabilities(current = [], requested = []) {
      return ensureBaselineCapabilities([...(current || []), ...(requested || [])]);
    }

    function resolveEnvVariables(envObj = {}) {
      const resolved = {};
      for (const [key, value] of Object.entries(envObj || {})) {
        if (typeof value === 'string') {
          resolved[key] = value.replace(/\$\{([^}]+)\}/g, (match, varName) =>
            process.env[varName] || match,
          );
        } else {
          resolved[key] = value;
        }
      }
      return resolved;
    }

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

      // Find participant by token (using tokenMap from secure storage)
      for (const [pid, storedToken] of tokenMap.entries()) {
        if (storedToken === token) {
          const config = spaceConfig.participants[pid];
          return config?.capabilities || spaceConfig.defaults?.capabilities || [];
        }
      }

      // Legacy support: check tokens field in config if it exists (backward compatibility)
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
      if (!pattern) return true; // No pattern means any payload is allowed
      if (!payload) return false; // Pattern exists but no payload

      for (const [key, value] of Object.entries(pattern)) {
        if (typeof value === 'string') {
          // Handle negative patterns
          if (value.startsWith('!')) {
            const negativePattern = value.slice(1);
            if (payload[key] === negativePattern) {
              return false; // Explicitly excluded value
            }
            continue; // Pattern matches anything except the negated value
          }
          
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
    async function hasCapabilityForMessage(participantId, message, context = {}) {
      const requiredKind = message?.kind || 'unknown';
      const correlationIds = Array.isArray(message?.correlation_id)
        ? message.correlation_id
        : message?.correlation_id
          ? [message.correlation_id]
          : undefined;

      // Get static capabilities from config
      const staticCapabilities = participantCapabilities.get(participantId) || [];

      // Get runtime capabilities (granted dynamically)
      const runtimeCaps = runtimeCapabilities.get(participantId);
      const dynamicCapabilities = runtimeCaps ? Array.from(runtimeCaps.values()).flat() : [];

      // Merge static and dynamic capabilities
      const allCapabilities = [...staticCapabilities, ...dynamicCapabilities];

      const logDecision = (result, matchedCapability = null, matchedSource = null) => {
        logCapabilityDecision({
          event: 'capability_check',
          envelope_id: message?.id,
          participant: participantId,
          space_id: context.spaceId,
          result: result ? 'allowed' : 'denied',
          required_capability: requiredKind,
          matched_capability: matchedCapability || undefined,
          matched_source: matchedSource || undefined,
          granted_capabilities: allCapabilities,
          metadata: {
            source: context.source || 'unknown',
            transport: context.transport,
            correlation_id: correlationIds,
          },
        });
      };

      // Always allow heartbeat messages
      if (requiredKind === 'system/heartbeat') {
        logDecision(true, { kind: 'system/heartbeat' }, 'implicit');
        return true;
      }

      if (options.logLevel === 'debug' && dynamicCapabilities.length > 0) {
        console.log(`Checking capabilities for ${participantId}:`, {
          static: staticCapabilities,
          dynamic: dynamicCapabilities,
          message: { kind: message.kind, payload: message.payload },
        });
      }

      // Check each capability pattern
      let matchedCapability = null;
      let matchedSource = null;
      for (const cap of allCapabilities) {
        if (matchesCapability(message, cap)) {
          matchedCapability = cap;
          matchedSource = staticCapabilities.includes(cap) ? 'static' : 'dynamic';
          logDecision(true, matchedCapability, matchedSource);
          return true;
        }
      }

      logDecision(false);
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
          const capabilities = ensureBaselineCapabilities(config.capabilities || []);
          participantCapabilities.set(participantId, capabilities);
          
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
      // Note: fs and path are imported at the top of the file

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
        spaces.set(spaceId, {
          participants: new Map(),
          streamCounter: 0,
          activeStreams: new Map(),
        });
      }

      // Register this virtual connection in the space
      const space = spaces.get(spaceId);

      // Backfill missing stream tracking fields for pre-existing spaces
      if (typeof space.streamCounter !== 'number') {
        space.streamCounter = 0;
      }
      if (!space.activeStreams) {
        space.activeStreams = new Map();
      }

      space.participants.set(participantId, virtualWs);

      // Send welcome message with active streams (like WebSocket join handler)
      const activeStreams = space.activeStreams
        ? Array.from(space.activeStreams.entries()).map(([streamId, info]) => ({
            stream_id: streamId,
            owner: info.participantId,
            direction: info.direction,
            created: info.created
          }))
        : [];

      const welcomeMessage = {
        protocol: 'mew/v0.4',
        id: `welcome-${Date.now()}`,
        ts: new Date().toISOString(),
        from: 'system:gateway',
        to: [participantId],
        kind: 'system/welcome',
        payload: {
          you: {
            id: participantId,
            capabilities: config.capabilities || [],
          },
          participants: Array.from(space.participants.keys())
            .filter((pid) => pid !== participantId)
            .map((pid) => ({
              id: pid,
              capabilities: participantCapabilities.get(pid) || [],
            })),
          active_streams: activeStreams,
        },
      };

      virtualWs.send(JSON.stringify(welcomeMessage));
      logEnvelopeEvent({
        event: 'delivered',
        id: welcomeMessage.id,
        envelope: welcomeMessage,
        participant: participantId,
        space_id: spaceId,
        direction: 'outbound',
        transport: 'virtual',
        metadata: {
          type: 'system/welcome',
          auto_connect: true,
        },
      });

      console.log(`${participantId} auto-connected with output to ${config.output_log}`);
    }

    // Auto-start agents with auto_start: true
    function autoStartAgents() {
      if (!spaceConfig || !spaceConfig.participants) return;

      for (const [participantId, config] of Object.entries(spaceConfig.participants)) {
        if (config.auto_start && config.command) {
          console.log(`Auto-starting agent: ${participantId}`);

          const resolvedSpaceId = spaceConfig?.space?.id || 'default';
          const token = tokenMap.get(participantId) || '';
          const args = (config.args || []).map((arg) =>
            typeof arg === 'string'
              ? arg
                  .replace('${PORT}', port.toString())
                  .replace('${SPACE}', resolvedSpaceId)
                  .replace('${TOKEN}', token)
              : arg,
          );

          const child = spawn(config.command, args, {
            env: {
              ...process.env,
              PORT: port.toString(),
              SPACE: resolvedSpaceId,
              TOKEN: token,
              [`MEW_TOKEN_${participantId.toUpperCase().replace(/-/g, '_')}`]: token,
              ...resolveEnvVariables(config.env || {}),
            },
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
    const SUPPORTED_PROTOCOL_VERSIONS = new Set(['mew/v0.4', 'mew/v0.3']);

    function validateMessage(message) {
      if (!message || typeof message !== 'object') {
        return 'Message must be an object';
      }

      // Protocol version check
      if (message.protocol && !SUPPORTED_PROTOCOL_VERSIONS.has(message.protocol)) {
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
          const dataStr = data.toString();

          // Check if this is a stream data frame (format: #streamID#data)
          if (dataStr.startsWith('#') && dataStr.indexOf('#', 1) > 0) {
            const secondHash = dataStr.indexOf('#', 1);
            const streamId = dataStr.substring(1, secondHash);

            // Forward stream data to all participants in the space
            if (spaceId && spaces.has(spaceId)) {
              const space = spaces.get(spaceId);

              // Verify stream exists and belongs to this participant
              const streamInfo = space.activeStreams.get(streamId);
              if (streamInfo && streamInfo.participantId === participantId) {
                // Forward to all participants
                for (const [pid, pws] of space.participants.entries()) {
                  if (pws.readyState === WebSocket.OPEN) {
                    pws.send(data); // Send raw data frame
                  }
                }
              } else {
                console.log(`[GATEWAY WARNING] Invalid stream ID ${streamId} from ${participantId}`);
              }
            }
            return; // Don't process as JSON message
          }

          const message = JSON.parse(dataStr);

          // Validate message
          const validationError = validateMessage(message);
          if (validationError) {
            const senderId = participantId || message.from || 'unknown';
            console.log(
              `[GATEWAY WARNING] Validation error from ${senderId}: ${validationError}. Message: ${dataStr}`,
            );
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
            spaceId =
              message.space || message.payload?.space || spaceConfig?.space?.id || 'default';
            const token = message.token || message.payload?.token;

            // Create space if it doesn't exist
            if (!spaces.has(spaceId)) {
              spaces.set(spaceId, {
                participants: new Map(),
                streamCounter: 0,
                activeStreams: new Map()
              });
            }

            // Add participant to space
            const space = spaces.get(spaceId);
            space.participants.set(participantId, ws);
            ws.participantId = participantId;
            ws.spaceId = spaceId;

            logEnvelopeEvent({
              event: 'received',
              id: message.id,
              envelope: message,
              participant: participantId,
              space_id: spaceId,
              direction: 'inbound',
              transport: 'websocket',
            });

            // Store token and resolve capabilities
            participantTokens.set(participantId, token);
            const capabilities = ensureBaselineCapabilities(
              await resolveCapabilities(token, participantId, null),
            );
            participantCapabilities.set(participantId, capabilities);

            // Send welcome message per MEW v0.2 spec
            // Include active streams per [j8v] proposal
            // Guard against spaces created via HTTP without activeStreams Map
            const activeStreams = space.activeStreams
              ? Array.from(space.activeStreams.entries()).map(([streamId, info]) => ({
                  stream_id: streamId,
                  owner: info.participantId,
                  direction: info.direction,
                  created: info.created
                }))
              : [];

            const welcomeMessage = {
              protocol: 'mew/v0.4',
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
                active_streams: activeStreams,
              },
            };

            ws.send(JSON.stringify(welcomeMessage));
            logEnvelopeEvent({
              event: 'delivered',
              id: welcomeMessage.id,
              envelope: welcomeMessage,
              participant: participantId,
              space_id: spaceId,
              direction: 'outbound',
              transport: 'websocket',
              metadata: {
                type: 'system/welcome',
              },
            });

            // Broadcast presence to others
            const presenceMessage = {
              protocol: 'mew/v0.4',
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
                logEnvelopeEvent({
                  event: 'delivered',
                  id: presenceMessage.id,
                  envelope: presenceMessage,
                  participant: pid,
                  space_id: spaceId,
                  direction: 'outbound',
                  transport: 'websocket',
                  metadata: {
                    type: 'system/presence',
                    source_participant: participantId,
                  },
                });
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

          if (message.kind === 'system/register') {
            const errorMessage = {
              protocol: 'mew/v0.4',
              id: `error-${Date.now()}`,
              ts: new Date().toISOString(),
              from: 'system:gateway',
              to: [participantId],
              kind: 'system/error',
              correlation_id: message.id ? [message.id] : undefined,
              payload: {
                error: 'invalid_request',
                message: 'system/register is reserved for the gateway. Use capability/grant instead.',
              },
            };
            ws.send(JSON.stringify(errorMessage));
            logEnvelopeEvent({
              event: 'delivered',
              id: errorMessage.id,
              envelope: errorMessage,
              participant: participantId,
              space_id: spaceId,
              direction: 'outbound',
              transport: 'websocket',
              metadata: {
                reason: 'system_register_blocked',
                source_envelope: message.id,
              },
            });
            return;
          }

          // Check capabilities for non-join messages
          if (
            !(await hasCapabilityForMessage(participantId, message, {
              source: 'websocket',
              spaceId,
              transport: 'websocket',
            }))
          ) {
            const errorMessage = {
              protocol: 'mew/v0.4',
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
            logEnvelopeEvent({
              event: 'delivered',
              id: errorMessage.id,
              envelope: errorMessage,
              participant: participantId,
              space_id: spaceId,
              direction: 'outbound',
              transport: 'websocket',
              metadata: {
                reason: 'capability_violation',
                source_envelope: message.id,
              },
            });

            if (options.logLevel === 'debug') {
              console.log(`Capability denied for ${participantId}: ${message.kind}`);
            }
            return;
          }

          // Handle capability management messages
          if (message.kind === 'capability/grant') {
            // Check if sender has capability to grant capabilities
            const canGrant = await hasCapabilityForMessage(
              participantId,
              {
                kind: 'capability/grant',
              },
              {
                source: 'capability/grant',
                spaceId,
                transport: 'websocket',
              },
            );

            if (!canGrant) {
              const errorMessage = {
                protocol: 'mew/v0.4',
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
              logEnvelopeEvent({
                event: 'delivered',
                id: errorMessage.id,
                envelope: errorMessage,
                participant: participantId,
                space_id: spaceId,
                direction: 'outbound',
                transport: 'websocket',
                metadata: {
                  reason: 'capability_violation',
                  source_envelope: message.id,
                },
              });
              return;
            }

            const recipient = message.payload?.recipient;
            const grantCapabilities = message.payload?.capabilities || [];
            const grantId = message.id || `grant-${Date.now()}`;

            if (recipient && grantCapabilities.length > 0) {
              // Resolve logical participant name to actual runtime client ID
              const space = spaces.get(spaceId);
              let recipientWs = null;
              let recipientClientId = null;

              // Find recipient by matching token
              // First check space config tokens field (for spaces using config-based tokens)
              // This handles the case where participants join with literal tokens from space.yaml
              let recipientToken = null;
              if (spaceConfig?.participants[recipient]?.tokens) {
                const configTokens = spaceConfig.participants[recipient].tokens;
                if (configTokens && configTokens.length > 0) {
                  recipientToken = configTokens[0]; // Use first token from config
                }
              }

              // If not found in config, try tokenMap (secure storage tokens)
              // This handles the case where tokens are stored in .mew/tokens/ files
              if (!recipientToken) {
                recipientToken = tokenMap.get(recipient);
              }

              if (recipientToken) {
                for (const [pid, ws] of space.participants) {
                  const pToken = participantTokens.get(pid);
                  if (pToken === recipientToken) {
                    recipientWs = ws;
                    recipientClientId = pid;
                    break;
                  }
                }
              }

              if (!recipientClientId) {
                console.error(`Failed to resolve logical name ${recipient} to runtime client ID`);
              }

              // Now that we have the runtime client ID, store capabilities under it
              if (recipientClientId) {
                // Initialize runtime capabilities for recipient if needed
                if (!runtimeCapabilities.has(recipientClientId)) {
                  runtimeCapabilities.set(recipientClientId, new Map());
                }

                // Store the granted capabilities under runtime client ID
                const recipientCaps = runtimeCapabilities.get(recipientClientId);
                recipientCaps.set(grantId, grantCapabilities);

                console.log(
                  `Granted capabilities to ${recipient} (${recipientClientId}): ${JSON.stringify(grantCapabilities)}`,
                );
                console.log(
                  `Runtime capabilities for ${recipientClientId}:`,
                  Array.from(recipientCaps.entries()),
                );
              } else {
                console.error(`Failed to resolve logical name ${recipient} to runtime client ID`);
              }

              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                  // Send updated welcome message with new capabilities
                  // This allows the participant to update their internal capability tracking
                  // Get both static capabilities and runtime capabilities (both keyed by runtime client ID)
                  const staticCapabilities = participantCapabilities.get(recipientClientId) || [];
                const runtimeCaps = runtimeCapabilities.get(recipientClientId);
                const dynamicCapabilities = runtimeCaps ? Array.from(runtimeCaps.values()).flat() : [];

                // Combine static and dynamic capabilities
                const updatedCapabilities = [...staticCapabilities, ...dynamicCapabilities];

                const updatedWelcomeMessage = {
                  protocol: 'mew/v0.4',
                  id: `welcome-update-${Date.now()}`,
                  ts: new Date().toISOString(),
                  from: 'system:gateway',
                  to: [recipientClientId],
                  kind: 'system/welcome',
                  payload: {
                    you: {
                      id: recipientClientId,
                      capabilities: updatedCapabilities,
                    },
                    participants: Array.from(space.participants.keys())
                      .filter((pid) => pid !== recipientClientId)
                      .map((pid) => {
                        // Also include runtime capabilities for other participants
                        const otherStatic = participantCapabilities.get(pid) || [];
                        const otherRuntime = runtimeCapabilities.get(pid);
                        const otherDynamic = otherRuntime ? Array.from(otherRuntime.values()).flat() : [];
                        return {
                          id: pid,
                          capabilities: [...otherStatic, ...otherDynamic],
                        };
                      }),
                  },
                  };
                  recipientWs.send(JSON.stringify(updatedWelcomeMessage));
                  logEnvelopeEvent({
                    event: 'delivered',
                    id: updatedWelcomeMessage.id,
                    envelope: updatedWelcomeMessage,
                    participant: recipient,
                    space_id: spaceId,
                    direction: 'outbound',
                    transport: 'websocket',
                    metadata: {
                      type: 'system/welcome',
                      reason: 'capability_grant_update',
                      source_participant: participantId,
                    },
                  });
                  console.log(`Sent updated welcome message to ${recipient} with ${updatedCapabilities.length} total capabilities`);
                  console.log('  Static capabilities:', staticCapabilities.length);
                  console.log('  Granted capabilities:', dynamicCapabilities.length);
                }
              }
          } else if (message.kind === 'capability/revoke') {
            // Check if sender has capability to revoke capabilities
            const canRevoke = await hasCapabilityForMessage(
              participantId,
              {
                kind: 'capability/revoke',
              },
              {
                source: 'capability/revoke',
                spaceId,
                transport: 'websocket',
              },
            );
            if (!canRevoke) {
              const errorMessage = {
                protocol: 'mew/v0.4',
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
              logEnvelopeEvent({
                event: 'delivered',
                id: errorMessage.id,
                envelope: errorMessage,
                participant: participantId,
                space_id: spaceId,
                direction: 'outbound',
                transport: 'websocket',
                metadata: {
                  reason: 'capability_violation',
                  source_envelope: message.id,
                },
              });
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
            protocol: message.protocol || 'mew/v0.4',
            id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ts: message.ts || new Date().toISOString(),
            from: participantId,
            ...message,
          };

          logEnvelopeEvent({
            event: 'received',
            id: envelope.id,
            envelope,
            participant: participantId,
            space_id: spaceId,
            direction: 'inbound',
            transport: 'websocket',
          });

          // Ensure correlation_id is always an array if present
          if (envelope.correlation_id && !Array.isArray(envelope.correlation_id)) {
            envelope.correlation_id = [envelope.correlation_id];
          }

          // Handle stream/request - gateway must respond with stream/open
          if (envelope.kind === 'stream/request' && spaceId && spaces.has(spaceId)) {
            const space = spaces.get(spaceId);

            // Generate unique stream ID
            space.streamCounter++;
            const streamId = `stream-${space.streamCounter}`;

            // Track the stream
            space.activeStreams.set(streamId, {
              requestId: envelope.id,
              participantId: participantId,
              direction: envelope.payload?.direction || 'unknown',
              created: new Date().toISOString()
            });

            // Send stream/open response
            const streamOpenResponse = {
              protocol: 'mew/v0.4',
              id: `stream-open-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              ts: new Date().toISOString(),
              from: 'gateway',
              to: [participantId],
              kind: 'stream/open',
              correlation_id: [envelope.id],
              payload: {
                stream_id: streamId,
                encoding: 'text'
              }
            };

            // Send stream/open to ALL participants (MEW Protocol visibility)
            for (const [pid, pws] of space.participants.entries()) {
              if (pws.readyState === WebSocket.OPEN) {
                pws.send(JSON.stringify(streamOpenResponse));
                logEnvelopeEvent({
                  event: 'delivered',
                  id: streamOpenResponse.id,
                  envelope: streamOpenResponse,
                  participant: pid,
                  space_id: spaceId,
                  direction: 'outbound',
                  transport: 'websocket',
                  metadata: {
                    type: 'stream/open',
                    source_participant: participantId,
                    stream_id: streamId,
                  },
                });
              }
            }

            if (options.logLevel === 'debug') {
              console.log(`[GATEWAY DEBUG] Assigned stream ID ${streamId} for request from ${participantId}`);
            }
          }

          // Handle stream/close - clean up active streams
          if (envelope.kind === 'stream/close' && spaceId && spaces.has(spaceId)) {
            const space = spaces.get(spaceId);

            // Find and remove the stream (may be referenced by correlation_id)
            if (envelope.payload?.stream_id) {
              const streamId = envelope.payload.stream_id;
              if (space.activeStreams.has(streamId)) {
                space.activeStreams.delete(streamId);
                if (options.logLevel === 'debug') {
                  console.log(`[GATEWAY DEBUG] Closed stream ${streamId}`);
                }
              }
            }
          }

          // ALWAYS broadcast to ALL participants - MEW Protocol requires all messages visible to all
          if (spaceId && spaces.has(spaceId)) {
            const space = spaces.get(spaceId);

            // Log if message has specific addressing
            if (envelope.to && Array.isArray(envelope.to)) {
              console.log(`[GATEWAY DEBUG] Message from ${envelope.from} addressed to: ${envelope.to.join(', ')}, kind: ${envelope.kind}`);
            }

            // Broadcast to ALL participants (everyone sees everything in MEW Protocol)
            console.log(`[GATEWAY DEBUG] Broadcasting ${envelope.kind} from ${envelope.from} to all ${space.participants.size} participants`);
            for (const [pid, pws] of space.participants.entries()) {
              if (pws.readyState === WebSocket.OPEN) {
                pws.send(JSON.stringify(envelope));
                if (options.logLevel === 'debug') {
                  console.log(`[GATEWAY DEBUG] Sent to ${pid}`);
                }
                logEnvelopeEvent({
                  event: 'delivered',
                  id: envelope.id,
                  envelope,
                  participant: pid,
                  space_id: spaceId,
                  direction: 'outbound',
                  transport: 'websocket',
                  metadata: {
                    source_participant: participantId,
                  },
                });
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
          participantTokens.delete(participantId);
          participantCapabilities.delete(participantId);
          runtimeCapabilities.delete(participantId);

          // Broadcast leave presence
          const presenceMessage = {
            protocol: 'mew/v0.4',
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
              logEnvelopeEvent({
                event: 'delivered',
                id: presenceMessage.id,
                envelope: presenceMessage,
                participant: pid,
                space_id: spaceId,
                direction: 'outbound',
                transport: 'websocket',
                metadata: {
                  type: 'system/presence',
                  source_participant: participantId,
                  reason: 'disconnect',
                },
              });
            }
          }

          if (options.logLevel === 'debug') {
            console.log(`${participantId} disconnected from ${spaceId}`);
          }
        }
      });
    });

    const autoStartEnabled = options.autoStart !== false;

    // Add error handler for server
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

    // Add error handler for unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Add error handler for uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
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
      if (autoStartEnabled) {
        console.log('Auto-starting participants defined in space configuration');
        autoStartAgents();
      } else {
        console.log('Auto-start of participants disabled via --no-auto-start');
      }
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

export default gateway;

function parseOptionalBoolean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function createGatewayLogger({ logsDir, config = {}, env = {}, logger = console }) {
  const warn = logger && typeof logger.warn === 'function' ? logger.warn.bind(logger) : console.warn.bind(console);

  let loggingEnabled = config?.enabled !== undefined ? Boolean(config.enabled) : true;
  const envAll = parseOptionalBoolean(env.GATEWAY_LOGGING);
  if (envAll !== undefined) {
    loggingEnabled = envAll;
  }

  let envelopeEnabled = config?.envelope_history?.enabled !== undefined
    ? Boolean(config.envelope_history.enabled)
    : true;
  let capabilityEnabled = config?.capability_decisions?.enabled !== undefined
    ? Boolean(config.capability_decisions.enabled)
    : true;

  const envEnvelope = parseOptionalBoolean(env.ENVELOPE_HISTORY);
  if (envEnvelope !== undefined) {
    envelopeEnabled = envEnvelope;
  }

  const envCapability = parseOptionalBoolean(env.CAPABILITY_DECISIONS);
  if (envCapability !== undefined) {
    capabilityEnabled = envCapability;
  }

  if (!loggingEnabled) {
    envelopeEnabled = false;
    capabilityEnabled = false;
  }

  if (!envelopeEnabled && !capabilityEnabled) {
    return {
      logEnvelopeEvent: () => {},
      logCapabilityDecision: () => {},
    };
  }

  try {
    fs.mkdirSync(logsDir, { recursive: true });
    const gitignorePath = path.join(logsDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, '*\n!.gitignore\n');
    }
  } catch (error) {
    warn(`Failed to prepare gateway log directory at ${logsDir}: ${error.message}`);
    return {
      logEnvelopeEvent: () => {},
      logCapabilityDecision: () => {},
    };
  }

  const streams = {};

  if (envelopeEnabled) {
    try {
      const envelopePath = path.join(logsDir, 'envelope-history.jsonl');
      streams.envelope = fs.createWriteStream(envelopePath, { flags: 'a' });
    } catch (error) {
      warn(`Failed to open envelope history log: ${error.message}`);
      envelopeEnabled = false;
    }
  }

  if (capabilityEnabled) {
    try {
      const capabilityPath = path.join(logsDir, 'capability-decisions.jsonl');
      streams.capability = fs.createWriteStream(capabilityPath, { flags: 'a' });
    } catch (error) {
      warn(`Failed to open capability decisions log: ${error.message}`);
      capabilityEnabled = false;
    }
  }

  if (!streams.envelope && !streams.capability) {
    return {
      logEnvelopeEvent: () => {},
      logCapabilityDecision: () => {},
    };
  }

  let cleanedUp = false;
  const performCleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    if (streams.envelope) {
      try {
        streams.envelope.end();
      } catch (error) {
        warn(`Failed to close envelope history log: ${error.message}`);
      }
    }
    if (streams.capability) {
      try {
        streams.capability.end();
      } catch (error) {
        warn(`Failed to close capability decisions log: ${error.message}`);
      }
    }
  };

  process.once('exit', performCleanup);
  process.once('SIGINT', performCleanup);
  process.once('SIGTERM', performCleanup);

  const pruneUndefined = (record) => {
    for (const key of Object.keys(record)) {
      if (record[key] === undefined || record[key] === null ||
        (typeof record[key] === 'object' && !Array.isArray(record[key]) && Object.keys(record[key]).length === 0)) {
        if (record[key] === undefined || record[key] === null || Object.keys(record[key] || {}).length === 0) {
          delete record[key];
        }
      }
    }
    return record;
  };

  const safeWrite = (stream, entry, label) => {
    if (!stream) {
      return;
    }

    try {
      stream.write(`${JSON.stringify(entry)}\n`);
    } catch (error) {
      warn(`Failed to write ${label} entry: ${error.message}`);
    }
  };

  return {
    logEnvelopeEvent(entry = {}) {
      if (!streams.envelope) {
        return;
      }
      const metadata = entry.metadata && Object.keys(entry.metadata).length > 0 ? entry.metadata : undefined;
      const record = pruneUndefined({
        timestamp: new Date().toISOString(),
        event: entry.event,
        id: entry.id,
        envelope: entry.envelope,
        participant: entry.participant,
        space_id: entry.space_id,
        direction: entry.direction,
        transport: entry.transport,
        metadata,
      });
      safeWrite(streams.envelope, record, 'envelope history');
    },
    logCapabilityDecision(entry = {}) {
      if (!streams.capability) {
        return;
      }
      const metadata = entry.metadata && Object.keys(entry.metadata).length > 0 ? entry.metadata : undefined;
      const record = pruneUndefined({
        timestamp: new Date().toISOString(),
        event: entry.event || 'capability_check',
        envelope_id: entry.envelope_id,
        participant: entry.participant,
        space_id: entry.space_id,
        result: entry.result,
        required_capability: entry.required_capability,
        matched_capability: entry.matched_capability,
        matched_source: entry.matched_source,
        granted_capabilities: entry.granted_capabilities,
        metadata,
      });
      safeWrite(streams.capability, record, 'capability decision');
    },
  };
}
