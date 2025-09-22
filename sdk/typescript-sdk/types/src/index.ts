/**
 * @mew-protocol/types
 * 
 * Shared TypeScript type definitions for MEW protocol
 * 
 * @packageDocumentation
 */

// Export all protocol types
export * from './protocol';

// Export all MCP types
export * from './mcp';

// Re-export commonly used types at top level for convenience
export type {
  // Core types
  Envelope,
  PartialEnvelope,
  ContextField,
  Participant,
  Capability,
  CapabilityGrant,
  Proposal,
  
  // System payloads
  SystemWelcomePayload,
  SystemErrorPayload,
  PresencePayload,
  
  // MEW payloads
  MewProposalPayload,
  MewProposalAcceptPayload,
  MewProposalRejectPayload,
  MewCapabilityGrantPayload,
  MewCapabilityRevokePayload,

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
  ParticipantClearPayload,
  ParticipantRestartPayload,
  ParticipantShutdownPayload,

  // Streams
  StreamRequestPayload,
  StreamOpenPayload,
  StreamClosePayload,

  // Reasoning
  ReasoningCancelPayload,

} from './protocol';

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
} from './mcp';

// Export constants
export { 
  PROTOCOL_VERSION, 
  MCP_VERSION,
  MessageKinds,
} from './protocol';

export {
  MCPMethods,
} from './mcp';