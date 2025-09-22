import { MEWClient, ClientOptions } from '@mew-protocol/client';
import { Envelope, Capability, ParticipantStatusPayload, ParticipantRestartPayload, StreamRequestPayload } from '@mew-protocol/types';
export interface ParticipantOptions extends ClientOptions {
    requestTimeout?: number;
}
export type MCPProposalHandler = (envelope: Envelope) => Promise<void>;
export type MCPRequestHandler = (envelope: Envelope) => Promise<void>;
export interface Tool {
    name: string;
    description?: string;
    inputSchema?: any;
    execute: (args: any) => Promise<any>;
}
export interface Resource {
    uri: string;
    name?: string;
    description?: string;
    mimeType?: string;
    read: () => Promise<any>;
}
interface DiscoveredTool {
    name: string;
    participantId: string;
    description?: string;
    inputSchema?: any;
}
export declare enum DiscoveryState {
    NOT_STARTED = "not_started",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
    NO_TOOLS = "no_tools"
}
export interface ParticipantDiscoveryStatus {
    state: DiscoveryState;
    lastAttempt?: Date;
    attempts: number;
    hasTools: boolean;
}
export declare class MEWParticipant extends MEWClient {
    protected participantInfo?: {
        id: string;
        capabilities: Capability[];
    };
    protected tools: Map<string, Tool>;
    protected discoveredTools: Map<string, DiscoveredTool[]>;
    private resources;
    private pendingRequests;
    private proposalFulfillments;
    private proposalHandlers;
    private requestHandlers;
    private participantJoinHandlers;
    private matcher;
    private joined;
    private toolCache;
    private autoDiscoveryEnabled;
    private defaultCacheTTL;
    private participantDiscoveryStatus;
    private pauseState?;
    private contextTokens;
    private contextMaxTokens;
    private contextMessages;
    private thresholdAlertActive;
    private lastStatusBroadcastAt;
    private proactiveStatusCooldownMs;
    private pendingStreamRequests;
    private activeStreams;
    private openToStream;
    constructor(options: ParticipantOptions);
    send(envelope: Envelope | Partial<Envelope>): void;
    /**
     * Check if we can send a specific envelope
     */
    canSend(envelope: Partial<Envelope>): boolean;
    /**
     * Send a smart MCP request - uses mcp/request or mcp/proposal based on capabilities
     */
    mcpRequest(target: string | string[], payload: any, timeoutMs?: number): Promise<any>;
    /**
     * Withdraw a pending proposal
     * Use when you no longer need the proposal (found alternative, user cancelled, etc)
     */
    withdrawProposal(proposalId: string, reason?: string): void;
    /**
     * Send a chat message
     */
    chat(text: string, to?: string | string[], format?: 'plain' | 'markdown'): void;
    acknowledgeChat(messageId: string, target: string | string[], status?: string): void;
    cancelChat(messageId: string, target?: string | string[], reason?: string): void;
    requestParticipantStatus(target: string | string[], fields?: string[]): void;
    requestStream(payload: StreamRequestPayload, target?: string | string[]): void;
    /**
     * Register a tool
     */
    registerTool(tool: Tool): void;
    /**
     * Register a resource
     */
    registerResource(resource: Resource): void;
    /**
     * Handle MCP proposal events
     */
    onMCPProposal(handler: MCPProposalHandler): () => void;
    /**
     * Handle MCP request events
     */
    onMCPRequest(handler: MCPRequestHandler): () => void;
    /**
     * Handle participant join events
     */
    onParticipantJoin(handler: (participant: any) => void): () => void;
    /**
     * Discover tools from a specific participant
     */
    discoverTools(participantId: string): Promise<DiscoveredTool[]>;
    /**
     * Get all available tools (own + discovered)
     */
    getAvailableTools(): DiscoveredTool[];
    /**
     * Enable automatic tool discovery when participants join
     */
    enableAutoDiscovery(): void;
    /**
     * Get discovery status for all participants
     */
    getDiscoveryStatus(): Map<string, ParticipantDiscoveryStatus>;
    /**
     * Check if any discoveries are in progress
     */
    hasDiscoveriesInProgress(): boolean;
    /**
     * Wait for all pending discoveries to complete
     */
    waitForPendingDiscoveries(maxWaitMs?: number): Promise<void>;
    /**
     * Get participants that haven't been discovered yet
     */
    getUndiscoveredParticipants(): string[];
    /**
     * Check if a participant can respond to MCP requests
     */
    private canParticipantRespondToMCP;
    /**
     * Discover tools with retry logic for robustness
     */
    private discoverToolsWithRetry;
    /**
     * Log helper (uses console for now, can be extended)
     */
    protected log(level: string, message: string): void;
    protected setContextTokenLimit(limit: number): void;
    protected recordContextUsage(delta: {
        tokens?: number;
        messages?: number;
    }): void;
    protected resetContextUsage(): void;
    protected getContextTokens(): number;
    protected getContextTokenLimit(): number;
    protected getContextMessageCount(): number;
    protected estimateTokens(text: string): number;
    protected buildStatusPayload(status?: string): ParticipantStatusPayload;
    protected reportStatus(status?: string, correlationId?: string[]): void;
    protected onForget(direction: 'oldest' | 'newest', entries?: number): Promise<{
        messagesRemoved: number;
        tokensFreed: number;
    }>;
    protected onClear(): Promise<void>;
    protected onRestart(_payload?: ParticipantRestartPayload): Promise<void>;
    private isAddressedToSelf;
    private trackInboundEnvelope;
    private handleParticipantPauseMessage;
    private handleParticipantResumeMessage;
    private handleParticipantForgetMessage;
    private handleParticipantClearMessage;
    private handleParticipantRestartMessage;
    private handleParticipantShutdownMessage;
    private handleParticipantRequestStatusMessage;
    private isPauseActive;
    private isAllowedDuringPause;
    private checkContextThreshold;
    /**
     * Lifecycle hooks for subclasses
     */
    protected onReady(): Promise<void>;
    protected onShutdown(): Promise<void>;
    /**
     * Set up lifecycle management
     */
    private setupLifecycle;
    /**
     * Check if we should handle a request
     */
    private shouldHandleRequest;
    /**
     * Handle MCP response
     */
    private handleMCPResponse;
    /**
     * Handle MCP request
     */
    private handleMCPRequest;
    /**
     * Handle proposal rejection
     */
    private handleProposalReject;
    /**
     * Handle proposal withdrawal
     * SECURITY: Only the original proposer can withdraw their proposal
     */
    private handleProposalWithdraw;
    /**
     * Handle tools/list request
     */
    private handleToolsList;
    /**
     * Handle tools/call request
     */
    private handleToolCall;
    /**
     * Handle resources/list request
     */
    private handleResourcesList;
    /**
     * Handle resources/read request
     */
    private handleResourceRead;
    /**
     * Handle presence events for auto-discovery
     */
    private handlePresence;
}
export {};
//# sourceMappingURL=MEWParticipant.d.ts.map