import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type {
  Envelope,
  PartialEnvelope,
  Participant,
  Capability,
  Proposal,
  CapabilityGrant,
  PresencePayload,
  SystemWelcomePayload,
  SystemErrorPayload,
  MewProposalPayload,
  MewProposalAcceptPayload,
  MewProposalRejectPayload,
  MewCapabilityGrantPayload,
  MewCapabilityRevokePayload,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ChatPayload,
  ConnectionOptions,
  PendingRequest,
  PendingProposal,
  SpaceInfo,
  HistoryOptions,
} from './types';
import { PROTOCOL_VERSION } from './types';

export const ClientEvents = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTED: 'reconnected',
  MESSAGE: 'message',
  WELCOME: 'welcome',
  ERROR: 'error',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  CHAT: 'chat',
  PROPOSAL: 'proposal',
  PROPOSAL_ACCEPT: 'proposal-accept',
  PROPOSAL_REJECT: 'proposal-reject',
  CAPABILITY_GRANT: 'capability-grant',
  CAPABILITY_REVOKE: 'capability-revoke',
} as const;

export type ClientEventParams = {
  [ClientEvents.CONNECTED]: [];
  [ClientEvents.DISCONNECTED]: [];
  [ClientEvents.RECONNECTED]: [];
  [ClientEvents.MESSAGE]: [envelope: Envelope];
  [ClientEvents.WELCOME]: [data: SystemWelcomePayload];
  [ClientEvents.ERROR]: [error: Error];
  [ClientEvents.PARTICIPANT_JOINED]: [participant: Participant];
  [ClientEvents.PARTICIPANT_LEFT]: [participant: Participant];
  [ClientEvents.CHAT]: [message: ChatPayload, from: string];
  [ClientEvents.PROPOSAL]: [proposal: Proposal, from: string];
  [ClientEvents.PROPOSAL_ACCEPT]: [data: MewProposalAcceptPayload];
  [ClientEvents.PROPOSAL_REJECT]: [data: MewProposalRejectPayload];
  [ClientEvents.CAPABILITY_GRANT]: [grant: CapabilityGrant];
  [ClientEvents.CAPABILITY_REVOKE]: [data: MewCapabilityRevokePayload];
};

export type ChatHandler = (message: ChatPayload, from: string) => void;
export type ErrorHandler = (error: Error) => void;
export type WelcomeHandler = (data: SystemWelcomePayload) => void;
export type ParticipantHandler = (participant: Participant) => void;
export type MessageHandler = (envelope: Envelope) => void;
export type ProposalHandler = (proposal: Proposal, from: string) => void;
export type ProposalAcceptHandler = (data: MewProposalAcceptPayload) => void;
export type ProposalRejectHandler = (data: MewProposalRejectPayload) => void;
export type CapabilityGrantHandler = (grant: CapabilityGrant) => void;
export type CapabilityRevokeHandler = (data: MewCapabilityRevokePayload) => void;
export type VoidHandler = () => void;

export class MEWClient {
  private ws: WebSocket | null = null;
  private options: Required<ConnectionOptions>;
  private participantId: string | null = null;
  private capabilities: Capability[] = [];
  private participants: Map<string, Participant> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private pendingProposals: Map<string, PendingProposal> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private contextStack: string[] = [];
  
  private handlers = {
    chat: new Set<ChatHandler>(),
    error: new Set<ErrorHandler>(),
    welcome: new Set<WelcomeHandler>(),
    'participant-joined': new Set<ParticipantHandler>(),
    'participant-left': new Set<ParticipantHandler>(),
    message: new Set<MessageHandler>(),
    connected: new Set<VoidHandler>(),
    disconnected: new Set<VoidHandler>(),
    reconnected: new Set<VoidHandler>(),
    proposal: new Set<ProposalHandler>(),
    'proposal-accept': new Set<ProposalAcceptHandler>(),
    'proposal-reject': new Set<ProposalRejectHandler>(),
    'capability-grant': new Set<CapabilityGrantHandler>(),
    'capability-revoke': new Set<CapabilityRevokeHandler>(),
  };

