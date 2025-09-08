const { spawn } = require('child_process');
const WebSocket = require('ws');
const debug = require('debug')('meup:bridge');
const { MCPClient } = require('./mcp-client');
const { MessageTranslator } = require('./message-translator');
const EventEmitter = require('events');

class MCPBridge extends EventEmitter {
  constructor(options) {
    super();
    
    // MEUP connection options
    this.gateway = options.gateway;
    this.space = options.space;
    this.participantId = options.participantId;
    this.token = options.token;
    
    // MCP server options
    this.mcpServerConfig = options.mcpServer;
    
    // Bridge options
    this.initTimeout = options.initTimeout || 30000;
    this.reconnect = options.reconnect !== false;
    this.maxReconnects = options.maxReconnects || 5;
    this.reconnectAttempts = 0;
    
    // State
    this.ws = null;
    this.mcpClient = null;
    this.translator = new MessageTranslator();
    this.capabilities = [];
    this.isShuttingDown = false;
    this.messageQueue = new Map(); // Track pending requests
  }

  async start() {
    debug('Starting MCP-MEUP bridge');
    
    try {
      // Step 1: Start MCP server and initialize
      await this.startMCPServer();
      
      // Step 2: Connect to MEUP gateway
      await this.connectToGateway();
      
      // Registration will happen after receiving welcome message
      
      debug('Bridge started successfully');
    } catch (error) {
      debug('Failed to start bridge:', error);
      await this.shutdown();
      throw error;
    }
  }

  async startMCPServer() {
    debug('Starting MCP server:', this.mcpServerConfig);
    
    this.mcpClient = new MCPClient(this.mcpServerConfig);
    
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
      if (!this.isShuttingDown && this.reconnect) {
        this.attemptReconnect();
      }
    });
    
    // Start and initialize MCP server
    await this.mcpClient.start();
    
    // Get capabilities from MCP server
    const serverInfo = await this.mcpClient.initialize();
    this.capabilities = this.translator.mcpToMeupCapabilities(serverInfo.capabilities);
    debug('MCP server capabilities:', this.capabilities);
  }

  async connectToGateway() {
    return new Promise((resolve, reject) => {
      debug(`Connecting to gateway: ${this.gateway}`);
      
      const url = new URL(this.gateway);
      url.searchParams.set('space', this.space);
      url.searchParams.set('participant-id', this.participantId);
      if (this.token) {
        url.searchParams.set('token', this.token);
      }
      
      this.ws = new WebSocket(url.toString());
      
      this.ws.on('open', () => {
        debug('Connected to MEUP gateway');
        // Registration will be sent after we have capabilities
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMEUPMessage(message);
        } catch (error) {
          console.error('Failed to parse MEUP message:', error);
        }
      });
      
      this.ws.on('error', (error) => {
        debug('WebSocket error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        debug('Disconnected from gateway');
        if (!this.isShuttingDown && this.reconnect) {
          this.attemptReconnect();
        }
      });
      
      // Set timeout for connection
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('Gateway connection timeout'));
        }
      }, 10000);
    });
  }

  async handleMEUPMessage(message) {
    debug('Received MEUP message:', message.kind, message.id);
    
    // Handle system messages
    if (message.kind === 'system/welcome') {
      this.handleWelcome(message);
      return;
    }
    
    // Handle MCP requests
    if (message.kind === 'mcp/request') {
      await this.handleMCPRequest(message);
      return;
    }
    
    // Handle other message types as needed
    debug('Unhandled message kind:', message.kind);
  }

  handleWelcome(message) {
    debug('Received welcome message');
    debug('My capabilities:', message.payload?.you?.capabilities);
    debug('Participants:', message.payload?.participants);
    
    // Now that we're welcomed, send our registration
    this.sendRegistration();
  }

  sendRegistration() {
    const message = {
      protocol: 'meup/v0.2',
      kind: 'system/register',
      id: `register-${Date.now()}`,
      from: this.participantId,
      ts: new Date().toISOString(),
      payload: {
        capabilities: this.capabilities
      }
    };
    
    debug('Sending registration:', message);
    this.ws.send(JSON.stringify(message));
  }

  async handleMCPRequest(message) {
    const { method, params } = message.payload;
    debug(`Handling MCP request: ${method}`);
    
    try {
      // Translate MEUP request to MCP JSON-RPC
      const mcpRequest = this.translator.meupToMcpRequest(message);
      
      // Track the request for correlation
      this.messageQueue.set(mcpRequest.id, {
        meupMessage: message,
        timestamp: Date.now()
      });
      
      // Send to MCP server
      const result = await this.mcpClient.request(method, params);
      
      // Send response back to MEUP
      this.sendMEUPResponse(message, result);
      
      // Clean up tracking
      this.messageQueue.delete(mcpRequest.id);
      
    } catch (error) {
      debug('MCP request failed:', error);
      this.sendMEUPError(message, error);
    }
  }

  handleMCPNotification(notification) {
    debug('MCP notification:', notification);
    
    // Translate MCP notifications to MEUP messages if needed
    // For example, log messages could become system/log messages
    if (notification.method === 'notifications/message') {
      this.sendMEUPMessage({
        kind: 'system/log',
        payload: notification.params
      });
    }
  }

  handleMCPError(error) {
    // Send error to MEUP space
    this.sendMEUPMessage({
      kind: 'system/error',
      payload: {
        error: error.message,
        source: 'mcp-bridge'
      }
    });
  }

  sendMEUPResponse(requestMessage, result) {
    const response = {
      protocol: 'meup/v0.2',
      kind: 'mcp/response',
      id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.participantId,
      to: [requestMessage.from],
      correlation_id: [requestMessage.id],
      payload: {
        jsonrpc: '2.0',
        result: result
      },
      ts: new Date().toISOString()
    };
    
    this.sendMEUPMessage(response);
  }

  sendMEUPError(requestMessage, error) {
    const errorResponse = {
      protocol: 'meup/v0.2',
      kind: 'mcp/response',
      id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: this.participantId,
      to: [requestMessage.from],
      correlation_id: [requestMessage.id],
      payload: {
        jsonrpc: '2.0',
        error: {
          code: error.code || -32603,
          message: error.message || 'Internal error',
          data: error.data
        }
      },
      ts: new Date().toISOString()
    };
    
    this.sendMEUPMessage(errorResponse);
  }

  sendMEUPMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Ensure required fields
      if (!message.protocol) message.protocol = 'meup/v0.2';
      if (!message.id) message.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      if (!message.from) message.from = this.participantId;
      if (!message.ts) message.ts = new Date().toISOString();
      
      debug('Sending MEUP message:', message.kind, message.id);
      this.ws.send(JSON.stringify(message));
    } else {
      debug('Cannot send message, WebSocket not open');
    }
  }

  async attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) {
      console.error('Max reconnection attempts reached');
      process.exit(1);
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    debug(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnects} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.start();
        this.reconnectAttempts = 0;
      } catch (error) {
        debug('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  async shutdown() {
    debug('Shutting down bridge');
    this.isShuttingDown = true;
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Stop MCP server
    if (this.mcpClient) {
      await this.mcpClient.shutdown();
      this.mcpClient = null;
    }
    
    debug('Bridge shutdown complete');
  }
}

module.exports = { MCPBridge };