import jwt, { SignOptions } from 'jsonwebtoken';
import { AuthToken, ServerConfig } from '../types/server';

export class AuthService {
  private config: ServerConfig['auth'];

  constructor(config: ServerConfig['auth']) {
    this.config = config;
  }

  generateToken(participantId: string, topic: string, capabilities?: string[]): string {
    const payload = {
      participantId,
      topic,
      capabilities
    };

    return jwt.sign(payload, this.config.secret, {
      expiresIn: this.config.tokenExpiry
    } as SignOptions);
  }

  // Get default capabilities based on participant ID or other logic
  getDefaultCapabilities(participantId: string): string[] {
    // Default: proposal-only for safety, can be customized
    // In production, this might check a database or config
    if (participantId.startsWith('human-') || participantId.startsWith('admin-')) {
      return ['mcp/*', 'chat'];  // Full access for humans/admins
    }
    // TEMPORARY: Give agents full access for testing
    // TODO: Revert to proposal-only for production
    return ['mcp/*', 'chat'];  // Full access for testing
    // Original: return ['mcp/proposal:*', 'mcp/response:*', 'chat'];
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