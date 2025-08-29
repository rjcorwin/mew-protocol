import { z } from 'zod';
import * as crypto from 'crypto';

// MCPx v0.1 Protocol Types

export const MCPxProtocolSchema = z.literal('mcpx/v0.1');
export type MCPxProtocol = z.infer<typeof MCPxProtocolSchema>;

// Capabilities replace participant kinds in v0.1
export const CapabilitySchema = z.string(); // e.g., "mcp/*", "mcp/request:*", "chat"
export type Capability = z.infer<typeof CapabilitySchema>;

export const ParticipantInfoSchema = z.object({
  id: z.string(),
  capabilities: z.array(CapabilitySchema)
});
export type ParticipantInfo = z.infer<typeof ParticipantInfoSchema>;

// For backward compat, keeping minimal Participant type
export interface Participant {
  id: string;
  capabilities: string[];
}

// v0.1 uses hierarchical kind format
// mcp/request:METHOD[:CONTEXT], mcp/response:METHOD[:CONTEXT], mcp/proposal:METHOD[:CONTEXT]
// system/welcome, system/presence, system/error
// chat
export const MessageKindSchema = z.string();
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

// Presence payload schema (v0.1)
export const PresenceEventSchema = z.enum(['join', 'leave']);
export const PresencePayloadSchema = z.object({
  event: PresenceEventSchema,
  participant: ParticipantInfoSchema
});
export type PresencePayload = z.infer<typeof PresencePayloadSchema>;

// System payload schemas (v0.1)
export const SystemWelcomePayloadSchema = z.object({
  you: ParticipantInfoSchema,  // The joining participant's info
  participants: z.array(ParticipantInfoSchema)  // Other participants
});
export type SystemWelcomePayload = z.infer<typeof SystemWelcomePayloadSchema>;

export const SystemErrorPayloadSchema = z.object({
  error: z.string(),
  message: z.string(),
  attempted_kind: z.string().optional(),
  your_capabilities: z.array(z.string()).optional()
});
export type SystemErrorPayload = z.infer<typeof SystemErrorPayloadSchema>;

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
    protocol: 'mcpx/v0.1',
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

// Chat message helpers (v0.1)
export interface ChatPayload {
  text: string;
  format?: 'plain' | 'markdown';
}

export function createChatMessage(from: string, message: ChatPayload): Envelope {
  return createEnvelope(from, 'chat', {
    text: message.text,
    format: message.format || 'plain'
  });
}

// Helper to parse kind format
export function parseKind(kind: string): { base: string; method?: string; context?: string } {
  const parts = kind.split(':');
  if (parts.length === 1) {
    return { base: parts[0] };
  }
  const [base, methodAndContext] = [parts[0], parts.slice(1).join(':')];
  const contextParts = methodAndContext.split(':');
  return {
    base,
    method: contextParts[0],
    context: contextParts.length > 1 ? contextParts.slice(1).join(':') : undefined
  };
}

// Check if a capability matches a kind
export function matchesCapability(kind: string, capability: string): boolean {
  // Exact match
  if (kind === capability) return true;
  
  // Wildcard matching
  if (capability.endsWith('*')) {
    const prefix = capability.slice(0, -1);
    return kind.startsWith(prefix);
  }
  
  return false;
}

// Check if any capability matches the kind
export function hasCapability(kind: string, capabilities: string[]): boolean {
  return capabilities.some(cap => matchesCapability(kind, cap));
}