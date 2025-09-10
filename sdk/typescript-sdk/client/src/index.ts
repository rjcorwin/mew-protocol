/**
 * MEW (Multi-Entity Workspace) Client SDK
 *
 * @packageDocumentation
 */

// Main MEW client export
export {
  MEWClient,
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
  type VoidHandler,
} from './MEWClient';

// Type exports
export * from './types';
