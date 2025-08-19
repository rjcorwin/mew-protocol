import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { 
  Client, 
  StdioClientTransport, 
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  InitializeRequest,
  InitializeResult,
  InitializedNotification
} from '@modelcontextprotocol/sdk/client/index.js';
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

  async callTool(name: string, arguments_?: Record<string, any>): Promise<CallToolResult> {
    if (!this.client || !this.isInitialized) {
      throw new Error('MCP server not initialized');
    }

    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name,
        arguments: arguments_ || {}
      }
    };

    return await this.client.callTool(request);
  }

  async listTools(): Promise<ListToolsResult> {
    if (!this.client || !this.isInitialized) {
      throw new Error('MCP server not initialized');
    }

    const request: ListToolsRequest = {
      method: 'tools/list',
      params: {}
    };

    return await this.client.listTools(request);
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
          // Re-initialization not supported
          throw new Error('Server already initialized');
        
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

    // Spawn the MCP server process
    this.process = spawn(this.config.command, this.config.args, {
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (!this.process.stdin || !this.process.stdout) {
      throw new Error('Failed to create stdio pipes');
    }

    // Set up process event handlers
    this.process.on('error', (error) => {
      console.error('MCP server process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`MCP server process exited: code=${code}, signal=${signal}`);
      this.emit('disconnected');
    });

    // Create transport and client
    this.transport = new StdioClientTransport({
      readable: this.process.stdout,
      writable: this.process.stdin
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

    // Set up client notification handler
    this.client.setNotificationHandler((method, params) => {
      this.emit('notification', method, params);
    });

    await this.client.connect(this.transport);
  }

  private async initializeMCP(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    try {
      const initRequest: InitializeRequest = {
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          clientInfo: {
            name: 'mcpx-bridge',
            version: '0.1.0'
          }
        }
      };

      const initResult = await this.client.initialize(initRequest);
      console.log('MCP server initialized:', initResult);

      // Send initialized notification
      const initializedNotification: InitializedNotification = {
        method: 'notifications/initialized',
        params: {}
      };

      await this.client.sendNotification(initializedNotification);
      
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