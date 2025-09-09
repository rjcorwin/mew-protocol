import { MEUPClient } from '@meup/client';
import { ParticipantOptions, ParticipantInfo, Tool, Resource, ProposalHandler, RequestHandler } from './types';
import { ToolRegistry } from './mcp/tools';
export declare class MEUPParticipant {
    protected options: ParticipantOptions;
    protected client: MEUPClient;
    protected participantInfo?: ParticipantInfo;
    protected tools: ToolRegistry;
    protected resources: Map<string, Resource>;
    private joined;
    private proposalHandlers;
    private requestHandlers;
    private pendingRequests;
    private requestTimeout;
    constructor(options: ParticipantOptions);
    /**
     * Connect to the gateway
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the gateway
     */
    disconnect(): void;
    /**
     * Register a tool
     */
    registerTool(tool: Tool): void;
    /**
     * Register a resource
     */
    registerResource(resource: Resource): void;
    /**
     * Check if we have a capability
     */
    canSend(kind: string, payload?: any): boolean;
    /**
     * Send a smart request - uses mcp/request or mcp/proposal based on capabilities
     * Returns a promise that resolves with the response
     */
    request(target: string | string[], method: string, params?: any, timeoutMs?: number): Promise<any>;
    /**
     * Send a chat message
     */
    chat(text: string, to?: string | string[]): void;
    /**
     * Register a proposal handler
     */
    onProposal(handler: ProposalHandler): () => void;
    /**
     * Register a custom request handler
     */
    onRequest(handler: RequestHandler): () => void;
    /**
     * Lifecycle hook - called when connected and ready
     */
    protected onReady(): Promise<void>;
    /**
     * Lifecycle hook - called before shutdown
     */
    protected onShutdown(): Promise<void>;
    /**
     * Setup lifecycle event handlers
     */
    private setupLifecycle;
    /**
     * Handle incoming MCP responses and resolve pending promises
     */
    private handleMCPResponse;
    /**
     * Check if we should handle this request
     */
    private shouldHandleRequest;
    /**
     * Handle incoming MCP requests
     */
    private handleMCPRequest;
    /**
     * List resources in MCP format
     */
    private listResources;
    /**
     * Read a resource
     */
    private readResource;
}
//# sourceMappingURL=MEUPParticipant.d.ts.map