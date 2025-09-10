import Debug from 'debug';
import { MEWParticipant } from '@mew-protocol/participant';
import { MCPClient, MCPServerConfig } from './mcp-client';

const debug = Debug('mew:bridge');

export interface MCPBridgeOptions {
  gateway: string;
  space: string;
  participantId?: string;
  token: string;
  mcpServer: MCPServerConfig;
  initTimeout?: number;
}

/**
 * MCP Bridge using MEWParticipant base class
 * Bridges an MCP server to the MEW Protocol as a participant
 */
export class MCPBridge extends MEWParticipant {
  private mcpClient?: MCPClient;
  private mcpCapabilities: any[] = [];
  private initTimeout: number;
  private isShuttingDown = false;

  constructor(options: MCPBridgeOptions) {
    // Initialize parent with connection options
    super({
      gateway: options.gateway,
      space: options.space,
      participant_id: options.participantId || 'mcp-bridge',
      token: options.token
    });
    
    this.initTimeout = options.initTimeout || 30000;
    
    // Set up request handler for MCP requests
    this.onRequest(async (envelope) => {
      console.log('Bridge: Custom handler called for:', envelope.kind);
      
      if (envelope.kind === 'mcp/request') {
        const { method, params } = envelope.payload || {};
        console.log(`Bridge: Processing MCP request - method: ${method} from ${envelope.from}`);
        
        // Check if MCP client is ready
        if (!this.mcpClient) {
          console.error('Bridge: MCP client not initialized yet');
          return {
            error: {
              code: -32603,
              message: 'MCP server not ready'
            }
          };
        }
        
        if (!this.mcpClient.isInitialized) {
          console.error('Bridge: MCP server not yet initialized');
          return {
            error: {
              code: -32603,
              message: 'MCP server not initialized'
            }
          };
        }
        
        try {
          // Send to MCP server
          console.log(`Bridge: Sending request to MCP server: ${method}`);
          const result = await this.mcpClient.request(method, params);
          console.log(`Bridge: Got result from MCP server for ${method}`);
          console.log('Bridge: MCP response from server (truncated):', JSON.stringify(result).substring(0, 200));
          
          // Return in the format MEUPParticipant expects
          // The base class will wrap this in the proper envelope
          const response = {
            result: result
          };
          
          console.log('Bridge: Custom handler returning response');
          return response;
          
        } catch (error: any) {
          console.error('Bridge: Error calling MCP server:', error);
          // Return error in MCP format
          return {
            error: {
              code: error.code || -32603,
              message: error.message || 'Internal error',
              data: error.data
            }
          };
        }
      }
      
      // Let base class handle other requests - return null means we don't handle it
      return null as any;
    });
    
    console.log('Bridge: Request handler registered in constructor');
    
    // Start MCP server after constructor
    this.startMCPServer(options.mcpServer).catch(error => {
      console.error('Failed to start MCP server:', error);
    });
  }
  
  /**
   * Start the bridge - initialize MCP server and connect to gateway
   */
  async start(): Promise<void> {
    debug('Starting MCP-MEW bridge with participant base class');
    
    try {
      // Connect to MEW gateway
      await this.connect();
      
      debug('Bridge started successfully');
    } catch (error) {
      debug('Failed to start bridge:', error);
      await this.shutdown();
      throw error;
    }
  }
  
  /**
   * Start and initialize the MCP server
   */
  private async startMCPServer(config: MCPServerConfig): Promise<void> {
    console.log('Bridge: Starting MCP server:', JSON.stringify(config));
    debug('Starting MCP server:', config);
    
    this.mcpClient = new MCPClient(config);
    
    // Set up MCP event handlers
    this.mcpClient.on('notification', (notification) => {
      this.handleMCPNotification(notification);
    });
    
    this.mcpClient.on('error', (error) => {
      console.error('MCP error:', error);
      this.handleMCPError(error);
    });
    
    this.mcpClient.on('close', () => {
      debug('MCP server closed');
      if (!this.isShuttingDown) {
        // MEWParticipant handles reconnection to gateway
        // We may need to restart MCP server
        this.restartMCPServer(config);
      }
    });
    
    // Start and initialize MCP server
    console.log('Bridge: Starting MCP client process...');
    await this.mcpClient.start();
    console.log('Bridge: MCP client started, initializing...');
    
    // Get capabilities from MCP server
    const serverInfo = await this.mcpClient.initialize();
    console.log('Bridge: MCP server initialized with capabilities:', serverInfo?.capabilities);
    this.mcpCapabilities = this.translateMCPCapabilities(serverInfo.capabilities);
    debug('MCP server capabilities:', this.mcpCapabilities);
    
    // Register MCP tools as MEUP tools
    if (serverInfo.capabilities?.tools) {
      await this.registerMCPTools();
    }
  }
  
