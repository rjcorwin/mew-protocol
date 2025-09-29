export * from './types';
export * from './client';
export { MEWParticipant, ToolRegistry, matchesCapability, canSend, filterCapabilities } from './participant';
export type { ParticipantOptions, ParticipantInfo, MCPRequest, MCPResponse, ProposalHandler, RequestHandler } from './participant';
export {
  PatternMatcher,
  hasCapability,
  findMatchingCapabilities,
  clearCache,
} from './capability-matcher';
export type {
  CapabilityPattern,
  PayloadPattern,
  PayloadPrimitive,
  PayloadValue,
  MatchOptions,
  CapabilityDefinition,
  Participant as MatcherParticipant,
} from './capability-matcher/types';
export * from './bridge';
export { MEWAgent } from './agent/MEWAgent';
