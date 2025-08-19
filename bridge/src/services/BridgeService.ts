import { EventEmitter } from 'events';
import { MCPxClient } from './MCPxClient';
import { MCPServerClient } from './MCPServerClient';
import { BridgeConfig } from '../types/config';
import { 
  Envelope, 
  isMCPRequest, 
  isMCPResponse, 
  createEnvelope,
  MCPRequest,
  MCPResponse 
} from '../types/mcpx';

export interface BridgeServiceEvents {
  started: () => void;
  stopped: () => void;
  error: (error: Error) => void;
  mcpxMessage: (envelope: Envelope) => void;
  mcpMessage: (method: string, params?: any) => void;
}

export declare interface BridgeService {
  on<U extends keyof BridgeServiceEvents>(event: U, listener: BridgeServiceEvents[U]): this;
  emit<U extends keyof BridgeServiceEvents>(event: U, ...args: Parameters<BridgeServiceEvents[U]>): boolean;
}

export class BridgeService extends EventEmitter {
  private config: BridgeConfig;
  private mcpxClient: MCPxClient;
  private mcpServerClient: MCPServerClient;
  private isRunning = false;
  private pendingRequests: Map<string | number, { envelope: Envelope; timestamp: Date }> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    
    this.mcpxClient = new MCPxClient({
      ...config.mcpx,
      participant: config.participant
    }, {
      maxReconnectAttempts: config.options.reconnectAttempts,
      reconnectDelay: config.options.reconnectDelay
    });

    this.mcpServerClient = new MCPServerClient(config.mcp_server);

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log('Starting MCPx bridge...');
    console.log(`Participant: ${this.config.participant.name} (${this.config.participant.id})`);
    console.log(`MCPx: ${this.config.mcpx.server} -> ${this.config.mcpx.topic}`);
    console.log(`MCP Server: ${this.config.mcp_server.type}`);

    try {
      // Start MCP server connection first
      console.log('Connecting to MCP server...');
      await this.mcpServerClient.connect();
      console.log('MCP server connected');

      // Then connect to MCPx
      console.log('Connecting to MCPx server...');
      await this.mcpxClient.connect();
      console.log('MCPx server connected');

      this.isRunning = true;
      this.startHeartbeat();
      this.emit('started');

      console.log('Bridge started successfully');

    } catch (error) {
      console.error('Failed to start bridge:', error);
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping MCPx bridge...');

    this.isRunning = false;
    this.stopHeartbeat();

    // Disconnect from both services
    await Promise.allSettled([
      this.mcpxClient.disconnect(),
      this.mcpServerClient.disconnect()
    ]);

    this.pendingRequests.clear();
    this.emit('stopped');
    
    console.log('Bridge stopped');
  }

  private setupEventHandlers(): void {
    // MCPx client events
    this.mcpxClient.on('connected', () => {
      console.log('MCPx client connected');
    });

    this.mcpxClient.on('disconnected', () => {
      console.log('MCPx client disconnected');
    });

    this.mcpxClient.on('error', (error) => {
      console.error('MCPx client error:', error);
      this.emit('error', error);
    });

    this.mcpxClient.on('message', (envelope) => {
      this.handleMCPxMessage(envelope);
    });

    this.mcpxClient.on('welcome', (payload) => {
      console.log(`Welcomed to MCPx topic ${this.config.mcpx.topic}`);
      console.log(`Other participants: ${payload.participants.map(p => p.name).join(', ')}`);
      
      // Broadcast tool availability
      this.broadcastToolsAvailability();
    });

    // MCP server events
    this.mcpServerClient.on('connected', () => {
      console.log('MCP server connected');
    });

    this.mcpServerClient.on('disconnected', () => {
      console.log('MCP server disconnected');
    });

    this.mcpServerClient.on('error', (error) => {
      console.error('MCP server error:', error);
      this.emit('error', error);
    });

    this.mcpServerClient.on('initialized', () => {
      console.log('MCP server initialized');
    });

    this.mcpServerClient.on('notification', (method, params) => {
      this.handleMCPNotification(method, params);
    });
  }

