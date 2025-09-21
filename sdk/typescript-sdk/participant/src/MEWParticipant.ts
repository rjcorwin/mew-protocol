import { MEWClient, ClientOptions } from '@mew-protocol/client';
import {
  Envelope,
  Capability,
  ParticipantStatusPayload,
  ParticipantForgetPayload,
  ParticipantRequestStatusPayload,
  ParticipantPausePayload,
  ParticipantClearPayload,
  ParticipantRestartPayload,
  ParticipantShutdownPayload,
  StreamRequestPayload,
} from '@mew-protocol/types';
import { PatternMatcher } from '@mew-protocol/capability-matcher';
import { v4 as uuidv4 } from 'uuid';

const PROTOCOL_VERSION = 'mew/v0.3';

export interface ParticipantOptions extends ClientOptions {
  requestTimeout?: number;  // Default timeout for MCP requests
}

// Handler types
export type MCPProposalHandler = (envelope: Envelope) => Promise<void>;
export type MCPRequestHandler = (envelope: Envelope) => Promise<void>;

// Tool and Resource interfaces
export interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
  execute: (args: any) => Promise<any>;
}

export interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
  read: () => Promise<any>;
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
  proposer?: string;  // Track original proposer for security validation
}

interface DiscoveredTool {
  name: string;
  participantId: string;
  description?: string;
  inputSchema?: any;
}

interface ToolCacheEntry {
  participant: string;
  tools: DiscoveredTool[];
  timestamp: number;
  ttl: number;
}

// Discovery state for each participant
export enum DiscoveryState {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  NO_TOOLS = 'no_tools'  // Participant responded but has no tools
}

export interface ParticipantDiscoveryStatus {
  state: DiscoveryState;
  lastAttempt?: Date;
  attempts: number;
  hasTools: boolean;
}

export class MEWParticipant extends MEWClient {
  protected participantInfo?: {
    id: string;
    capabilities: Capability[];
  };

  protected tools = new Map<string, Tool>();
  protected discoveredTools = new Map<string, DiscoveredTool[]>();
  private resources = new Map<string, Resource>();
  private pendingRequests = new Map<string, PendingRequest>();
  private proposalFulfillments = new Map<string, string>(); // Maps fulfillment request ID to proposal ID
  private proposalHandlers = new Set<MCPProposalHandler>();
  private requestHandlers = new Set<MCPRequestHandler>();
  private participantJoinHandlers = new Set<(participant: any) => void>();
  private matcher = new PatternMatcher();
  private joined = false;
  private toolCache: ToolCacheEntry[] = [];
  private autoDiscoveryEnabled = false;
  private defaultCacheTTL = 300000; // 5 minutes
  private participantDiscoveryStatus = new Map<string, ParticipantDiscoveryStatus>();
  private pauseState?: { id: string; reason?: string; until?: number; from: string };
  private contextTokens = 0;
  private contextMaxTokens = 20000;
  private contextMessages = 0;
  private thresholdAlertActive = false;
  private lastStatusBroadcastAt = 0;
  private proactiveStatusCooldownMs = 60000;
  private pendingStreamRequests = new Map<string, { description?: string; target?: string | string[] }>();
  private activeStreams = new Map<string, { description?: string; correlationId?: string }>();
  private openToStream = new Map<string, string>();

  constructor(options: ParticipantOptions) {
    super(options);
    this.options = { requestTimeout: 30000, ...options };
    this.setupLifecycle();
  }

  send(envelope: Envelope | Partial<Envelope>): void {
    const kind = (envelope as Envelope).kind || (envelope as any).kind;
    if (kind && this.isPauseActive() && !this.isAllowedDuringPause(kind)) {
      const reason = this.pauseState?.reason ? ` (${this.pauseState?.reason})` : '';
      throw new Error(`Participant is paused${reason}`);
    }

    super.send(envelope);
  }

  /**
   * Check if we can send a specific envelope
   */
  canSend(envelope: Partial<Envelope>): boolean {
    if (!this.participantInfo) return false;
    // Use matchesCapability directly to check against all capabilities
    return this.participantInfo.capabilities.some(cap => 
      this.matcher.matchesCapability(cap as any, envelope as any)
    );
  }

