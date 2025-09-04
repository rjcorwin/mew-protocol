/**
 * MEUP Agent layer types
 */

import { Capability, Proposal } from '@meup/client';

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'busy' | 'error';

/**
 * Agent role in MEUP
 */
export type AgentRole = 'trusted' | 'untrusted' | 'coordinator';

/**
 * MCP Server capabilities
 */
export interface ServerCapabilities {
  tools?: {
    list?: boolean;
  };
  resources?: {
    list?: boolean;
    subscribe?: boolean;
  };
  prompts?: {
    list?: boolean;
  };
  logging?: {};
  experimental?: Record<string, any>;
}

/**
 * MCP Tool definition
 */
export interface Tool {
  name: string;
  description?: string;
  inputSchema?: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Resource definition
 */
export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Prompt definition
 */
export interface Prompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

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
 * Tool execution result
 */
export interface ToolExecutionResult {
  content?: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
  }>;
  isError?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Progress notification params
 */
export interface ProgressParams {
  progressToken?: string | number;
  progress: number;
  total?: number;
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