/**
 * @meup/types
 * 
 * Shared TypeScript type definitions for MEUP protocol
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
  
  // MEUP payloads
  MeupProposalPayload,
  MeupProposalAcceptPayload,
  MeupProposalRejectPayload,
  MeupCapabilityGrantPayload,
  MeupCapabilityRevokePayload,
  
  // Chat
  ChatPayload,
  
  // MCP types
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
} from './protocol';

// Export constants
export { 
  PROTOCOL_VERSION, 
  MCP_VERSION,
  MessageKinds,
  MCPMethods,
} from './protocol';