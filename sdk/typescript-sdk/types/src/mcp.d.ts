/**
 * MCP (Model Context Protocol) Types
 *
 * Types for MCP operations within MEUP
 */
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
 * Progress notification params
 */
export interface ProgressParams {
    progressToken?: string | number;
    progress: number;
    total?: number;
}
export declare const MCPMethods: {
    readonly INITIALIZE: "initialize";
    readonly TOOLS_LIST: "tools/list";
    readonly TOOLS_CALL: "tools/call";
    readonly RESOURCES_LIST: "resources/list";
    readonly RESOURCES_READ: "resources/read";
    readonly RESOURCES_SUBSCRIBE: "resources/subscribe";
    readonly RESOURCES_UNSUBSCRIBE: "resources/unsubscribe";
    readonly PROMPTS_LIST: "prompts/list";
    readonly PROMPTS_GET: "prompts/get";
    readonly PROGRESS: "progress";
    readonly RESOURCES_UPDATED: "resources/updated";
};
export type MCPMethod = typeof MCPMethods[keyof typeof MCPMethods];
//# sourceMappingURL=mcp.d.ts.map