import { WebSocket } from 'ws';
import { 
  Envelope, 
  Participant, 
  createEnvelope, 
  PresencePayload,
  SystemWelcomePayload,
  validateEnvelope 
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

    if (topic.participants.has(participant.id)) {
      throw new Error(`Participant ${participant.id} already in topic ${topicName}`);
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

    // Check rate limits
    const client = topic.participants.get(fromParticipantId);
    if (client && !this.checkRateLimit(client, envelope)) {
      console.warn(`Rate limit exceeded for participant ${fromParticipantId}`);
      return;
    }

    // Store in history
    this.addToHistory(topic, envelope);

    // Determine recipients
    const recipients = envelope.to && envelope.to.length > 0 
      ? envelope.to 
      : Array.from(topic.participants.keys());

    // Send to recipients
    recipients.forEach(recipientId => {
      const recipient = topic.participants.get(recipientId);
      if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
        try {
          recipient.ws.send(JSON.stringify(envelope));
          recipient.lastActivity = new Date();
        } catch (error) {
          console.error(`Failed to send message to ${recipientId}:`, error);
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
    const welcomePayload: SystemWelcomePayload = {
      type: 'welcome',
      participant_id: client.participant.id,
      topic: client.topic,
      participants: Array.from(topic.participants.values())
        .filter(c => c.participant.id !== client.participant.id)
        .map(c => c.participant),
      history: topic.messageHistory.slice(-this.config.topics.historyLimit)
    };

    const envelope = createEnvelope('system:gateway', 'system', welcomePayload, [client.participant.id]);

    // Send welcome message with a small delay to ensure client is ready
    setImmediate(() => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(envelope));
      }
    });
  }

  private broadcastPresence(
    topicName: string, 
    event: 'join' | 'leave' | 'heartbeat', 
    participant: Participant
  ): void {
    const payload: PresencePayload = {
      event,
      participant
    };

    const envelope = createEnvelope('system:gateway', 'presence', payload);
    
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

    // Check chat message rate limit
    if (envelope.kind === 'mcp' && 
        envelope.payload.method === 'notifications/chat/message') {
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
}