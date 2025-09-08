#!/usr/bin/env node

/**
 * MEUP Gateway
 * Manages spaces, enforces capabilities, and routes messages between participants
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class MEUPGateway {
  constructor(port = 3000) {
    this.port = port;
    this.spaces = new Map();
    this.connections = new Map();
    
    // Create default space
    this.createSpace('default');
  }

  createSpace(name) {
    this.spaces.set(name, {
      name,
      participants: new Map(),
      messages: []
    });
  }

  start() {
    const wss = new WebSocket.Server({ port: this.port });

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url, `http://localhost:${this.port}`);
      const spaceName = url.searchParams.get('space') || 'default';
      const token = req.headers.authorization?.replace('Bearer ', '') || 'anonymous';
      
      this.handleConnection(ws, spaceName, token);
    });

    console.log(`🚀 MEUP Gateway running on ws://localhost:${this.port}`);
    console.log(`📍 Connect with: ws://localhost:${this.port}/ws?space=default`);
  }

  handleConnection(ws, spaceName, token) {
    const space = this.spaces.get(spaceName);
    if (!space) {
      ws.send(JSON.stringify({
        protocol: 'meup/v0.2',
        id: this.generateId(),
        from: 'system:gateway',
        kind: 'system/error',
        payload: {
          error: 'space_not_found',
          message: `Space '${spaceName}' does not exist`
        }
      }));
      ws.close();
      return;
    }

    // Assign participant ID and capabilities based on token
    const participantId = this.getParticipantId(token);
    const capabilities = this.getCapabilities(participantId);
    
    // Store connection info
    const connectionId = this.generateId();
    this.connections.set(connectionId, {
      ws,
      spaceName,
      participantId,
      capabilities
    });

    // Add to space
    space.participants.set(participantId, {
      id: participantId,
      capabilities,
      connectionId
    });

    // Send welcome message to new participant
    ws.send(JSON.stringify({
      protocol: 'meup/v0.2',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: 'system:gateway',
      to: [participantId],
      kind: 'system/welcome',
      payload: {
        you: {
          id: participantId,
          capabilities
        },
        participants: Array.from(space.participants.entries())
          .filter(([id]) => id !== participantId)
          .map(([id, info]) => ({
            id,
            capabilities: info.capabilities
          }))
      }
    }));

    // Broadcast presence to others
    this.broadcast(space, {
      protocol: 'meup/v0.2',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: 'system:gateway',
      kind: 'system/presence',
      payload: {
        event: 'join',
        participant: {
          id: participantId,
          capabilities
        }
      }
    }, participantId);

    // Handle messages from this participant
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connectionId, message);
      } catch (error) {
        ws.send(JSON.stringify({
          protocol: 'meup/v0.2',
          id: this.generateId(),
          from: 'system:gateway',
          kind: 'system/error',
          payload: {
            error: 'parse_error',
            message: 'Invalid JSON'
          }
        }));
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(connectionId);
    });

    ws.on('error', (error) => {
      console.error(`Connection error for ${participantId}:`, error);
    });
  }

  handleMessage(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { spaceName, participantId, capabilities, ws } = connection;
    const space = this.spaces.get(spaceName);
    if (!space) return;

    // Validate message structure
    if (!message.kind || !message.payload) {
      ws.send(JSON.stringify({
        protocol: 'meup/v0.2',
        id: this.generateId(),
        from: 'system:gateway',
        to: [participantId],
        kind: 'system/error',
        payload: {
          error: 'invalid_message',
          message: 'Message must have kind and payload'
        }
      }));
      return;
    }

    // Check if participant has capability for this message kind
    if (!this.hasCapability(capabilities, message)) {
      ws.send(JSON.stringify({
        protocol: 'meup/v0.2',
        id: this.generateId(),
        from: 'system:gateway',
        to: [participantId],
        kind: 'system/error',
        correlation_id: [message.id],
        payload: {
          error: 'capability_violation',
          attempted_kind: message.kind,
          your_capabilities: capabilities
        }
      }));
      return;
    }

    // Add metadata to message
    const fullMessage = {
      protocol: 'meup/v0.2',
      ...message,
      from: participantId,
      ts: message.ts || new Date().toISOString(),
      id: message.id || this.generateId()
    };

    // Store message in space history
    space.messages.push(fullMessage);

    // Route message
    if (message.to && message.to.length > 0) {
      // Send to specific participants
      message.to.forEach(targetId => {
        const target = space.participants.get(targetId);
        if (target) {
          const targetConn = Array.from(this.connections.values())
            .find(c => c.connectionId === target.connectionId);
          if (targetConn && targetConn.ws.readyState === WebSocket.OPEN) {
            targetConn.ws.send(JSON.stringify(fullMessage));
          }
        }
      });
    } else {
      // Broadcast to all
      this.broadcast(space, fullMessage, participantId);
    }
  }

  handleDisconnect(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { spaceName, participantId } = connection;
    const space = this.spaces.get(spaceName);
    if (!space) return;

    // Remove from space
    space.participants.delete(participantId);
    this.connections.delete(connectionId);

    // Broadcast leave event
    this.broadcast(space, {
      protocol: 'meup/v0.2',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: 'system:gateway',
      kind: 'system/presence',
      payload: {
        event: 'leave',
        participant: { id: participantId }
      }
    });
  }

  broadcast(space, message, excludeId = null) {
    space.participants.forEach((participant, id) => {
      if (id === excludeId) return;
      
      const conn = Array.from(this.connections.values())
        .find(c => c.connectionId === participant.connectionId);
      
      if (conn && conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(message));
      }
    });
  }

  hasCapability(capabilities, message) {
    return capabilities.some(cap => {
      // Check kind match
      if (cap.kind === '*') return true;
      
      if (cap.kind.endsWith('/*')) {
        const prefix = cap.kind.slice(0, -2);
        if (!message.kind.startsWith(prefix + '/')) return false;
      } else if (cap.kind !== message.kind) {
        return false;
      }

      // Check payload constraints if specified
      if (cap.payload) {
        // Simple payload matching - could be extended
        if (cap.payload.method && message.payload.method !== cap.payload.method) {
          return false;
        }
      }

      return true;
    });
  }

  getParticipantId(token) {
    // Map tokens to participant IDs
    const tokenMap = {
      'user-token': 'user',
      'assistant-token': 'assistant',
      'calculator-token': 'calculator',
      'observer-token': 'observer'
    };
    
    return tokenMap[token] || `participant-${token.substring(0, 8)}`;
  }

  getCapabilities(participantId) {
    // Assign capabilities based on participant role
    const capabilityMap = {
      'user': [
        { kind: 'chat' },
        { kind: 'mcp/*' }
      ],
      'assistant': [
        { kind: 'chat' },
        { kind: 'mcp/proposal' },
        { kind: 'mcp/withdraw' },
        { kind: 'reasoning/*' }
      ],
      'calculator': [
        { kind: 'chat' },
        { kind: 'mcp/*' }
      ],
      'observer': [
        { kind: 'chat' },
        { kind: 'mcp/*' },
        { kind: 'capability/*' }
      ]
    };

    return capabilityMap[participantId] || [
      { kind: 'chat' }
    ];
  }

  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }
}

// Start the gateway
const gateway = new MEUPGateway(3000);
gateway.start();