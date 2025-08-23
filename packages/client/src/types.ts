/**
 * Core MCPx protocol types matching v0 specification
 */

export const PROTOCOL_VERSION = 'mcp-x/v0';
export const MCP_VERSION = '2025-06-18';

/**
 * MCPx envelope - the top-level wrapper for all messages
 */
export interface Envelope {
  protocol: 'mcp-x/v0';
  id: string;
  ts: string;
  from: string;
  to?: string[];
  kind: 'mcp' | 'presence' | 'system';
  correlation_id?: string;
  payload: any;
}

/**
 * Partial envelope for sending (auto-fills protocol, id, ts, from)
 */
export interface PartialEnvelope {
  to?: string[];
  kind: 'mcp' | 'presence' | 'system';
  correlation_id?: string;
  payload: any;
}

/**
 * Participant in a topic
 */
export interface Peer {
  id: string;
  name?: string;
  kind: 'human' | 'agent' | 'robot';
  mcp?: {
    version: string;
  };
}

/**
 * Presence event payload
 */
export interface PresencePayload {
  event: 'join' | 'leave' | 'heartbeat';
  participant: Peer;
}

/**
 * System message payloads
 */
export interface SystemWelcomePayload {
  type: 'welcome';
  participant_id: string;
  topic: string;
  participants: Peer[];
  history?: Envelope[];
}

export interface SystemErrorPayload {
  type: 'error';
  code: string;
  message: string;
  details?: any;
}

export type SystemPayload = SystemWelcomePayload | SystemErrorPayload;

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
 * Chat notification format
 */
export interface ChatMessage {
  jsonrpc: '2.0';
  method: 'notifications/chat/message';
  params: {
    text: string;
    format?: 'plain' | 'markdown';
  };
}

/**
 * Connection options
 */
export interface ConnectionOptions {
  gateway: string;
  topic: string;
  token: string;
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
 * Client events
 */
export type ClientEventMap = {
  welcome: (data: SystemWelcomePayload) => void;
  message: (envelope: Envelope) => void;
  chat: (message: ChatMessage, from: string) => void;
  'peer-joined': (peer: Peer) => void;
  'peer-left': (peer: Peer) => void;
  error: (error: Error) => void;
  reconnected: () => void;
  connected: () => void;
  disconnected: () => void;
};

/**
 * REST API types
 */
export interface TopicInfo {
  name: string;
  participants: number;
  created: string;
}

export interface HistoryOptions {
  limit?: number;
  before?: string;
}