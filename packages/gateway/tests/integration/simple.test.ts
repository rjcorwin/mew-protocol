import request from 'supertest';
import { WebSocket } from 'ws';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';

import { TopicService } from '../../src/services/TopicService';
import { AuthService } from '../../src/services/AuthService';
import { createApiRoutes } from '../../src/routes/api';
import { setupWebSocketRoutes } from '../../src/routes/websocket';
import { testConfig, findAvailablePort } from '../helpers/testUtils';

describe('Simple Integration Test', () => {
  let server: any;
  let app: express.Application;
  let wss: WebSocketServer;
  let port: number;
  let topicService: TopicService;
  let authService: AuthService;

  beforeAll(async () => {
    port = await findAvailablePort();
    
    topicService = new TopicService(testConfig);
    authService = new AuthService(testConfig.auth);

    app = express();
    app.use(cors());
    app.use(express.json());
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', protocol: 'mcp-x/v0' });
    });
    app.use('/v0', createApiRoutes(topicService, authService));

    server = createServer(app);
    wss = new WebSocketServer({ server, path: '/v0/ws' });
    setupWebSocketRoutes(wss, topicService, authService);

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`Test server started on port ${port}`);
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (wss) {
      wss.close();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  it('should start server and respond to health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
  });

  it('should generate auth token', async () => {
    const response = await request(app)
      .post('/v0/auth/token')
      .send({
        participantId: 'test-user',
        topic: 'test-topic'
      })
      .expect(200);

    expect(response.body.token).toBeTruthy();
  });

  it('should establish basic WebSocket connection', async () => {
    // Get auth token
    const tokenResponse = await request(app)
      .post('/v0/auth/token')
      .send({
        participantId: 'test-user',
        topic: 'test-topic'
      });

    const token = tokenResponse.body.token;

    // Try to connect
    return new Promise<void>((resolve, reject) => {
      const wsUrl = `ws://localhost:${port}/v0/ws?topic=test-topic`;
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        console.log('WebSocket connected');
        clearTimeout(timeout);
        ws.close();
        resolve();
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(timeout);
        reject(error);
      });

      ws.on('message', (data) => {
        console.log('Received message:', data.toString());
      });
    });
  }, 10000);
});