  private async handleMCPxMessage(envelope: Envelope): Promise<void> {
    this.emit('mcpxMessage', envelope);

    // Only handle MCP messages addressed to us
    if (envelope.kind !== 'mcp') {
      return;
    }

    const isAddressedToUs = !envelope.to || envelope.to.includes(this.config.participant.id);
    if (!isAddressedToUs) {
      return;
    }

    try {
      if (isMCPRequest(envelope.payload)) {
        await this.handleMCPRequest(envelope, envelope.payload);
      } else if (isMCPResponse(envelope.payload)) {
        await this.handleMCPResponse(envelope, envelope.payload);
      }
      // Notifications are handled but don't require responses
    } catch (error) {
      console.error('Error handling MCPx message:', error);
      
      // Send error response if this was a request
      if (isMCPRequest(envelope.payload)) {
        this.sendMCPError(envelope, {
          code: -32603,
          message: 'Internal error',
          data: (error as Error).message
        });
      }
    }
  }

  private async handleMCPRequest(envelope: Envelope, request: MCPRequest): Promise<void> {
    console.log(`Handling MCP request: ${request.method} from ${envelope.from}`);

    try {
      const result = await this.mcpServerClient.handleMCPRequest(
        request.method, 
        request.params, 
        request.id
      );

      // Send success response
      this.sendMCPResponse(envelope, {
        jsonrpc: '2.0',
        id: request.id,
        result
      });

    } catch (error: any) {
      // Send error response
      const mcpError = error.code ? error : {
        code: -32603,
        message: 'Internal error',
        data: error.message
      };

      this.sendMCPError(envelope, mcpError);
    }
  }

  private async handleMCPResponse(envelope: Envelope, response: MCPResponse): Promise<void> {
    // Check if this response corresponds to a request we sent
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      console.log(`Received response for request ${response.id}`);
      this.pendingRequests.delete(response.id);
    }

    // Forward response to MCP server if needed
    // This would be for requests that the MCP server made to other participants
    // Implementation depends on MCP SDK capabilities
  }

  private handleMCPNotification(method: string, params?: any): void {
    console.log(`MCP notification: ${method}`);
    this.emit('mcpMessage', method, params);

    // Forward certain notifications to MCPx topic
    if (method.startsWith('notifications/')) {
      const envelope = createEnvelope(
        this.config.participant.id,
        'mcp',
        {
          jsonrpc: '2.0',
          method,
          params
        }
      );

      this.mcpxClient.sendMessage(envelope);
    }
  }

  private sendMCPResponse(originalEnvelope: Envelope, response: MCPResponse): void {
    const envelope = createEnvelope(
      this.config.participant.id,
      'mcp',
      response,
      [originalEnvelope.from],
      originalEnvelope.id
    );

    this.mcpxClient.sendMessage(envelope);
  }

  private sendMCPError(originalEnvelope: Envelope, error: any): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: (originalEnvelope.payload as MCPRequest).id,
      error
    };

    const envelope = createEnvelope(
      this.config.participant.id,
      'mcp',
      response,
      [originalEnvelope.from],
      originalEnvelope.id
    );

    this.mcpxClient.sendMessage(envelope);
  }

  private async broadcastToolsAvailability(): Promise<void> {
    try {
      const tools = await this.mcpServerClient.listTools();
      
      // Send a broadcast notification about available tools
      const envelope = createEnvelope(
        this.config.participant.id,
        'mcp',
        {
          jsonrpc: '2.0',
          method: 'notifications/tools/available',
          params: {
            tools: tools.tools.map(tool => ({
              name: tool.name,
              description: tool.description
            })),
            participant: this.config.participant
          }
        }
      );

      this.mcpxClient.sendMessage(envelope);
      console.log(`Broadcast ${tools.tools.length} available tools`);

    } catch (error) {
      console.error('Failed to broadcast tools availability:', error);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      // Send heartbeat via presence system (handled by MCPx server)
      // Could also send custom heartbeat notifications if needed
      console.debug('Heartbeat');
    }, this.config.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}