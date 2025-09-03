/**
 * MEUP (Multi-Entity Unified-context Protocol) Client SDK
 * 
 * @packageDocumentation
 */

// Main MEUP client export
export { 
  MEUPClient, 
  ClientEvents, 
  type ClientEventParams,
  type ChatHandler,
  type ErrorHandler,
  type WelcomeHandler,
  type ParticipantHandler,
  type MessageHandler,
  type ProposalHandler,
  type ProposalAcceptHandler,
  type ProposalRejectHandler,
  type CapabilityGrantHandler,
  type CapabilityRevokeHandler,
  type VoidHandler
} from './MEUPClient';

// Type exports
export * from './types';

// Legacy MCPx client for backwards compatibility (deprecated)
export { 
  MCPxClient,
  type ClientEventParams as MCPxClientEventParams,
  type PeerHandler
} from './MCPxClient';