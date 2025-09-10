import { MEWClient, ClientEvents, PROTOCOL_VERSION } from '@mew-protocol/client';
import { Envelope, Capability } from '@mew-protocol/types';
import { 
  ParticipantOptions, 
  ParticipantInfo, 
  Tool, 
  Resource,
  MCPResponse,
  ProposalHandler,
  RequestHandler,
  PendingRequest
} from './types';
import { canSend, matchesCapability } from './capabilities';
import { ToolRegistry } from './mcp/tools';

export class MEWParticipant {
  protected client: MEWClient;
  protected participantInfo?: ParticipantInfo;
  protected tools = new ToolRegistry();
  protected resources = new Map<string, Resource>();
  private joined = false;
  private proposalHandlers = new Set<ProposalHandler>();
  private requestHandlers = new Set<RequestHandler>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestTimeout = 30000; // 30 seconds default timeout
  
  constructor(protected options: ParticipantOptions) {
    // Create underlying client
    this.client = new MEWClient({
      ...options,
      capabilities: [] // Will be set from welcome message
    });
    
    this.setupLifecycle();
  }
  
  /**
   * Connect to the gateway
   */
  async connect(): Promise<void> {
    await this.client.connect();
  }
  
  /**
   * Disconnect from the gateway
   */
  disconnect(): void {
    this.client.disconnect();
  }
  
  /**
   * Register a tool
   */
  registerTool(tool: Tool): void {
    this.tools.register(tool);
  }
  
  /**
   * Register a resource
   */
  registerResource(resource: Resource): void {
    this.resources.set(resource.uri, resource);
  }
  
  /**
   * Check if we have a capability
   */
  canSend(kind: string, payload?: any): boolean {
    if (!this.participantInfo) return false;
    return canSend(this.participantInfo.capabilities, kind, payload);
  }
  
  /**
   * Send a smart request - uses mcp/request or mcp/proposal based on capabilities
   * Returns a promise that resolves with the response
   */
  async request(target: string | string[], method: string, params?: any, timeoutMs?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const to = Array.isArray(target) ? target : [target];
      const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timeout = timeoutMs || this.requestTimeout;
      
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);
      
      // Store pending request
      this.pendingRequests.set(id, {
        id,
        resolve,
        reject,
        timeout: timeoutHandle
      });
      
      // Check if we can send direct MCP request
      if (this.canSend('mcp/request', { method, params })) {
        const envelope: Envelope = {
          protocol: PROTOCOL_VERSION,
          id,
          ts: new Date().toISOString(),
          from: this.options.participant_id!,
          to,
          kind: 'mcp/request',
          payload: {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
          }
        };
        
        this.client.send(envelope);
        return;
      }
      
      // Fall back to proposal if we have that capability
      if (this.canSend('mcp/proposal')) {
        const envelope: Envelope = {
          protocol: PROTOCOL_VERSION,
          id,
          ts: new Date().toISOString(),
          from: this.options.participant_id!,
          to,
          kind: 'mcp/proposal',
          payload: {
            proposal: {
              method,
              params
            }
          }
        };
        
        this.client.send(envelope);
        return;
      }
      