  /**
   * Translate MCP capabilities to MEW capabilities
   */
  private translateMCPCapabilities(mcpCaps: any): any[] {
    const capabilities: any[] = [];
    
    // Always support MCP response
    capabilities.push({
      kind: 'mcp/response'
    });
    
    // Add tool capabilities if supported
    if (mcpCaps?.tools) {
      capabilities.push({
        kind: 'mcp/request',
        payload: {
          method: 'tools/*'
        }
      });
    }
    
    // Add resource capabilities if supported  
    if (mcpCaps?.resources) {
      capabilities.push({
        kind: 'mcp/request',
        payload: {
          method: 'resources/*'
        }
      });
    }
    
    return capabilities;
  }
  
  /**
   * Register MCP tools as MEW tools
   */
  private async registerMCPTools(): Promise<void> {
    if (!this.mcpClient) return;
    
    try {
      // List available MCP tools
      const toolsResponse = await this.mcpClient.request('tools/list', {});
      const tools = toolsResponse.tools || [];
      
      debug(`Registering ${tools.length} MCP tools`);
      
      // Register each tool with the participant
      for (const tool of tools) {
        this.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          execute: async (args) => {
            if (!this.mcpClient) {
              throw new Error('MCP client not available');
            }
            // Forward tool call to MCP server
            const result = await this.mcpClient.request('tools/call', {
              name: tool.name,
              arguments: args
            });
            return result;
          }
        });
      }
      
      debug(`Registered ${tools.length} tools from MCP server`);
    } catch (error) {
      debug('Failed to register MCP tools:', error);
    }
  }
  
  /**
   * Called when participant is ready (connected and welcomed)
   */
  protected async onReady(): Promise<void> {
    debug('MCP Bridge participant ready!');
    debug('Participant ID:', this.participantInfo?.id);
    debug('Capabilities:', this.participantInfo?.capabilities?.map(c => c.kind));
    
    // Send registration with MCP capabilities
    this.sendRegistration();
  }
  
  /**
   * Send registration message with MCP server capabilities
   */
  private sendRegistration(): void {
    const envelope = {
      kind: 'system/register',
      payload: {
        capabilities: this.mcpCapabilities
      }
    };
    
    debug('Sending registration with MCP capabilities:', envelope);
    this.client.send(envelope);
  }
  
  /**
   * Handle MCP notification
   */
  private handleMCPNotification(notification: any): void {
    debug('MCP notification:', notification);
    
    // Translate MCP notifications to MEW messages if needed
    if (notification.method === 'notifications/message') {
      this.client.send({
        kind: 'system/log',
        payload: notification.params
      });
    }
  }
  
  /**
   * Handle MCP error
   */
  private handleMCPError(error: any): void {
    // Send error to MEW space
    this.client.send({
      kind: 'system/error',
      payload: {
        error: error.message,
        source: 'mcp-bridge'
      }
    });
  }
  
  /**
   * Restart MCP server after disconnection
   */
  private async restartMCPServer(config: MCPServerConfig): Promise<void> {
    debug('Attempting to restart MCP server...');
    
    try {
      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restart MCP server
      await this.startMCPServer(config);
      
      debug('MCP server restarted successfully');
      
      // Re-send registration with updated capabilities
      if (this.participantInfo) {
        this.sendRegistration();
      }
    } catch (error) {
      console.error('Failed to restart MCP server:', error);
      // Try again after delay
      setTimeout(() => this.restartMCPServer(config), 5000);
    }
  }
  
  /**
   * Shutdown the bridge
   */
  async shutdown(): Promise<void> {
    debug('Shutting down MCP bridge');
    this.isShuttingDown = true;
    
    // Disconnect from MEW gateway
    this.disconnect();
    
    // Stop MCP server
    if (this.mcpClient) {
      await this.mcpClient.shutdown();
      this.mcpClient = undefined;
    }
    
    debug('MCP bridge shutdown complete');
  }
  
  /**
   * Called when participant is shutting down
   */
  protected async onShutdown(): Promise<void> {
    debug('MCP Bridge participant shutting down...');
    await this.shutdown();
  }
}