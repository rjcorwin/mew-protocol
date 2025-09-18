import { MEWClient, ClientOptions } from '@mew-protocol/client';
import type { StreamRecord } from '@mew-protocol/client';
import { Envelope, Capability } from '@mew-protocol/types';
import { PatternMatcher } from '@mew-protocol/capability-matcher';
import { v4 as uuidv4 } from 'uuid';
import type {
  StreamAnnouncementOptions,
  StreamHandle,
  StreamStartOptions,
  StreamDataOptions,
  StreamCompleteOptions,
  StreamErrorOptions,
} from './types';

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

interface PendingStreamAnnouncement {
  resolve: (handle: StreamHandle) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  options: StreamAnnouncementOptions;
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
  private pendingStreamAnnouncements = new Map<string, PendingStreamAnnouncement>();
  private streamSequences = new Map<string, number>();

  constructor(options: ParticipantOptions) {
    super(options);
    this.options = { requestTimeout: 30000, ...options };
    this.setupLifecycle();
    this.onStreamReady((envelope) => this.handleStreamReady(envelope));
    this.onStreamError((envelope) => this.handleStreamError(envelope));
    this.onStreamComplete((envelope) => this.handleStreamComplete(envelope));
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
  chat(text: string, to?: string | string[]): void {
    if (!this.canSend({ kind: 'chat', payload: { text } })) {
      throw new Error('No capability to send chat messages');
    }

    const envelope: Partial<Envelope> = {
      kind: 'chat',
      payload: { text }
    };

    if (to) {
      envelope.to = Array.isArray(to) ? to : [to];
    }

    this.send(envelope);
  }

  async announceStream(options: StreamAnnouncementOptions): Promise<StreamHandle> {
    if (!this.canSend({ kind: 'stream/announce', payload: { formats: options.formats } })) {
      throw new Error('No capability to announce streams');
    }

    if (!options.formats || options.formats.length === 0) {
      throw new Error('announceStream requires at least one format descriptor');
    }

    const announcementId = uuidv4();
    const payload: any = {
      intent: options.intent,
      desired_id: options.desiredId,
      formats: options.formats,
    };

    if (options.scope && options.scope.length > 0) {
      payload.scope = options.scope;
    }

    const timeoutMs = options.timeoutMs ?? 5000;

    return new Promise<StreamHandle>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingStreamAnnouncements.delete(announcementId);
        reject(new Error(`Timed out waiting for stream/ready (${announcementId})`));
      }, timeoutMs);

      this.pendingStreamAnnouncements.set(announcementId, { resolve, reject, timer, options });

      this.send({
        id: announcementId,
        kind: 'stream/announce',
        payload,
      });
    });
  }

  startStream(streamId: string, options: StreamStartOptions = {}): void {
    if (!this.canSend({ kind: 'stream/start', payload: { stream: { stream_id: streamId } } })) {
      throw new Error('No capability to start streams');
    }

    const payload: any = {
      stream: { stream_id: streamId },
      start_ts: options.startTs || new Date().toISOString(),
    };
    this.send({ kind: 'stream/start', payload });
  }

  sendStreamData(streamId: string, content: any, options: StreamDataOptions = {}): void {
    if (!this.canSend({ kind: 'stream/data', payload: { stream: { stream_id: streamId } } })) {
      throw new Error('No capability to send stream data');
    }

    const payload: any = {
      stream: { stream_id: streamId },
      sequence: options.sequence ?? this.nextStreamSequence(streamId),
      content,
    };

    if (options.formatId) {
      payload.format_id = options.formatId;
    }
    if (options.metadata) {
      Object.assign(payload, options.metadata);
    }

    this.send({ kind: 'stream/data', payload });
  }

  completeStream(streamId: string, options: StreamCompleteOptions = {}): void {
    if (!this.canSend({ kind: 'stream/complete', payload: { stream: { stream_id: streamId } } })) {
      throw new Error('No capability to complete streams');
    }

    const payload: any = {
      stream: { stream_id: streamId },
    };
    if (options.reason) {
      payload.reason = options.reason;
    }
    if (options.metadata) {
      Object.assign(payload, options.metadata);
    }

    this.send({ kind: 'stream/complete', payload });
    this.streamSequences.delete(streamId);
  }

  failStream(streamId: string, error: StreamErrorOptions): void {
    if (!this.canSend({ kind: 'stream/error', payload: { stream: { stream_id: streamId } } })) {
      throw new Error('No capability to fail streams');
    }

    const payload: any = {
      stream: { stream_id: streamId },
      code: error.code,
      message: error.message,
    };
    if (error.reason) {
      payload.reason = error.reason;
    }
    if (error.metadata) {
      Object.assign(payload, error.metadata);
    }

    this.send({ kind: 'stream/error', payload });
    this.streamSequences.delete(streamId);
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

  private handleStreamReady(envelope: Envelope): void {
    const correlationId = this.extractCorrelationId(envelope);
    if (correlationId && this.pendingStreamAnnouncements.has(correlationId)) {
      const pending = this.pendingStreamAnnouncements.get(correlationId)!;
      clearTimeout(pending.timer);
      this.pendingStreamAnnouncements.delete(correlationId);

      const streamPayload: any = envelope.payload?.stream;
      if (!streamPayload) {
        pending.reject(new Error('stream/ready missing stream payload'));
        return;
      }

      const record = this.getStream(streamPayload.stream_id) as StreamRecord | undefined;
      this.streamSequences.set(streamPayload.stream_id, 0);

      const namespace = record?.namespace || streamPayload.namespace || `${this.options.space}/${streamPayload.stream_id}`;
      const formats = (record?.formats && record.formats.length > 0)
        ? record.formats
        : streamPayload.formats || [];
      const payloadIntent = (envelope as any).payload?.intent;
      const payloadScope = (envelope as any).payload?.scope;

      pending.resolve({
        streamId: streamPayload.stream_id,
        namespace,
        formats,
        intent: payloadIntent ?? pending.options.intent,
        scope: payloadScope ?? pending.options.scope,
      });
      return;
    }

    const streamId = envelope.payload?.stream?.stream_id;
    if (streamId) {
      this.streamSequences.set(streamId, 0);
    }
  }

  private handleStreamError(envelope: Envelope): void {
    const correlationId = this.extractCorrelationId(envelope);
    if (correlationId && this.pendingStreamAnnouncements.has(correlationId)) {
      const pending = this.pendingStreamAnnouncements.get(correlationId)!;
      clearTimeout(pending.timer);
      this.pendingStreamAnnouncements.delete(correlationId);
      const message = envelope.payload?.message || 'stream error';
      pending.reject(new Error(message));
    }

    const streamId = envelope.payload?.stream?.stream_id;
    if (streamId) {
      this.streamSequences.delete(streamId);
    }
  }

  private handleStreamComplete(envelope: Envelope): void {
    const streamId = envelope.payload?.stream?.stream_id;
    if (streamId) {
      this.streamSequences.delete(streamId);
    }
  }

  private extractCorrelationId(envelope: Envelope): string | undefined {
    const correlation = envelope.correlation_id;
    if (!correlation) {
      return undefined;
    }
    return Array.isArray(correlation) ? correlation[0] : correlation;
  }

  private nextStreamSequence(streamId: string): number {
    const current = this.streamSequences.get(streamId) ?? 0;
    const next = current + 1;
    this.streamSequences.set(streamId, next);
    return next;
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
