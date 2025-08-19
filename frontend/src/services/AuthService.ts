export interface AuthCredentials {
  participantId: string;
  topic: string;
}

export interface AuthToken {
  token: string;
  participantId: string;
  topic: string;
  expiresAt: Date;
}

export class AuthService {
  private baseUrl: string;
  private currentToken: AuthToken | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  async generateToken(credentials: AuthCredentials): Promise<AuthToken> {
    const response = await fetch(`${this.baseUrl}/v0/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Authentication failed: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    
    // Decode JWT to get expiration (simple base64 decode, not cryptographically verified)
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    
    const token: AuthToken = {
      token: data.token,
      participantId: credentials.participantId,
      topic: credentials.topic,
      expiresAt: new Date(payload.exp * 1000)
    };

    this.currentToken = token;
    this.saveTokenToStorage(token);

    return token;
  }

  getCurrentToken(): AuthToken | null {
    if (!this.currentToken) {
      this.currentToken = this.loadTokenFromStorage();
    }

    if (this.currentToken && this.isTokenExpired(this.currentToken)) {
      this.clearToken();
      return null;
    }

    return this.currentToken;
  }

  isTokenValid(token?: AuthToken): boolean {
    const tokenToCheck = token || this.getCurrentToken();
    return tokenToCheck !== null && !this.isTokenExpired(tokenToCheck);
  }

  clearToken(): void {
    this.currentToken = null;
    localStorage.removeItem('mcpx_auth_token');
  }

  getWebSocketUrl(): string {
    return this.baseUrl.replace(/^http/, 'ws');
  }

  private isTokenExpired(token: AuthToken): boolean {
    return new Date() >= token.expiresAt;
  }

  private saveTokenToStorage(token: AuthToken): void {
    try {
      localStorage.setItem('mcpx_auth_token', JSON.stringify({
        token: token.token,
        participantId: token.participantId,
        topic: token.topic,
        expiresAt: token.expiresAt.toISOString()
      }));
    } catch (error) {
      console.warn('Failed to save token to localStorage:', error);
    }
  }

  private loadTokenFromStorage(): AuthToken | null {
    try {
      const stored = localStorage.getItem('mcpx_auth_token');
      if (!stored) return null;

      const data = JSON.parse(stored);
      return {
        token: data.token,
        participantId: data.participantId,
        topic: data.topic,
        expiresAt: new Date(data.expiresAt)
      };
    } catch (error) {
      console.warn('Failed to load token from localStorage:', error);
      return null;
    }
  }
}