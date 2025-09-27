/**
 * Core MEW Protocol Types
 *
 * These types define the Multi-Entity Workspace Protocol v0.4
 */

// ============================================================================
// Protocol Constants
// ============================================================================

export const PROTOCOL_VERSION = 'mew/v0.4';
export const MCP_VERSION = '2025-06-18';

// ============================================================================
// Core Protocol Types
// ============================================================================

/**
 * MEW envelope - the top-level wrapper for all messages
 */
export interface Envelope {
  protocol: 'mew/v0.4';
  id: string;
  ts: string;
  from: string;
  to?: string[];
  kind: string;
  correlation_id?: string[];
  context?: ContextField;
  payload: any;
}

/**
 * Partial envelope for sending (auto-fills protocol, id, ts, from)
 */
export interface PartialEnvelope {
  to?: string[];
  kind: string;
  correlation_id?: string[];
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
  [key: string]: unknown;
}

/**
 * Capability definition with JSON pattern matching
 */
export interface Capability {
  id?: string;
  kind: string;
  to?: string[];
  payload?: any;
  [key: string]: unknown;
}

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
  [key: string]: unknown;
}

/**
 * Presence event payload
 */
export interface PresencePayload {
  event: 'join' | 'leave';
  participant: Participant;
  [key: string]: unknown;
}

export type SystemPayload = SystemWelcomePayload | SystemErrorPayload | PresencePayload;

// ============================================================================
// Capability & Space Management Payloads
// ============================================================================

export interface CapabilityGrantPayload {
  recipient: string;
  capabilities: Capability[];
  grant_id?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface CapabilityRevokePayload {
  recipient: string;
  grant_id?: string;
  capabilities?: Capability[];
  reason?: string;
  [key: string]: unknown;
}

export interface CapabilityGrantAckPayload {
  status?: 'accepted' | 'declined' | string;
  grant_id?: string;
  capabilities?: Capability[];
  reason?: string;
  [key: string]: unknown;
}

export interface SpaceInvitePayload {
  participant_id: string;
  email?: string;
  initial_capabilities?: Capability[];
  reason?: string;
  [key: string]: unknown;
}

export interface SpaceKickPayload {
  participant_id: string;
  reason?: string;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export interface ChatAcknowledgePayload {
  status?: string;
  [key: string]: unknown;
}

export interface ChatCancelPayload {
  reason?: string;
  [key: string]: unknown;
}

// ============================================================================
// Reasoning Transparency
// ============================================================================

export interface ReasoningCancelPayload {
  reason?: string;
  [key: string]: unknown;
}

// ============================================================================
// Participant Control Payloads
// ============================================================================

export interface ParticipantPausePayload {
  reason?: string;
  timeout_seconds?: number;
  [key: string]: unknown;
}

export interface ParticipantResumePayload {
  reason?: string;
  [key: string]: unknown;
}

export interface ParticipantRequestStatusPayload {
  fields?: string[];
  [key: string]: unknown;
}

export interface ParticipantStatusPayload {
  tokens?: number;
  max_tokens?: number;
  messages_in_context: number;
  status?: string;
  latency_ms?: number;
  [key: string]: unknown;
}

export interface ParticipantForgetPayload {
  direction: 'oldest' | 'newest';
  entries?: number;
  [key: string]: unknown;
}

export interface ParticipantCompactPayload {
  reason?: string;
  target_tokens?: number;
  [key: string]: unknown;
}

export interface ParticipantCompactDonePayload {
  freed_tokens?: number;
  freed_messages?: number;
  status?: string;
  skipped?: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface ParticipantClearPayload {
  reason?: string;
  [key: string]: unknown;
}

export interface ParticipantRestartPayload {
  mode?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ParticipantShutdownPayload {
  reason?: string;
  [key: string]: unknown;
}

// ============================================================================
// Stream Payloads
// ============================================================================

export interface StreamRequestPayload {
  direction: string;
  expected_size_bytes?: number;
  description?: string;
  [key: string]: unknown;
}

export interface StreamOpenPayload {
  stream_id: string;
  encoding?: string;
  compression?: string;
  description?: string;
  [key: string]: unknown;
}

export interface StreamClosePayload {
  reason?: string;
  [key: string]: unknown;
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
  MCP_PROPOSAL: 'mcp/proposal',
  MCP_WITHDRAW: 'mcp/withdraw',
  MCP_REJECT: 'mcp/reject',
  MCP_NOTIFICATION: 'mcp/notification',

  // Capability & space management
  CAPABILITY_GRANT: 'capability/grant',
  CAPABILITY_REVOKE: 'capability/revoke',
  CAPABILITY_GRANT_ACK: 'capability/grant-ack',
  SPACE_INVITE: 'space/invite',
  SPACE_KICK: 'space/kick',

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
  PARTICIPANT_COMPACT: 'participant/compact',
  PARTICIPANT_COMPACT_DONE: 'participant/compact-done',
  PARTICIPANT_CLEAR: 'participant/clear',
  PARTICIPANT_RESTART: 'participant/restart',
  PARTICIPANT_SHUTDOWN: 'participant/shutdown',

  // Streams
  STREAM_REQUEST: 'stream/request',
  STREAM_OPEN: 'stream/open',
  STREAM_CLOSE: 'stream/close',
} as const;

export type MessageKind = typeof MessageKinds[keyof typeof MessageKinds];

// ============================================================================
// Legacy aliases
// ============================================================================

/** @deprecated Use {@link CapabilityGrantPayload}. */
export type CapabilityGrant = CapabilityGrantPayload;

/** @deprecated Use {@link CapabilityGrantPayload}. */
export type MewCapabilityGrantPayload = CapabilityGrantPayload;

/** @deprecated Use {@link CapabilityRevokePayload}. */
export type MewCapabilityRevokePayload = CapabilityRevokePayload;

/** @deprecated Legacy MEW proposal envelopes are no longer part of v0.4. */
export interface MewProposalPayload {
  proposal: Proposal;
}

/** @deprecated Legacy MEW proposal accept envelope. */
export interface MewProposalAcceptPayload {
  correlation_id: string;
  accepted_by: string;
  envelope: Envelope;
}

/** @deprecated Legacy MEW proposal reject envelope. */
export interface MewProposalRejectPayload {
  correlation_id: string;
  rejected_by: string;
  reason?: string;
}
