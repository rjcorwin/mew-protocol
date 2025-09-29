export * from './types';
export * from './client';

export { MEWParticipant, ToolRegistry, matchesCapability, canSend, filterCapabilities } from './participant';
export type {
  ParticipantOptions,
  ParticipantInfo,
  MCPRequest,
  MCPResponse,
  ProposalHandler,
  RequestHandler,
} from './participant';

export { MEWAgent, AgentConfig, OpenAIClientFactory, OpenAIClientFactoryOptions } from './agent/MEWAgent';
export { MCPBridge, MCPBridgeOptions, MCPClient, MCPServerConfig } from './bridge';
export {
  createGatewayLogger,
  parseOptionalBoolean,
} from './gateway';
export type {
  GatewayCapabilityDecisionEntry,
  GatewayCapabilityDecisionMetadata,
  GatewayEnvelopeLogEntry,
  GatewayEnvelopeLogMetadata,
  GatewayLogger,
  GatewayLoggerOptions,
  GatewayLoggingConfig,
  GatewayLoggingSectionConfig,
} from './gateway';
