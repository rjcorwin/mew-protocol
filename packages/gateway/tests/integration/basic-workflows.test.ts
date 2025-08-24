import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

describe('MCPx Server Basic Workflows', () => {
  let server: any;
  let app: express.Application;
  let wss: WebSocketServer;
  let port: number;
  let topicService: TopicService;
  let authService: AuthService;
  let baseUrl: string;

  beforeAll(async () => {
    port = await findAvailablePort();
    baseUrl = `http://localhost:${port}`;

    topicService = new TopicService(testConfig);
    authService = new AuthService(testConfig.auth);

    app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        protocol: 'mcp-x/v0'
      });
    });

    app.use('/v0', createApiRoutes(topicService, authService));

    server = createServer(app);
    wss = new WebSocketServer({ 
      server,
      path: '/v0/ws'
    });

    setupWebSocketRoutes(wss, topicService, authService);

    await new Promise<void>((resolve) => {
      server.listen(port, () => resolve());
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

  describe('Server Health and Auth', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.protocol).toBe('mcp-x/v0');
    });

    it('should generate and validate authentication tokens', async () => {
      const response = await request(app)
        .post('/v0/auth/token')
        .send({
          participantId: 'test-user',
          topic: 'auth-test'
        })
        .expect(200);

      expect(response.body.token).toBeTruthy();
      expect(typeof response.body.token).toBe('string');

      // Test token validation
      const topicsResponse = await request(app)
        .get('/v0/topics')
        .set('Authorization', `Bearer ${response.body.token}`)
        .expect(200);

      expect(Array.isArray(topicsResponse.body.topics)).toBe(true);
    });
  });

  describe('WebSocket Connection Workflow', () => {
    it('should establish WebSocket connection and receive system messages', async () => {
      const tokenResponse = await request(app)
        .post('/v0/auth/token')
        .send({
          participantId: 'ws-test-user',
          topic: 'ws-test'
        });

      const token = tokenResponse.body.token;
      const wsUrl = `ws://localhost:${port}/v0/ws?topic=ws-test`;

      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        let welcomeReceived = false;
        const timeout = setTimeout(() => {
          if (!welcomeReceived) {
            ws.close();
            reject(new Error('Did not receive welcome message in time'));
          }
        }, 3000);

        ws.on('open', () => {
          console.log('WebSocket connected, waiting for welcome...');
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('Received message:', message.kind, message.payload?.event);
            
            if (message.kind === 'system' && message.payload?.type === 'welcome') {
              welcomeReceived = true;
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        ws.on('close', () => {
          clearTimeout(timeout);
          if (!welcomeReceived) {
            reject(new Error('Connection closed without welcome message'));
          }
        });
      });
    }, 10000);

    it('should handle multiple participants and presence events', async () => {
      const [token1Response, token2Response] = await Promise.all([
        request(app)
          .post('/v0/auth/token')
          .send({ participantId: 'user1', topic: 'multi-test' }),
        request(app)
          .post('/v0/auth/token')
          .send({ participantId: 'user2', topic: 'multi-test' })
      ]);

      const wsUrl = `ws://localhost:${port}/v0/ws?topic=multi-test`;
      const ws1 = new WebSocket(wsUrl, {
        headers: { 'Authorization': `Bearer ${token1Response.body.token}` }
      });

      let user1Ready = false;
      let joinEventReceived = false;
      let user2Ready = false;
      let ws2: WebSocket;

      // Set up all message handlers before connecting
      const checkComplete = (resolve: () => void, timeout: NodeJS.Timeout) => {
        if (user1Ready && joinEventReceived && user2Ready) {
          clearTimeout(timeout);
          ws1.close();
          if (ws2) ws2.close();
          resolve();
        }
      };

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timeout')), 5000);
        
        ws1.on('message', (data) => {
          const message = JSON.parse(data.toString());
          console.log('WS1 received:', message.kind, message.payload?.event);
          
          if (message.kind === 'system' && message.payload?.type === 'welcome') {
            user1Ready = true;
            
            // Connect second user after first is ready
            ws2 = new WebSocket(wsUrl, {
              headers: { 'Authorization': `Bearer ${token2Response.body.token}` }
            });

            ws2.on('message', (data) => {
              const message = JSON.parse(data.toString());
              console.log('WS2 received:', message.kind, message.payload?.event);
              
              if (message.kind === 'system' && message.payload?.type === 'welcome') {
                user2Ready = true;
                checkComplete(resolve, timeout);
              }
            });

            ws2.on('error', (error) => {
              clearTimeout(timeout);
              reject(error);
            });
            
            checkComplete(resolve, timeout);
          }
          
          if (message.kind === 'presence' && 
              message.payload?.event === 'join' && 
              message.payload?.participant?.id === 'user2') {
            joinEventReceived = true;
            checkComplete(resolve, timeout);
          }
        });

        ws1.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 15000);
  });

  describe('Message Exchange Workflow', () => {
    it('should handle chat message broadcasting', async () => {
      const [token1, token2] = await Promise.all([
        request(app).post('/v0/auth/token').send({ participantId: 'sender', topic: 'chat-test' }),
        request(app).post('/v0/auth/token').send({ participantId: 'receiver', topic: 'chat-test' })
      ]);

      const wsUrl = `ws://localhost:${port}/v0/ws?topic=chat-test`;
      const senderWs = new WebSocket(wsUrl, {
        headers: { 'Authorization': `Bearer ${token1.body.token}` }
      });
      const receiverWs = new WebSocket(wsUrl, {
        headers: { 'Authorization': `Bearer ${token2.body.token}` }
      });

      // Wait for both to connect and receive initial messages
      await Promise.all([
        new Promise<void>((resolve) => {
          senderWs.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.kind === 'presence' && msg.payload?.participant?.id === 'receiver') {
              resolve(); // Both connected
            }
          });
        }),
        new Promise<void>((resolve) => {
          receiverWs.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.kind === 'system' && msg.payload?.type === 'welcome') {
              resolve();
            }
          });
        })
      ]);

      // Send chat message
      const chatMessage = {
        protocol: 'mcp-x/v0',
        id: 'chat-1',
        ts: new Date().toISOString(),
        from: 'sender',
        kind: 'mcp',
        payload: {
          jsonrpc: '2.0',
          method: 'notifications/chat/message',
          params: {
            text: 'Hello, integration test!',
            format: 'plain'
          }
        }
      };

      // Set up message listener before sending
      const messageReceived = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Chat message timeout')), 3000);
        
        receiverWs.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.kind === 'mcp' && 
              msg.payload?.method === 'notifications/chat/message' &&
              msg.payload?.params?.text === 'Hello, integration test!') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      senderWs.send(JSON.stringify(chatMessage));
      await messageReceived;

      senderWs.close();
      receiverWs.close();
    }, 10000);
  });

  describe('Data Persistence', () => {
    it('should store and retrieve message history', async () => {
      const token = await request(app)
        .post('/v0/auth/token')
        .send({ participantId: 'historian', topic: 'history-test' });

      const wsUrl = `ws://localhost:${port}/v0/ws?topic=history-test`;
      const ws = new WebSocket(wsUrl, {
        headers: { 'Authorization': `Bearer ${token.body.token}` }
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
        ws.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.kind === 'system' && msg.payload?.type === 'welcome') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      // Send test messages
      const messages = ['First message', 'Second message', 'Third message'];
      for (const text of messages) {
        const envelope = {
          protocol: 'mcp-x/v0',
          id: `msg-${text}`,
          ts: new Date().toISOString(),
          from: 'historian',
          kind: 'mcp',
          payload: {
            jsonrpc: '2.0',
            method: 'notifications/chat/message',
            params: { text }
          }
        };
        ws.send(JSON.stringify(envelope));
        
        // Wait a bit between messages
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      ws.close();

      // Check history via REST API
      const historyResponse = await request(app)
        .get('/v0/topics/history-test/history')
        .set('Authorization', `Bearer ${token.body.token}`)
        .expect(200);

      const history = historyResponse.body.history;
      expect(history.length).toBe(3);
      
      // Should be in reverse chronological order
      expect(history[0].payload.params.text).toBe('Third message');
      expect(history[1].payload.params.text).toBe('Second message');
      expect(history[2].payload.params.text).toBe('First message');
    });
  });
});