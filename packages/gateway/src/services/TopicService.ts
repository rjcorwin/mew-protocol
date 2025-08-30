import { WebSocket } from 'ws';
import { 
  Envelope, 
  Participant,
  ParticipantInfo,
  createEnvelope, 
  PresencePayload,
  SystemWelcomePayload,
  SystemErrorPayload,
  validateEnvelope,
  hasCapability
} from '../types/mcpx';
import { ConnectedClient, TopicState, ServerConfig, RateLimitInfo } from '../types/server';

export class TopicService {
  private topics: Map<string, TopicState> = new Map();
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
  }

  createTopic(topicName: string): TopicState {
    const topic: TopicState = {
      participants: new Map(),
      messageHistory: [],
      createdAt: new Date()
    };
    this.topics.set(topicName, topic);
    return topic;
  }

  getTopic(topicName: string): TopicState | undefined {
    return this.topics.get(topicName);
  }

  getOrCreateTopic(topicName: string): TopicState {
    return this.getTopic(topicName) || this.createTopic(topicName);
  }

  joinTopic(
    topicName: string, 
    participant: Participant, 
    ws: WebSocket
  ): ConnectedClient {
    const topic = this.getOrCreateTopic(topicName);
    
    if (topic.participants.size >= this.config.topics.maxParticipants) {
      throw new Error(`Topic ${topicName} is full`);
    }

    // If participant already exists, disconnect the old connection
    if (topic.participants.has(participant.id)) {
      const existingClient = topic.participants.get(participant.id);
      if (existingClient && existingClient.ws.readyState === WebSocket.OPEN) {
        console.log(`Disconnecting existing connection for ${participant.id} in ${topicName}`);
        existingClient.ws.close(1000, 'Duplicate connection - disconnecting old session');
      }
      topic.participants.delete(participant.id);
    }

    const client: ConnectedClient = {
      ws,
      participant,
      topic: topicName,
      lastActivity: new Date(),
      messageCount: 0,
      chatMessageCount: 0,
      rateLimitReset: new Date(Date.now() + 60000) // 1 minute from now
    };

    topic.participants.set(participant.id, client);

    // Send welcome message
    this.sendWelcomeMessage(client, topic);

    // Broadcast presence join
    this.broadcastPresence(topicName, 'join', participant);

    console.log(`Participant ${participant.id} joined topic ${topicName}`);
    return client;
  }

  leaveTopic(topicName: string, participantId: string): void {
    const topic = this.getTopic(topicName);
    if (!topic) return;

    const client = topic.participants.get(participantId);
    if (!client) return;

    topic.participants.delete(participantId);

    // Broadcast presence leave
    this.broadcastPresence(topicName, 'leave', client.participant);

    console.log(`Participant ${participantId} left topic ${topicName}`);

    // Clean up empty topics
    if (topic.participants.size === 0) {
      this.topics.delete(topicName);
      console.log(`Topic ${topicName} deleted (empty)`);
    }
  }

  broadcastMessage(topicName: string, envelope: Envelope, fromParticipantId: string): void {
    const topic = this.getTopic(topicName);
    if (!topic) return;

    // Validate envelope
    try {
      validateEnvelope(envelope);
    } catch (error) {
      console.warn('Invalid envelope received:', error);
      return;
    }

    const client = topic.participants.get(fromParticipantId);
    if (!client) return;

    // Check capabilities (v0.1)
    // System messages can only come from the gateway
    if (envelope.kind.startsWith('system/')) {
      this.sendCapabilityError(client, envelope.kind, 'Only the gateway can send system messages');
      return;
    }

    // Check if participant has capability for this kind
    if (!hasCapability(envelope.kind, client.participant.capabilities)) {
      this.sendCapabilityError(client, envelope.kind);
      return;
    }

    // Check rate limits
    if (!this.checkRateLimit(client, envelope)) {
      console.warn(`Rate limit exceeded for participant ${fromParticipantId}`);
      return;
    }

    // Store in history
    this.addToHistory(topic, envelope);

    // IMPORTANT: In MCPx, all participants in a topic see all messages
    // This is essential for the protocol to work correctly:
    // - Proposals are broadcast, but responses might be targeted
    // - All participants need to see responses to understand the conversation
    // - This enables proper multi-agent collaboration
    topic.participants.forEach((participant, participantId) => {
      if (participant.ws.readyState === WebSocket.OPEN) {
        try {
          participant.ws.send(JSON.stringify(envelope));
          participant.lastActivity = new Date();
        } catch (error) {
          console.error(`Failed to send message to ${participantId}:`, error);
        }
      }
    });
  }

  getParticipants(topicName: string): Participant[] {
    const topic = this.getTopic(topicName);
    if (!topic) return [];
    
    return Array.from(topic.participants.values()).map(client => client.participant);
  }

  getHistory(topicName: string, limit: number = 100, before?: string): Envelope[] {
    const topic = this.getTopic(topicName);
    if (!topic) return [];

    let history = topic.messageHistory;
    
    if (before) {
      const beforeIndex = history.findIndex(msg => msg.id === before || msg.ts === before);
      if (beforeIndex > 0) {
        history = history.slice(0, beforeIndex);
      }
    }

    return history.slice(-limit).reverse(); // Most recent first
  }

  getTopics(): string[] {
    return Array.from(this.topics.keys());
  }

  private sendWelcomeMessage(client: ConnectedClient, topic: TopicState): void {
    const you: ParticipantInfo = {
      id: client.participant.id,
      capabilities: client.participant.capabilities
    };

    const participants: ParticipantInfo[] = Array.from(topic.participants.values())
      .filter(c => c.participant.id !== client.participant.id)
      .map(c => ({
        id: c.participant.id,
        capabilities: c.participant.capabilities
      }));

    const welcomePayload: SystemWelcomePayload = {
      you,
      participants
    };

    const envelope = createEnvelope('system:gateway', 'system/welcome', welcomePayload, [client.participant.id]);

    // Send welcome message with a small delay to ensure client is ready
    setImmediate(() => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(envelope));
      }
    });
  }

  private broadcastPresence(
    topicName: string, 
    event: 'join' | 'leave', 
    participant: Participant
  ): void {
    const participantInfo: ParticipantInfo = {
      id: participant.id,
      capabilities: participant.capabilities
    };

    const payload: PresencePayload = {
      event,
      participant: participantInfo
    };

    const envelope = createEnvelope('system:gateway', 'system/presence', payload);
    
    const topic = this.getTopic(topicName);
    if (topic) {
      topic.participants.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(JSON.stringify(envelope));
          } catch (error) {
            console.error(`Failed to send presence to ${client.participant.id}:`, error);
          }
        }
      });
    }
  }

  private addToHistory(topic: TopicState, envelope: Envelope): void {
    topic.messageHistory.push(envelope);
    
    // Trim history if it exceeds the limit
    if (topic.messageHistory.length > this.config.topics.historyLimit) {
      topic.messageHistory = topic.messageHistory.slice(-this.config.topics.historyLimit);
    }
  }

  private checkRateLimit(client: ConnectedClient, envelope: Envelope): boolean {
    const now = new Date();
    
    // Reset counters if time window has passed
    if (now >= client.rateLimitReset) {
      client.messageCount = 0;
      client.chatMessageCount = 0;
      client.rateLimitReset = new Date(now.getTime() + 60000); // Next minute
    }

    // Check general message rate limit
    client.messageCount++;
    if (client.messageCount > this.config.rateLimit.messagesPerMinute) {
      return false;
    }

    // Check chat message rate limit (v0.1 - chat is now a separate kind)
    if (envelope.kind === 'chat') {
      client.chatMessageCount++;
      if (client.chatMessageCount > this.config.rateLimit.chatMessagesPerMinute) {
        return false;
      }
    }

    return true;
  }

  getRateLimitInfo(topicName: string, participantId: string): RateLimitInfo | null {
    const topic = this.getTopic(topicName);
    if (!topic) return null;

    const client = topic.participants.get(participantId);
    if (!client) return null;

    return {
      messages: client.messageCount,
      chatMessages: client.chatMessageCount,
      resetTime: client.rateLimitReset
    };
  }

  private sendCapabilityError(client: ConnectedClient, attemptedKind: string, customMessage?: string): void {
    const errorPayload: SystemErrorPayload = {
      error: 'capability_violation',
      message: customMessage || `You lack capability for '${attemptedKind}'`,
      attempted_kind: attemptedKind,
      your_capabilities: client.participant.capabilities
    };

    const envelope = createEnvelope(
      'system:gateway', 
      'system/error', 
      errorPayload, 
      [client.participant.id]
    );

    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(envelope));
    }
  }
}