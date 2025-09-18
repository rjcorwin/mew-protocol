/**
 * Client-specific types for MEW SDK
 */

import type {
  Envelope,
  Participant,
  Capability,
  Proposal,
  SystemWelcomePayload,
  ChatPayload,
  StreamMetadata,
} from '@mew-protocol/types';

// Re-export commonly used types from the shared types package (relative path for monorepo dev)
export type {
  Envelope,
  PartialEnvelope,
  Participant,
  Capability,
  CapabilityGrant,
  Proposal,
  SystemWelcomePayload,
  SystemErrorPayload,
  PresencePayload,
  ChatPayload,
  MewProposalPayload,
  MewProposalAcceptPayload,
  MewProposalRejectPayload,
  MewCapabilityGrantPayload,
  MewCapabilityRevokePayload,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from '@mew-protocol/types';
export { PROTOCOL_VERSION, MCP_VERSION, MessageKinds } from '@mew-protocol/types';

// ============================================================================
// Client-Specific Types
// ============================================================================

/**
 * Connection options for MEWClient
 */
export interface ConnectionOptions {
  gateway: string;
  space: string;
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
 * Client event map for type-safe event handling
 */
export type ClientEventMap = {
  welcome: (data: SystemWelcomePayload) => void;
  message: (envelope: Envelope) => void;
  chat: (message: ChatPayload, from: string) => void;
  proposal: (proposal: Proposal, from: string) => void;
  'proposal-accept': (data: {
    correlation_id: string;
    accepted_by: string;
    envelope: Envelope;
  }) => void;
  'proposal-reject': (data: {
    correlation_id: string;
    rejected_by: string;
    reason?: string;
  }) => void;
  'capability-grant': (grant: { from: string; to: string; capabilities: Capability[] }) => void;
  'capability-revoke': (data: { from: string; to: string; capabilities: string[] }) => void;
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

export interface StreamRecord extends StreamMetadata {
  intent?: string;
  scope?: string[];
  lastSequence: number;
  createdAt: string;
  updatedAt: string;
}
