/**
 * MEUP Gateway types
 */

import { WebSocket } from 'ws';

export const PROTOCOL_VERSION = 'meup/v0.2';
export const MCP_VERSION = '2025-06-18';

/**
 * MEUP envelope - matches client/agent types
 */
export interface Envelope {
  protocol: 'meup/v0.2';
  id: string;
  ts: string;
  from: string;
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
 * Capability definition with JSON pattern matching
 */
export interface Capability {
  id: string;
  kind: string;
  to?: string | string[];
  payload?: any;
}

/**
 * Participant in a space
 */
export interface Participant {
  id: string;
  capabilities: Capability[];
}

/**
 * Connected client
 */
export interface ConnectedClient {
  ws: WebSocket;
  participantId: string;
  spaceId: string;
  capabilities: Capability[];
  authenticated: boolean;
  metadata: Record<string, any>;
  lastActivity: Date;
  contextStack: string[];
}

/**
 * Space (communication channel)
 */
export interface Space {
  id: string;
  name: string;
  clients: Map<string, ConnectedClient>;
  created: Date;
  messageHistory: Envelope[];
  maxHistorySize: number;
  metadata: Record<string, any>;
  adminIds: Set<string>;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  port?: number;
  host?: string;
  corsOrigins?: string[];
  maxSpaces?: number;
  maxClientsPerSpace?: number;
  maxMessageSize?: number;
  maxHistorySize?: number;
  heartbeatInterval?: number;
  authSecret?: string;
  enableRestApi?: boolean;
  enableMetrics?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Authentication token payload
 */
export interface TokenPayload {
  sub: string;  // participant ID
  space?: string;
  capabilities?: Capability[];
  admin?: boolean;
  iat?: number;
  exp?: number;
}

/**
 * Capability check result
 */
export interface CapabilityCheckResult {
  allowed: boolean;
  matchedCapability?: Capability;
  reason?: string;
}

/**
 * Message routing result
 */
export interface RoutingResult {
  delivered: string[];
  failed: string[];
  offline: string[];
}

/**
 * System message payloads
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

export interface PresencePayload {
  event: 'join' | 'leave' | 'heartbeat';
  participant: Participant;
}

/**
 * Metrics data
 */
export interface GatewayMetrics {
  spaces: number;
  totalClients: number;
  messagesProcessed: number;
  messagesPerSecond: number;
  averageLatency: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
}

/**
 * REST API types
 */
export interface SpaceInfo {
  id: string;
  name: string;
  participants: number;
  created: string;
}

export interface CreateSpaceRequest {
  name: string;
  adminIds?: string[];
  metadata?: Record<string, any>;
}

export interface CreateTokenRequest {
  participantId: string;
  space?: string;
  capabilities?: Capability[];
  admin?: boolean;
  expiresIn?: string | number;
}

/**
 * Event emitter events
 */
export interface GatewayEvents {
  'space:created': (space: Space) => void;
  'space:deleted': (spaceId: string) => void;
  'client:connected': (client: ConnectedClient) => void;
  'client:disconnected': (client: ConnectedClient) => void;
  'message:sent': (envelope: Envelope, space: Space) => void;
  'message:blocked': (envelope: Envelope, reason: string) => void;
  'error': (error: Error, client?: ConnectedClient) => void;
}