  /**
   * Send a smart MCP request - uses mcp/request or mcp/proposal based on capabilities
   */
  async mcpRequest(
    target: string | string[],
    payload: any,
    timeoutMs?: number
  ): Promise<any> {
    const id = uuidv4();
    const to = Array.isArray(target) ? target : [target];
    const timeout = timeoutMs || (this.options as ParticipantOptions).requestTimeout || 30000;

    return new Promise((resolve, reject) => {
      // Check if we can send direct request
      if (this.canSend({ kind: 'mcp/request', payload })) {
        // Send direct MCP request
        const envelope: Envelope = {
          protocol: PROTOCOL_VERSION,
          id,
          ts: new Date().toISOString(),
          from: this.options.participant_id!,
          to,
          kind: 'mcp/request',
          payload
        };

        // Set up timeout
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} timed out after ${timeout}ms`));
        }, timeout);

        // Store pending request
        this.pendingRequests.set(id, { resolve, reject, timer });
        // Debug: Sending MCP request

        // Send the request
        this.send(envelope);
        return;
      }

      // Check if we can send proposal
      if (this.canSend({ kind: 'mcp/proposal', payload })) {
        // Create proposal for someone else to fulfill
        const envelope: Envelope = {
          protocol: PROTOCOL_VERSION,
          id,
          ts: new Date().toISOString(),
          from: this.options.participant_id!,
          to,  // Include target participant(s) if specified
          kind: 'mcp/proposal',
          payload
        };

        // Set up timeout for proposal
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          
          // Send withdrawal when timing out
          const withdrawEnvelope: Envelope = {
            protocol: PROTOCOL_VERSION,
            id: uuidv4(),
            ts: new Date().toISOString(),
            from: this.options.participant_id!,
            kind: 'mcp/withdraw',
            correlation_id: [id],
            payload: {
              reason: 'timeout'
            }
          };
          this.send(withdrawEnvelope);
          
          reject(new Error(`Proposal ${id} not fulfilled after ${timeout}ms`));
        }, timeout);

        // Store pending proposal with proposer info for security validation
        this.pendingRequests.set(id, { 
          resolve, 
          reject, 
          timer,
          proposer: this.options.participant_id  // Track who created this proposal
        });
        // Debug: Sending MCP proposal

        // Send the proposal
        this.send(envelope);
        return;
      }

      // Can't send request or proposal
      reject(new Error(`No capability to send request for method: ${payload.method}`));
    });
  }

  /**
   * Withdraw a pending proposal
   * Use when you no longer need the proposal (found alternative, user cancelled, etc)
   */
  withdrawProposal(proposalId: string, reason: string = 'no_longer_needed'): void {
    const pending = this.pendingRequests.get(proposalId);
    if (!pending) return;
    
    // Clear timeout
    if (pending.timer) clearTimeout(pending.timer);
    this.pendingRequests.delete(proposalId);
    
    // Send withdrawal
    const withdrawEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      kind: 'mcp/withdraw',
      correlation_id: [proposalId],
      payload: { reason }
    };
    this.send(withdrawEnvelope);
    
    // Reject the promise
    pending.reject(new Error(`Proposal withdrawn: ${reason}`));
  }

  /**
   * Send a chat message
   */
  chat(text: string, to?: string | string[], format: 'plain' | 'markdown' = 'plain'): void {
    if (!this.canSend({ kind: 'chat', payload: { text } })) {
      throw new Error('No capability to send chat messages');
    }

    const envelope: Partial<Envelope> = {
      kind: 'chat',
      payload: { text }
    };

    if (format && format !== 'plain') {
      (envelope.payload as any).format = format;
    }

    if (to) {
      envelope.to = Array.isArray(to) ? to : [to];
    }

    this.send(envelope);

    this.recordContextUsage({ tokens: this.estimateTokens(text), messages: 1 });
  }

  acknowledgeChat(messageId: string, target: string | string[], status: string = 'received'): void {
    const to = Array.isArray(target) ? target : [target];
    this.send({
      kind: 'chat/acknowledge',
      to,
      correlation_id: [messageId],
      payload: status ? { status } : {}
    });
  }

  cancelChat(messageId: string, target?: string | string[], reason: string = 'cancelled'): void {
    const envelope: Partial<Envelope> = {
      kind: 'chat/cancel',
      correlation_id: [messageId],
      payload: reason ? { reason } : {}
    };

    if (target) {
      envelope.to = Array.isArray(target) ? target : [target];
    }

    this.send(envelope);
  }

  requestParticipantStatus(target: string | string[], fields?: string[]): void {
    const to = Array.isArray(target) ? target : [target];
    const payload: ParticipantRequestStatusPayload = {};
    if (fields && fields.length > 0) {
      payload.fields = fields;
    }

    this.send({
      kind: 'participant/request-status',
      to,
      payload
    });
  }

  requestStream(payload: StreamRequestPayload, target: string | string[] = 'gateway'): void {
    const to = Array.isArray(target) ? target : [target];
    this.send({
      kind: 'stream/request',
      to,
      payload
    });
  }

  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Register a resource
   */
  registerResource(resource: Resource): void {
    this.resources.set(resource.uri, resource);
  }

  /**
   * Handle MCP proposal events
   */
  onMCPProposal(handler: MCPProposalHandler): () => void {
    this.proposalHandlers.add(handler);
    return () => this.proposalHandlers.delete(handler);
  }

  /**
   * Handle MCP request events
   */
  onMCPRequest(handler: MCPRequestHandler): () => void {
    this.requestHandlers.add(handler);
    return () => this.requestHandlers.delete(handler);
  }

  /**
   * Handle participant join events
   */
  onParticipantJoin(handler: (participant: any) => void): () => void {
    this.participantJoinHandlers.add(handler);
    return () => this.participantJoinHandlers.delete(handler);
  }

  /**
   * Discover tools from a specific participant
   */
  async discoverTools(participantId: string): Promise<DiscoveredTool[]> {
    // Update discovery state
    const status = this.participantDiscoveryStatus.get(participantId) || {
      state: DiscoveryState.NOT_STARTED,
      attempts: 0,
      hasTools: false
    };

    status.state = DiscoveryState.IN_PROGRESS;
    status.lastAttempt = new Date();
    this.participantDiscoveryStatus.set(participantId, status);

    try {
      // Check cache first
      const cached = this.toolCache.find(entry =>
        entry.participant === participantId &&
        Date.now() - entry.timestamp < entry.ttl
      );

      if (cached) {
        status.state = DiscoveryState.COMPLETED;
        status.hasTools = cached.tools.length > 0;
        this.participantDiscoveryStatus.set(participantId, status);
        return cached.tools;
      }

      // Fetch tools from participant (increased timeout for bridge initialization)
      const result = await this.mcpRequest([participantId], {
        method: 'tools/list'
      }, 15000);

      const tools: DiscoveredTool[] = [];
      if (result?.tools) {
        for (const tool of result.tools) {
          tools.push({
            name: tool.name,
            participantId,
            description: tool.description,
            inputSchema: tool.inputSchema
          });
        }
      }

      // Update cache
      this.toolCache = this.toolCache.filter(e => e.participant !== participantId);
      this.toolCache.push({
        participant: participantId,
        tools,
        timestamp: Date.now(),
        ttl: this.defaultCacheTTL
      });

      // Store discovered tools
      this.discoveredTools.set(participantId, tools);

      // Update discovery state
      status.state = tools.length > 0 ? DiscoveryState.COMPLETED : DiscoveryState.NO_TOOLS;
      status.hasTools = tools.length > 0;
      this.participantDiscoveryStatus.set(participantId, status);

      return tools;
    } catch (error) {
      console.error(`Failed to discover tools from ${participantId}:`, error);

      // Update discovery state as failed
      status.state = DiscoveryState.FAILED;
      status.attempts++;
      this.participantDiscoveryStatus.set(participantId, status);

      return [];
    }
  }

  /**
   * Get all available tools (own + discovered)
   */
  getAvailableTools(): DiscoveredTool[] {
    const allTools: DiscoveredTool[] = [];
    
    // Add own tools
    for (const [name, tool] of this.tools.entries()) {
      allTools.push({
        name,
        participantId: this.options.participant_id!,
        description: tool.description,
        inputSchema: tool.inputSchema
      });
    }
    
    // Add discovered tools
    for (const tools of this.discoveredTools.values()) {
      allTools.push(...tools);
    }
    
    return allTools;
  }

  /**
   * Enable automatic tool discovery when participants join
   */
  enableAutoDiscovery(): void {
    this.autoDiscoveryEnabled = true;
  }

  /**
   * Get discovery status for all participants
   */
  getDiscoveryStatus(): Map<string, ParticipantDiscoveryStatus> {
    return new Map(this.participantDiscoveryStatus);
  }

  /**
   * Check if any discoveries are in progress
   */
  hasDiscoveriesInProgress(): boolean {
    for (const [_, status] of this.participantDiscoveryStatus) {
      if (status.state === DiscoveryState.IN_PROGRESS) {
        return true;
      }
    }
    return false;
  }

  /**
   * Wait for all pending discoveries to complete
   */
  async waitForPendingDiscoveries(maxWaitMs: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (this.hasDiscoveriesInProgress() && (Date.now() - startTime) < maxWaitMs) {
      this.log('debug', 'Waiting for pending tool discoveries to complete...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (this.hasDiscoveriesInProgress()) {
      this.log('warn', 'Some tool discoveries are still pending after timeout');
    }
  }

  /**
   * Get participants that haven't been discovered yet
   */
  getUndiscoveredParticipants(): string[] {
    const undiscovered: string[] = [];
    for (const [participantId, status] of this.participantDiscoveryStatus) {
      if (status.state === DiscoveryState.NOT_STARTED ||
          (status.state === DiscoveryState.FAILED && status.attempts < 3)) {
        undiscovered.push(participantId);
      }
    }
    return undiscovered;
  }

  /**
   * Check if a participant can respond to MCP requests
   */
  private canParticipantRespondToMCP(participant: any): boolean {
    return participant.capabilities?.some((cap: any) =>
      cap.kind === 'mcp/response'
    );
  }

  /**
   * Discover tools with retry logic for robustness
   */
  private async discoverToolsWithRetry(participantId: string, attempt: number = 1): Promise<void> {
    const maxAttempts = 3;

    try {
      this.log('debug', `Attempting to discover tools from ${participantId} (attempt ${attempt}/${maxAttempts})`);
      const tools = await this.discoverTools(participantId);

      if (tools && tools.length > 0) {
        this.log('info', `✅ Successfully discovered ${tools.length} tools from ${participantId}`);
      } else {
        this.log('debug', `No tools found from ${participantId} (participant may not have tools)`);
      }
    } catch (error) {
      this.log('warn', `Failed to discover tools from ${participantId} (attempt ${attempt}/${maxAttempts}): ${error}`);

      if (attempt < maxAttempts) {
        const delay = attempt * 5000; // 5s, 10s, 15s
        this.log('debug', `Will retry discovery from ${participantId} in ${delay}ms`);
        setTimeout(() => this.discoverToolsWithRetry(participantId, attempt + 1), delay);
      } else {
        this.log('error', `Failed to discover tools from ${participantId} after ${maxAttempts} attempts`);
      }
    }
  }

  /**
   * Log helper (uses console for now, can be extended)
   */
  protected log(level: string, message: string): void {
    const prefix = `[${level.toUpperCase()}] [${this.options.participant_id || 'participant'}]`;

    switch (level) {
      case 'error':
        console.error(`${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`);
        break;
      case 'info':
        console.log(`${prefix} ${message}`);
        break;
      case 'debug':
        if (process.env.DEBUG) {
          console.log(`${prefix} ${message}`);
        }
        break;
    }
  }

  protected setContextTokenLimit(limit: number): void {
    this.contextMaxTokens = limit;
    this.checkContextThreshold();
  }

  protected recordContextUsage(delta: { tokens?: number; messages?: number }): void {
    if (typeof delta.tokens === 'number' && !Number.isNaN(delta.tokens)) {
      this.contextTokens = Math.max(0, this.contextTokens + delta.tokens);
    }

    if (typeof delta.messages === 'number' && !Number.isNaN(delta.messages)) {
      this.contextMessages = Math.max(0, this.contextMessages + delta.messages);
    }

    this.checkContextThreshold();
  }

  protected resetContextUsage(): void {
    this.contextTokens = 0;
    this.contextMessages = 0;
    this.thresholdAlertActive = false;
  }

  protected getContextTokens(): number {
    return this.contextTokens;
  }

  protected getContextTokenLimit(): number {
    return this.contextMaxTokens;
  }

  protected getContextMessageCount(): number {
    return this.contextMessages;
  }

  protected estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }

  protected buildStatusPayload(status?: string): ParticipantStatusPayload {
    const payload: ParticipantStatusPayload = {
      tokens: Math.round(this.contextTokens),
      max_tokens: this.contextMaxTokens,
      messages_in_context: Math.round(this.contextMessages)
    };

    const activeStatus = status || (this.isPauseActive() ? 'paused' : 'active');
    if (activeStatus) {
      payload.status = activeStatus;
    }

    return payload;
  }

  protected reportStatus(status?: string, correlationId?: string[]): void {
    const payload = this.buildStatusPayload(status);

    if (!this.canSend({ kind: 'participant/status', payload })) {
      return;
    }

    const envelope: Partial<Envelope> = {
      kind: 'participant/status',
      payload
    };

    if (correlationId && correlationId.length > 0) {
      envelope.correlation_id = correlationId;
    }

    this.lastStatusBroadcastAt = Date.now();
    this.send(envelope);
  }

  protected async onForget(direction: 'oldest' | 'newest', entries?: number): Promise<{ messagesRemoved: number; tokensFreed: number }> {
    return { messagesRemoved: 0, tokensFreed: 0 };
  }

  protected async onClear(): Promise<void> {
    this.resetContextUsage();
  }

  protected async onRestart(_payload?: ParticipantRestartPayload): Promise<void> {
    await this.onClear();
  }

  private isAddressedToSelf(envelope: Envelope): boolean {
    if (!envelope.to || envelope.to.length === 0) {
      return true;
    }

    return envelope.to.includes(this.options.participant_id!);
  }

  private trackInboundEnvelope(envelope: Envelope): void {
    if (envelope.from === this.options.participant_id) {
      if (envelope.kind === 'stream/request') {
        this.pendingStreamRequests.set(envelope.id, {
          description: envelope.payload?.description,
          target: envelope.to
        });
      }
      return;
    }

    if (envelope.kind === 'chat' && this.isAddressedToSelf(envelope)) {
      const text = envelope.payload?.text;
      if (typeof text === 'string') {
        this.recordContextUsage({ tokens: this.estimateTokens(text), messages: 1 });
      }
    }
  }

  private handleParticipantPauseMessage(envelope: Envelope): void {
    const payload = (envelope.payload || {}) as ParticipantPausePayload;
    const timeoutSeconds = payload.timeout_seconds;
    const until = timeoutSeconds ? Date.now() + timeoutSeconds * 1000 : undefined;

    this.pauseState = {
      id: envelope.id,
      reason: payload.reason,
      until,
      from: envelope.from
    };

    this.reportStatus('paused', [envelope.id]);
  }

  private handleParticipantResumeMessage(envelope: Envelope): void {
    this.pauseState = undefined;
    this.reportStatus('active', [envelope.id]);
  }

  private async handleParticipantForgetMessage(envelope: Envelope): Promise<void> {
    const payload = (envelope.payload || {}) as ParticipantForgetPayload;
    this.reportStatus('compacting', [envelope.id]);

    const result = await this.onForget(payload.direction, payload.entries);
    if (result) {
      this.recordContextUsage({
        tokens: result.tokensFreed ? -result.tokensFreed : 0,
        messages: result.messagesRemoved ? -result.messagesRemoved : 0
      });
    }

    this.reportStatus('compacted', [envelope.id]);
  }

  private async handleParticipantClearMessage(envelope: Envelope): Promise<void> {
    const payload = (envelope.payload || {}) as ParticipantClearPayload;
    await this.onClear();
    this.resetContextUsage();
    const status = payload?.reason ? `cleared:${payload.reason}` : 'cleared';
    this.reportStatus(status, [envelope.id]);
  }

  private async handleParticipantRestartMessage(envelope: Envelope): Promise<void> {
    const payload = (envelope.payload || {}) as ParticipantRestartPayload;
    await this.onRestart(payload);
    this.resetContextUsage();
    this.reportStatus('restarted', [envelope.id]);
  }

  private async handleParticipantShutdownMessage(envelope: Envelope): Promise<void> {
    const payload = (envelope.payload || {}) as ParticipantShutdownPayload;
    this.reportStatus(payload?.reason ? `shutting_down:${payload.reason}` : 'shutting_down', [envelope.id]);
    await this.onShutdown();
    this.disconnect();
  }

  private handleParticipantRequestStatusMessage(envelope: Envelope): void {
    const request = (envelope.payload || {}) as ParticipantRequestStatusPayload;
    const payload = this.buildStatusPayload();

    let filtered: ParticipantStatusPayload = { ...payload };
    if (request.fields && request.fields.length > 0) {
      filtered = { messages_in_context: payload.messages_in_context } as ParticipantStatusPayload;
      for (const field of request.fields) {
        if (field in payload) {
          (filtered as any)[field] = (payload as any)[field];
        }
      }

      filtered.status = payload.status;
      if (!request.fields.includes('messages_in_context')) {
        filtered.messages_in_context = payload.messages_in_context;
      }
    }

    if (!this.canSend({ kind: 'participant/status', payload: filtered })) {
      return;
    }

    this.send({
      kind: 'participant/status',
      to: [envelope.from],
      correlation_id: [envelope.id],
      payload: filtered
    });
  }

  private isPauseActive(): boolean {
    if (!this.pauseState) {
      return false;
    }

    if (this.pauseState.until && Date.now() > this.pauseState.until) {
      this.pauseState = undefined;
      return false;
    }

    return true;
  }

  private isAllowedDuringPause(kind: string): boolean {
    const allowedKinds = new Set([
      'participant/status',
      'participant/resume',
      'participant/request-status',
      'chat/acknowledge',
      'chat/cancel',
      'reasoning/cancel',
      'participant/clear',
      'participant/forget',
      'participant/shutdown',
      'system/presence',
      'system/error'
    ]);

    if (allowedKinds.has(kind)) {
      return true;
    }

    return kind.startsWith('system/');
  }

  private checkContextThreshold(): void {
    const threshold = this.contextMaxTokens * 0.9;
    if (this.contextTokens >= threshold) {
      if (!this.thresholdAlertActive && Date.now() - this.lastStatusBroadcastAt > this.proactiveStatusCooldownMs) {
        this.thresholdAlertActive = true;
        this.reportStatus('near_limit');
      }
    } else if (this.thresholdAlertActive && this.contextTokens < this.contextMaxTokens * 0.75) {
      this.thresholdAlertActive = false;
    }
  }

  /**
   * Lifecycle hooks for subclasses
   */
  protected async onReady(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}

  /**
   * Set up lifecycle management
   */
  private setupLifecycle(): void {
    // Handle connection
    this.onConnected(() => {
      if (!this.joined) {
        // Join is now handled by MEWClient
        this.joined = true;
      }
    });

    // Handle welcome message (including updates after grants)
    this.onWelcome(async (data: any) => {
      const previousCapabilities = this.participantInfo?.capabilities?.length || 0;
      this.participantInfo = {
        id: data.you.id,
        capabilities: data.you.capabilities
      };

      // Log capability updates
      const newCapabilities = data.you.capabilities?.length || 0;
      if (previousCapabilities > 0 && newCapabilities !== previousCapabilities) {
        console.log(`[MEWParticipant] Capabilities updated: ${previousCapabilities} -> ${newCapabilities}`);
        console.log('[MEWParticipant] New capabilities:', JSON.stringify(data.you.capabilities, null, 2));
      }

      // Initialize discovery status for all participants
      if (data.participants) {
        for (const participant of data.participants) {
          if (participant.id !== data.you.id) {
            // Initialize discovery status if not already tracked
            if (!this.participantDiscoveryStatus.has(participant.id)) {
              this.participantDiscoveryStatus.set(participant.id, {
                state: DiscoveryState.NOT_STARTED,
                attempts: 0,
                hasTools: false
              });
            }
          }
        }

        // Discover tools from existing participants if auto-discovery is enabled
        if (this.autoDiscoveryEnabled) {
          this.log('debug', `Discovering tools from ${data.participants.length} existing participants`);
          for (const participant of data.participants) {
            if (participant.id !== data.you.id && this.canParticipantRespondToMCP(participant)) {
              // Stagger discovery to avoid storms
              const delay = 3000 + Math.random() * 2000; // 3-5 seconds
              setTimeout(() => this.discoverToolsWithRetry(participant.id), delay);
            }
          }
        }
      }

      await this.onReady();
    });

    // Handle incoming messages
    this.onMessage(async (envelope: Envelope) => {
      this.trackInboundEnvelope(envelope);

      if (envelope.kind === 'stream/open') {
        const correlationId = envelope.correlation_id?.[0];
        const streamId = envelope.payload?.stream_id;
        if (correlationId && streamId) {
          const meta = this.pendingStreamRequests.get(correlationId);
          if (meta) {
            this.pendingStreamRequests.delete(correlationId);
            this.activeStreams.set(streamId, { description: meta.description, correlationId });
          } else {
            this.activeStreams.set(streamId, { description: envelope.payload?.description, correlationId });
          }
          this.openToStream.set(envelope.id, streamId);
        }
      }

      if (envelope.kind === 'stream/close') {
        const correlationId = envelope.correlation_id?.[0];
        if (correlationId) {
          const streamId = this.openToStream.get(correlationId) || correlationId;
          this.activeStreams.delete(streamId);
          this.openToStream.delete(correlationId);
        }
      }

      if (this.isAddressedToSelf(envelope)) {
        if (envelope.kind === 'participant/pause') {
          this.handleParticipantPauseMessage(envelope);
        } else if (envelope.kind === 'participant/resume') {
          this.handleParticipantResumeMessage(envelope);
        } else if (envelope.kind === 'participant/request-status') {
          this.handleParticipantRequestStatusMessage(envelope);
        } else if (envelope.kind === 'participant/forget') {
          await this.handleParticipantForgetMessage(envelope);
        } else if (envelope.kind === 'participant/clear') {
          await this.handleParticipantClearMessage(envelope);
        } else if (envelope.kind === 'participant/restart') {
          await this.handleParticipantRestartMessage(envelope);
        } else if (envelope.kind === 'participant/shutdown') {
          await this.handleParticipantShutdownMessage(envelope);
          return;
        }
      }

      // Handle MCP responses
      if (envelope.kind === 'mcp/response') {
        // Debug: Received MCP response
        await this.handleMCPResponse(envelope);
      }

      // Handle MCP requests
      if (envelope.kind === 'mcp/request') {
        // Track if this request is fulfilling one of our proposals
        if (envelope.correlation_id && envelope.correlation_id.length > 0) {
          const proposalId = envelope.correlation_id[0];
          if (this.pendingRequests.has(proposalId)) {
            // Someone is fulfilling our proposal - track it
            this.proposalFulfillments.set(envelope.id, proposalId);
          }
        }
        
        if (this.shouldHandleRequest(envelope)) {
          await this.handleMCPRequest(envelope);
        }
      }

      // Handle MCP proposals (not from self)
      if (envelope.kind === 'mcp/proposal' && envelope.from !== this.options.participant_id) {
        for (const handler of this.proposalHandlers) {
          await handler(envelope);
        }
      }

      // Handle proposal rejection
      if (envelope.kind === 'mcp/reject') {
        await this.handleProposalReject(envelope);
      }

      // Handle proposal withdrawal
      if (envelope.kind === 'mcp/withdraw') {
        await this.handleProposalWithdraw(envelope);
      }

      // Handle system presence for auto-discovery
      if (envelope.kind === 'system/presence' && this.autoDiscoveryEnabled) {
        await this.handlePresence(envelope);
      }
    });
  }

  /**
   * Check if we should handle a request
   */
  private shouldHandleRequest(envelope: Envelope): boolean {
    // Handle if addressed to us or broadcast
    return !envelope.to || 
           envelope.to.length === 0 || 
           envelope.to.includes(this.options.participant_id!);
  }

  /**
   * Handle MCP response
   */
  private async handleMCPResponse(envelope: Envelope): Promise<void> {
    const correlationId = envelope.correlation_id?.[0];
    if (!correlationId) {
      // Debug: MCP response received but no correlation_id
      return;
    }

    // First check if this is a direct response to our request
    const pending = this.pendingRequests.get(correlationId);
    if (pending) {
      // Debug: Resolving pending request
      if (pending.timer) clearTimeout(pending.timer);
      this.pendingRequests.delete(correlationId);

      if (envelope.payload.error) {
        // Debug: Request failed
        pending.reject(new Error(envelope.payload.error.message || 'Request failed'));
      } else {
        // Debug: Request succeeded
        pending.resolve(envelope.payload.result);
      }
      return;
    }

    // Check if this is a response to a fulfilled proposal
    const fulfillmentProposalId = this.proposalFulfillments.get(correlationId);
    if (fulfillmentProposalId) {
      // This response is for a request that fulfilled our proposal
      const pending = this.pendingRequests.get(fulfillmentProposalId);
      if (pending) {
        // Resolve our original proposal with the result
        if (pending.timer) clearTimeout(pending.timer);
        this.pendingRequests.delete(fulfillmentProposalId);
        this.proposalFulfillments.delete(correlationId);
        
        if (envelope.payload.error) {
          pending.reject(new Error(envelope.payload.error.message || 'Proposal fulfillment failed'));
        } else {
          pending.resolve(envelope.payload.result);
        }
        return;
      }
    }
    
    // Debug: No pending request found for response
  }

  /**
   * Handle MCP request
   */
  private async handleMCPRequest(envelope: Envelope): Promise<void> {
    // Check if we have capability to respond
    if (!this.canSend({ kind: 'mcp/response' })) {
      return;
    }

    const { method, params } = envelope.payload;
    let result: any;
    let error: any;

    try {
      switch (method) {
        case 'tools/list':
          result = await this.handleToolsList();
          break;
        
        case 'tools/call':
          result = await this.handleToolCall(params);
          break;
        
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
        
        case 'resources/read':
          result = await this.handleResourceRead(params);
          break;
        
        default:
          // Let request handlers handle it
          for (const handler of this.requestHandlers) {
            await handler(envelope);
          }
          return; // Don't send automatic response
      }
    } catch (err: any) {
      error = {
        code: err.code || -32603,
        message: err.message || 'Internal error'
      };
    }

    // Send response
    const response: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      to: [envelope.from],
      correlation_id: [envelope.id],
      kind: 'mcp/response',
      payload: error ? { error } : { result }
    };

    // Debug: Sending MCP response
    this.send(response);
  }

  /**
   * Handle proposal rejection
   */
  private async handleProposalReject(envelope: Envelope): Promise<void> {
    const correlationId = envelope.correlation_id?.[0];
    if (!correlationId) return;

    const pending = this.pendingRequests.get(correlationId);
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      this.pendingRequests.delete(correlationId);
      
      // Include who rejected and why for better debugging
      const reason = envelope.payload?.reason || 'unknown';
      const errorMessage = `Proposal rejected by ${envelope.from}: ${reason}`;
      pending.reject(new Error(errorMessage));
    }
  }

  /**
   * Handle proposal withdrawal
   * SECURITY: Only the original proposer can withdraw their proposal
   */
  private async handleProposalWithdraw(envelope: Envelope): Promise<void> {
    const correlationId = envelope.correlation_id?.[0];
    if (!correlationId) return;

    const pending = this.pendingRequests.get(correlationId);
    if (!pending) return;
    
    // SECURITY CHECK: Verify the withdrawal is from the original proposer
    // This prevents privilege escalation where other participants try to cancel proposals
    if (envelope.from !== (pending as any).proposer) {
      console.warn(`[SECURITY] Ignoring withdrawal from ${envelope.from} for proposal created by ${(pending as any).proposer}`);
      return;
    }
    
    // Valid withdrawal from the original proposer
    if (pending.timer) clearTimeout(pending.timer);
    this.pendingRequests.delete(correlationId);
    
    // Only reject if this is our own proposal
    if (envelope.from === this.options.participant_id) {
      const reason = envelope.payload?.reason || 'no_longer_needed';
      pending.reject(new Error(`Proposal withdrawn: ${reason}`));
    }
    // Otherwise, we're an observer/auto-fulfiller and should stop processing
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(): Promise<any> {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    // Debug: Returning tools list
    return { tools };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(params: any): Promise<any> {
    const { name, arguments: args } = params;
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return await tool.execute(args);
  }

  /**
   * Handle resources/list request
   */
  private async handleResourcesList(): Promise<any> {
    const resources = Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
    
    return { resources };
  }

  /**
   * Handle resources/read request
   */
  private async handleResourceRead(params: any): Promise<any> {
    const { uri } = params;
    const resource = this.resources.get(uri);
    
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    const contents = await resource.read();
    return {
      uri,
      mimeType: resource.mimeType,
      contents
    };
  }

  /**
   * Handle presence events for auto-discovery
   */
  private async handlePresence(envelope: Envelope): Promise<void> {
    const { event, participant } = envelope.payload;
    
    if (event === 'join' && participant.id !== this.options.participant_id) {
      // Initialize discovery status for new participant
      if (!this.participantDiscoveryStatus.has(participant.id)) {
        this.participantDiscoveryStatus.set(participant.id, {
          state: DiscoveryState.NOT_STARTED,
          attempts: 0,
          hasTools: false
        });
      }

      // Notify join handlers
      for (const handler of this.participantJoinHandlers) {
        handler(participant);
      }

      // Auto-discover tools if enabled
      if (this.autoDiscoveryEnabled) {
        if (this.canParticipantRespondToMCP(participant)) {
          // Discover tools with a delay to let participant fully initialize
          const delay = 3000 + Math.random() * 2000; // 3-5 seconds
          setTimeout(() => this.discoverToolsWithRetry(participant.id), delay);
        }
      }
    } else if (event === 'leave') {
      // Remove cached tools and discovery status for leaving participant
      this.discoveredTools.delete(participant.id);
      this.toolCache = this.toolCache.filter(e => e.participant !== participant.id);
      this.participantDiscoveryStatus.delete(participant.id);
    }
  }
}