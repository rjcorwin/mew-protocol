"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEUPParticipant = void 0;
const client_1 = require("@meup/client");
const capabilities_1 = require("./capabilities");
const tools_1 = require("./mcp/tools");
class MEUPParticipant {
    constructor(options) {
        this.options = options;
        this.tools = new tools_1.ToolRegistry();
        this.resources = new Map();
        this.joined = false;
        this.proposalHandlers = new Set();
        this.requestHandlers = new Set();
        this.pendingRequests = new Map();
        this.requestTimeout = 30000; // 30 seconds default timeout
        // Create underlying client
        this.client = new client_1.MEUPClient({
            ...options,
            capabilities: [] // Will be set from welcome message
        });
        this.setupLifecycle();
    }
    /**
     * Connect to the gateway
     */
    async connect() {
        await this.client.connect();
    }
    /**
     * Disconnect from the gateway
     */
    disconnect() {
        this.client.disconnect();
    }
    /**
     * Register a tool
     */
    registerTool(tool) {
        this.tools.register(tool);
    }
    /**
     * Register a resource
     */
    registerResource(resource) {
        this.resources.set(resource.uri, resource);
    }
    /**
     * Check if we have a capability
     */
    canSend(kind, payload) {
        if (!this.participantInfo)
            return false;
        return (0, capabilities_1.canSend)(this.participantInfo.capabilities, kind, payload);
    }
    /**
     * Send a smart request - uses mcp/request or mcp/proposal based on capabilities
     * Returns a promise that resolves with the response
     */
    async request(target, method, params, timeoutMs) {
        return new Promise((resolve, reject) => {
            const to = Array.isArray(target) ? target : [target];
            const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const timeout = timeoutMs || this.requestTimeout;
            // Set up timeout
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timed out after ${timeout}ms`));
            }, timeout);
            // Store pending request
            this.pendingRequests.set(id, {
                id,
                resolve,
                reject,
                timeout: timeoutHandle
            });
            // Check if we can send direct MCP request
            if (this.canSend('mcp/request', { method, params })) {
                const envelope = {
                    protocol: 'meup/v0.2',
                    id,
                    ts: new Date().toISOString(),
                    from: this.options.participant_id,
                    to,
                    kind: 'mcp/request',
                    payload: {
                        jsonrpc: '2.0',
                        id: Date.now(),
                        method,
                        params
                    }
                };
                console.log(`${this.options.participant_id} sending MCP request with envelope.id: ${envelope.id}`);
                this.client.send(envelope);
                return;
            }
            // Fall back to proposal if we have that capability
            if (this.canSend('mcp/proposal')) {
                const envelope = {
                    protocol: 'meup/v0.2',
                    id,
                    ts: new Date().toISOString(),
                    from: this.options.participant_id,
                    to,
                    kind: 'mcp/proposal',
                    payload: {
                        proposal: {
                            method,
                            params
                        }
                    }
                };
                this.client.send(envelope);
                return;
            }
            // Clean up and reject
            clearTimeout(timeoutHandle);
            this.pendingRequests.delete(id);
            reject(new Error(`No capability to send ${method} request`));
        });
    }
    /**
     * Send a chat message
     */
    chat(text, to) {
        if (!this.canSend('chat')) {
            throw new Error('No capability to send chat messages');
        }
        const envelope = {
            protocol: 'meup/v0.2',
            id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ts: new Date().toISOString(),
            from: this.options.participant_id,
            to: to ? (Array.isArray(to) ? to : [to]) : undefined,
            kind: 'chat',
            payload: {
                text,
                format: 'plain'
            }
        };
        this.client.send(envelope);
    }
    /**
     * Register a proposal handler
     */
    onProposal(handler) {
        this.proposalHandlers.add(handler);
        return () => this.proposalHandlers.delete(handler);
    }
    /**
     * Register a custom request handler
     */
    onRequest(handler) {
        this.requestHandlers.add(handler);
        return () => this.requestHandlers.delete(handler);
    }
    /**
     * Lifecycle hook - called when connected and ready
     */
    async onReady() {
        // Override in subclass
    }
    /**
     * Lifecycle hook - called before shutdown
     */
    async onShutdown() {
        // Override in subclass
    }
    /**
     * Setup lifecycle event handlers
     */
    setupLifecycle() {
        // Handle connection
        this.client.onConnected(() => {
            console.log(`${this.options.participant_id} connected to gateway`);
            // Send join message for gateway compatibility
            if (!this.joined) {
                this.client.send({
                    type: 'join',
                    participantId: this.options.participant_id,
                    space: this.options.space,
                    token: this.options.token
                });
                this.joined = true;
            }
        });
        // Handle welcome message
        this.client.onWelcome(async (data) => {
            this.participantInfo = {
                id: data.you.id,
                capabilities: data.you.capabilities
            };
            console.log(`${this.options.participant_id} welcomed with ${this.participantInfo.capabilities.length} capabilities`);
            // Call ready hook
            await this.onReady();
        });
        // Handle incoming messages
        this.client.onMessage(async (envelope) => {
            // Debug log
            if (envelope.kind === 'mcp/response' || envelope.kind === 'mcp/request') {
                console.log(`${this.options.participant_id} received ${envelope.kind} from ${envelope.from}`);
            }
            // Handle MCP responses
            if (envelope.kind === 'mcp/response') {
                await this.handleMCPResponse(envelope);
            }
            // Handle MCP requests
            if (envelope.kind === 'mcp/request') {
                console.log(`${this.options.participant_id} received MCP request from ${envelope.from}`);
                if (this.shouldHandleRequest(envelope)) {
                    console.log(`${this.options.participant_id} handling MCP request`);
                    await this.handleMCPRequest(envelope);
                }
                else {
                    console.log(`${this.options.participant_id} not handling MCP request (not addressed to us or no capability)`);
                }
            }
            // Handle proposals
            if (envelope.kind === 'mcp/proposal' && envelope.from !== this.options.participant_id) {
                for (const handler of this.proposalHandlers) {
                    await handler(envelope);
                }
            }
        });
        // Handle errors
        this.client.onError((error) => {
            console.error(`${this.options.participant_id} error:`, error);
        });
        // Handle disconnection
        this.client.onDisconnected(async () => {
            console.log(`${this.options.participant_id} disconnected`);
            // Reject all pending requests
            for (const [id, pendingRequest] of this.pendingRequests) {
                clearTimeout(pendingRequest.timeout);
                pendingRequest.reject(new Error('Connection closed'));
            }
            this.pendingRequests.clear();
            await this.onShutdown();
        });
    }
    /**
     * Handle incoming MCP responses and resolve pending promises
     */
    async handleMCPResponse(envelope) {
        console.log(`${this.options.participant_id} handleMCPResponse called with correlation_id: ${envelope.correlation_id}`);
        // Check if this response correlates to one of our pending requests
        if (envelope.correlation_id) {
            // Handle correlation_id as either string or array
            const correlationId = Array.isArray(envelope.correlation_id)
                ? envelope.correlation_id[0]
                : envelope.correlation_id;
            console.log(`${this.options.participant_id} pending requests:`, Array.from(this.pendingRequests.keys()));
            console.log(`${this.options.participant_id} looking for: "${correlationId}" (original type: ${typeof envelope.correlation_id})`);
            const pendingRequest = this.pendingRequests.get(correlationId);
            console.log(`${this.options.participant_id} pendingRequest found:`, pendingRequest ? 'YES' : 'NO');
            if (pendingRequest) {
                console.log(`${this.options.participant_id} found matching pending request for ${envelope.correlation_id}`);
                // Clean up
                clearTimeout(pendingRequest.timeout);
                this.pendingRequests.delete(correlationId);
                const payload = envelope.payload;
                // Check for MCP error
                if (payload.error) {
                    pendingRequest.reject(new Error(`MCP Error ${payload.error.code}: ${payload.error.message}`));
                    return;
                }
                // Resolve with the result
                if (payload.result) {
                    pendingRequest.resolve(payload.result);
                }
                else {
                    pendingRequest.resolve(payload);
                }
                return;
            }
        }
    }
    /**
     * Check if we should handle this request
     */
    shouldHandleRequest(envelope) {
        // Check if it's addressed to us
        if (envelope.to && !envelope.to.includes(this.options.participant_id)) {
            return false;
        }
        // Check if we have mcp/response capability
        return this.canSend('mcp/response');
    }
    /**
     * Handle incoming MCP requests
     */
    async handleMCPRequest(envelope) {
        const { method, params } = envelope.payload || {};
        const requestId = envelope.payload?.id;
        console.log(`handleMCPRequest: method=${method}, from=${envelope.from}`);
        let response;
        try {
            // Check custom handlers first
            console.log(`Checking ${this.requestHandlers.size} custom handlers`);
            for (const handler of this.requestHandlers) {
                console.log('Calling custom handler...');
                const result = await handler(envelope);
                console.log('Custom handler returned:', result ? 'result' : 'null');
                if (result) {
                    response = result;
                    break;
                }
            }
            // Built-in handlers
            if (!response) {
                switch (method) {
                    case 'tools/list':
                        response = this.tools.list();
                        break;
                    case 'tools/call':
                        response = await this.tools.execute(params?.name, params?.arguments);
                        break;
                    case 'resources/list':
                        response = this.listResources();
                        break;
                    case 'resources/read':
                        response = await this.readResource(params?.uri);
                        break;
                    default:
                        response = {
                            error: {
                                code: -32601,
                                message: `Method not found: ${method}`
                            }
                        };
                }
            }
        }
        catch (error) {
            response = {
                error: {
                    code: -32603,
                    message: error.message || 'Internal error',
                    data: error.stack
                }
            };
        }
        // Send response
        const responseEnvelope = {
            protocol: 'meup/v0.2',
            id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ts: new Date().toISOString(),
            from: this.options.participant_id,
            to: [envelope.from],
            kind: 'mcp/response',
            correlation_id: envelope.id,
            payload: {
                jsonrpc: '2.0',
                id: requestId,
                ...response
            }
        };
        console.log(`Sending MCP response to ${envelope.from}:`, JSON.stringify(responseEnvelope));
        this.client.send(responseEnvelope);
    }
    /**
     * List resources in MCP format
     */
    listResources() {
        const resources = Array.from(this.resources.values()).map(r => ({
            uri: r.uri,
            name: r.name,
            description: r.description,
            mimeType: r.mimeType
        }));
        return {
            result: { resources }
        };
    }
    /**
     * Read a resource
     */
    async readResource(uri) {
        const resource = this.resources.get(uri);
        if (!resource) {
            return {
                error: {
                    code: -32602,
                    message: `Resource not found: ${uri}`
                }
            };
        }
        try {
            const data = await resource.read();
            return {
                result: {
                    contents: [{
                            uri: resource.uri,
                            mimeType: resource.mimeType || 'text/plain',
                            text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
                        }]
                }
            };
        }
        catch (error) {
            return {
                error: {
                    code: -32603,
                    message: error.message || 'Failed to read resource'
                }
            };
        }
    }
}
exports.MEUPParticipant = MEUPParticipant;
//# sourceMappingURL=MEUPParticipant.js.map