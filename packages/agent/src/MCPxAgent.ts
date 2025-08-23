import { MCPxClient, ConnectionOptions, Envelope, JsonRpcRequest, JsonRpcNotification, JsonRpcMessage, MCP_VERSION } from '@mcpx-protocol/client';
import {
  AgentStatus,
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
  PeerState,
  AgentConfig,
  ToolExecutionContext,
  ToolExecutionResult,
  ProgressParams,
} from './types';

/**
 * Abstract base class for MCPx agents
 */
export abstract class MCPxAgent {
  protected client: MCPxClient;
  protected context: Map<string, any> = new Map();
  protected status: AgentStatus = 'idle';
  protected peerStates: Map<string, PeerState> = new Map();
  protected config: AgentConfig;
  private isRunning = false;

  constructor(connectionOptions: ConnectionOptions, config?: AgentConfig) {
    this.config = config || { name: 'agent', description: 'MCPx Agent', version: '1.0.0' };
    this.client = new MCPxClient(connectionOptions);
    this.setupEventHandlers();
  }

  /**
   * Lifecycle methods - must be implemented by subclasses
   */
  abstract onStart(): Promise<void>;
  abstract onStop(): Promise<void>;

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

    // Clear context and peer states
    this.context.clear();
    this.peerStates.clear();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming MCP messages
    this.client.on('message', (envelope: Envelope) => {
      console.log(`[${this.config.name}] Received envelope: kind=${envelope.kind}, from=${envelope.from}, to=${envelope.to?.join(',') || 'broadcast'}`);
      if (envelope.kind === 'mcp') {
        this.handleMCPMessage(envelope);
      }
    });

    // Track peer joins/leaves
    this.client.on('peer-joined', (peer) => {
      this.peerStates.set(peer.id, {
        id: peer.id,
        initialized: false,
      });
    });

    this.client.on('peer-left', (peer) => {
      this.peerStates.delete(peer.id);
    });

