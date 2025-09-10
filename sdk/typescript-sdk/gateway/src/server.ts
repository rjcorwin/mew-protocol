import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { MEWGateway } from './MEWGateway';

/**
 * Create and start MEW gateway server with REST API
 */
export function createGatewayServer() {
  dotenv.config();
  
  const app = express();
  app.use(cors());
  app.use(express.json());
  
  const server = createServer(app);
  
  const gateway = new MEWGateway({
    port: Number(process.env.PORT) || 8080,
    host: process.env.HOST || '0.0.0.0',
  });
  
  // Start WebSocket server
  gateway.start(server);
  
  // Basic REST endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  server.listen(Number(process.env.PORT) || 8080, process.env.HOST || '0.0.0.0', () => {
    const host = process.env.HOST || '0.0.0.0';
    const port = Number(process.env.PORT) || 8080;
    console.log(`MEW Gateway Server running at http://${host}:${port}`);
  });
}