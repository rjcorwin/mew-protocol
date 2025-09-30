/**
 * Message Input Utility
 * 
 * Provides multiple input mechanisms for receiving messages:
 * - HTTP endpoint (recommended for automation)
 * - FIFO (backward compatibility)
 * - Future: Unix sockets, file queue
 */

import express from 'express';
import bodyParser from 'body-parser';

/**
 * Set up HTTP input server for receiving messages
 * 
 * @param {number} port - Port to listen on
 * @param {string} bind - Bind address (default: 127.0.0.1)
 * @param {Function} messageHandler - Handler function for incoming messages
 * @returns {Object} Express server instance
 */
function setupHttpInput(port, bind = '127.0.0.1', messageHandler) {
  const app = express();
  
  // Parse JSON bodies
  app.use(bodyParser.json({ limit: '10mb' }));
  
  // CORS headers for local development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      version: '0.2.0',
      endpoints: ['/health', '/message', '/messages']
    });
  });
  
  // Single message endpoint
  app.post('/message', async (req, res) => {
    try {
      // Validate message structure
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ 
          error: 'Invalid message format',
          code: 'INVALID_FORMAT'
        });
      }
      
      // Ensure message has required fields for MEW protocol
      if (!req.body.kind) {
        return res.status(400).json({ 
          error: 'Message must have a "kind" field',
          code: 'MISSING_KIND'
        });
      }
      
      // Handle the message
      const result = await messageHandler(req.body);
      
      // Send response
      res.json(result || { success: true, id: req.body.id });
      
    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error',
        code: error.code || 'HANDLER_ERROR'
      });
    }
  });
  
  // Batch messages endpoint
  app.post('/messages', async (req, res) => {
    try {
      if (!req.body || !Array.isArray(req.body.messages)) {
        return res.status(400).json({ 
          error: 'Request must contain a "messages" array',
          code: 'INVALID_BATCH_FORMAT'
        });
      }
      
      const results = [];
      for (const message of req.body.messages) {
        try {
          // Validate each message
          if (!message.kind) {
            results.push({ 
              success: false, 
              error: 'Message must have a "kind" field',
              code: 'MISSING_KIND'
            });
            continue;
          }
          
          const result = await messageHandler(message);
          results.push({ 
            success: true, 
            result: result || { id: message.id }
          });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error.message,
            code: error.code || 'HANDLER_ERROR'
          });
        }
      }
      
      res.json({ results });
      
    } catch (error) {
      console.error('Error handling batch messages:', error);
      res.status(500).json({ 
        error: error.message || 'Internal server error',
        code: 'BATCH_ERROR'
      });
    }
  });
  
  // 404 for other routes
  app.use((req, res) => {
    res.status(404).json({ 
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      available: ['/health', '/message', '/messages']
    });
  });
  
  // Error handler
  app.use((err, req, res, next) => {
    console.error('Express error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  });
  
  // Start server
  const server = app.listen(port, bind, () => {
    console.log(`HTTP input server listening on http://${bind}:${port}`);
    console.log(`  Health check: http://${bind}:${port}/health`);
    console.log(`  Send message: POST http://${bind}:${port}/message`);
    console.log(`  Send batch: POST http://${bind}:${port}/messages`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
    } else {
      console.error('HTTP server error:', error);
    }
    process.exit(1);
  });
  
  return server;
}

/**
 * Message input manager for handling multiple input sources
 */
class MessageInputManager {
  constructor(options, messageHandler) {
    this.options = options;
    this.messageHandler = messageHandler;
    this.inputs = [];
    
    // Set up configured input methods
    if (options.httpPort) {
      this.setupHttp();
    }
    
    if (options.fifoIn) {
      this.setupFifo();
    }
    
    // Future: Unix socket, file queue, etc.
  }
  
  setupHttp() {
    const server = setupHttpInput(
      this.options.httpPort,
      this.options.httpBind || '127.0.0.1',
      this.messageHandler
    );
    this.inputs.push({ type: 'http', server });
  }
  
  setupFifo() {
    // FIFO setup handled in client.js for now
    // Could be moved here in future refactor
    console.log(`FIFO input configured at: ${this.options.fifoIn}`);
  }
  
  close() {
    // Clean up all input sources
    for (const input of this.inputs) {
      if (input.type === 'http' && input.server) {
        input.server.close();
      }
      // Add cleanup for other input types as needed
    }
  }
}

export { setupHttpInput, MessageInputManager };