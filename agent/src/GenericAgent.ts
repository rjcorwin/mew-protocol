import { MCPxAgentClient, ChatMessage, Peer, ToolCallRequest } from '@mcpx/agent-client';
import Debug from 'debug';

const debug = Debug('mcpx:agent');

export interface AgentConfig {
  // Connection
  serverUrl: string;
  topic: string;
  participantId: string;
  participantName?: string;
  authToken: string;
  
  // Behavior
  respondToChat?: boolean;
  chatResponsePatterns?: Array<{
    pattern: string | RegExp;
    response: string | ((match: RegExpMatchArray | null) => string);
  }>;
  
  // Tool automation
  autoCallTools?: boolean;
  toolCallPatterns?: Array<{
    trigger: string | RegExp;
    calls: Array<{
      peerId?: string;  // Can be dynamic
      tool: string;
      params: any | ((context: any) => any);
    }>;
  }>;
  
  // Custom handlers
  onChat?: (message: ChatMessage, agent: GenericAgent) => Promise<void>;
  onPeerJoined?: (peer: Peer, agent: GenericAgent) => Promise<void>;
  onToolCall?: (request: ToolCallRequest, agent: GenericAgent) => Promise<any>;
}

export class GenericAgent {
  private client: MCPxAgentClient;
  private config: AgentConfig;
  private running = false;
  
  constructor(config: AgentConfig) {
    this.config = config;
    this.client = new MCPxAgentClient({
      serverUrl: config.serverUrl,
      topic: config.topic,
      participantId: config.participantId,
      participantName: config.participantName,
      authToken: config.authToken
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // Handle chat messages
    this.client.on('chat', async (message: ChatMessage) => {
      debug(`Chat from ${message.from}: ${message.text}`);
      
      // Custom handler first
      if (this.config.onChat) {
        await this.config.onChat(message, this);
      }
      
      // Pattern-based responses
      if (this.config.respondToChat && this.config.chatResponsePatterns) {
        for (const pattern of this.config.chatResponsePatterns) {
          const regex = typeof pattern.pattern === 'string' 
            ? new RegExp(pattern.pattern, 'i')
            : pattern.pattern;
          
          const match = message.text.match(regex);
          if (match) {
            const response = typeof pattern.response === 'function'
              ? pattern.response(match)
              : pattern.response;
            
            this.client.sendChat(response);
            break; // Only respond with first match
          }
        }
      }
      
      // Tool call patterns
      if (this.config.autoCallTools && this.config.toolCallPatterns) {
        for (const pattern of this.config.toolCallPatterns) {
          const regex = typeof pattern.trigger === 'string'
            ? new RegExp(pattern.trigger, 'i')
            : pattern.trigger;
          
          if (message.text.match(regex)) {
            await this.executeToolPattern(pattern.calls, { message });
          }
        }
      }
    });
    
    // Handle peer events
    this.client.on('peerJoined', async (peer: Peer) => {
      debug(`Peer joined: ${peer.id} (${peer.name || 'unnamed'})`);
      
      if (this.config.onPeerJoined) {
        await this.config.onPeerJoined(peer, this);
      }
      
      // Greet new peers
      if (this.config.respondToChat) {
        this.client.sendChat(`Welcome ${peer.name || peer.id}! I'm ${this.config.participantName || this.config.participantId}.`);
      }
    });
    
    // Handle tool calls
    this.client.on('toolCall', async (request: ToolCallRequest) => {
      debug(`Tool call from ${request.from}: ${request.tool}`);
      
      if (this.config.onToolCall) {
        return await this.config.onToolCall(request, this);
      }
      
      // Default: reject unknown tools
      throw new Error(`Tool ${request.tool} not implemented`);
    });
    
    // Handle errors
    this.client.on('error', (error: Error) => {
      console.error('Agent error:', error);
    });
    
    // Handle connection events
    this.client.on('connected', () => {
      console.log(`Agent ${this.config.participantId} connected to ${this.config.topic}`);
    });
    
    this.client.on('disconnected', (reason?: string) => {
      console.log(`Agent disconnected: ${reason || 'unknown reason'}`);
      if (this.running) {
        console.log('Attempting to reconnect...');
      }
    });
  }
  
  private async executeToolPattern(
    calls: Array<{
      peerId?: string;
      tool: string;
      params: any | ((context: any) => any);
    }>,
    context: any
  ): Promise<void> {
    for (const call of calls) {
      try {
        // Resolve peer ID
        let peerId = call.peerId;
        if (!peerId) {
          // Find first peer with this tool
          const tools = this.client.listTools();
          const toolMatch = tools.find(t => t.name === call.tool);
          if (!toolMatch) {
            console.warn(`No peer found with tool: ${call.tool}`);
            continue;
          }
          peerId = toolMatch.peerId;
        }
        
        // Resolve params
        const params = typeof call.params === 'function'
          ? call.params(context)
          : call.params;
        
        // Make the call
        debug(`Calling ${call.tool} on ${peerId}`);
        const result = await this.client.callTool(peerId, call.tool, params);
        debug(`Result:`, result);
        
        // Add result to context for next calls
        context[`${peerId}_${call.tool}_result`] = result;
      } catch (error) {
        console.error(`Failed to call ${call.tool}:`, error);
      }
    }
  }
  
  // Public API
  
  async start(): Promise<void> {
    this.running = true;
    await this.client.connect();
    console.log(`Agent ${this.config.participantId} started`);
  }
  
  async stop(): Promise<void> {
    this.running = false;
    this.client.disconnect();
    console.log(`Agent ${this.config.participantId} stopped`);
  }
  
  // Expose client methods for advanced usage
  
  sendChat(message: string, format?: 'plain' | 'markdown'): void {
    this.client.sendChat(message, format);
  }
  
  async callTool(peerId: string, tool: string, params: any): Promise<any> {
    return this.client.callTool(peerId, tool, params);
  }
  
  listTools(peerId?: string): any[] {
    return this.client.listTools(peerId);
  }
  
  getPeers(): Peer[] {
    return this.client.getPeers();
  }
  
  registerTool(name: string, handler: (params: any) => Promise<any>): void {
    this.client.registerTool(name, handler);
  }
  
  getClient(): MCPxAgentClient {
    return this.client;
  }
}