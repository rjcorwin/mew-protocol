import { Participant, Envelope } from './mcpx';
import { WebSocket } from 'ws';

export interface ServerConfig {
  port: number;
  auth: {
    secret: string;
    tokenExpiry: string;
  };
  topics: {
    maxParticipants: number;
    historyLimit: number;
  };
  rateLimit: {
    messagesPerMinute: number;
    chatMessagesPerMinute: number;
  };
}

export interface AuthToken {
  participantId: string;
  topic: string;
  exp: number;
  iat: number;
}

export interface ConnectedClient {
  ws: WebSocket;
  participant: Participant;
  topic: string;
  lastActivity: Date;
  messageCount: number;
  chatMessageCount: number;
  rateLimitReset: Date;
}

export interface TopicState {
  participants: Map<string, ConnectedClient>;
  messageHistory: Envelope[];
  createdAt: Date;
}

export interface RateLimitInfo {
  messages: number;
  chatMessages: number;
  resetTime: Date;
}