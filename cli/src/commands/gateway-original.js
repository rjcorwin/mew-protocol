const { Command } = require('commander');
const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const gateway = new Command('gateway')
  .description('Gateway server management');

gateway
  .command('start')
  .description('Start a MEW gateway server')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-l, --log-level <level>', 'Log level (debug|info|warn|error)', 'info')
  .action(async (options) => {
    const port = parseInt(options.port);
    console.log(`Starting MEW gateway on port ${port}...`);
    
    // Create Express app for health endpoint
    const app = express();
    app.use(express.json());
    
    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        spaces: spaces.size,
        clients: Array.from(spaces.values()).reduce((sum, space) => sum + space.participants.size, 0),
        uptime: process.uptime()
      });
    });
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Create WebSocket server
    const wss = new WebSocket.Server({ server });
    
    // Track spaces and participants
    const spaces = new Map(); // spaceId -> { participants: Map(participantId -> ws) }
    
    // Handle WebSocket connections
    wss.on('connection', (ws, req) => {
      let participantId = null;
      let spaceId = null;
      
      if (options.logLevel === 'debug') {
        console.log('New WebSocket connection');
      }
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Handle join message (simplified - no real auth)
          if (message.type === 'join') {
            participantId = message.participantId || `participant-${Date.now()}`;
            spaceId = message.space || 'default';
            
            // Create space if it doesn't exist
            if (!spaces.has(spaceId)) {
              spaces.set(spaceId, { participants: new Map() });
            }
            
            // Add participant to space
            const space = spaces.get(spaceId);
            space.participants.set(participantId, ws);
            
            // Store participant info on websocket
            ws.participantId = participantId;
            ws.spaceId = spaceId;
            
            // Send welcome message
            ws.send(JSON.stringify({
              protocol: 'mew/v0.3',
              kind: 'system/welcome',
              payload: {
                participantId,
                space: spaceId,
                capabilities: [] // Simplified - no real capabilities yet
              }
            }));
            
            console.log(`${participantId} joined space ${spaceId}`);
            return;
          }
          
          // Route messages to other participants in the same space
          if (spaceId && spaces.has(spaceId)) {
            const space = spaces.get(spaceId);
            const envelope = {
              protocol: 'mew/v0.3',
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              ts: new Date().toISOString(),
              from: participantId,
              ...message
            };
            
            // Broadcast to all participants in the space (including sender)
            for (const [pid, pws] of space.participants.entries()) {
              if (pws.readyState === WebSocket.OPEN) {
                pws.send(JSON.stringify(envelope));
              }
            }
            
            if (options.logLevel === 'debug') {
              console.log(`Message from ${participantId} in ${spaceId}:`, message.kind);
            }
          }
        } catch (error) {
          console.error('Error handling message:', error);
          ws.send(JSON.stringify({
            protocol: 'mew/v0.3',
            kind: 'system/error',
            payload: {
              error: error.message
            }
          }));
        }
      });
      
      ws.on('close', () => {
        if (participantId && spaceId && spaces.has(spaceId)) {
          const space = spaces.get(spaceId);
          space.participants.delete(participantId);
          console.log(`${participantId} left space ${spaceId}`);
          
          // Clean up empty spaces
          if (space.participants.size === 0) {
            spaces.delete(spaceId);
          }
        }
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
    
    // Start server
    server.listen(port, () => {
      console.log(`Gateway listening on port ${port}`);
      console.log(`Health endpoint: http://localhost:${port}/health`);
      console.log(`WebSocket endpoint: ws://localhost:${port}`);
    });
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down gateway...');
      wss.close();
      server.close();
      process.exit(0);
    });
  });

module.exports = gateway;