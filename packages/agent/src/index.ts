export { MCPxAgent } from './MCPxAgent';
export * from './types';

// Re-export runtime values from client
export {
  MCPxClient,
  MCP_VERSION,
  PROTOCOL_VERSION,
} from '@mcpx-protocol/client';

// Re-export types from client  
export type {
  ConnectionOptions,
  Envelope,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessage,
  Peer,
} from '@mcpx-protocol/client';