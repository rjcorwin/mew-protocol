import { 
  MEUPClient, 
  ConnectionOptions, 
  Envelope, 
  JsonRpcRequest, 
  JsonRpcResponse,
  JsonRpcNotification,
  ChatPayload,
  Proposal,
  Capability,
  MCP_VERSION 
} from '@meup/client';

import {
  AgentStatus,
  AgentRole,
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
  ParticipantState,
  AgentConfig,
  AgentEventHandlers,
  ToolExecutionContext,
  ToolExecutionResult,
  ProposalReview,
  ContextState,
  ProgressParams,
} from './types';

/**
 * Abstract base class for MEUP agents
 */
export abstract class MEUPAgent {
  protected client: MEUPClient;
  protected context: Map<string, any> = new Map();
  protected contextStack: ContextState[] = [];
  protected status: AgentStatus = 'idle';
  protected participantStates: Map<string, ParticipantState> = new Map();
  protected config: AgentConfig;
  protected handlers: AgentEventHandlers;
  private isRunning = false;
  private proposalQueue: Map<string, Proposal> = new Map();

  constructor(connectionOptions: ConnectionOptions, config: AgentConfig, handlers?: AgentEventHandlers) {
    this.config = {
      ...config,
      capabilities: config.capabilities || [],
    };
    
    this.handlers = handlers || {};
    
    // Create client with agent's capabilities
    this.client = new MEUPClient({
      ...connectionOptions,
      participant_id: config.name,
      capabilities: config.capabilities,
    });
    
    this.setupEventHandlers();
  }

  /**
   * Lifecycle methods - must be implemented by subclasses
   */
  abstract onStart(): Promise<void>;
  abstract onStop(): Promise<void>;

  /**
   * Optional methods for subclasses to override
   */
  protected async onProposal(proposal: Proposal, from: string): Promise<ProposalReview> {
    if (this.handlers.onProposal) {
      return this.handlers.onProposal(proposal, from);
    }
    
    // Default behavior based on role
    if (this.config.role === 'trusted' || this.config.role === 'coordinator') {
      // Apply proposal filter if configured
      if (this.config.proposalFilter) {
        const shouldAccept = this.config.proposalFilter(proposal);
        return { accept: shouldAccept, reason: shouldAccept ? undefined : 'Filtered' };
      }
      
      // Auto-accept if configured
      if (this.config.autoAcceptProposals) {
        return { accept: true };
      }
    }
    
    return { accept: false, reason: 'No handler configured' };
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    this.isRunning = true;
    this.status = 'idle';

    // Connect to gateway
    await this.client.connect();

    // Call subclass startup
    await this.onStart();
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.status = 'idle';

    // Call subclass shutdown
    await this.onStop();

    // Disconnect from gateway
    this.client.disconnect();

    // Clear context and participant states
    this.context.clear();
    this.contextStack = [];
    this.participantStates.clear();
    this.proposalQueue.clear();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming messages
    this.client.on('message', (envelope) => {
      console.log(`[${this.config.name}] Received: kind=${envelope.kind}, from=${envelope.from}`);
      
      // Handle MCP messages
      if (envelope.kind.startsWith('mcp/')) {
        this.handleMCPMessage(envelope);
      }
      
      // Handle context operations
      if (envelope.kind === 'meup/context' && envelope.context) {
        this.handleContextOperation(envelope);
      }
    });

    // Handle proposals if we're trusted
    if (this.config.role === 'trusted' || this.config.role === 'coordinator') {
      this.client.on('proposal', async (proposal, from) => {
        console.log(`[${this.config.name}] Proposal from ${from}:`, proposal);
        
        // Store proposal for execution if accepted
        this.proposalQueue.set(proposal.correlation_id, proposal);
        
        // Review proposal
        const review = await this.onProposal(proposal, from);
        
        if (review.accept) {
          // Execute the proposed action on behalf of the proposer
          const result = await this.executeProposal(proposal);
          await this.client.acceptProposal(proposal.correlation_id);
        } else {
          await this.client.rejectProposal(proposal.correlation_id, review.reason);
        }
        
        // Clean up
        this.proposalQueue.delete(proposal.correlation_id);
      });
    }

    // Track participant joins/leaves
    this.client.on('participant-joined', (participant) => {
      this.participantStates.set(participant.id, {
        id: participant.id,
        initialized: false,
        capabilities: participant.capabilities,
      });
    });

    this.client.on('participant-left', (participant) => {
      this.participantStates.delete(participant.id);
    });

    // Handle chat messages
    this.client.on('chat', (message, from) => {
      this.handleChatMessage(message, from);
    });
  }

