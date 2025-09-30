import Debug from 'debug';
import { MEWParticipant } from '@mew-protocol/participant';
import type { Capability } from '@mew-protocol/types';
import { MCPClient, MCPServerConfig } from './mcp-client';

const debug = Debug('mew:bridge');

const DEFAULT_CAPABILITIES: Capability[] = [
  { id: 'chat', kind: 'chat' },
  { id: 'mcp-response', kind: 'mcp/response' },
];

function mergeCapabilities(...groups: Array<Capability[] | undefined>): Capability[] {
  const merged = new Map<string, Capability>();
  for (const group of groups) {
    if (!group) continue;
    for (const capability of group) {
      if (!capability || typeof capability.kind !== 'string') {
        continue;
      }
      const key = JSON.stringify(capability);
      if (!merged.has(key)) {
        merged.set(key, capability);
      }
    }
  }

  // Ensure default capabilities are always present for local bookkeeping
  for (const capability of DEFAULT_CAPABILITIES) {
    const key = JSON.stringify(capability);
    if (!merged.has(key)) {
      merged.set(key, capability);
    }
  }

  return Array.from(merged.values());
}

export interface MCPBridgeOptions {
  gateway: string;
  space: string;
  participantId?: string;
  token: string;
  mcpServer: MCPServerConfig;
  initTimeout?: number;
  capabilities?: Capability[];
}

/**
 * MCP Bridge using MEWParticipant base class
 * Bridges an MCP server to the MEW Protocol as a participant
 */
export class MCPBridge extends MEWParticipant {
  private mcpClient?: MCPClient;
  private mcpCapabilities: Capability[] = [];
  private initTimeout: number;
  private isShuttingDown = false;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;
  private mcpServerConfig: MCPServerConfig;
  private advertisedCapabilities: Capability[];

  constructor(options: MCPBridgeOptions) {
    const initialCapabilities = mergeCapabilities(options.capabilities);
    // Initialize parent with connection options
    const participantId = options.participantId || 'mcp-bridge';
    console.log(`Bridge: Initializing with participant_id: "${participantId}"`);

    super({
      gateway: options.gateway,
      space: options.space,
      participant_id: participantId,
      token: options.token,
      capabilities: initialCapabilities,
    });

    this.initTimeout = options.initTimeout || 30000;
    this.mcpServerConfig = options.mcpServer;
    this.advertisedCapabilities = initialCapabilities;

    this.participantInfo = {
      id: options.participantId || 'mcp-bridge',
      capabilities: initialCapabilities,
    };

    console.log('Bridge: Using MEWParticipant base class for MCP request handling');

    // MCP server will be started in start() method for proper sequencing
  }

