import { AuthService } from '../../../src/services/AuthService';
import { testConfig } from '../../helpers/testUtils';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(testConfig.auth);
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = authService.generateToken('test-user', 'test-topic');
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct claims in token', () => {
      const participantId = 'test-user';
      const topic = 'test-topic';
      const token = authService.generateToken(participantId, topic);
      
      const verified = authService.verifyToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified!.participantId).toBe(participantId);
      expect(verified!.topic).toBe(topic);
      expect(verified!.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const participantId = 'test-user';
      const topic = 'test-topic';
      const token = authService.generateToken(participantId, topic);
      
      const verified = authService.verifyToken(token);
      
      expect(verified).not.toBeNull();
      expect(verified!.participantId).toBe(participantId);
      expect(verified!.topic).toBe(topic);
    });

    it('should reject an invalid token', () => {
      const result = authService.verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should reject a token with wrong secret', () => {
      const otherAuthService = new AuthService({
        secret: 'different-secret',
        tokenExpiry: '1h'
      });
      
      const token = otherAuthService.generateToken('test-user', 'test-topic');
      const result = authService.verifyToken(token);
      
      expect(result).toBeNull();
    });
  });

  describe('extractTokenFromAuth', () => {
    it('should extract token from Bearer header', () => {
      const token = 'test-token';
      const authHeader = `Bearer ${token}`;
      
      const extracted = authService.extractTokenFromAuth(authHeader);
      
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(authService.extractTokenFromAuth('Invalid token')).toBeNull();
      expect(authService.extractTokenFromAuth('')).toBeNull();
      expect(authService.extractTokenFromAuth(undefined)).toBeNull();
    });

    it('should return null for missing header', () => {
      const result = authService.extractTokenFromAuth(undefined);
      expect(result).toBeNull();
    });
  });
});