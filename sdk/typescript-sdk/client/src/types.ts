/**
 * Core MEUP (Multi-Entity Unified-context Protocol) types matching v0.2 specification
 */

export const PROTOCOL_VERSION = 'meup/v0.2';
export const MCP_VERSION = '2025-06-18';

/**
 * MEUP envelope - the top-level wrapper for all messages
 */
export interface Envelope {
  protocol: 'meup/v0.2';
  id: string;
  ts: string;
  from: string;
  to?: string[];
  kind: string; // v0.2 uses slash notation like 'mcp/request', 'meup/proposal'
  correlation_id?: string;
  context?: ContextField;
  payload: any;
}

/**
 * Partial envelope for sending (auto-fills protocol, id, ts, from)
 */
export interface PartialEnvelope {
  to?: string[];
  kind: string;
  correlation_id?: string;
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
 * Proposal for untrusted agents
 */
export interface Proposal {
  correlation_id: string;
  capability: string;
  envelope: PartialEnvelope;
}

/**
 * Capability grant
 */
export interface CapabilityGrant {
  from: string;
  to: string;
  capabilities: Capability[];
}

/**
 * Presence event payload
 */
export interface PresencePayload {
  event: 'join' | 'leave' | 'heartbeat';
  participant: Participant;
}

/**
 * System message payloads (v0.2)
 */
export interface SystemWelcomePayload {
  you: Participant;
  participants: Participant[];
}

export interface SystemErrorPayload {
  error: string;
  message: string;
  attempted_kind?: string;
  your_capabilities?: Capability[];
}

export type SystemPayload = SystemWelcomePayload | SystemErrorPayload;

/**
 * MEUP-specific payloads
 */
export interface MeupProposalPayload {
  proposal: Proposal;
}

export interface MeupProposalAcceptPayload {
  correlation_id: string;
  accepted_by: string;
  envelope: Envelope;
}

export interface MeupProposalRejectPayload {
  correlation_id: string;
  rejected_by: string;
  reason?: string;
}

export interface MeupCapabilityGrantPayload {
  grant: CapabilityGrant;
}

export interface MeupCapabilityRevokePayload {
  from: string;
  to: string;
  capabilities: string[];
}

/**
 * MCP JSON-RPC 2.0 message types
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

/**
 * Chat message format (v0.2)
 */
export interface ChatPayload {
  text: string;
  format?: 'plain' | 'markdown';
}

/**
 * Connection options
 */
export interface ConnectionOptions {
  gateway: string;
  space: string;  // Changed from 'topic' to 'space'
  token: string;
  participant_id?: string;
  capabilities?: Capability[];
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
  requestTimeout?: number;
}

/**
 * Pending request tracking
 */
export interface PendingRequest {
  envelope: Envelope;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
  timeout?: NodeJS.Timeout;
}

/**
 * Pending proposal tracking
 */
export interface PendingProposal {
  proposal: Proposal;
  resolve: (envelope: Envelope) => void;
  reject: (reason: string) => void;
  timestamp: number;
  timeout?: NodeJS.Timeout;
}

/**
 * Client events
 */
export type ClientEventMap = {
  welcome: (data: SystemWelcomePayload) => void;
  message: (envelope: Envelope) => void;
  chat: (message: ChatPayload, from: string) => void;
  proposal: (proposal: Proposal, from: string) => void;
  'proposal-accept': (data: MeupProposalAcceptPayload) => void;
  'proposal-reject': (data: MeupProposalRejectPayload) => void;
  'capability-grant': (grant: CapabilityGrant) => void;
  'capability-revoke': (data: MeupCapabilityRevokePayload) => void;
  'participant-joined': (participant: Participant) => void;
  'participant-left': (participant: Participant) => void;
  error: (error: Error) => void;
  reconnected: () => void;
  connected: () => void;
  disconnected: () => void;
};

/**
 * REST API types
 */
export interface SpaceInfo {
  name: string;
  participants: number;
  created: string;
}

export interface HistoryOptions {
  limit?: number;
  before?: string;
}