      // Clean up and reject
      clearTimeout(timeoutHandle);
      this.pendingRequests.delete(id);
      reject(new Error(`No capability to send ${method} request`));
    });
  }
  
  /**
   * Send a chat message
   */
  chat(text: string, to?: string | string[]): void {
    if (!this.canSend('chat')) {
      throw new Error('No capability to send chat messages');
    }
    
    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      to: to ? (Array.isArray(to) ? to : [to]) : undefined,
      kind: 'chat',
      payload: {
        text,
        format: 'plain'
      }
    };
    
    this.client.send(envelope);
  }
  
  onProposal(handler: ProposalHandler): () => void {
    this.proposalHandlers.add(handler);
    return () => this.proposalHandlers.delete(handler);
  }
  
  onRequest(handler: RequestHandler): () => void {
    this.requestHandlers.add(handler);
    return () => this.requestHandlers.delete(handler);
  }
  
  protected async onReady(): Promise<void> {}
  protected async onShutdown(): Promise<void> {}
  
  private setupLifecycle(): void {
    this.client.onConnected(() => {
      if (!this.joined) {
        this.client.send({
          type: 'join',
          participantId: this.options.participant_id,
          space: this.options.space,
          token: this.options.token
        } as any);
        this.joined = true;
      }
    });
    
    this.client.onWelcome(async (data: any) => {
      this.participantInfo = {
        id: data.you.id,
        capabilities: data.you.capabilities
      };
      await this.onReady();
    });
    
    this.client.onMessage(async (envelope: any) => {
      if (envelope.kind === 'mcp/response') {
        await this.handleMCPResponse(envelope);
      }
      if (envelope.kind === 'mcp/request') {
        if (this.shouldHandleRequest(envelope)) {
          await this.handleMCPRequest(envelope);
        }
      }
      if (envelope.kind === 'mcp/proposal' && envelope.from !== this.options.participant_id) {
        for (const handler of this.proposalHandlers) {
          await handler(envelope);
        }
      }
    });
    
    this.client.onError((error: any) => {});
    
    this.client.onDisconnected(async () => {
      for (const [id, pendingRequest] of this.pendingRequests) {
        clearTimeout(pendingRequest.timeout);
        pendingRequest.reject(new Error('Connection closed'));
      }
      this.pendingRequests.clear();
      await this.onShutdown();
    });
  }
  
  private async handleMCPResponse(envelope: Envelope): Promise<void> {
    if (envelope.correlation_id) {
      const correlationId = Array.isArray(envelope.correlation_id) 
        ? envelope.correlation_id[0] 
        : envelope.correlation_id;
      
      const pendingRequest = this.pendingRequests.get(correlationId);
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(correlationId);
        
        const payload = envelope.payload;
        
        if (payload.error) {
          pendingRequest.reject(new Error(`MCP Error ${payload.error.code}: ${payload.error.message}`));
          return;
        }
        
        if (payload.result) {
          pendingRequest.resolve(payload.result);
        } else {
          pendingRequest.resolve(payload);
        }
        return;
      }
    }
  }
  
  private shouldHandleRequest(envelope: Envelope): boolean {
    if (envelope.to && !envelope.to.includes(this.options.participant_id!)) {
      return false;
    }
    return this.canSend('mcp/response');
  }
  
  private async handleMCPRequest(envelope: Envelope): Promise<void> {
    const { method, params } = envelope.payload || {};
    const requestId = envelope.payload?.id;
    
    let response: MCPResponse;
    
    try {
      for (const handler of this.requestHandlers) {
        const result = await handler(envelope);
        if (result) {
          response = result;
          break;
        }
      }
      
      if (!response!) {
        switch (method) {
          case 'tools/list':
            response = this.tools.list();
            break;
          case 'tools/call':
            response = await this.tools.execute(params?.name, params?.arguments);
            break;
          case 'resources/list':
            response = this.listResources();
            break;
          case 'resources/read':
            response = await this.readResource(params?.uri);
            break;
          default:
            response = { error: { code: -32601, message: `Method not found: ${method}` } };
        }
      }
    } catch (error: any) {
      response = { error: { code: -32603, message: error.message || 'Internal error', data: error.stack } };
    }
    
    const responseEnvelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ts: new Date().toISOString(),
      from: this.options.participant_id!,
      to: [envelope.from],
      kind: 'mcp/response',
      correlation_id: envelope.id,
      payload: {
        jsonrpc: '2.0',
        id: requestId,
        ...response
      }
    };
    
    this.client.send(responseEnvelope);
  }
  
  private listResources(): MCPResponse {
    const resources = Array.from(this.resources.values()).map(r => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType
    }));
    return { result: { resources } };
  }
  
  private async readResource(uri: string): Promise<MCPResponse> {
    const resource = this.resources.get(uri);
    if (!resource) {
      return { error: { code: -32602, message: `Resource not found: ${uri}` } };
    }
    try {
      const data = await resource.read();
      return {
        result: {
          contents: [{
            uri: resource.uri,
            mimeType: resource.mimeType || 'text/plain',
            text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
          }]
        }
      };
    } catch (error: any) {
      return { error: { code: -32603, message: error.message || 'Failed to read resource' } };
    }
  }
}

