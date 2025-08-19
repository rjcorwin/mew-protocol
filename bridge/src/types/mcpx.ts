// MCPx protocol types (shared with server/frontend)

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
    id: generateUUID(),
    ts: new Date().toISOString(),
    from,
    to,
    kind,
    correlation_id: correlationId,
    payload
  };
}

export function generateUUID(): string {
  return require('uuid').v4();
}

export function isMCPRequest(payload: any): payload is MCPRequest {
  return payload?.jsonrpc === '2.0' && 
         payload?.method && 
         payload?.id !== undefined;
}

export function isMCPResponse(payload: any): payload is MCPResponse {
  return payload?.jsonrpc === '2.0' && 
         payload?.id !== undefined &&
         (payload?.result !== undefined || payload?.error !== undefined);
}

export function isMCPNotification(payload: any): payload is MCPNotification {
  return payload?.jsonrpc === '2.0' && 
         payload?.method && 
         payload?.id === undefined;
}