import { Router, Request, Response } from 'express';
import { TopicService } from '../services/TopicService';
import { AuthService } from '../services/AuthService';

export function createApiRoutes(
  topicService: TopicService,
  authService: AuthService
): Router {
  const router = Router();

  // Middleware to verify JWT token
  const authenticate = (req: Request, res: Response, next: any): void => {
    const token = authService.extractTokenFromAuth(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const authToken = authService.verifyToken(token);
    if (!authToken) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    (req as any).auth = authToken;
    next();
  };

  // GET /v0/topics - List visible topics
  router.get('/topics', authenticate, (req: Request, res: Response) => {
    try {
      const topics = topicService.getTopics();
      return res.json({ topics });
    } catch (error) {
      console.error('Error listing topics:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /v0/topics/{topic}/participants - Get topic participants
  router.get('/topics/:topic/participants', authenticate, (req: Request, res: Response) => {
    try {
      const { topic } = req.params;
      const auth = (req as any).auth;

      // Verify user has access to this topic
      if (auth.topic !== topic) {
        return res.status(403).json({ error: 'Access denied to topic' });
      }

      const participants = topicService.getParticipants(topic);
      return res.json({ participants });
    } catch (error) {
      console.error('Error getting participants:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /v0/topics/{topic}/history - Get topic message history
  router.get('/topics/:topic/history', authenticate, (req: Request, res: Response) => {
    try {
      const { topic } = req.params;
      const auth = (req as any).auth;
      
      // Verify user has access to this topic
      if (auth.topic !== topic) {
        return res.status(403).json({ error: 'Access denied to topic' });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const before = req.query.before as string;

      if (limit > 1000) {
        return res.status(400).json({ error: 'Limit cannot exceed 1000' });
      }

      const history = topicService.getHistory(topic, limit, before);
      return res.json({ history });
    } catch (error) {
      console.error('Error getting history:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /v0/topics/{topic}/rate-limit - Get current rate limit info
  router.get('/topics/:topic/rate-limit', authenticate, (req: Request, res: Response) => {
    try {
      const { topic } = req.params;
      const auth = (req as any).auth;
      
      // Verify user has access to this topic
      if (auth.topic !== topic) {
        return res.status(403).json({ error: 'Access denied to topic' });
      }

      const rateLimitInfo = topicService.getRateLimitInfo(topic, auth.participantId);
      if (!rateLimitInfo) {
        return res.status(404).json({ error: 'Participant not found in topic' });
      }

      return res.json(rateLimitInfo);
    } catch (error) {
      console.error('Error getting rate limit info:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /v0/auth/token - Generate auth token (for development/testing)
  router.post('/auth/token', (req: Request, res: Response) => {
    try {
      const { participantId, topic } = req.body;
      
      if (!participantId || !topic) {
        return res.status(400).json({ 
          error: 'participantId and topic are required' 
        });
      }

      const token = authService.generateToken(participantId, topic);
      return res.json({ token });
    } catch (error) {
      console.error('Error generating token:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}