import { MEWClient, ClientOptions } from '@mew-protocol/client';
import { Envelope, Capability } from '@mew-protocol/types';
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
}

export class MEWParticipant extends MEWClient {
  protected participantInfo?: {
    id: string;
    capabilities: Capability[];
  };
  
  private tools = new Map<string, Tool>();
  private resources = new Map<string, Resource>();
  private pendingRequests = new Map<string, PendingRequest>();
  private proposalHandlers = new Set<MCPProposalHandler>();
  private requestHandlers = new Set<MCPRequestHandler>();
  private matcher = new PatternMatcher();
  private joined = false;

  constructor(options: ParticipantOptions) {
    super(options);
    this.options = { requestTimeout: 30000, ...options };
    this.setupLifecycle();
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
          // No 'to' field for proposals - they're broadcast
          kind: 'mcp/proposal',
          payload
        };

        // Set up timeout for proposal
        const timer = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(new Error(`Proposal ${id} not fulfilled after ${timeout}ms`));
        }, timeout);

        // Store pending proposal
        this.pendingRequests.set(id, { resolve, reject, timer });

        // Send the proposal
        this.send(envelope);
        return;
      }

      // Can't send request or proposal
      reject(new Error(`No capability to send request for method: ${payload.method}`));
    });
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

    // Handle welcome message
    this.onWelcome(async (data: any) => {
      this.participantInfo = {
        id: data.you.id,
        capabilities: data.you.capabilities
      };
      await this.onReady();
    });

    // Handle incoming messages
    this.onMessage(async (envelope: Envelope) => {
      // Handle MCP responses
      if (envelope.kind === 'mcp/response') {
        await this.handleMCPResponse(envelope);
      }

      // Handle MCP requests
      if (envelope.kind === 'mcp/request') {
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
    if (!correlationId) return;

    const pending = this.pendingRequests.get(correlationId);
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      this.pendingRequests.delete(correlationId);

      if (envelope.payload.error) {
        pending.reject(new Error(envelope.payload.error.message || 'Request failed'));
      } else {
        pending.resolve(envelope.payload.result);
      }
    }
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
      pending.reject(new Error(envelope.payload.reason || 'Proposal rejected'));
    }
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
}