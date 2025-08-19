// Shared MCPx types for frontend

export type MCPxProtocol = 'mcp-x/v0';
export type MessageKind = 'mcp' | 'presence' | 'system';
export type ParticipantKind = 'human' | 'agent' | 'robot';

export interface Participant {
  id: string;
  name: string;
  kind: ParticipantKind;
  mcp: {
    version: string;
  };
}

export interface Envelope {
  protocol: MCPxProtocol;
  id: string;
  ts: string;
  from: string;
  to?: string[];
  kind: MessageKind;
  correlation_id?: string;
  payload: any;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
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
  params?: Record<string, any>;
}

export interface PresencePayload {
  event: 'join' | 'leave' | 'heartbeat';
  participant: Participant;
}

export interface SystemWelcomePayload {
  event: 'welcome';
  participant: { id: string };
  participants: Participant[];
  history: {
    enabled: boolean;
    limit: number;
  };
  protocol: MCPxProtocol;
}

export interface ChatMessage {
  text: string;
  format?: 'plain' | 'markdown';
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  topic?: string;
  participantId?: string;
  error?: string;
}

export interface TopicInfo {
  name: string;
  participants: Participant[];
  messageCount: number;
}

// Helper functions
export function createEnvelope(
  from: string,
  kind: MessageKind,
  payload: any,
  to?: string[],
  correlationId?: string
): Envelope {
  return {
    protocol: 'mcp-x/v0',
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    from,
    to,
    kind,
    correlation_id: correlationId,
    payload
  };
}

export function createChatMessage(from: string, text: string, format: 'plain' | 'markdown' = 'plain'): Envelope {
  return createEnvelope(from, 'mcp', {
    jsonrpc: '2.0',
    method: 'notifications/chat/message',
    params: { text, format }
  });
}

export function createMCPRequest(
  from: string,
  to: string,
  method: string,
  params?: Record<string, any>,
  id: string | number = crypto.randomUUID()
): Envelope {
  return createEnvelope(from, 'mcp', {
    jsonrpc: '2.0',
    id,
    method,
    params
  }, [to]);
}

export function isChatMessage(envelope: Envelope): boolean {
  return envelope.kind === 'mcp' && 
         envelope.payload?.method === 'notifications/chat/message';
}

export function isPresenceMessage(envelope: Envelope): boolean {
  return envelope.kind === 'presence';
}

export function isSystemMessage(envelope: Envelope): boolean {
  return envelope.kind === 'system';
}