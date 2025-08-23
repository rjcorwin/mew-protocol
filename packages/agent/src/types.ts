/**
 * MCPx Agent layer types
 */

/**
 * Agent status
 */
export type AgentStatus = 'idle' | 'busy' | 'error';

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
 * Peer MCP state tracking
 */
export interface PeerState {
  id: string;
  initialized: boolean;
  initializePromise?: Promise<void>;
  capabilities?: ServerCapabilities;
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
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  tool: string;
  params: any;
  from: string;
  requestId: string | number;
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