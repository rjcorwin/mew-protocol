import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { MEUPGateway } from './MEUPGateway';
import { CapabilityChecker } from './CapabilityChecker';
import { 
  GatewayConfig,
  CreateSpaceRequest,
  CreateTokenRequest,
  TokenPayload,
  SpaceInfo 
} from './types';

/**
 * Create and start MEUP gateway server with REST API
 */
export function createGatewayServer(config: GatewayConfig = {}) {
  const app = express();
  const server = createServer(app);
  const gateway = new MEUPGateway(config);

  // Middleware
  app.use(cors({
    origin: config.corsOrigins || ['*'],
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      protocol: 'meup/v0.2',
      uptime: process.uptime(),
    });
  });

  // Get gateway metrics
  app.get('/metrics', (req, res) => {
    if (!config.enableMetrics) {
      return res.status(404).json({ error: 'Metrics not enabled' });
    }
    
    res.json(gateway.getMetrics());
  });

  // REST API Routes (if enabled)
  if (config.enableRestApi !== false) {
    const authSecret = config.authSecret || 'change-me-in-production';
    
    // Middleware to verify admin token
    const requireAdmin = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      try {
        const payload = jwt.verify(token, authSecret) as TokenPayload;
        if (!payload.admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        req.user = payload;
        next();
      } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
      }
    };

    // List all spaces
    app.get('/api/spaces', (req, res) => {
      const spaces = gateway.getSpaceManager().getAllSpaces();
      const spacesInfo: SpaceInfo[] = spaces.map(space => ({
        id: space.id,
        name: space.name,
        participants: space.clients.size,
        created: space.created.toISOString(),
      }));
      
      res.json(spacesInfo);
    });

    // Get space info
    app.get('/api/spaces/:name', (req, res) => {
      const space = gateway.getSpaceManager().getSpaceByName(req.params.name);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }
      
      const info: SpaceInfo = {
        id: space.id,
        name: space.name,
        participants: space.clients.size,
        created: space.created.toISOString(),
      };
      
      res.json(info);
    });

    // Get space participants
    app.get('/api/spaces/:name/participants', (req, res) => {
      const space = gateway.getSpaceManager().getSpaceByName(req.params.name);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }
      
      const participants = Array.from(space.clients.values()).map(client => ({
        id: client.participantId,
        capabilities: client.capabilities,
        connected: client.ws.readyState === client.ws.OPEN,
        lastActivity: client.lastActivity.toISOString(),
      }));
      
      res.json(participants);
    });

    // Get message history
    app.get('/api/spaces/:name/messages', (req, res) => {
      const space = gateway.getSpaceManager().getSpaceByName(req.params.name);
      if (!space) {
        return res.status(404).json({ error: 'Space not found' });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const before = req.query.before as string;
      
      let messages = space.messageHistory;
      
      if (before) {
        const beforeIndex = messages.findIndex(m => m.id === before);
        if (beforeIndex >= 0) {
          messages = messages.slice(0, beforeIndex);
        }
      }
      
      messages = messages.slice(-limit);
      
      res.json(messages);
    });

    // Create space (admin only)
    app.post('/api/spaces', requireAdmin, (req, res) => {
      const request: CreateSpaceRequest = req.body;
      
      try {
        const space = gateway.getSpaceManager().createSpace(
          request.name,
          request.adminIds
        );
        
        res.json({
          id: space.id,
          name: space.name,
          created: space.created.toISOString(),
        });
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Create authentication token
    app.post('/api/tokens', (req, res) => {
      const request: CreateTokenRequest = req.body;
      
      if (!request.participantId) {
        return res.status(400).json({ error: 'participantId required' });
      }
      
      // Determine capabilities
      let capabilities = request.capabilities;
      if (!capabilities) {
        capabilities = CapabilityChecker.createDefaultCapabilities('untrusted');
      }
      
      const payload: TokenPayload = {
        sub: request.participantId,
        space: request.space,
        capabilities,
        admin: request.admin || false,
      };
      
      const token = jwt.sign(
        payload,
        authSecret,
        { expiresIn: request.expiresIn || '24h' }
      );
      
      res.json({ token });
    });

    // Get default capabilities for a role
    app.get('/api/capabilities/:role', (req, res) => {
      const role = req.params.role as 'admin' | 'trusted' | 'untrusted';
      
      if (!['admin', 'trusted', 'untrusted'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      
      const capabilities = CapabilityChecker.createDefaultCapabilities(role);
      res.json(capabilities);
    });
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start gateway WebSocket server
  gateway.start(server);

  // Log gateway events
  gateway.on('client:connected', (client) => {
    console.log(`Client connected: ${client.participantId}`);
  });

  gateway.on('client:disconnected', (client) => {
    console.log(`Client disconnected: ${client.participantId}`);
  });

  gateway.on('message:sent', (envelope, space) => {
    console.log(`Message sent in ${space.name}: ${envelope.kind} from ${envelope.from}`);
  });

  gateway.on('message:blocked', (envelope, reason) => {
    console.warn(`Message blocked: ${reason} (${envelope.kind} from ${envelope.from})`);
  });

  gateway.on('error', (error, client) => {
    console.error(`Gateway error${client ? ` for ${client.participantId}` : ''}: ${error.message}`);
  });

  // Start HTTP server
  const port = config.port || 8080;
  const host = config.host || '0.0.0.0';
  
  server.listen(port, host, () => {
    console.log(`MEUP Gateway Server running at http://${host}:${port}`);
    console.log(`WebSocket endpoint: ws://${host}:${port}/spaces/{spaceName}`);
    if (config.enableRestApi !== false) {
      console.log(`REST API available at http://${host}:${port}/api`);
    }
  });

  return {
    app,
    server,
    gateway,
  };
}

// Run if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();

  const config: GatewayConfig = {
    port: parseInt(process.env.PORT || '8080'),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    authSecret: process.env.AUTH_SECRET || 'change-me-in-production',
    enableRestApi: process.env.ENABLE_REST_API !== 'false',
    enableMetrics: process.env.ENABLE_METRICS !== 'false',
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    maxSpaces: parseInt(process.env.MAX_SPACES || '100'),
    maxClientsPerSpace: parseInt(process.env.MAX_CLIENTS_PER_SPACE || '100'),
    maxMessageSize: parseInt(process.env.MAX_MESSAGE_SIZE || '1048576'),
    maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '1000'),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000'),
  };

  createGatewayServer(config);
}