  /**
   * Handle MCP messages
   */
  private async handleMCPMessage(envelope: Envelope): Promise<void> {
    const { kind, payload, correlation_id, from } = envelope;
    
    // Handle MCP requests directed to us
    if (kind === 'mcp/request' && (!envelope.to || envelope.to.includes(this.config.name))) {
      const request = payload as JsonRpcRequest;
      await this.handleMCPRequest(request, from, correlation_id);
    }
    
    // Handle MCP responses to our requests
    if (kind === 'mcp/response' && correlation_id) {
      // Client handles response correlation automatically
    }
    
    // Handle MCP notifications
    if (kind === 'mcp/notification') {
      const notification = payload as JsonRpcNotification;
      await this.handleMCPNotification(notification, from);
    }
  }

  /**
   * Handle MCP requests
   */
  private async handleMCPRequest(request: JsonRpcRequest, from: string, correlationId?: string): Promise<void> {
    const { method, params, id } = request;
    
    try {
      let result: any;
      
      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params, from);
          break;
          
        case 'tools/list':
          result = await this.handleToolsList();
          break;
          
        case 'tools/call':
          result = await this.handleToolCall(params, from, id);
          break;
          
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
          
        case 'resources/read':
          result = await this.handleResourceRead(params, from);
          break;
          
        case 'prompts/list':
          result = await this.handlePromptsList();
          break;
          
        case 'prompts/get':
          result = await this.handlePromptGet(params, from);
          break;
          
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
      
      // Send response
      await this.client.send({
        kind: 'mcp/response',
        to: [from],
        correlation_id: correlationId,
        payload: {
          jsonrpc: '2.0',
          id,
          result,
        } as JsonRpcResponse,
      });
      
    } catch (error: any) {
      // Send error response
      await this.client.send({
        kind: 'mcp/response',
        to: [from],
        correlation_id: correlationId,
        payload: {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32603,
            message: error.message,
          },
        } as JsonRpcResponse,
      });
    }
  }

  /**
   * Handle MCP notifications
   */
  private async handleMCPNotification(notification: JsonRpcNotification, from: string): Promise<void> {
    const { method, params } = notification;
    
    switch (method) {
      case 'progress':
        this.handleProgress(params as ProgressParams, from);
        break;
        
      case 'resources/updated':
        this.handleResourcesUpdated(params, from);
        break;
        
      default:
        console.log(`[${this.config.name}] Unhandled notification: ${method}`);
    }
  }

  /**
   * Handle context operations
   */
  private async handleContextOperation(envelope: Envelope): Promise<void> {
    if (!envelope.context) return;
    
    const { operation, topic, correlation_id } = envelope.context;
    
    switch (operation) {
      case 'push':
        if (topic && correlation_id) {
          const newContext: ContextState = {
            id: correlation_id,
            topic,
            parentId: this.contextStack[this.contextStack.length - 1]?.id,
            children: [],
            messages: [],
          };
          this.contextStack.push(newContext);
          
          if (this.handlers.onContextPush) {
            await this.handlers.onContextPush(topic, correlation_id);
          }
        }
        break;
        
      case 'pop':
        if (correlation_id) {
          const popped = this.contextStack.pop();
          if (popped && this.handlers.onContextPop) {
            await this.handlers.onContextPop(correlation_id);
          }
        }
        break;
        
      case 'resume':
        if (correlation_id && this.handlers.onContextResume) {
          await this.handlers.onContextResume(correlation_id, topic);
        }
        break;
    }
  }

  /**
   * Execute a proposal on behalf of another participant
   */
  private async executeProposal(proposal: Proposal): Promise<any> {
    const { envelope, capability } = proposal;
    
    // Check if we have the required capability
    if (!this.client.hasCapability(envelope.kind)) {
      throw new Error(`Missing capability for ${envelope.kind}`);
    }
    
    // Execute the proposed action
    await this.client.send({
      ...envelope,
      // Override the from field to be us (the executor)
      from: this.config.name,
    });
  }

  /**
   * MCP Protocol Handlers
   */
  
  private async handleInitialize(params: any, from: string): Promise<any> {
    const participant = this.participantStates.get(from);
    if (participant) {
      participant.initialized = true;
    }
    
    return {
      protocolVersion: MCP_VERSION,
      capabilities: await this.getServerCapabilities(),
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
    };
  }

  private async handleToolsList(): Promise<any> {
    const tools = await this.getTools();
    return { tools };
  }

  private async handleToolCall(params: any, from: string, requestId: string | number): Promise<any> {
    if (!this.handlers.onToolCall) {
      throw new Error('Tool handler not configured');
    }
    
    const context: ToolExecutionContext = {
      tool: params.name,
      params: params.arguments,
      from,
      requestId,
    };
    
    const result = await this.handlers.onToolCall(context);
    
    if (result.isError) {
      throw new Error(result.error?.message || 'Tool execution failed');
    }
    
    return result;
  }

  private async handleResourcesList(): Promise<any> {
    const resources = await this.getResources();
    return { resources };
  }

  private async handleResourceRead(params: any, from: string): Promise<any> {
    if (!this.handlers.onResourceRequest) {
      throw new Error('Resource handler not configured');
    }
    
    const content = await this.handlers.onResourceRequest(params.uri, from);
    return { contents: [content] };
  }

  private async handlePromptsList(): Promise<any> {
    const prompts = await this.getPrompts();
    return { prompts };
  }

  private async handlePromptGet(params: any, from: string): Promise<any> {
    if (!this.handlers.onPromptRequest) {
      throw new Error('Prompt handler not configured');
    }
    
    const result = await this.handlers.onPromptRequest(params.name, params.arguments, from);
    return { prompt: result };
  }

  private handleProgress(params: ProgressParams, from: string): void {
    console.log(`[${this.config.name}] Progress from ${from}: ${params.progress}/${params.total || '?'}`);
  }

  private handleResourcesUpdated(params: any, from: string): void {
    console.log(`[${this.config.name}] Resources updated by ${from}`);
  }

  /**
   * Handle chat messages (override in subclass for custom behavior)
   */
  protected handleChatMessage(message: ChatPayload, from: string): void {
    console.log(`[${this.config.name}] Chat from ${from}: ${message.text}`);
  }

  /**
   * Helper methods for subclasses
   */

  /**
   * Send a chat message
   */
  protected async sendChat(text: string, format: 'plain' | 'markdown' = 'plain'): Promise<void> {
    await this.client.sendChat(text, format);
  }

  /**
   * Make an MCP request
   */
  protected async request<T = any>(method: string, params?: any, target?: string): Promise<T> {
    if (this.config.role === 'untrusted') {
      // Untrusted agents must use proposals
      const result = await this.client.propose('mcp-request', {
        kind: 'mcp/request',
        to: target ? [target] : undefined,
        payload: {
          jsonrpc: '2.0',
          method,
          params,
        },
      });
      
      return result.payload as T;
    }
    
    return this.client.request<T>(method, params, target);
  }

  /**
   * Call another participant's tool
   */
  protected async callTool(participant: string, tool: string, args: any): Promise<any> {
    return this.request('tools/call', { name: tool, arguments: args }, participant);
  }

  /**
   * Read another participant's resource
   */
  protected async readResource(participant: string, uri: string): Promise<any> {
    return this.request('resources/read', { uri }, participant);
  }

  /**
   * Override these in subclasses to provide MCP capabilities
   */
  protected async getServerCapabilities(): Promise<ServerCapabilities> {
    return {};
  }

  protected async getTools(): Promise<Tool[]> {
    return [];
  }

  protected async getResources(): Promise<Resource[]> {
    return [];
  }

  protected async getPrompts(): Promise<Prompt[]> {
    return [];
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Set agent status
   */
  protected setStatus(status: AgentStatus): void {
    this.status = status;
  }

  /**
   * Get current context stack
   */
  getContextStack(): ContextState[] {
    return [...this.contextStack];
  }

  /**
   * Get participant states
   */
  getParticipantStates(): Map<string, ParticipantState> {
    return new Map(this.participantStates);
  }
}