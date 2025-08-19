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

      // Extract and verify auth token
      const authHeader = req.headers.authorization;
      const token = authService.extractTokenFromAuth(authHeader);
      
      if (!token) {
        ws.close(1008, 'Authorization header required');
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

      // Create participant info - in a real system this would come from the token or user database
      const participant: Participant = {
        id: authToken.participantId,
        name: authToken.participantId, // Could be enhanced with display name
        kind: 'agent', // Could be determined from token claims
        mcp: {
          version: '2025-06-18'
        }
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