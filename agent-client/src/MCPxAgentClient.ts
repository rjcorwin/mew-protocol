import WebSocket from 'ws';
import { EventEmitter } from 'eventemitter3';
import Debug from 'debug';
import {
  MCPxConfig,
  MCPxEvents,
  Envelope,
  Peer,
  Tool,
  ToolCall,
  ToolResult,
  ChatMessage,
  PresenceEvent,
  SystemWelcome,
  TopicContext,
  ToolCallRequest,
  MCPRequest,
  MCPResponse,
  EnvelopeSchema
} from './types';

const debug = Debug('mcpx:agent-client');

export class MCPxAgentClient extends EventEmitter<MCPxEvents> {
  private ws: WebSocket | null = null;
  private config: MCPxConfig;
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectAttempt = 0;
  
  // State management
  private peers = new Map<string, Peer>();
  private messageHistory: Envelope[] = [];
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  
  // Tool registry
  private localTools = new Map<string, (params: any) => Promise<any>>();
  
  constructor(config: MCPxConfig) {
    super();
    this.config = {
      reconnect: true,
      reconnectDelay: 1000,
      reconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    };
  }
  
  // Connection Management
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.serverUrl}/v0/ws?topic=${encodeURIComponent(this.config.topic)}`;
      
      debug('Connecting to', wsUrl);
      
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.authToken}`
        }
      });
      
      this.ws.on('open', () => {
        debug('Connected');
        this.connected = true;
        this.reconnectAttempt = 0;
        this.startHeartbeat();
        this.emit('connected');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });
      
      this.ws.on('error', (error) => {
        debug('WebSocket error:', error);
        this.emit('error', error);
        if (!this.connected) reject(error);
      });
      
      this.ws.on('close', (code, reason) => {
        debug('Disconnected:', code, reason?.toString());
        this.handleDisconnect();
      });
    });
  }
  
  disconnect(): void {
    this.connected = false;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();
    
    this.emit('disconnected');
  }
  
  private handleDisconnect(): void {
    this.connected = false;
    this.stopHeartbeat();
    
    if (this.config.reconnect && this.reconnectAttempt < this.config.reconnectAttempts!) {
      this.reconnectAttempt++;
      const delay = this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempt - 1);
      
      debug(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(error => {
          debug('Reconnection failed:', error);
        });
      }, delay);
    } else {
      this.emit('disconnected', 'Max reconnection attempts reached');
    }
  }
  
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.sendPresenceHeartbeat();
      }
    }, this.config.heartbeatInterval!);
  }
  
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
  
  private sendPresenceHeartbeat(): void {
    const envelope: Envelope = {
      protocol: 'mcp-x/v0',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: this.config.participantId,
      kind: 'presence',
      payload: {
        event: 'heartbeat',
        participant: {
          id: this.config.participantId,
          name: this.config.participantName,
          kind: 'agent'
        },
        timestamp: new Date().toISOString()
      }
    };
    
    this.sendEnvelope(envelope);
  }
  
  // Message Handling
  private handleMessage(data: string): void {
    try {
      const envelope = JSON.parse(data);
      const validated = EnvelopeSchema.parse(envelope);
      
      debug('Received:', validated.kind, validated.from);
      
      this.messageHistory.push(validated);
      this.emit('message', validated);
      
      switch (validated.kind) {
        case 'system':
          this.handleSystemMessage(validated);
          break;
        case 'presence':
          this.handlePresenceMessage(validated);
          break;
        case 'chat':
          this.handleChatMessage(validated);
          break;
        case 'mcp':
          this.handleMCPMessage(validated);
          break;
      }
    } catch (error) {
      debug('Failed to parse message:', error);
    }
  }
  
  private handleSystemMessage(envelope: Envelope): void {
    debug('System message received:', JSON.stringify(envelope.payload));
    if (envelope.payload.event === 'welcome') {
      const welcome = envelope.payload as SystemWelcome;
      debug(`Welcome message received with ${welcome.participants.length} participants`);
      
      // Update peer list
      for (const participant of welcome.participants) {
        if (participant.id !== this.config.participantId) {
          debug(`Adding peer: ${participant.id} (${participant.name}) - ${participant.kind}`);
          this.peers.set(participant.id, {
            id: participant.id,
            name: participant.name,
            kind: participant.kind,
            tools: [],
            status: 'online',
            lastSeen: new Date(),
            metadata: participant.metadata
          });
        }
      }
      
      // Store history (if it's an array)
      if (welcome.history && Array.isArray(welcome.history)) {
        this.messageHistory = welcome.history;
      }
      
      debug(`Initializing MCP with ${this.peers.size} peers`);
      // Send MCP initialize to all peers
      this.initializeMCPWithPeers();
    }
  }
  
  private handlePresenceMessage(envelope: Envelope): void {
    const presence = envelope.payload as PresenceEvent;
    
    if (presence.participant.id === this.config.participantId) {
      return; // Ignore our own presence
    }
    
    switch (presence.event) {
      case 'join':
        const peer: Peer = {
          id: presence.participant.id,
          name: presence.participant.name,
          kind: presence.participant.kind,
          tools: [],
          status: 'online',
          lastSeen: new Date(),
          metadata: presence.participant.metadata
        };
        this.peers.set(peer.id, peer);
        this.emit('peerJoined', peer);
        
        // Initialize MCP with new peer
        this.sendMCPInitialize(peer.id);
        break;
        
      case 'leave':
        this.peers.delete(presence.participant.id);
        this.emit('peerLeft', presence.participant.id);
        break;
        
      case 'heartbeat':
        const existingPeer = this.peers.get(presence.participant.id);
        if (existingPeer) {
          existingPeer.lastSeen = new Date();
          existingPeer.status = 'online';
        }
        break;
    }
  }
  
  private handleChatMessage(envelope: Envelope): void {
    const message: ChatMessage = {
      from: envelope.from,
      text: envelope.payload.text,
      format: envelope.payload.format || 'plain',
      timestamp: new Date(envelope.ts)
    };
    
    this.emit('chat', message);
  }
  
  private async handleMCPMessage(envelope: Envelope): Promise<void> {
    const mcp = envelope.payload;
    
    // Handle responses to our requests
    if (mcp.id && this.pendingRequests.has(mcp.id)) {
      const pending = this.pendingRequests.get(mcp.id)!;
      clearTimeout(pending.timer);
      this.pendingRequests.delete(mcp.id);
      
      if (mcp.error) {
        pending.reject(new Error(mcp.error.message));
      } else {
        pending.resolve(mcp.result);
      }
      return;
    }
    
    // Handle incoming requests
    if (mcp.method && mcp.id) {
      await this.handleIncomingToolCall(envelope, mcp);
    }
    
    // Handle notifications
    if (mcp.method && !mcp.id) {
      this.handleMCPNotification(envelope, mcp);
    }
  }
  
  private async handleIncomingToolCall(envelope: Envelope, mcp: MCPRequest): Promise<void> {
    if (mcp.method === 'tools/call') {
      const request: ToolCallRequest = {
        from: envelope.from,
        tool: mcp.params.name,
        params: mcp.params.arguments,
        requestId: mcp.id!
      };
      
      try {
        const result = await this.emit('toolCall', request);
        
        // Send response
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcp.id!,
          result: result || null
        };
        
        this.sendMCPResponse(envelope.from, response, envelope.id);
      } catch (error: any) {
        // Send error response
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: mcp.id!,
          error: {
            code: -32603,
            message: error.message || 'Internal error'
          }
        };
        
        this.sendMCPResponse(envelope.from, response, envelope.id);
      }
    }
  }
  
  private handleMCPNotification(envelope: Envelope, mcp: any): void {
    // Handle chat messages
    if (mcp.method === 'notifications/chat/message') {
      const message: ChatMessage = {
        from: envelope.from,
        text: mcp.params?.text || '',
        format: mcp.params?.format || 'plain',
        timestamp: new Date(envelope.ts)
      };
      debug(`Chat from ${message.from}: ${message.text}`);
      this.emit('chat', message);
      return;
    }
    
    // Handle initialized notification
    if (mcp.method === 'initialized') {
      debug(`Peer ${envelope.from} initialized`);
      
      // Request their tools and wait for the response before emitting ready
      this.requestPeerTools(envelope.from).then(() => {
        // Emit an event when peer is fully initialized with tools
        const peer = this.peers.get(envelope.from);
        if (peer) {
          this.emit('peerReady', peer);
        }
      });
    }
  }
  
  // MCP Protocol
  private async requestPeerTools(peerId: string): Promise<void> {
    try {
      const requestId = this.generateId();
      
      // Create promise to wait for response
      const responsePromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Timeout requesting tools from ${peerId}`));
        }, 5000);
        
        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          timer
        });
      });
      
      // Send the request
      this.sendMCPRequest(peerId, 'tools/list', {}, requestId);
      
      // Wait for response
      const result = await responsePromise;
      
      // Update peer's tools
      const peer = this.peers.get(peerId);
      if (peer && result && result.tools) {
        peer.tools = result.tools.map((tool: any) => ({
          peerId: peerId,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }));
        debug(`Received ${peer.tools.length} tools from ${peerId}`);
        this.emit('peerUpdated', peer);
      }
    } catch (error) {
      debug(`Failed to get tools from ${peerId}:`, error);
    }
  }
  
  private async initializeMCPWithPeers(): Promise<void> {
    debug(`Sending MCP initialize to ${this.peers.size} peers`);
    const promises = [];
    for (const peer of this.peers.values()) {
      debug(`Sending MCP initialize to ${peer.id}`);
      promises.push(this.sendMCPInitialize(peer.id));
    }
    await Promise.allSettled(promises);
    debug('Finished initializing with all peers');
  }
  
  private async sendMCPInitialize(peerId: string): Promise<void> {
    const requestId = this.generateId();
    
    try {
      // Create promise to wait for initialize response
      const responsePromise = new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Timeout initializing with ${peerId}`));
        }, 5000);
        
        this.pendingRequests.set(requestId, {
          resolve,
          reject,
          timer
        });
      });
      
      // Send initialize request
      this.sendMCPRequest(peerId, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: this.config.participantName || this.config.participantId,
          version: '0.1.0'
        }
      }, requestId);
      
      // Wait for initialize response
      const result = await responsePromise;
      debug(`Received initialize response from ${peerId}`, result);
      
      // Send initialized notification (no id)
      const notificationEnvelope: Envelope = {
        protocol: 'mcp-x/v0',
        id: this.generateId(),
        ts: new Date().toISOString(),
        from: this.config.participantId,
        to: [peerId],
        kind: 'mcp',
        payload: {
          jsonrpc: '2.0',
          method: 'initialized',
          params: {}
        }
      };
      this.sendEnvelope(notificationEnvelope);
      debug(`Sent initialized notification to ${peerId}`);
      
      // Now request tools
      await this.requestPeerTools(peerId);
      
    } catch (error) {
      debug(`Failed to initialize with ${peerId}:`, error);
    }
  }
  
  private sendMCPRequest(to: string, method: string, params: any, id?: string | number): void {
    const requestId = id || this.generateId();
    
    const envelope: Envelope = {
      protocol: 'mcp-x/v0',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: this.config.participantId,
      to: [to],
      kind: 'mcp',
      payload: {
        jsonrpc: '2.0',
        id: requestId,
        method,
        params
      }
    };
    
    this.sendEnvelope(envelope);
  }
  
  private sendMCPResponse(to: string, response: MCPResponse, correlationId: string): void {
    const envelope: Envelope = {
      protocol: 'mcp-x/v0',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: this.config.participantId,
      to: [to],
      kind: 'mcp',
      correlation_id: correlationId,
      payload: response
    };
    
    this.sendEnvelope(envelope);
  }
  
  private sendEnvelope(envelope: Envelope): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(envelope));
    }
  }
  
  // Public API
  
  // Peer Discovery
  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }
  
  getPeer(id: string): Peer | null {
    return this.peers.get(id) || null;
  }
  
  async waitForPeer(id: string, timeout = 30000): Promise<Peer> {
    const existing = this.peers.get(id);
    if (existing) return existing;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('peerJoined', handler);
        reject(new Error(`Timeout waiting for peer ${id}`));
      }, timeout);
      
      const handler = (peer: Peer) => {
        if (peer.id === id) {
          clearTimeout(timer);
          this.off('peerJoined', handler);
          resolve(peer);
        }
      };
      
      this.on('peerJoined', handler);
    });
  }
  
  async waitForPeersReady(timeout = 10000): Promise<void> {
    debug('Waiting for all peers to be ready with tools...');
    const startTime = Date.now();
    
    // Get all peers that don't have tools yet
    const peersWithoutTools = Array.from(this.peers.values()).filter(p => p.tools.length === 0);
    
    if (peersWithoutTools.length === 0) {
      debug('All peers already have tools');
      return;
    }
    
    // Wait for each peer to be ready
    const promises = peersWithoutTools.map(peer => {
      return new Promise<void>((resolve) => {
        const checkReady = () => {
          const updatedPeer = this.peers.get(peer.id);
          if (updatedPeer && updatedPeer.tools.length > 0) {
            resolve();
          } else if (Date.now() - startTime > timeout) {
            debug(`Timeout waiting for peer ${peer.id} tools`);
            resolve(); // Resolve anyway after timeout
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    });
    
    await Promise.all(promises);
    debug('All peers ready with tools');
  }
  
  // Tool Operations
  listTools(peerId?: string): Tool[] {
    const tools: Tool[] = [];
    
    for (const peer of this.peers.values()) {
      if (!peerId || peer.id === peerId) {
        tools.push(...peer.tools);
      }
    }
    
    return tools;
  }
  
  async callTool(peerId: string, tool: string, params: any, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateId();
      
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool call timeout: ${tool} on ${peerId}`));
      }, timeout);
      
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timer
      });
      
      this.sendMCPRequest(peerId, 'tools/call', {
        name: tool,
        arguments: params
      }, requestId);
    });
  }
  
  async callTools(calls: ToolCall[]): Promise<ToolResult[]> {
    const promises = calls.map(call => 
      this.callTool(call.peerId, call.tool, call.params, call.timeout)
        .then(result => ({ success: true, result } as ToolResult))
        .catch(error => ({ success: false, error: error.message } as ToolResult))
    );
    
    return Promise.all(promises);
  }
  
  // Communication
  sendChat(message: string, format: 'plain' | 'markdown' = 'plain'): void {
    const envelope: Envelope = {
      protocol: 'mcp-x/v0',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: this.config.participantId,
      kind: 'mcp',
      payload: {
        jsonrpc: '2.0',
        method: 'notifications/chat/message',
        params: {
          text: message,
          format
        }
      }
    };
    
    this.sendEnvelope(envelope);
  }
  
  broadcast(kind: string, payload: any): void {
    const envelope: Envelope = {
      protocol: 'mcp-x/v0',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: this.config.participantId,
      kind: kind as any,
      payload
    };
    
    this.sendEnvelope(envelope);
  }
  
  sendTo(peerId: string, kind: string, payload: any): void {
    const envelope: Envelope = {
      protocol: 'mcp-x/v0',
      id: this.generateId(),
      ts: new Date().toISOString(),
      from: this.config.participantId,
      to: [peerId],
      kind: kind as any,
      payload
    };
    
    this.sendEnvelope(envelope);
  }
  
  // Context
  getHistory(limit?: number): Envelope[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }
  
  getContext(): TopicContext {
    const availableTools = new Map<string, Tool[]>();
    
    for (const peer of this.peers.values()) {
      availableTools.set(peer.id, peer.tools);
    }
    
    return {
      topic: this.config.topic,
      participantId: this.config.participantId,
      participants: new Map(this.peers),
      messageHistory: [...this.messageHistory],
      availableTools
    };
  }
  
  // Tool Registration (for this agent's tools)
  registerTool(name: string, handler: (params: any) => Promise<any>): void {
    this.localTools.set(name, handler);
  }
  
  // Utilities
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
}