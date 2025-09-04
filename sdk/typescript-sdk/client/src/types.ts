/**
 * Client-specific types for MEUP SDK
 */

import type {
  Envelope,
  PartialEnvelope,
  Participant,
  Capability,
  Proposal,
  SystemWelcomePayload,
  ChatPayload,
} from '@meup/types';

// Re-export commonly used types from @meup/types for convenience
export * from '@meup/types';

// ============================================================================
// Client-Specific Types
// ============================================================================

/**
 * Connection options for MEUPClient
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
  'proposal-accept': (data: { correlation_id: string; accepted_by: string; envelope: Envelope }) => void;
  'proposal-reject': (data: { correlation_id: string; rejected_by: string; reason?: string }) => void;
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