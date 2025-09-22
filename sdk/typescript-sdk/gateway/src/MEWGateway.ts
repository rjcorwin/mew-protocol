import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import {
  GatewayConfig,
  ConnectedClient,
  Envelope,
  Space,
  SystemErrorPayload,
  GatewayEvents,
  Capability,
  PROTOCOL_VERSION,
} from './types';
import { SpaceManager } from './SpaceManager';
import { CapabilityChecker } from './CapabilityChecker';

/**
 * MEW Gateway implementation
 */
export class MEWGateway extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private spaceManager: SpaceManager;
  private capabilityChecker: CapabilityChecker;
  private config: Required<GatewayConfig>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private messagesProcessed = 0;
  private startTime = Date.now();

  constructor(config: GatewayConfig = {}) {
    super();
    
    this.config = {
      port: config.port || 8080,
      host: config.host || '0.0.0.0',
      corsOrigins: config.corsOrigins || ['*'],
      maxSpaces: config.maxSpaces || 100,
      maxClientsPerSpace: config.maxClientsPerSpace || 100,
      maxMessageSize: config.maxMessageSize || 1024 * 1024, // 1MB
      maxHistorySize: config.maxHistorySize || 1000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      authSecret: config.authSecret || 'change-me-in-production',
      enableRestApi: config.enableRestApi !== false,
      enableMetrics: config.enableMetrics !== false,
      logLevel: config.logLevel || 'info',
    };

    this.spaceManager = new SpaceManager(
      this.config.maxSpaces,
      this.config.maxClientsPerSpace,
      this.config.maxHistorySize
    );
    
    this.capabilityChecker = new CapabilityChecker();
  }

  /**
   * Start the gateway
   */
  start(server?: any): void {
    if (this.wss) {
      throw new Error('Gateway already started');
    }

    // Create WebSocket server
    if (server) {
      this.wss = new WebSocketServer({ server });
    } else {
      this.wss = new WebSocketServer({
        port: this.config.port,
        host: this.config.host,
      });
    }

    // Handle connections
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat
    this.startHeartbeat();

    // Start metrics collection
    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }

    this.log('info', `Gateway started on ${this.config.host}:${this.config.port}`);
  }

  /**
   * Stop the gateway
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.wss) {
      this.wss.close(() => {
        this.log('info', 'Gateway stopped');
      });
      this.wss = null;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    // Extract space name from path: /spaces/{spaceName}
    if (pathParts.length !== 2 || pathParts[0] !== 'spaces') {
      this.sendError(ws, 'Invalid path. Use /spaces/{spaceName}');
      ws.close();
      return;
    }

    const spaceName = pathParts[1];
    
    // Extract participant ID and capabilities from headers or query
    const participantId = req.headers['x-participant-id'] as string || 
                         url.searchParams.get('participant') || 
                         `participant-${uuidv4().split('-')[0]}`;
    
    // Parse capabilities from header or use defaults
    let capabilities: Capability[] = [];
    const capsHeader = req.headers['x-capabilities'] as string;
    if (capsHeader) {
      try {
        capabilities = JSON.parse(capsHeader);
      } catch {
        capabilities = CapabilityChecker.createDefaultCapabilities('untrusted');
      }
    } else {
      capabilities = CapabilityChecker.createDefaultCapabilities('untrusted');
    }

    // Create client
    const client: ConnectedClient = {
      ws,
      participantId,
      spaceId: '',
      capabilities,
      authenticated: true, // TODO: Implement proper auth
      metadata: {},
      lastActivity: new Date(),
      contextStack: [],
    };

    // Get or create space
    try {
      const space = this.spaceManager.getOrCreateSpace(spaceName);
      
      // Add client to space
      this.spaceManager.addClient(space.id, client);
      
      this.log('info', `Client ${participantId} joined space ${spaceName}`);
      this.emit('client:connected', client);

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        this.handleMessage(client, data);
      });

      // Handle disconnect
      ws.on('close', () => {
        this.handleDisconnect(client);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        this.log('error', `Client ${participantId} error: ${error.message}`);
        this.emit('error', error, client);
      });

    } catch (error: any) {
      this.sendError(ws, error.message);
      ws.close();
    }
  }

  /**
   * Handle message from client
   */
  private handleMessage(client: ConnectedClient, data: Buffer): void {
    try {
      console.log(
        `[${new Date().toISOString()}] [DEBUG] Raw message from ${client.participantId}: ${data.toString()}`,
      );

      // Check message size
      if (data.length > this.config.maxMessageSize) {
        throw new Error(`Message too large (max ${this.config.maxMessageSize} bytes)`);
      }

      // Parse envelope
      const envelope = JSON.parse(data.toString()) as Envelope;
      
      // Validate envelope
      this.validateEnvelope(envelope, client);

      const isRegistration = envelope.kind === 'system/register';

      console.log(
        `[${new Date().toISOString()}] [INFO] Received envelope from ${client.participantId}: ${envelope.kind}`,
      );

      if (!isRegistration) {
        // Check capabilities
        const capCheck = this.capabilityChecker.checkCapability(envelope, client.capabilities);
        if (!capCheck.allowed) {
          this.sendErrorToClient(client, capCheck.reason || 'Operation not allowed', envelope.kind);
          this.emit('message:blocked', envelope, capCheck.reason || 'No capability');
          return;
        }
      }

      // Update client activity
      client.lastActivity = new Date();

      // Handle context operations
      if (envelope.context) {
        this.handleContextOperation(client, envelope);
      }

      // Get space
      const space = this.spaceManager.getSpace(client.spaceId);
      if (!space) {
        throw new Error('Client not in a space');
      }

      if (envelope.kind === 'system/register') {
        this.handleSystemRegister(client, envelope, space);
        return;
      }

      // Route message
      this.routeMessage(space, envelope);
      
      // Update metrics
      this.messagesProcessed++;
      
      // Emit event
      this.emit('message:sent', envelope, space);

    } catch (error: any) {
      this.log('error', `Message handling error: ${error.message}`);
      this.sendErrorToClient(client, error.message);
    }
  }

  private handleSystemRegister(
    client: ConnectedClient,
    envelope: Envelope,
    space: Space
  ): void {
    const payload = envelope.payload as { capabilities?: Capability[] } | undefined;
    if (!payload || !Array.isArray(payload.capabilities)) {
      throw new Error('system/register payload must include capabilities array');
    }

    console.log(
      `[${new Date().toISOString()}] [INFO] system/register from ${client.participantId}: ${JSON.stringify(payload.capabilities)}`,
    );

    const merged = this.mergeCapabilities(client.capabilities, payload.capabilities);
    client.capabilities = merged;

    console.log(
      `[${new Date().toISOString()}] [INFO] Updated capabilities for ${client.participantId}: ${JSON.stringify(merged)}`,
    );

    this.spaceManager.broadcastPresenceUpdate(space, client);
  }

  private mergeCapabilities(
    current: Capability[],
    requested: Capability[]
  ): Capability[] {
    const deduped = new Map<string, Capability>();

    for (const capability of [...current, ...requested]) {
      if (!capability || typeof capability.kind !== 'string') {
        continue;
      }
      const key = JSON.stringify(capability);
      deduped.set(key, capability);
    }

    const ensure = (capability: Capability) => {
      const key = JSON.stringify(capability);
      if (!deduped.has(key)) {
        deduped.set(key, capability);
      }
    };

    ensure({ id: 'system-register', kind: 'system/register' });
    ensure({ id: 'mcp-response', kind: 'mcp/response' });

    return Array.from(deduped.values());
  }

  /**
   * Validate envelope structure
   */
  private validateEnvelope(envelope: Envelope, client: ConnectedClient): void {
    if (envelope.protocol !== PROTOCOL_VERSION) {
      throw new Error(`Invalid protocol version: ${envelope.protocol}`);
    }
    
    if (!envelope.id || !envelope.ts || !envelope.from || !envelope.kind) {
      throw new Error('Missing required envelope fields');
    }
    
    // Ensure from matches client
    if (envelope.from !== client.participantId) {
      throw new Error('Envelope from does not match participant ID');
    }
  }

  /**
   * Handle context operations
   */
  private handleContextOperation(client: ConnectedClient, envelope: Envelope): void {
    if (!envelope.context) return;
    
    const context = envelope.context;

    if (typeof context === 'string') {
      if (context) {
        client.contextStack.push(context);
      }
      return;
    }

    const { operation, correlation_id } = context;
    
    switch (operation) {
      case 'push':
        if (correlation_id) {
          client.contextStack.push(correlation_id);
        }
        break;
        
      case 'pop':
        client.contextStack.pop();
        break;
        
      case 'resume':
        // Move correlation_id to top if it exists
        if (correlation_id) {
          const index = client.contextStack.indexOf(correlation_id);
          if (index >= 0) {
            client.contextStack.splice(index, 1);
            client.contextStack.push(correlation_id);
          }
        }
        break;
    }
  }

  /**
   * Route message to appropriate recipients
   */
  private routeMessage(space: Space, envelope: Envelope): void {
    if (envelope.to && envelope.to.length > 0) {
      // Targeted message
      this.spaceManager.sendToTargets(space, envelope, envelope.to);
    } else {
      // Broadcast to all except sender
      this.spaceManager.broadcast(space, envelope, [envelope.from]);
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: ConnectedClient): void {
    this.log('info', `Client ${client.participantId} disconnected`);
    
    if (client.spaceId) {
      this.spaceManager.removeClient(client.spaceId, client.participantId);
    }
    
    this.emit('client:disconnected', client);
  }

  /**
   * Send error to WebSocket
   */
  private sendError(ws: WebSocket, message: string): void {
    const errorPayload: SystemErrorPayload = {
      error: 'gateway_error',
      message,
    };

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'system',
      kind: 'system/error',
      payload: errorPayload,
    };

    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  }

  /**
   * Send error to connected client
   */
  private sendErrorToClient(
    client: ConnectedClient, 
    message: string, 
    attemptedKind?: string
  ): void {
    const errorPayload: SystemErrorPayload = {
      error: 'operation_failed',
      message,
      attempted_kind: attemptedKind,
      your_capabilities: client.capabilities,
    };

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'system',
      to: [client.participantId],
      kind: 'system/error',
      payload: errorPayload,
    };

    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(envelope));
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeat: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: uuidv4(),
        ts: new Date().toISOString(),
        from: 'system',
        kind: 'system/heartbeat',
        payload: {},
      };

      for (const space of this.spaceManager.getAllSpaces()) {
        for (const client of space.clients.values()) {
          if (client.ws.readyState === client.ws.OPEN) {
            client.ws.send(JSON.stringify(heartbeat));
          }
        }
      }
      
      // Clean up disconnected clients
      this.spaceManager.cleanupDisconnectedClients();
      
    }, this.config.heartbeatInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics', metrics);
    }, 10000); // Every 10 seconds
  }

  /**
   * Get gateway metrics
   */
  getMetrics() {
    const stats = this.spaceManager.getStats();
    const uptime = Date.now() - this.startTime;
    const messagesPerSecond = this.messagesProcessed / (uptime / 1000);

    return {
      spaces: stats.totalSpaces,
      totalClients: stats.totalClients,
      messagesProcessed: this.messagesProcessed,
      messagesPerSecond,
      averageLatency: 0, // TODO: Implement latency tracking
      uptime,
      memoryUsage: process.memoryUsage(),
      spacesInfo: stats.spacesInfo,
    };
  }

  /**
   * Log message
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Get space manager (for REST API)
   */
  getSpaceManager(): SpaceManager {
    return this.spaceManager;
  }

  /**
   * Get capability checker (for REST API)
   */
  getCapabilityChecker(): CapabilityChecker {
    return this.capabilityChecker;
  }
}

// Override emit to provide typed events
export declare interface MEWGateway {
  emit<K extends keyof GatewayEvents>(event: K, ...args: Parameters<GatewayEvents[K]>): boolean;
  on<K extends keyof GatewayEvents>(event: K, listener: GatewayEvents[K]): this;
  once<K extends keyof GatewayEvents>(event: K, listener: GatewayEvents[K]): this;
  off<K extends keyof GatewayEvents>(event: K, listener: GatewayEvents[K]): this;
}

