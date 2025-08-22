// Core client
export { MCPxClient } from './MCPxClient';
export type { MCPxConfig, Envelope, MCPxEvents } from './MCPxClient';

// Chat client (built on top of core)
export { MCPxChatClient, MCPxChatConfig } from './MCPxChatClient';