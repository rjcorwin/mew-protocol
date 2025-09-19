import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';
import Debug from 'debug';

const debug = Debug('mew:mcp-client');

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

      this.process = spawn(this.config.command, args, {
        env,
        cwd: this.config.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.on('error', (error) => {
        debug('Process error:', error);
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        debug(`MCP server exited: code=${code}, signal=${signal}`);
        console.error(`MCP server exited unexpectedly: code=${code}, signal=${signal}`);
        this.emit('close');
      });

      this.process.stderr?.on('data', (data) => {
        const stderr = data.toString();
        console.error('MCP server stderr:', stderr);
        debug('MCP server stderr:', stderr);
      });

      // Also capture raw stdout for debugging
      this.process.stdout?.on('data', (data) => {
        console.log('MCP server stdout (raw):', data.toString());
      });

      // Set up readline interface for JSON-RPC
      this.rl = readline.createInterface({
        input: this.process.stdout!,
        crlfDelay: Infinity,
      });

      this.rl.on('line', (line) => {
        console.log('MCP server line:', line);
        try {
          const message = JSON.parse(line);
          console.log('MCP Server -> Client:', JSON.stringify(message));
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse MCP message:', line, error);
          debug('Failed to parse MCP message:', line, error);
        }
      });

      // Process is started
      setTimeout(() => resolve(), 100); // Give process time to start
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
          listChanged: true,
        },
        sampling: {},
      },
      clientInfo: {
        name: 'mew-bridge',
        version: '0.1.0',
      },
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
      params,
    };

    debug(`Sending MCP request ${id}:`, method);

    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        timestamp: Date.now(),
      });

      // Send request
      this.send(request);

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          debug(`Request ${id} timed out for method ${method}`);
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
      params,
    };

    debug(`Sending MCP notification:`, method);
    this.send(notification);
  }

  private send(message: any): void {
    if (!this.process?.stdin) {
      throw new Error('MCP process not started');
    }

    const json = JSON.stringify(message);
    console.log('MCP Client -> Server:', json);
    debug('MCP -> Server:', json);
    this.process.stdin.write(json + '\n');
  }

  private handleMessage(message: any): void {
    debug('Server -> MCP:', message);

    // Handle response to our request
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);

        if (message.error) {
          debug(`Rejecting request ${message.id} with error:`, message.error);
          pending.reject(new Error(message.error.message || 'MCP error'));
        } else {
          debug(`Resolving request ${message.id} with result`);
          pending.resolve(message.result);
        }
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
        result: this.handleServerRequest(message.method, message.params),
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

  private handleServerRequest(method: string, _params: any): any {
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

    if (this.process && !this.process.killed) {
      // First try SIGTERM for graceful shutdown
      this.process.kill('SIGTERM');
      
      // Wait up to 5 seconds for process to exit
      let waited = 0;
      while (this.process.exitCode === null && waited < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waited += 100;
      }
      
      // Force kill if still running
      if (this.process.exitCode === null) {
        debug('Process did not exit gracefully, sending SIGKILL');
        this.process.kill('SIGKILL');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    this.pendingRequests.clear();
    this.isInitialized = false;
  }
}
