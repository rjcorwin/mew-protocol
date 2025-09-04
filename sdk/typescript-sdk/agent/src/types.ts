/**
 * Agent-specific types for MEUP SDK
 */

import type { 
  Capability, 
  Proposal,
  Tool,
  Resource,
  Prompt,
  ServerCapabilities,
  ToolExecutionResult,
  ProgressParams,
} from '@meup/types';

// Re-export types from @meup/types for convenience
export * from '@meup/types';

// ============================================================================
// Agent-Specific Types
// ============================================================================

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'busy' | 'error';

/**
 * Agent role in MEUP
 */
export type AgentRole = 'trusted' | 'untrusted' | 'coordinator';

/**
 * Participant MCP state tracking
 */
export interface ParticipantState {
  id: string;
  initialized: boolean;
  initializePromise?: Promise<void>;
  capabilities?: Capability[];
  mcpCapabilities?: ServerCapabilities;
  tools?: Tool[];
  resources?: Resource[];
  prompts?: Prompt[];
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  version: string;
  description?: string;
  role: AgentRole;
  capabilities?: Capability[];
  autoAcceptProposals?: boolean;
  proposalFilter?: (proposal: Proposal) => boolean;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  tool: string;
  params: any;
  from: string;
  requestId: string | number;
  isProposal?: boolean;
  proposalId?: string;
}

/**
 * Proposal review result
 */
export interface ProposalReview {
  accept: boolean;
  reason?: string;
  modifiedEnvelope?: any;
}

/**
 * Context management
 */
export interface ContextState {
  id: string;
  topic: string;
  parentId?: string;
  children: string[];
  messages: any[];
}

/**
 * Agent event handlers
 */
export interface AgentEventHandlers {
  onProposal?: (proposal: Proposal, from: string) => Promise<ProposalReview>;
  onToolCall?: (context: ToolExecutionContext) => Promise<ToolExecutionResult>;
  onResourceRequest?: (uri: string, from: string) => Promise<any>;
  onPromptRequest?: (name: string, args: any, from: string) => Promise<string>;
  onContextPush?: (topic: string, correlationId: string) => Promise<void>;
  onContextPop?: (correlationId: string) => Promise<void>;
  onContextResume?: (correlationId: string, topic?: string) => Promise<void>;
}