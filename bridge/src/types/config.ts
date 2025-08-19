import { z } from 'zod';

// MCPx connection configuration
export const MCPxConfigSchema = z.object({
  server: z.string().url(),
  topic: z.string(),
  token: z.string()
});
export type MCPxConfig = z.infer<typeof MCPxConfigSchema>;

// Participant metadata
export const ParticipantConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['human', 'agent', 'robot']).default('agent')
});
export type ParticipantConfig = z.infer<typeof ParticipantConfigSchema>;

// MCP server connection configuration
export const MCPServerTransportSchema = z.enum(['stdio', 'websocket', 'sse']);
export type MCPServerTransport = z.infer<typeof MCPServerTransportSchema>;

export const StdioTransportConfigSchema = z.object({
  type: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional()
});
export type StdioTransportConfig = z.infer<typeof StdioTransportConfigSchema>;

export const WebSocketTransportConfigSchema = z.object({
  type: z.literal('websocket'),
  url: z.string().url()
});
export type WebSocketTransportConfig = z.infer<typeof WebSocketTransportConfigSchema>;

export const SSETransportConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url()
});
export type SSETransportConfig = z.infer<typeof SSETransportConfigSchema>;

export const MCPServerConfigSchema = z.discriminatedUnion('type', [
  StdioTransportConfigSchema,
  WebSocketTransportConfigSchema,
  SSETransportConfigSchema
]);
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

// Full bridge configuration
export const BridgeConfigSchema = z.object({
  mcpx: MCPxConfigSchema,
  participant: ParticipantConfigSchema,
  mcp_server: MCPServerConfigSchema,
  options: z.object({
    reconnectAttempts: z.number().default(5),
    reconnectDelay: z.number().default(1000),
    heartbeatInterval: z.number().default(30000),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  }).default({})
});
export type BridgeConfig = z.infer<typeof BridgeConfigSchema>;

// Validation functions
export function validateBridgeConfig(data: unknown): BridgeConfig {
  return BridgeConfigSchema.parse(data);
}

export function createDefaultConfig(): Partial<BridgeConfig> {
  return {
    mcpx: {
      server: 'ws://localhost:3000',
      topic: 'room:general',
      token: ''
    },
    participant: {
      id: 'mcp-bridge',
      name: 'MCP Bridge',
      kind: 'agent'
    },
    mcp_server: {
      type: 'stdio',
      command: 'python',
      args: ['server.py']
    },
    options: {
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      logLevel: 'info'
    }
  };
}