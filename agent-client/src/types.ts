import { z } from 'zod';

// MCPx Envelope types
export const EnvelopeSchema = z.object({
  protocol: z.literal('mcp-x/v0'),
  id: z.string(),
  ts: z.string(),
  from: z.string(),
  to: z.array(z.string()).optional(),
  kind: z.enum(['mcp', 'presence', 'system', 'chat']),
  correlation_id: z.string().optional(),
  payload: z.any()
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

// Peer types
export interface Peer {
  id: string;
  name?: string;
  kind: 'human' | 'agent' | 'robot';
  tools: Tool[];
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, any>;
}

// Tool types
export interface Tool {
  peerId: string;
  name: string;
  description?: string;
  inputSchema?: any;
}

// Tool call types
export interface ToolCall {
  peerId: string;
  tool: string;
  params: any;
  timeout?: number;
}

export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
}

// Chat types
export interface ChatMessage {
  from: string;
  text: string;
  format: 'plain' | 'markdown';
  timestamp: Date;
}

// Presence types
export interface PresenceEvent {
  event: 'join' | 'leave' | 'heartbeat';
  participant: {
    id: string;
    name?: string;
    kind: 'human' | 'agent' | 'robot';
    metadata?: Record<string, any>;
  };
  timestamp: string;
}

// System types
export interface SystemWelcome {
  participants: Array<{
    id: string;
    name?: string;
    kind: 'human' | 'agent' | 'robot';
    metadata?: Record<string, any>;
  }>;
  history: Envelope[];
}

// Connection types
export interface MCPxConfig {
  serverUrl: string;
  topic: string;
  participantId: string;
  participantName?: string;
  authToken: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
}

// Event types
export interface MCPxEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  error: (error: Error) => void;
  peerJoined: (peer: Peer) => void;
  peerLeft: (peerId: string) => void;
  peerUpdated: (peer: Peer) => void;
  chat: (message: ChatMessage) => void;
  toolCall: (request: ToolCallRequest) => Promise<any>;
  message: (envelope: Envelope) => void;
}

export interface ToolCallRequest {
  from: string;
  tool: string;
  params: any;
  requestId: string | number;
}

// Topic context
export interface TopicContext {
  topic: string;
  participantId: string;
  participants: Map<string, Peer>;
  messageHistory: Envelope[];
  availableTools: Map<string, Tool[]>;
}

// MCP types
export interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}