import { ServerConfig } from './types/server';

export const defaultConfig: ServerConfig = {
  port: parseInt(process.env.PORT || '3000'),
  auth: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    tokenExpiry: process.env.TOKEN_EXPIRY || '1h'
  },
  topics: {
    maxParticipants: parseInt(process.env.MAX_PARTICIPANTS_PER_TOPIC || '50'),
    historyLimit: parseInt(process.env.HISTORY_LIMIT || '1000')
  },
  rateLimit: {
    messagesPerMinute: parseInt(process.env.RATE_LIMIT_MESSAGES || '60'),
    chatMessagesPerMinute: parseInt(process.env.RATE_LIMIT_CHAT || '10')
  }
};

export function loadConfig(): ServerConfig {
  // In a real implementation, this could load from a config file
  // or environment-specific settings
  const config = { ...defaultConfig };

  // Validate required settings
  if (process.env.NODE_ENV === 'production' && config.auth.secret === 'dev-secret-change-in-production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }

  return config;
}