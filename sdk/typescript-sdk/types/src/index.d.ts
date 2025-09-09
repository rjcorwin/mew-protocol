/**
 * @meup/types
 *
 * Shared TypeScript type definitions for MEUP protocol
 *
 * @packageDocumentation
 */
export * from './protocol';
export * from './mcp';
export type { Envelope, PartialEnvelope, ContextField, Participant, Capability, CapabilityGrant, Proposal, SystemWelcomePayload, SystemErrorPayload, PresencePayload, MeupProposalPayload, MeupProposalAcceptPayload, MeupProposalRejectPayload, MeupCapabilityGrantPayload, MeupCapabilityRevokePayload, ChatPayload, } from './protocol';
export type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification, JsonRpcError, JsonRpcMessage, ServerCapabilities, Tool, Resource, Prompt, ToolExecutionResult, ResourceContent, ProgressParams, } from './mcp';
export { PROTOCOL_VERSION, MCP_VERSION, MessageKinds, } from './protocol';
export { MCPMethods, } from './mcp';
//# sourceMappingURL=index.d.ts.map