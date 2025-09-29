/**
 * MCP (Model Context Protocol) Types
 * 
 * Types for MCP operations within MEUP
 */

// ============================================================================
// JSON-RPC Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 Notification
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ============================================================================
// MCP Server Capabilities
// ============================================================================

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

// ============================================================================
// MCP Tool Types
// ============================================================================

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

// ============================================================================
// MCP Resource Types
// ============================================================================

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
 * Resource content
 */
export interface ResourceContent {
  type: 'text' | 'binary';
  text?: string;
  data?: string;
  mimeType?: string;
}

// ============================================================================
// MCP Prompt Types
// ============================================================================

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

// ============================================================================
// MCP Progress Types
// ============================================================================

/**
 * Progress notification params
 */
export interface ProgressParams {
  progressToken?: string | number;
  progress: number;
  total?: number;
}

// ============================================================================
// MCP Method Names
// ============================================================================

export const MCPMethods = {
  // Initialization
  INITIALIZE: 'initialize',
  
  // Tools
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  
  // Resources
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',
  
  // Prompts
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  
  // Notifications
  PROGRESS: 'progress',
  RESOURCES_UPDATED: 'resources/updated',
} as const;

export type MCPMethod = typeof MCPMethods[keyof typeof MCPMethods];