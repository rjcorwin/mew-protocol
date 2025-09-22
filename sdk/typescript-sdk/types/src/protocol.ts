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
 * Structured context operations for sub-context protocol management.
 *
 * The type system allows both legacy string context identifiers and the
 * expanded operation objects so existing agents continue to function while we
 * phase in richer context semantics.
 */
export interface ContextOperation {
  operation: 'push' | 'pop' | 'resume';
  topic?: string;
  correlation_id?: string;
}

/**
 * Context field for sub-context protocol
 */
export type ContextField = string | ContextOperation;

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
  event: 'join' | 'leave' | 'heartbeat' | 'update';
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

export interface ChatAcknowledgePayload {
  status?: string;
}

export interface ChatCancelPayload {
  reason?: string;
}

export interface ReasoningCancelPayload {
  reason?: string;
}

export interface ParticipantPausePayload {
  reason?: string;
  timeout_seconds?: number;
}

export interface ParticipantResumePayload {
  reason?: string;
}

export interface ParticipantRequestStatusPayload {
  fields?: string[];
}

export interface ParticipantStatusPayload {
  tokens?: number;
  max_tokens?: number;
  messages_in_context: number;
  status?: string;
  latency_ms?: number;
  [key: string]: any;
}

export interface ParticipantForgetPayload {
  direction: 'oldest' | 'newest';
  entries?: number;
}

export interface ParticipantClearPayload {
  reason?: string;
}

export interface ParticipantRestartPayload {
  mode?: string;
  reason?: string;
}

export interface ParticipantShutdownPayload {
  reason?: string;
}

export interface StreamRequestPayload {
  direction: string;
  expected_size_bytes?: number;
  description?: string;
}

export interface StreamOpenPayload {
  stream_id: string;
  encoding?: string;
  compression?: string;
}

export interface StreamClosePayload {
  reason?: string;
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

  // Application messages
  CHAT: 'chat',
  CHAT_ACKNOWLEDGE: 'chat/acknowledge',
  CHAT_CANCEL: 'chat/cancel',

  // Reasoning transparency
  REASONING_START: 'reasoning/start',
  REASONING_THOUGHT: 'reasoning/thought',
  REASONING_CONCLUSION: 'reasoning/conclusion',
  REASONING_CANCEL: 'reasoning/cancel',

  // Participant control
  PARTICIPANT_PAUSE: 'participant/pause',
  PARTICIPANT_RESUME: 'participant/resume',
  PARTICIPANT_STATUS: 'participant/status',
  PARTICIPANT_REQUEST_STATUS: 'participant/request-status',
  PARTICIPANT_FORGET: 'participant/forget',
  PARTICIPANT_CLEAR: 'participant/clear',
  PARTICIPANT_RESTART: 'participant/restart',
  PARTICIPANT_SHUTDOWN: 'participant/shutdown',

  // Streams
  STREAM_REQUEST: 'stream/request',
  STREAM_OPEN: 'stream/open',
  STREAM_CLOSE: 'stream/close',
  STREAM_DATA: 'stream/data',
} as const;

export type MessageKind = typeof MessageKinds[keyof typeof MessageKinds];