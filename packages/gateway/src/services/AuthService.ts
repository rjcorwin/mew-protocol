import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthToken, ServerConfig } from '../types/server';

export class AuthService {
  private config: ServerConfig['auth'];

  constructor(config: ServerConfig['auth']) {
    this.config = config;
  }

  generateToken(participantId: string, topic: string): string {
    const payload = {
      participantId,
      topic
    };

    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.tokenExpiry
    } as SignOptions);
  }

  verifyToken(token: string): AuthToken | null {
    try {
      const decoded = jwt.verify(token, this.config.secret) as AuthToken;
      return decoded;
    } catch (error) {
      console.warn('Token verification failed:', error);
      return null;
    }
  }

  extractTokenFromAuth(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}