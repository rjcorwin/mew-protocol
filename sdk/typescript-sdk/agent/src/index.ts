/**
 * MEUP Agent SDK
 * 
 * @packageDocumentation
 */

// Main agent export
export { MEUPAgent } from './MEUPAgent';

// Export all types
export * from './types';

// Legacy MCPx agent for backwards compatibility
export { MCPxAgent } from './MCPxAgent';

// Re-export runtime values from client
export {
  MEUPClient,
  MCP_VERSION,
  PROTOCOL_VERSION,
  ClientEvents,
} from '@meup/client';

// Re-export types from client  
export type {
  ConnectionOptions,
  Envelope,
  PartialEnvelope,
  ContextField,
  Participant,
  Capability,
  Proposal,
  CapabilityGrant,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessage,
  JsonRpcError,
  ChatPayload,
  SystemWelcomePayload,
  MeupProposalPayload,
  MeupProposalAcceptPayload,
  MeupProposalRejectPayload,
  MeupCapabilityGrantPayload,
  MeupCapabilityRevokePayload,
} from '@meup/client';

// Legacy type exports for backwards compatibility
export type {
  Peer,
} from '@mcpx-protocol/client';