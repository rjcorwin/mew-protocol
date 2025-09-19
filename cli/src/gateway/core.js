const EventEmitter = require('events');

/**
 * GatewayCore manages space state, participant tracking, and message routing while
 * remaining agnostic of the underlying transport.
 */
class GatewayCore extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} options.spaceId
   * @param {Map<string, object>} options.participants - participantId -> config
   * @param {Map<string, string>} options.tokensByParticipant - participantId -> token
   * @param {object} [options.logger]
   */
  constructor({ spaceId, participants, tokensByParticipant, logger }) {
    super();
    this.spaceId = spaceId;
    this.participantConfigs = participants; // Map of participantId -> config from space.yaml
    this.tokensByParticipant = tokensByParticipant; // Map participantId -> token string

    // Reverse lookup: token -> participantId for authentication
    this.participantByToken = new Map();
    for (const [participantId, token] of tokensByParticipant.entries()) {
      if (token) {
        this.participantByToken.set(token, participantId);
      }
    }

    this.logger = logger || console;
    this.transports = new Set();
    this.connections = new Map(); // participantId -> connection state
  }

  /**
   * Registers a transport and wires up event handlers.
   * Transport must expose on(event, handler) and support events: message, disconnect, error.
   */
  attachTransport(transport) {
    this.transports.add(transport);

    transport.on('message', ({ participantId, envelope, channel }) => {
      this._handleIncomingEnvelope(participantId, envelope, channel);
    });

    transport.on('disconnect', ({ participantId, channel }) => {
      this._handleDisconnect(participantId, channel);
    });

    transport.on('error', (error) => {
      this.logger.error('Transport error:', error);
    });
  }

  /**
   * Core handles envelope routing, performing join authentication on first message.
   */
  _handleIncomingEnvelope(participantId, envelope, channel) {
    const connection = this.connections.get(participantId);

    if (!connection) {
      this._handleJoin(participantId, envelope, channel);
      return;
    }

    // Subsequent messages: enforce space and from fields before routing
    const enrichedEnvelope = {
      ...envelope,
      space: this.spaceId,
      from: participantId,
      protocol: envelope.protocol || 'mew/v0.3',
      ts: envelope.ts || new Date().toISOString(),
    };

    this._broadcast(enrichedEnvelope, { exclude: participantId });
  }

  _handleJoin(participantId, envelope, channel) {
    const joinPayload = envelope?.payload || envelope;
    const token = joinPayload?.token || envelope?.token;
    const requestedParticipantId = joinPayload?.participantId || envelope?.participantId;
    const requestedSpace = joinPayload?.space || envelope?.space;

    if (requestedSpace && requestedSpace !== this.spaceId) {
      this.logger.warn(
        `Participant ${participantId} attempted to join unexpected space ${requestedSpace}`,
      );
      channel.send({
        protocol: 'mew/v0.3',
        kind: 'system/error',
        payload: { message: 'Invalid space for this gateway' },
      });
      channel.close?.();
      return;
    }

    if (!token) {
      this.logger.warn(`Participant ${participantId} missing token in join handshake`);
      channel.send({
        protocol: 'mew/v0.3',
        kind: 'system/error',
        payload: { message: 'Authentication required' },
      });
      channel.close?.();
      return;
    }

    const expectedParticipant = this.participantByToken.get(token);
    if (!expectedParticipant || expectedParticipant !== participantId) {
      this.logger.warn(`Authentication failed for participant ${participantId}`);
      channel.send({
        protocol: 'mew/v0.3',
        kind: 'system/error',
        payload: { message: 'Authentication failed' },
      });
      channel.close?.();
      return;
    }

    if (requestedParticipantId && requestedParticipantId !== participantId) {
      this.logger.warn(
        `Join mismatch: FIFO participant ${participantId} requested id ${requestedParticipantId}`,
      );
      channel.send({
        protocol: 'mew/v0.3',
        kind: 'system/error',
        payload: { message: 'Participant mismatch' },
      });
      channel.close?.();
      return;
    }

    const config = this.participantConfigs.get(participantId) || {};

    const connectionState = {
      participantId,
      channel,
      capabilities: config.capabilities || [],
    };
    this.connections.set(participantId, connectionState);

    this.logger.log(`Participant ${participantId} joined space ${this.spaceId}`);

    // Send welcome to participant
    channel.send({
      protocol: 'mew/v0.3',
      kind: 'system/welcome',
      payload: {
        space: this.spaceId,
        participant: participantId,
        participants: Array.from(this.connections.keys()),
      },
    });

    // Notify other participants
    this._broadcast(
      {
        protocol: 'mew/v0.3',
        kind: 'system/participant-joined',
        from: participantId,
        space: this.spaceId,
        ts: new Date().toISOString(),
      },
      { exclude: participantId },
    );

    this.emit('participant:joined', { participantId });
  }

  _handleDisconnect(participantId) {
    if (!this.connections.has(participantId)) {
      return;
    }

    this.logger.log(`Participant ${participantId} disconnected`);
    this.connections.delete(participantId);

    this._broadcast(
      {
        protocol: 'mew/v0.3',
        kind: 'system/participant-left',
        from: participantId,
        space: this.spaceId,
        ts: new Date().toISOString(),
      },
      { exclude: participantId },
    );

    this.emit('participant:left', { participantId });
  }

  _broadcast(envelope, { exclude } = {}) {
    for (const [participantId, connection] of this.connections.entries()) {
      if (participantId === exclude) continue;
      try {
        connection.channel.send(envelope);
      } catch (error) {
        this.logger.error('Failed to deliver envelope', error);
      }
    }
  }
}

module.exports = {
  GatewayCore,
};
