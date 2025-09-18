/**
 * Core MEW Protocol Types
 * 
 * These types define the Multi-Entity Workspace Protocol v0.3
 */

// ============================================================================
// Protocol Constants
// ============================================================================

export const PROTOCOL_VERSION = 'mew/v0.3';
export const MCP_VERSION = '2025-06-18';

// ============================================================================
// Core Protocol Types
// ============================================================================

/**
 * MEW envelope - the top-level wrapper for all messages
 */
export interface Envelope {
  protocol: 'mew/v0.3';
  id: string;
  ts: string;
  from: string;
  to?: string[];
  kind: string;
  correlation_id?: string | string[];
  context?: ContextField;
  payload: any;
}

/**
 * Partial envelope for sending (auto-fills protocol, id, ts, from)
 */
export interface PartialEnvelope {
  to?: string[];
  kind: string;
  correlation_id?: string | string[];
  context?: ContextField;
  payload: any;
}

/**
 * Context field for sub-context protocol
 */
export interface ContextField {
  operation: 'push' | 'pop' | 'resume';
  topic?: string;
  correlation_id?: string;
}

// ============================================================================
// Participant and Capability Types
// ============================================================================

/**
 * Participant in a space with capabilities
 */
export interface Participant {
  id: string;
  capabilities: Capability[];
}

/**
 * Capability definition with JSON pattern matching
 */
export interface Capability {
  id: string;
  kind: string;
  to?: string | string[];
  payload?: any;
}

/**
 * Capability grant from one participant to another
 */
export interface CapabilityGrant {
  from: string;
  to: string;
  capabilities: Capability[];
}

// ============================================================================
// Proposal System Types
// ============================================================================

/**
 * Proposal for untrusted agents to request operations
 */
export interface Proposal {
  correlation_id: string;
  capability: string;
  envelope: PartialEnvelope;
}

// ============================================================================
// System Message Payloads
// ============================================================================

/**
 * Welcome message payload sent when joining a space
 */
export interface SystemWelcomePayload {
  you: Participant;
  participants: Participant[];
}

/**
 * Error message payload
 */
export interface SystemErrorPayload {
  error: string;
  message: string;
  attempted_kind?: string;
  your_capabilities?: Capability[];
}

/**
 * Presence event payload
 */
export interface PresencePayload {
  event: 'join' | 'leave' | 'heartbeat';
  participant: Participant;
}

export type SystemPayload = SystemWelcomePayload | SystemErrorPayload | PresencePayload;

// ============================================================================
// MEW-specific Message Payloads
// ============================================================================

export interface MewProposalPayload {
  proposal: Proposal;
}

export interface MewProposalAcceptPayload {
  correlation_id: string;
  accepted_by: string;
  envelope: Envelope;
}

export interface MewProposalRejectPayload {
  correlation_id: string;
  rejected_by: string;
  reason?: string;
}

export interface MewCapabilityGrantPayload {
  grant: CapabilityGrant;
}

export interface MewCapabilityRevokePayload {
  from: string;
  to: string;
  capabilities: string[];
}

// ============================================================================
// Chat Message Types
// ============================================================================

/**
 * Chat message format
 */
export interface ChatPayload {
  text: string;
  format?: 'plain' | 'markdown';
}

// ============================================================================
// Stream Message Types
// ============================================================================

export type StreamStatus = 'pending' | 'ready' | 'live' | 'complete' | 'error';

export interface StreamCapabilitiesDescriptor {
  write?: string[];
  read?: string[];
}

export interface StreamFormatDescriptor {
  id: string;
  description?: string;
  mime_type?: string;
  schema?: any;
  metadata?: Record<string, unknown>;
}

export interface StreamMetadata {
  stream_id: string;
  namespace: string;
  creator: string;
  status: StreamStatus;
  formats: StreamFormatDescriptor[];
  capabilities?: StreamCapabilitiesDescriptor;
  intent?: string;
  scope?: string[];
}

export interface StreamAnnouncePayload {
  intent?: string;
  desired_id?: string;
  formats: StreamFormatDescriptor[];
  scope?: string[];
}

export interface StreamReadyPayload {
  stream: StreamMetadata;
  intent?: string;
  scope?: string[];
}

export interface StreamReference {
  stream_id: string;
  namespace?: string;
}

export interface StreamStartPayload {
  stream: StreamReference;
  start_ts?: string;
  [key: string]: any;
}

export interface StreamDataPayload {
  stream: StreamReference;
  sequence: number;
  format_id?: string;
  content: any;
  [key: string]: any;
}

export interface StreamCompletePayload {
  stream: StreamReference;
  reason?: string;
  [key: string]: any;
}

export interface StreamErrorPayload extends StreamCompletePayload {
  code: string;
  message: string;
}

// ============================================================================
// Message Kind Constants
// ============================================================================

export const MessageKinds = {
  // System messages
  SYSTEM_WELCOME: 'system/welcome',
  SYSTEM_ERROR: 'system/error',
  SYSTEM_PRESENCE: 'system/presence',
  SYSTEM_HEARTBEAT: 'system/heartbeat',
  
  // MCP messages
  MCP_REQUEST: 'mcp/request',
  MCP_RESPONSE: 'mcp/response',
  MCP_NOTIFICATION: 'mcp/notification',
  
  // MEW messages
  MEW_PROPOSAL: 'mew/proposal',
  MEW_PROPOSAL_ACCEPT: 'mew/proposal/accept',
  MEW_PROPOSAL_REJECT: 'mew/proposal/reject',
  MEW_CAPABILITY_GRANT: 'mew/capability/grant',
  MEW_CAPABILITY_REVOKE: 'mew/capability/revoke',
  MEW_CONTEXT: 'mew/context',
  
  // Stream messages
  STREAM_ANNOUNCE: 'stream/announce',
  STREAM_READY: 'stream/ready',
  STREAM_START: 'stream/start',
  STREAM_DATA: 'stream/data',
  STREAM_COMPLETE: 'stream/complete',
  STREAM_ERROR: 'stream/error',
  
  // Application messages
  CHAT: 'chat',
} as const;

export type MessageKind = typeof MessageKinds[keyof typeof MessageKinds];
