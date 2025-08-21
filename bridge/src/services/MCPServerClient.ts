import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { 
  CallToolRequest,
  ListToolsRequest,
  InitializeRequest
} from '@modelcontextprotocol/sdk/types.js';
import { MCPServerConfig } from '../types/config';

export interface MCPServerClientEvents {
  connected: () => void;
  disconnected: () => void;
  error: (error: Error) => void;
  initialized: () => void;
  notification: (method: string, params?: any) => void;
}

export declare interface MCPServerClient {
  on<U extends keyof MCPServerClientEvents>(event: U, listener: MCPServerClientEvents[U]): this;
  emit<U extends keyof MCPServerClientEvents>(event: U, ...args: Parameters<MCPServerClientEvents[U]>): boolean;
}

export class MCPServerClient extends EventEmitter {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private process: ChildProcess | null = null;
  private config: MCPServerConfig;
  private isConnected = false;
  private isInitialized = false;

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.setupConnection();
      await this.initializeMCP();
      this.isConnected = true;
      this.emit('connected');
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.cleanup();
  }

  async callTool(name: string, arguments_?: Record<string, any>): Promise<any> {
    if (!this.client || !this.isInitialized) {
      throw new Error('MCP server not initialized');
    }

    // The new SDK takes params directly
    return await this.client.callTool({
      name,
      arguments: arguments_ || {}
    });
  }

  async listTools(): Promise<any> {
    if (!this.client || !this.isInitialized) {
      throw new Error('MCP server not initialized');
    }

    // The new SDK uses params directly, not wrapped in a request object
    return await this.client.listTools();
  }

  async handleMCPRequest(method: string, params: any, id?: string | number): Promise<any> {
    if (!this.client) {
      throw new Error('MCP server not connected');
    }

    try {
      switch (method) {
        case 'tools/list':
          return await this.listTools();
        
        case 'tools/call':
          return await this.callTool(params.name, params.arguments);
        
        case 'initialize':
          // Return bridge capabilities when another client initializes
          return {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'MCPx Bridge',
              version: '0.1.0'
            }
          };
        
        default:
          // For other methods, we'd need to extend the SDK or handle them manually
          throw new Error(`Unsupported method: ${method}`);
      }
    } catch (error) {
      throw {
        code: -32603,
        message: 'Internal error',
        data: (error as Error).message
      };
    }
  }

  private async setupConnection(): Promise<void> {
    switch (this.config.type) {
      case 'stdio':
        await this.setupStdioConnection();
        break;
      case 'websocket':
        throw new Error('WebSocket transport not yet implemented');
      case 'sse':
        throw new Error('SSE transport not yet implemented');
      default:
        throw new Error(`Unknown transport type: ${(this.config as any).type}`);
    }
  }

  private async setupStdioConnection(): Promise<void> {
    if (this.config.type !== 'stdio') {
      throw new Error('Invalid config for stdio connection');
    }

    // Create transport with server parameters - new SDK spawns process internally
    // Set working directory to the first allowed directory for relative paths
    const cwd = this.config.args && this.config.args.length > 0 ? this.config.args[0] : undefined;
    
    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env: { ...process.env, ...this.config.env },
      cwd: cwd
    });

    this.client = new Client(
      {
        name: 'mcpx-bridge',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        }
      }
    );

    // Note: setNotificationHandler doesn't exist in new SDK
    // this.client.setNotificationHandler((method, params) => {
    //   this.emit('notification', method, params);
    // });

    await this.client.connect(this.transport);
  }

  private async initializeMCP(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      // The new SDK handles initialization automatically when connect() is called
      // We just need to wait for it to complete
      this.isInitialized = true;
      this.emit('initialized');

    } catch (error) {
      throw new Error(`Failed to initialize MCP server: ${(error as Error).message}`);
    }
  }

  private async cleanup(): Promise<void> {
    this.isConnected = false;
    this.isInitialized = false;

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.error('Error closing transport:', error);
      }
      this.transport = null;
    }

    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      // Wait for graceful shutdown, then force kill if needed
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.warn('Force killing MCP server process');
          this.process.kill('SIGKILL');
        }
      }, 5000);
      
      this.process = null;
    }

    this.emit('disconnected');
  }
}