  constructor(options: ConnectionOptions) {
    this.options = {
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
      requestTimeout: 30000,
      participant_id: options.participant_id || `client-${uuidv4().split('-')[0]}`,
      capabilities: [],
      ...options,
    };
    this.participantId = this.options.participant_id!;
    this.capabilities = this.options.capabilities;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return this.connectionPromise!;
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.isConnecting = true;
    this.connectionPromise = this.doConnect();
    try { await this.connectionPromise; } finally { this.isConnecting = false; this.connectionPromise = null; }
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.options.gateway}/spaces/${this.options.space}`;
      this.ws = new WebSocket(url, { headers: { 'Authorization': `Bearer ${this.options.token}`, 'X-Participant-ID': this.participantId!, } });
      const timeout = setTimeout(() => { this.ws?.close(); reject(new Error('Connection timeout')); }, 10000);
      this.ws.once('open', () => { clearTimeout(timeout); this.reconnectAttempts = 0; this.startHeartbeat(); this.emit('connected'); resolve(); });
      this.ws.once('error', (error) => { clearTimeout(timeout); this.emit('error', error); reject(error); });
      this.ws.on('message', (data: WebSocket.Data) => { try { const envelope = JSON.parse(data.toString()) as Envelope; this.handleEnvelope(envelope); } catch (error) { this.emit('error', error as Error); } });
      this.ws.on('close', () => { this.stopHeartbeat(); this.ws = null; this.emit('disconnected'); if (this.options.reconnect) { this.scheduleReconnect(); } });
    });
  }

  private handleEnvelope(envelope: Envelope): void {
    this.emit('message', envelope);
    if (envelope.kind === 'system/welcome') { const payload = envelope.payload as SystemWelcomePayload; this.participantId = payload.you.id; this.capabilities = payload.you.capabilities; payload.participants.forEach((p: Participant) => this.participants.set(p.id, p)); this.emit('welcome', payload); return; }
    if (envelope.kind === 'system/error') { const payload = envelope.payload as SystemErrorPayload; this.emit('error', new Error(payload.message)); return; }
    if (envelope.kind === 'system/presence') { const payload = envelope.payload as PresencePayload; if (payload.event === 'join') { this.participants.set(payload.participant.id, payload.participant); this.emit('participant-joined', payload.participant); } else if (payload.event === 'leave') { this.participants.delete(payload.participant.id); this.emit('participant-left', payload.participant); } return; }
    if (envelope.kind === 'chat') { this.emit('chat', envelope.payload as ChatPayload, envelope.from); return; }
    if (envelope.kind === 'mew/proposal') { const payload = envelope.payload as MewProposalPayload; this.emit('proposal', payload.proposal, envelope.from); return; }
    if (envelope.kind === 'mew/proposal/accept') { const payload = envelope.payload as MewProposalAcceptPayload; const pending = this.pendingProposals.get(payload.correlation_id); if (pending) { pending.resolve(payload.envelope); this.pendingProposals.delete(payload.correlation_id); } this.emit('proposal-accept', payload); return; }
    if (envelope.kind === 'mew/proposal/reject') { const payload = envelope.payload as MewProposalRejectPayload; const pending = this.pendingProposals.get(payload.correlation_id); if (pending) { pending.reject(payload.reason || 'Proposal rejected'); this.pendingProposals.delete(payload.correlation_id); } this.emit('proposal-reject', payload); return; }
    if (envelope.kind === 'mew/capability/grant') { const payload = envelope.payload as MewCapabilityGrantPayload; if (payload.grant.to === this.participantId) { this.capabilities.push(...payload.grant.capabilities); } this.emit('capability-grant', payload.grant); return; }
    if (envelope.kind === 'mew/capability/revoke') { const payload = envelope.payload as MewCapabilityRevokePayload; if (payload.to === this.participantId) { this.capabilities = this.capabilities.filter(c => !payload.capabilities.includes(c.id)); } this.emit('capability-revoke', payload); return; }
    if (envelope.kind === 'mcp/response' && envelope.correlation_id) { const pending = this.pendingRequests.get(envelope.correlation_id); if (pending) { const response = envelope.payload as JsonRpcResponse; if (response.error) { pending.reject(new Error(response.error.message)); } else { pending.resolve(response.result); } this.pendingRequests.delete(envelope.correlation_id); } return; }
  }

  async send(partial: PartialEnvelope): Promise<void> { const envelope: Envelope = { protocol: PROTOCOL_VERSION, id: uuidv4(), ts: new Date().toISOString(), from: this.participantId!, ...partial, }; if (!this.ws || this.ws.readyState !== WebSocket.OPEN) { throw new Error('Not connected'); } this.ws.send(JSON.stringify(envelope)); }
  async sendChat(text: string, format: 'plain' | 'markdown' = 'plain'): Promise<void> { await this.send({ kind: 'chat', payload: { text, format }, }); }
  async request<T = any>(method: string, params?: any, target?: string): Promise<T> { const correlationId = uuidv4(); const envelope: PartialEnvelope = { kind: 'mcp/request', to: target ? [target] : undefined, correlation_id: correlationId, payload: { jsonrpc: '2.0', id: correlationId, method, params, } as JsonRpcRequest, }; await this.send(envelope); return new Promise((resolve, reject) => { const timeout = setTimeout(() => { this.pendingRequests.delete(correlationId); reject(new Error(`Request timeout: ${method}`)); }, this.options.requestTimeout); this.pendingRequests.set(correlationId, { envelope: {} as Envelope, resolve, reject, timestamp: Date.now(), timeout, }); }); }
  async notify(method: string, params?: any, target?: string): Promise<void> { await this.send({ kind: 'mcp/notification', to: target ? [target] : undefined, payload: { jsonrpc: '2.0', method, params, } as JsonRpcNotification, }); }
  async propose(capability: string, envelope: PartialEnvelope): Promise<Envelope> { const correlationId = uuidv4(); const proposal: Proposal = { correlation_id: correlationId, capability, envelope, }; await this.send({ kind: 'mew/proposal', payload: { proposal }, }); return new Promise((resolve, reject) => { const timeout = setTimeout(() => { this.pendingProposals.delete(correlationId); reject(new Error(`Proposal timeout: ${capability}`)); }, this.options.requestTimeout); this.pendingProposals.set(correlationId, { proposal, resolve, reject, timestamp: Date.now(), timeout, }); }); }
  async acceptProposal(correlationId: string): Promise<void> { await this.send({ kind: 'mew/proposal/accept', payload: { correlation_id: correlationId, accepted_by: this.participantId, }, }); }
  async rejectProposal(correlationId: string, reason?: string): Promise<void> { await this.send({ kind: 'mew/proposal/reject', payload: { correlation_id: correlationId, rejected_by: this.participantId, reason, }, }); }
  async grantCapabilities(to: string, capabilities: Capability[]): Promise<void> { await this.send({ kind: 'mew/capability/grant', payload: { grant: { from: this.participantId, to, capabilities, }, }, }); }
  async revokeCapabilities(to: string, capabilityIds: string[]): Promise<void> { await this.send({ kind: 'mew/capability/revoke', payload: { from: this.participantId, to, capabilities: capabilityIds, }, }); }
  async pushContext(topic: string): Promise<void> { const correlationId = uuidv4(); this.contextStack.push(correlationId); await this.send({ kind: 'mew/context', context: { operation: 'push', topic, correlation_id: correlationId, }, payload: {}, }); }
  async popContext(): Promise<void> { const correlationId = this.contextStack.pop(); if (!correlationId) { throw new Error('No context to pop'); } await this.send({ kind: 'mew/context', context: { operation: 'pop', correlation_id: correlationId, }, payload: {}, }); }
  async resumeContext(correlationId: string, topic?: string): Promise<void> { await this.send({ kind: 'mew/context', context: { operation: 'resume', correlation_id: correlationId, topic, }, payload: {}, }); }
  getParticipants(): Participant[] { return Array.from(this.participants.values()); }
  getCapabilities(): Capability[] { return [...this.capabilities]; }
  hasCapability(kind: string, to?: string): boolean { return this.capabilities.some(c => { if (c.kind !== kind) return false; if (!to) return true; if (!c.to) return true; if (typeof c.to === 'string') return c.to === to; return c.to.includes(to); }); }

  on<K extends keyof ClientEventParams>(event: K, handler: (...args: ClientEventParams[K]) => void): () => void { const handlers = this.handlers[event] as Set<any>; handlers.add(handler); return () => this.off(event, handler); }
  off<K extends keyof ClientEventParams>(event: K, handler: (...args: ClientEventParams[K]) => void): void { const handlers = this.handlers[event] as Set<any>; handlers.delete(handler); }
  onConnected(handler: VoidHandler): () => void { return this.on(ClientEvents.CONNECTED, handler); }
  onDisconnected(handler: VoidHandler): () => void { return this.on(ClientEvents.DISCONNECTED, handler); }
  onReconnected(handler: VoidHandler): () => void { return this.on(ClientEvents.RECONNECTED, handler); }
  onMessage(handler: MessageHandler): () => void { return this.on(ClientEvents.MESSAGE, handler); }
  onWelcome(handler: WelcomeHandler): () => void { return this.on(ClientEvents.WELCOME, handler); }
  onError(handler: ErrorHandler): () => void { return this.on(ClientEvents.ERROR, handler); }
  onParticipantJoined(handler: ParticipantHandler): () => void { return this.on(ClientEvents.PARTICIPANT_JOINED, handler); }
  onParticipantLeft(handler: ParticipantHandler): () => void { return this.on(ClientEvents.PARTICIPANT_LEFT, handler); }
  onChat(handler: ChatHandler): () => void { return this.on(ClientEvents.CHAT, handler); }
  onProposal(handler: ProposalHandler): () => void { return this.on(ClientEvents.PROPOSAL, handler); }
  onProposalAccept(handler: ProposalAcceptHandler): () => void { return this.on(ClientEvents.PROPOSAL_ACCEPT, handler); }
  onProposalReject(handler: ProposalRejectHandler): () => void { return this.on(ClientEvents.PROPOSAL_REJECT, handler); }
  onCapabilityGrant(handler: CapabilityGrantHandler): () => void { return this.on(ClientEvents.CAPABILITY_GRANT, handler); }
  onCapabilityRevoke(handler: CapabilityRevokeHandler): () => void { return this.on(ClientEvents.CAPABILITY_REVOKE, handler); }

  private emit<K extends keyof ClientEventParams>(event: K, ...args: ClientEventParams[K]): void { const handlers = this.handlers[event] as Set<any>; handlers.forEach(handler => { try { handler(...args); } catch (error) { console.error(`Error in ${event} handler:`, error); } }); }
  disconnect(): void { this.options.reconnect = false; this.stopHeartbeat(); if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; } if (this.ws) { this.ws.close(); this.ws = null; } }
  private scheduleReconnect(): void { if (this.reconnectTimer) return; const delay = Math.min(this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.options.maxReconnectDelay); this.reconnectAttempts++; this.reconnectTimer = setTimeout(async () => { this.reconnectTimer = null; try { await this.connect(); this.emit('reconnected'); } catch { } }, delay); }
  private startHeartbeat(): void { this.stopHeartbeat(); this.heartbeatTimer = setInterval(async () => { try { await this.send({ kind: 'system/heartbeat', payload: {}, }); } catch { } }, this.options.heartbeatInterval); }
  private stopHeartbeat(): void { if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; } }
  isConnected(): boolean { return this.ws?.readyState === WebSocket.OPEN; }
  getParticipantId(): string | null { return this.participantId; }
  async getSpaceInfo(space: string): Promise<SpaceInfo> { const response = await fetch(`${this.options.gateway}/api/spaces/${space}`, { headers: { 'Authorization': `Bearer ${this.options.token}`, }, }); if (!response.ok) { throw new Error(`Failed to get space info: ${response.statusText}`); } return response.json() as Promise<SpaceInfo>; }
  async getHistory(options?: HistoryOptions): Promise<Envelope[]> { const params = new URLSearchParams(); if (options?.limit) params.set('limit', options.limit.toString()); if (options?.before) params.set('before', options.before); const response = await fetch(`${this.options.gateway}/api/spaces/${this.options.space}/messages?${params}`, { headers: { 'Authorization': `Bearer ${this.options.token}`, }, }); if (!response.ok) { throw new Error(`Failed to get history: ${response.statusText}`); } return response.json() as Promise<Envelope[]>; }
}

