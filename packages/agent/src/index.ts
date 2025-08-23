export { MCPxAgent } from './MCPxAgent';
export * from './types';

// Re-export commonly used client types
export {
  MCPxClient,
  ConnectionOptions,
  Envelope,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessage,
  Peer,
  MCP_VERSION,
  PROTOCOL_VERSION,
} from '@mcpx-protocol/client';