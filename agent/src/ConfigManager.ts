import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import os from 'os';

const AgentConfigSchema = z.object({
  server: z.object({
    url: z.string().url().or(z.string().startsWith('ws://')),
    topic: z.string(),
    authToken: z.string().optional()
  }),
  participant: z.object({
    id: z.string(),
    name: z.string().optional(),
    metadata: z.record(z.any()).optional()
  }),
  openai: z.object({
    apiKey: z.string(),
    model: z.string().default('gpt-4-turbo-preview'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().optional(),
    respondToAllMessages: z.boolean().default(true),
    toolCallConfirmation: z.boolean().default(false),
    systemPrompt: z.string().optional()
  }),
  behavior: z.object({
    respondToChat: z.boolean().default(true),
    chatPatterns: z.array(z.object({
      pattern: z.string(),
      response: z.string()
    })).optional(),
    toolPatterns: z.array(z.object({
      trigger: z.string(),
      calls: z.array(z.object({
        peerId: z.string().optional(),
        tool: z.string(),
        params: z.any()
      }))
    })).optional()
  }).optional(),
  tools: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    handler: z.string().optional() // Path to handler module
  })).optional()
});

export type AgentConfigData = z.infer<typeof AgentConfigSchema>;

export class ConfigManager {
  private configDir: string;
  private configFile: string;
  
  constructor() {
    this.configDir = path.join(os.homedir(), '.mcpx');
    this.configFile = path.join(this.configDir, 'agent-config.json');
  }
  
  async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }
  
  async saveConfig(config: AgentConfigData): Promise<void> {
    await this.ensureConfigDir();
    const validated = AgentConfigSchema.parse(config);
    await fs.writeFile(
      this.configFile,
      JSON.stringify(validated, null, 2),
      'utf-8'
    );
  }
  
  async loadConfig(): Promise<AgentConfigData | null> {
    try {
      const data = await fs.readFile(this.configFile, 'utf-8');
      return AgentConfigSchema.parse(JSON.parse(data));
    } catch (error) {
      return null;
    }
  }
  
  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configFile);
      return true;
    } catch {
      return false;
    }
  }
  
  async deleteConfig(): Promise<void> {
    try {
      await fs.unlink(this.configFile);
    } catch {
      // File doesn't exist
    }
  }
  
  // Generate auth token
  async generateAuthToken(serverUrl: string, participantId: string, topic: string): Promise<string> {
    // Convert WebSocket URL to HTTP URL for auth endpoint
    const httpUrl = serverUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    
    try {
      const response = await fetch(`${httpUrl}/v0/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          participantId,
          topic
        })
      });
      
      if (!response.ok) {
        throw new Error(`Auth failed: ${response.statusText}`);
      }
      
      const data = await response.json() as { token: string };
      return data.token;
    } catch (error) {
      throw new Error(`Failed to generate auth token: ${error}`);
    }
  }
}