import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';

import { loadConfig } from './config';
import { TopicService } from './services/TopicService';
import { AuthService } from './services/AuthService';
import { createApiRoutes } from './routes/api';
import { setupWebSocketRoutes } from './routes/websocket';

async function main() {
  const config = loadConfig();
  
  console.log('MCPx Server starting...');
  console.log(`Configuration: port=${config.port}, historyLimit=${config.topics.historyLimit}`);

  // Initialize services
  const topicService = new TopicService(config);
  const authService = new AuthService(config.auth);

  // Create Express app
  const app = express();
  
  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false // Allow embedding in iframes for development
  }));
  
  app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
    credentials: true
  }));

  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      protocol: 'mcp-x/v0'
    });
  });

  // API routes
  app.use('/v0', createApiRoutes(topicService, authService));

  // Create HTTP server
  const server = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server,
    path: '/v0/ws'
  });

  // Setup WebSocket routes
  setupWebSocketRoutes(wss, topicService, authService);

  // Error handling
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server shut down');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start server
  server.listen(config.port, () => {
    console.log(`MCPx Server running on port ${config.port}`);
    console.log(`WebSocket endpoint: ws://localhost:${config.port}/v0/ws`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`API: http://localhost:${config.port}/v0/`);
  });
}

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});