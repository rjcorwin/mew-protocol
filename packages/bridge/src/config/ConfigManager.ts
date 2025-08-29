import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { BridgeConfig, validateBridgeConfig, createDefaultConfig } from '../types/config';

export class ConfigManager {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || resolve(process.cwd(), 'bridge-config.json');
  }

  loadConfig(): BridgeConfig {
    if (!existsSync(this.configPath)) {
      throw new Error(`Configuration file not found: ${this.configPath}`);
    }

    try {
      const configData = readFileSync(this.configPath, 'utf8');
      const parsedConfig = JSON.parse(configData);
      return validateBridgeConfig(parsedConfig);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  saveConfig(config: BridgeConfig): void {
    try {
      const configJson = JSON.stringify(config, null, 2);
      writeFileSync(this.configPath, configJson, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${(error as Error).message}`);
    }
  }

  configExists(): boolean {
    return existsSync(this.configPath);
  }

  createDefaultConfigFile(): void {
    const defaultConfig = createDefaultConfig();
    this.saveConfig(defaultConfig as BridgeConfig);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  validateConfigFile(): { valid: boolean; errors: string[] } {
    if (!this.configExists()) {
      return { valid: false, errors: ['Configuration file does not exist'] };
    }

    try {
      this.loadConfig();
      return { valid: true, errors: [] };
    } catch (error) {
      return { valid: false, errors: [(error as Error).message] };
    }
  }
}

// Utility functions for working with specific config sections
export function generateAuthToken(serverUrl: string, participantId: string, topic: string): Promise<string> {
  // Convert WebSocket URL to HTTP URL for auth endpoint
  const httpUrl = serverUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
  return fetch(`${httpUrl}/v0.1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ participantId, topic })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }
    return response.json();
  })
  .then((data: any) => data.token);
}

export function validateMCPServerConfig(config: BridgeConfig['mcp_server']): { valid: boolean; error?: string } {
  switch (config.type) {
    case 'stdio':
      if (!config.command) {
        return { valid: false, error: 'Command is required for stdio transport' };
      }
      break;
    
    case 'websocket':
      try {
        new URL(config.url);
      } catch {
        return { valid: false, error: 'Invalid WebSocket URL' };
      }
      break;
    
    case 'sse':
      try {
        new URL(config.url);
      } catch {
        return { valid: false, error: 'Invalid SSE URL' };
      }
      break;
    
    default:
      return { valid: false, error: 'Unknown transport type' };
  }

  return { valid: true };
}