export { MEWParticipant } from './MEWParticipant';
export { ToolRegistry } from './mcp/tools';
export { 
  matchesCapability, 
  canSend, 
  filterCapabilities 
} from './capabilities';

export type {
  Tool,
  Resource,
  ParticipantOptions,
  ParticipantInfo,
  MCPRequest,
  MCPResponse,
  ProposalHandler,
  RequestHandler,
  StreamAnnouncementOptions,
  StreamHandle,
  StreamStartOptions,
  StreamDataOptions,
  StreamCompleteOptions,
  StreamErrorOptions,
} from './types';
