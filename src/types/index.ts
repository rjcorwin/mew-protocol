/**
 * @mew-protocol/types
 * 
 * Shared TypeScript type definitions for MEW protocol
 * 
 * @packageDocumentation
 */

// Export all protocol types
export * from './protocol.js';

// Export all MCP types
export * from './mcp.js';

// Re-export commonly used types at top level for convenience
export type {
  // Core types
  Envelope,
  PartialEnvelope,
  ContextField,
  Participant,
  Capability,
  CapabilityGrant,
  CapabilityGrantPayload,
  CapabilityRevokePayload,
  CapabilityGrantAckPayload,
  Proposal,
  
  // System payloads
  SystemWelcomePayload,
  SystemErrorPayload,
  PresencePayload,
  StreamMetadata,
  
  // MEW payloads
  MewProposalPayload,
  MewProposalAcceptPayload,
  MewProposalRejectPayload,
  MewCapabilityGrantPayload,
  MewCapabilityRevokePayload,
  SpaceInvitePayload,
  SpaceInviteAckPayload,
  SpaceKickPayload,

  // Chat
  ChatPayload,
  ChatAcknowledgePayload,
  ChatCancelPayload,

  // Participant control
  ParticipantPausePayload,
  ParticipantResumePayload,
  ParticipantRequestStatusPayload,
  ParticipantStatusPayload,
  ParticipantForgetPayload,
  ParticipantCompactPayload,
  ParticipantCompactDonePayload,
  ParticipantClearPayload,
  ParticipantRestartPayload,
  ParticipantShutdownPayload,

  // Streams
  StreamRequestPayload,
  StreamOpenPayload,
  StreamClosePayload,

  // Reasoning
  ReasoningCancelPayload,

} from './protocol.js';

// Re-export MCP types for convenience
export type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcMessage,
  ServerCapabilities,
  Tool,
  Resource,
  Prompt,
  ToolExecutionResult,
  ResourceContent,
  ProgressParams,
} from './mcp.js';

// Export constants
export {
  PROTOCOL_VERSION,
  MCP_VERSION,
  MessageKinds,
} from './protocol.js';

export {
  MCPMethods,
} from './mcp.js';