    // Handle chat messages
    this.client.on('chat', (message, from) => {
      this.onChatMessage(message.params.text, from);
    });
  }

  /**
   * Handle incoming MCP messages
   */
  private async handleMCPMessage(envelope: Envelope): Promise<void> {
    const message = envelope.payload as JsonRpcMessage;
    console.log(`[${this.config.name}] MCP message:`, JSON.stringify(message));

    // Check if it's a request
    if ('method' in message && 'id' in message) {
      const request = message as JsonRpcRequest;
      console.log(`[${this.config.name}] Handling MCP request: ${request.method}`);
      
      try {
        const result = await this.handleMCPRequest(envelope.from, request);
        console.log(`[${this.config.name}] Sending response:`, JSON.stringify(result));
        
        // Send response
        const responseEnvelope = {
          to: [envelope.from],
          kind: 'mcp' as const,
          correlation_id: envelope.id,
          payload: {
            jsonrpc: '2.0',
            id: request.id,
            result,
          },
        };
        console.log(`[${this.config.name}] Response envelope:`, JSON.stringify(responseEnvelope));
        await this.client.send(responseEnvelope);
      } catch (error: any) {
        // Send error response
        await this.client.send({
          to: [envelope.from],
          kind: 'mcp',
          correlation_id: envelope.id,
          payload: {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32603,
              message: error.message || 'Internal error',
            },
          },
        });
      }
    }
    // Handle notifications
    else if ('method' in message && !('id' in message)) {
      const notification = message as JsonRpcNotification;
      await this.handleMCPNotification(envelope.from, notification);
    }
  }

  /**
   * Handle MCP requests (server functionality)
   */
  private async handleMCPRequest(from: string, request: JsonRpcRequest): Promise<any> {
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(from, request.params);
      
      case 'tools/list':
        return this.handleToolsList();
      
      case 'tools/call':
        return this.handleToolCall(from, request);
      
      case 'resources/list':
        return this.handleResourcesList();
      
      case 'prompts/list':
        return this.handlePromptsList();
      
      default:
        throw new Error(`Method not found: ${request.method}`);
    }
  }

  /**
   * Handle MCP notifications
   */
  private async handleMCPNotification(from: string, notification: JsonRpcNotification): Promise<void> {
    switch (notification.method) {
      case 'notifications/initialized':
        this.handleInitialized(from);
        break;
      
      case 'notifications/cancelled':
        this.handleCancellation(notification.params);
        break;
      
      case 'notifications/progress':
        this.handleProgress(from, notification.params);
        break;
    }
  }

  /**
   * Handle initialize request
   */
  private async handleInitialize(from: string, params: any): Promise<any> {
    const peerState = this.peerStates.get(from);
    if (peerState) {
      peerState.initialized = true;
      peerState.capabilities = params.capabilities;
    }

    const capabilities = await this.getCapabilities();
    
    return {
      protocolVersion: MCP_VERSION,
      capabilities,
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
    };
  }

  /**
   * Handle initialized notification
   */
  private handleInitialized(from: string): void {
    const peerState = this.peerStates.get(from);
    if (peerState) {
      peerState.initialized = true;
    }
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(): Promise<any> {
    const tools = await this.listTools();
    return { tools };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(from: string, request: JsonRpcRequest): Promise<any> {
    const { name, arguments: args } = request.params;
    
    const context: ToolExecutionContext = {
      tool: name,
      params: args,
      from,
      requestId: request.id,
    };

    this.status = 'busy';
    try {
      const result = await this.executeTool(context.tool, context.params, context);
      this.status = 'idle';
      return result;
    } catch (error: any) {
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Handle resources/list request
   */
  private async handleResourcesList(): Promise<any> {
    const resources = await this.listResources();
    return { resources };
  }

  /**
   * Handle prompts/list request
   */
  private async handlePromptsList(): Promise<any> {
    const prompts = await this.listPrompts();
    return { prompts };
  }

  /**
   * Handle cancellation notification
   */
  private handleCancellation(params: any): void {
    // Override in subclass if needed
    this.onCancellation(params.requestId, params.reason);
  }

  /**
   * Handle progress notification
   */
  private handleProgress(from: string, params: any): void {
    // Override in subclass if needed
    this.onProgress(from, params);
  }

  /**
   * MCP Server methods - override these to expose functionality
   */
  async getCapabilities(): Promise<ServerCapabilities> {
    return {
      tools: { list: true },
    };
  }

  async listTools(): Promise<Tool[]> {
    return [];
  }

  async listResources(): Promise<Resource[]> {
    return [];
  }

  async listPrompts(): Promise<Prompt[]> {
    return [];
  }

  async executeTool(name: string, _params: any, _context: ToolExecutionContext): Promise<ToolExecutionResult> {
    throw new Error(`Tool ${name} not implemented`);
  }

  /**
   * MCP Client methods - call peer tools
   */
  async callTool(peerId: string, tool: string, params: any): Promise<any> {
    // Ensure MCP handshake is complete
    await this.ensureInitialized(peerId);

    // Call the tool
    return this.client.request(peerId, 'tools/call', {
      name: tool,
      arguments: params,
    });
  }

  /**
   * List peer tools
   */
  async listPeerTools(peerId: string): Promise<Tool[]> {
    await this.ensureInitialized(peerId);
    
    const result = await this.client.request(peerId, 'tools/list', {});
    
    const peerState = this.peerStates.get(peerId);
    if (peerState) {
      peerState.tools = result.tools;
    }
    
    return result.tools || [];
  }

  /**
   * Ensure MCP handshake with peer
   */
  private async ensureInitialized(peerId: string): Promise<void> {
    let peerState = this.peerStates.get(peerId);
    
    if (!peerState) {
      peerState = {
        id: peerId,
        initialized: false,
      };
      this.peerStates.set(peerId, peerState);
    }

    if (peerState.initialized) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (peerState.initializePromise) {
      await peerState.initializePromise;
      return;
    }

    // Start initialization
    peerState.initializePromise = this.initializePeer(peerId);
    await peerState.initializePromise;
  }

  /**
   * Initialize MCP connection with peer
   */
  private async initializePeer(peerId: string): Promise<void> {
    const peerState = this.peerStates.get(peerId)!;

    try {
      // Send initialize request
      const response = await this.client.request(peerId, 'initialize', {
        protocolVersion: MCP_VERSION,
        capabilities: await this.getCapabilities(),
        clientInfo: {
          name: this.config.name,
          version: this.config.version,
        },
      });

      // Store peer capabilities
      peerState.capabilities = response.capabilities;

      // Send initialized notification
      this.client.notify([peerId], 'notifications/initialized', {});

      peerState.initialized = true;
    } catch (error) {
      peerState.initialized = false;
      peerState.initializePromise = undefined;
      throw error;
    }
  }

  /**
   * Send progress notification
   */
  protected sendProgress(to: string, params: ProgressParams, correlationId?: string): void {
    const envelope = {
      to: [to],
      kind: 'mcp' as const,
      correlation_id: correlationId,
      payload: {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params,
      },
    };
    
    this.client.send(envelope).catch((error) => {
      console.error('Failed to send progress:', error);
    });
  }

  /**
   * Context management
   */
  setContext(key: string, value: any): void {
    this.context.set(key, value);
  }

  getContext(key: string): any {
    return this.context.get(key);
  }

  clearContext(): void {
    this.context.clear();
  }

  /**
   * State management
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  setStatus(status: AgentStatus): void {
    this.status = status;
  }

  /**
   * Get connected peers
   */
  getPeers(): string[] {
    return this.client.getPeers().map(p => p.id);
  }

  /**
   * Get participant ID
   */
  getParticipantId(): string {
    return this.client.getParticipantId();
  }

  /**
   * Send chat message
   */
  sendChat(text: string, format: 'plain' | 'markdown' = 'plain'): void {
    this.client.chat(text, format);
  }

  /**
   * Event handlers - override in subclass
   */
  protected onChatMessage(_text: string, _from: string): void {
    // Override in subclass to handle chat messages
  }

  protected onCancellation(_requestId: string | number, _reason: string): void {
    // Override in subclass to handle cancellations
  }

  protected onProgress(_from: string, _params: ProgressParams): void {
    // Override in subclass to handle progress updates
  }
}