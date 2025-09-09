import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';
import Debug from 'debug';

const debug = Debug('meup:mcp-client');

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface PendingRequest {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  method: string;
  timestamp: number;
}

export class MCPClient extends EventEmitter {
  private process?: ChildProcess;
  private rl?: readline.Interface;
  private requestId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private serverInfo?: any;
  public isInitialized = false;

  constructor(private config: MCPServerConfig) {
    super();
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = this.config.args || [];
      const env = { ...process.env, ...this.config.env };

      debug(`Starting MCP server: ${this.config.command} ${args.join(' ')}`);
      console.log('MCP Client: Starting process...', this.config.command, args);
      
      this.process = spawn(this.config.command, args, {
        env,
        cwd: this.config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.on('error', (error) => {
        console.error('MCP Client: Process error:', error);
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        debug(`MCP server exited: code=${code}, signal=${signal}`);
        this.emit('close');
      });

      this.process.stderr?.on('data', (data) => {
        debug('MCP server stderr:', data.toString());
      });

      // Set up readline interface for JSON-RPC
      this.rl = readline.createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity
      });

      this.rl.on('line', (line) => {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          debug('Failed to parse MCP message:', line, error);
        }
      });

      // Process is started
      resolve();
    });
  }

  async initialize(): Promise<any> {
    if (this.isInitialized) {
      return this.serverInfo;
    }

    // Send initialize request
    const result = await this.request('initialize', {
      protocolVersion: '0.1.0',
      capabilities: {
        roots: {
          listChanged: true
        },
        sampling: {}
      },
      clientInfo: {
        name: 'meup-bridge',
        version: '0.1.0'
      }
    });

    this.serverInfo = result;
    
    // Send initialized notification
    this.notify('notifications/initialized', {});
    
    this.isInitialized = true;
    return this.serverInfo;
  }

  async request(method: string, params: any = {}): Promise<any> {
    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    console.log(`MCP Client: Sending request ${id}: ${method}`);
    debug(`Sending MCP request ${id}:`, method);
    
    return new Promise((resolve, reject) => {
      // Store pending request
      console.log(`MCP Client: Storing pending request with id ${id}`);
      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        timestamp: Date.now()
      });
      console.log(`MCP Client: Pending requests after storing:`, Array.from(this.pendingRequests.keys()));

      // Send request
      this.send(request);

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          console.log(`MCP Client: Request ${id} timed out for method ${method}`);
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  notify(method: string, params: any = {}): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    debug(`Sending MCP notification:`, method);
    this.send(notification);
  }

  private send(message: any): void {
    if (!this.process?.stdin) {
      throw new Error('MCP process not started');
    }
    
    const json = JSON.stringify(message);
    console.log('MCP Client: Writing to stdin:', json);
    debug('MCP -> Server:', json);
    this.process.stdin.write(json + '\n');
  }

  private handleMessage(message: any): void {
    console.log('MCP Client: Received from server:', JSON.stringify(message));
    debug('Server -> MCP:', message);

    // Handle response to our request
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      console.log(`MCP Client: Checking for pending request with id ${message.id}`);
      console.log(`MCP Client: Current pending requests:`, Array.from(this.pendingRequests.keys()));
      
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        console.log(`MCP Client: Found pending request for id ${message.id}, resolving...`);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          console.log(`MCP Client: Rejecting request ${message.id} with error:`, message.error);
          pending.reject(new Error(message.error.message || 'MCP error'));
        } else {
          console.log(`MCP Client: Resolving request ${message.id} with result:`, message.result);
          pending.resolve(message.result);
        }
      } else {
        console.log(`MCP Client: No pending request found for id ${message.id}`);
      }
      return;
    }

    // Handle request from server (like roots/list)
    if (message.id !== undefined && message.method) {
      debug(`Received request from MCP server: ${message.method}`);
      // For now, respond with empty result
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: this.handleServerRequest(message.method, message.params)
      };
      this.send(response);
      return;
    }

    // Handle notification from server
    if (message.method && message.id === undefined) {
      debug(`Received notification from MCP server: ${message.method}`);
      this.emit('notification', message);
    }
  }

  private handleServerRequest(method: string, params: any): any {
    // Handle server requests
    switch (method) {
      case 'roots/list':
        return { roots: [] };
      default:
        debug(`Unhandled server request: ${method}`);
        return {};
    }
  }

  async shutdown(): Promise<void> {
    debug('Shutting down MCP client');
    
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.process) {
      this.process.kill();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.pendingRequests.clear();
    this.isInitialized = false;
  }
}