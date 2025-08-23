import { z } from 'zod';
import * as crypto from 'crypto';

// MCPx v0 Protocol Types

export const MCPxProtocolSchema = z.literal('mcp-x/v0');
export type MCPxProtocol = z.infer<typeof MCPxProtocolSchema>;

export const ParticipantKindSchema = z.enum(['human', 'agent', 'robot']);
export type ParticipantKind = z.infer<typeof ParticipantKindSchema>;

export const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: ParticipantKindSchema,
  mcp: z.object({
    version: z.string()
  })
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const MessageKindSchema = z.enum(['mcp', 'presence', 'system']);
export type MessageKind = z.infer<typeof MessageKindSchema>;

// Base envelope schema
export const EnvelopeSchema = z.object({
  protocol: MCPxProtocolSchema,
  id: z.string(),
  ts: z.string(),
  from: z.string(),
  to: z.array(z.string()).optional(),
  kind: MessageKindSchema,
  correlation_id: z.string().optional(),
  payload: z.record(z.any())
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

// MCP JSON-RPC schemas
export const MCPRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.any()).optional()
});
export type MCPRequest = z.infer<typeof MCPRequestSchema>;

export const MCPResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional()
  }).optional()
});
export type MCPResponse = z.infer<typeof MCPResponseSchema>;

export const MCPNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.any()).optional()
});
export type MCPNotification = z.infer<typeof MCPNotificationSchema>;

export const MCPPayloadSchema = z.union([MCPRequestSchema, MCPResponseSchema, MCPNotificationSchema]);
export type MCPPayload = z.infer<typeof MCPPayloadSchema>;

// Presence payload schema
export const PresenceEventSchema = z.enum(['join', 'leave', 'heartbeat']);
export const PresencePayloadSchema = z.object({
  event: PresenceEventSchema,
  participant: ParticipantSchema
});
export type PresencePayload = z.infer<typeof PresencePayloadSchema>;

// System payload schema
export const SystemWelcomePayloadSchema = z.object({
  type: z.literal('welcome'),
  participant_id: z.string(),
  topic: z.string(),
  participants: z.array(ParticipantSchema),
  history: z.array(EnvelopeSchema).optional()
});
export type SystemWelcomePayload = z.infer<typeof SystemWelcomePayloadSchema>;

// Envelope validation functions
export function validateEnvelope(data: unknown): Envelope {
  return EnvelopeSchema.parse(data);
}

export function createEnvelope(
  from: string,
  kind: MessageKind,
  payload: any,
  to?: string[],
  correlationId?: string
): Envelope {
  return {
    protocol: 'mcp-x/v0',
    id: generateMessageId(),
    ts: new Date().toISOString(),
    from,
    to,
    kind,
    correlation_id: correlationId,
    payload
  };
}

export function generateMessageId(): string {
  // Use crypto.randomUUID() which is built-in to Node.js
  return crypto.randomUUID();
}

// Chat message helpers
export interface ChatMessage {
  text: string;
  format?: 'plain' | 'markdown';
}

export function createChatNotification(from: string, message: ChatMessage): Envelope {
  return createEnvelope(from, 'mcp', {
    jsonrpc: '2.0',
    method: 'notifications/chat/message',
    params: {
      text: message.text,
      format: message.format || 'plain'
    }
  });
}