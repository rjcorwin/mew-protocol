const { spawn } = require('child_process');
const EventEmitter = require('events');
const debug = require('debug')('meup:bridge:mcp');
const readline = require('readline');

/**
 * MCP Client - manages MCP server subprocess and JSON-RPC communication
 */
class MCPClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.process = null;
    this.rl = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.isInitialized = false;
    this.serverInfo = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      debug('Starting MCP server process:', this.config.command, this.config.args);
      
      // Spawn the MCP server process
      this.process = spawn(this.config.command, this.config.args || [], {
        env: this.config.env,
        cwd: this.config.cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Set up readline interface for parsing JSON-RPC from stdout
      this.rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      // Handle stdout lines (JSON-RPC responses)
      this.rl.on('line', (line) => {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          debug('Failed to parse MCP message:', line);
          debug('Parse error:', error);
        }
      });

      // Handle stderr (logging)
      this.process.stderr.on('data', (data) => {
        debug('MCP stderr:', data.toString());
      });

      // Handle process errors
      this.process.on('error', (error) => {
        debug('MCP process error:', error);
        this.emit('error', error);
        reject(error);
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        debug(`MCP process exited with code ${code}, signal ${signal}`);
        this.emit('close', code);
        
        // Reject any pending requests
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error(`MCP server exited: ${code}`));
        }
        this.pendingRequests.clear();
      });

      // Process is started
      resolve();
    });
  }

  async initialize() {
    debug('Initializing MCP server');
    
    // Send initialize request
    const initResult = await this.request('initialize', {
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

    this.serverInfo = initResult;
    debug('MCP server info:', this.serverInfo);

    // Send initialized notification
    this.notify('notifications/initialized', {});
    
    this.isInitialized = true;
    return this.serverInfo;
  }

  async request(method, params = {}) {
    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    debug(`Sending MCP request ${id}:`, method);
    
    return new Promise((resolve, reject) => {
      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        timestamp: Date.now()
      });

      // Send request
      this.send(request);

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  notify(method, params = {}) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    debug('Sending MCP notification:', method);
    this.send(notification);
  }

  send(message) {
    if (!this.process || this.process.killed) {
      throw new Error('MCP process not running');
    }

    const json = JSON.stringify(message);
    debug('MCP -> Server:', json);
    this.process.stdin.write(json + '\n');
  }

  handleMessage(message) {
    debug('Server -> MCP:', message);

    // Handle response to our request
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error.message || 'MCP error'));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Handle request from server (like roots/list)
    if (message.id !== undefined && message.method) {
      debug(`Received request from MCP server: ${message.method}`);
      
      // For now, respond with empty result for unsupported requests
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {}
      };
      
      // Handle specific requests
      if (message.method === 'roots/list') {
        response.result = { roots: [] };
      }
      
      debug(`Responding to MCP server request:`, response);
      this.send(response);
      return;
    }

    // Handle notification
    if (message.method) {
      this.emit('notification', message);
      
      // Handle specific notifications
      if (message.method === 'notifications/resources/list_changed') {
        debug('Resources changed');
      } else if (message.method === 'notifications/tools/list_changed') {
        debug('Tools changed');
      } else if (message.method === 'notifications/prompts/list_changed') {
        debug('Prompts changed');
      }
    }
  }

  async shutdown() {
    debug('Shutting down MCP server');
    
    if (this.rl) {
      this.rl.close();
    }

    if (this.process && !this.process.killed) {
      // Try graceful shutdown first
      this.process.stdin.end();
      
      // Give it time to exit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force kill if still running
      if (!this.process.killed) {
        this.process.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }
    }

    this.process = null;
    this.isInitialized = false;
  }

  // Helper methods for common MCP operations
  async listTools() {
    return this.request('tools/list');
  }

  async callTool(name, args) {
    return this.request('tools/call', {
      name,
      arguments: args
    });
  }

  async listResources() {
    return this.request('resources/list');
  }

  async readResource(uri) {
    return this.request('resources/read', { uri });
  }

  async listPrompts() {
    return this.request('prompts/list');
  }

  async getPrompt(name, args) {
    return this.request('prompts/get', {
      name,
      arguments: args
    });
  }

  async complete(ref, completion) {
    return this.request('completion/complete', {
      ref,
      completion
    });
  }

  async setLogLevel(level) {
    return this.request('logging/setLevel', { level });
  }
}

module.exports = { MCPClient };