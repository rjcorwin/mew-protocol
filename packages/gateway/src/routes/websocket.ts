import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { TopicService } from '../services/TopicService';
import { AuthService } from '../services/AuthService';
import { Participant, validateEnvelope } from '../types/mcpx';

export function setupWebSocketRoutes(
  wss: WebSocketServer,
  topicService: TopicService,
  authService: AuthService
): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    try {
      const url = parse(req.url || '', true);
      const topic = url.query.topic as string;
      
      if (!topic) {
        ws.close(1008, 'Topic parameter required');
        return;
      }

      // Extract auth token from header or query parameter (for browser WebSocket)
      const authHeader = req.headers.authorization;
      let token = authService.extractTokenFromAuth(authHeader);
      
      // If no token in header, check query parameter (for browser WebSocket clients)
      if (!token && url.query.token) {
        token = url.query.token as string;
      }
      
      if (!token) {
        ws.close(1008, 'Authorization required (header or query param)');
        return;
      }

      const authToken = authService.verifyToken(token);
      if (!authToken) {
        ws.close(1008, 'Invalid token');
        return;
      }

      if (authToken.topic !== topic) {
        ws.close(1008, 'Token not valid for this topic');
        return;
      }

      // Create participant info with capabilities (v0.1)
      const capabilities = authToken.capabilities || authService.getDefaultCapabilities(authToken.participantId);
      
      const participant: Participant = {
        id: authToken.participantId,
        capabilities
      };

      // Join topic
      let client;
      try {
        client = topicService.joinTopic(topic, participant, ws);
        console.log(`WebSocket connection established for ${participant.id} in ${topic}`);
      } catch (error) {
        console.error('Failed to join topic:', error);
        ws.close(1008, (error as Error).message);
        return;
      }

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          const envelope = validateEnvelope(message);

          // Verify the message is from the authenticated participant
          if (envelope.from !== participant.id) {
            console.warn(`Message from ${envelope.from} but authenticated as ${participant.id}`);
            ws.send(JSON.stringify({
              protocol: 'mcpx/v0.1',
              id: Date.now().toString(),
              ts: new Date().toISOString(),
              from: 'system:gateway',
              to: [participant.id],
              kind: 'system/error',
              payload: {
                error: 'auth_violation',
                message: `Message 'from' field must match your participant ID (${participant.id})`
              }
            }));
            return;
          }

          // Broadcast the message to the topic
          topicService.broadcastMessage(topic, envelope, participant.id);
          
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          // Send error response if possible
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({
                error: 'Invalid message format',
                details: (error as Error).message
              }));
            } catch (sendError) {
              console.error('Failed to send error message:', sendError);
            }
          }
        }
      });

      // Set up ping/pong for connection health
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds

      ws.on('pong', () => {
        console.debug(`Pong received from ${participant.id}`);
      });

      // Handle connection close
      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`WebSocket closed for ${participant.id}: ${code} ${reason.toString()}`);
        clearInterval(pingInterval);
        topicService.leaveTopic(topic, participant.id);
      });

      // Handle connection error
      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for ${participant.id}:`, error);
        clearInterval(pingInterval);
        topicService.leaveTopic(topic, participant.id);
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  });

  console.log('WebSocket server configured');
}