  /**
   * Start the bridge - initialize MCP server and connect to gateway
   */
  async start(): Promise<void> {
    debug('Starting MCP-MEW bridge with participant base class');

    try {
      // Initialize MCP server first, before connecting to gateway
      console.log('Bridge: Initializing MCP server before connecting to gateway...');
      await this.startMCPServer(this.mcpServerConfig);

      // Now connect to MEW gateway after MCP is ready
      console.log('Bridge: MCP server ready, connecting to gateway...');
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
        this.restartMCPServer(this.mcpServerConfig);
      }
    });

    // Start and initialize MCP server
    console.log('Bridge: Starting MCP client process...');
    await this.mcpClient.start();
    console.log('Bridge: MCP client started, initializing...');

    // Get capabilities from MCP server
    const serverInfo = await this.mcpClient.initialize();
    console.log('Bridge: MCP server initialized with full serverInfo:', JSON.stringify(serverInfo, null, 2));
    console.log('Bridge: MCP server capabilities:', serverInfo?.capabilities);
    this.mcpCapabilities = this.translateMCPCapabilities(serverInfo.capabilities);
    debug('MCP server capabilities:', this.mcpCapabilities);

    // Register MCP tools as MEUP tools
    // Note: Some MCP servers may have tools but not advertise in capabilities
    // Always try to list tools
    await this.registerMCPTools();
  }

  /**
   * Translate MCP capabilities to MEW capabilities
   */
  private translateMCPCapabilities(mcpCaps: any): Capability[] {
    const capabilities: Capability[] = [];

    // Add tool capabilities if supported
    if (mcpCaps?.tools) {
      capabilities.push({
        id: 'mcp-request-tools',
        kind: 'mcp/request',
        payload: {
          method: 'tools/*',
        },
      });
    }

    // Add resource capabilities if supported
    if (mcpCaps?.resources) {
      capabilities.push({
        id: 'mcp-request-resources',
        kind: 'mcp/request',
        payload: {
          method: 'resources/*',
        },
      });
    }

    return capabilities;
  }

  /**
   * Register MCP tools as MEW tools
   */
  private async registerMCPTools(): Promise<void> {
    if (!this.mcpClient) {
      console.log('Bridge: No MCP client available for tool registration');
      return;
    }

    try {
      console.log('Bridge: Attempting to list MCP tools...');
      // List available MCP tools
      const toolsResponse = await this.mcpClient.request('tools/list', {});
      console.log('Bridge: Tools response:', JSON.stringify(toolsResponse, null, 2));
      
      const tools = toolsResponse.tools || [];
      console.log(`Bridge: Found ${tools.length} MCP tools to register`);

      debug(`Registering ${tools.length} MCP tools`);

      // Register each tool with the participant
      for (const tool of tools) {
        console.log(`Bridge: Registering tool "${tool.name}"`);
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
              arguments: args,
            });
            return result;
          },
        });
      }

      console.log(`Bridge: Successfully registered ${tools.length} tools from MCP server`);
      debug(`Registered ${tools.length} tools from MCP server`);
    } catch (error) {
      console.error('Bridge: Failed to register MCP tools:', error);
      debug('Failed to register MCP tools:', error);
    }
  }

  /**
   * Called when participant is ready (connected and welcomed)
   */
  protected async onReady(): Promise<void> {
    console.log('Bridge: onReady called!');
    console.log('Bridge: Participant info:', JSON.stringify(this.participantInfo, null, 2));

    debug('MCP Bridge participant ready!');
    debug('Participant ID:', this.participantInfo?.id);
    debug(
      'Capabilities:',
      this.participantInfo?.capabilities?.map((c) => c.kind),
    );

    const merged = new Map<string, Capability>();
    const existingCapabilities = this.participantInfo?.capabilities || this.advertisedCapabilities;
    const requiredCapabilities: Capability[] = [
      { id: 'mcp-request-tools', kind: 'mcp/request', payload: { method: 'tools/*' } },
    ];

    const capabilityCandidates = [
      ...existingCapabilities,
      ...this.advertisedCapabilities,
      ...this.mcpCapabilities,
      ...requiredCapabilities,
    ];

    for (const capability of capabilityCandidates) {
      merged.set(JSON.stringify(capability), capability);
    }

    const combinedCapabilities = Array.from(merged.values());

    if (this.participantInfo) {
      this.participantInfo.capabilities = combinedCapabilities;
    } else {
      this.participantInfo = {
        id: this.options.participant_id || 'mcp-bridge',
        capabilities: combinedCapabilities,
      };
    }

    console.log('Bridge: Effective capabilities:', JSON.stringify(combinedCapabilities));

    // Track the final set locally so operators can audit what we discovered.
    this.advertisedCapabilities = combinedCapabilities;
  }

  /**
   * Handle MCP notification
   */
  private handleMCPNotification(notification: any): void {
    debug('MCP notification:', notification);

    if (notification.method === 'notifications/message') {
      console.log('Bridge: MCP notification message:', notification.params);

      if (this.canSend({ kind: 'chat' })) {
        void this.send({
          kind: 'chat',
          payload: {
            text: `[MCP] ${JSON.stringify(notification.params)}`,
            format: 'plain',
          },
        }).catch((err) => {
          console.error('Bridge: Failed to forward MCP notification as chat:', err);
        });
      }
    }
  }

  /**
   * Handle MCP error
   */
  private handleMCPError(error: any): void {
    console.error('Bridge: MCP error encountered:', error);

    const payload = {
      status: 'error',
      error: error.message,
      tokens: 0,
      max_tokens: 0,
      messages_in_context: 0,
    };

    if (this.canSend({ kind: 'participant/status', payload })) {
      void this.send({
        kind: 'participant/status',
        payload,
      }).catch((sendError) => {
        console.error('Bridge: Failed to report MCP error via participant/status:', sendError);
      });
    }
  }

  /**
   * Restart MCP server after disconnection
   */
  private async restartMCPServer(config: MCPServerConfig): Promise<void> {
    // Check if we're shutting down or exceeded max attempts
    if (this.isShuttingDown) {
      debug('Skipping restart - bridge is shutting down');
      return;
    }

    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error(`Failed to restart MCP server after ${this.maxRestartAttempts} attempts. Giving up.`);
      process.exit(1); // Exit to prevent infinite spawning
    }

    this.restartAttempts++;
    debug(`Attempting to restart MCP server (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);

    try {
      // Wait a bit before restarting
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Restart MCP server
      await this.startMCPServer(config);

      debug('MCP server restarted successfully');
      this.restartAttempts = 0; // Reset counter on success

      // Capabilities are managed by the gateway; nothing else to send here.
    } catch (error) {
      console.error(`Failed to restart MCP server (attempt ${this.restartAttempts}):`, error);
      
      // Only retry if we haven't exceeded attempts and not shutting down
      if (this.restartAttempts < this.maxRestartAttempts && !this.isShuttingDown) {
        setTimeout(() => this.restartMCPServer(config), 5000);
      } else {
        console.error('Giving up on MCP server restart');
        process.exit(1);
      }
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
