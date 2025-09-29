"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEWParticipant = exports.DiscoveryState = void 0;
const client_1 = require("@mew-protocol/mew/client");
const capability_matcher_1 = require("@mew-protocol/mew/capability-matcher");
const uuid_1 = require("uuid");
const PROTOCOL_VERSION = 'mew/v0.4';
// Discovery state for each participant
var DiscoveryState;
(function (DiscoveryState) {
    DiscoveryState["NOT_STARTED"] = "not_started";
    DiscoveryState["IN_PROGRESS"] = "in_progress";
    DiscoveryState["COMPLETED"] = "completed";
    DiscoveryState["FAILED"] = "failed";
    DiscoveryState["NO_TOOLS"] = "no_tools"; // Participant responded but has no tools
})(DiscoveryState || (exports.DiscoveryState = DiscoveryState = {}));
class MEWParticipant extends client_1.MEWClient {
    constructor(options) {
        super(options);
        this.tools = new Map();
        this.discoveredTools = new Map();
        this.resources = new Map();
        this.pendingRequests = new Map();
        this.proposalFulfillments = new Map(); // Maps fulfillment request ID to proposal ID
        this.proposalHandlers = new Set();
        this.requestHandlers = new Set();
        this.participantJoinHandlers = new Set();
        this.matcher = new capability_matcher_1.PatternMatcher();
        this.joined = false;
        this.toolCache = [];
        this.autoDiscoveryEnabled = false;
        this.defaultCacheTTL = 300000; // 5 minutes
        this.participantDiscoveryStatus = new Map();
        this.contextTokens = 0;
        this.contextMaxTokens = 20000;
        this.contextMessages = 0;
        this.thresholdAlertActive = false;
        this.lastStatusBroadcastAt = 0;
        this.proactiveStatusCooldownMs = 60000;
        this.pendingStreamRequests = new Map();
        this.activeStreams = new Map();
        this.openToStream = new Map();
        this.options = { requestTimeout: 30000, ...options };
        this.setupLifecycle();
    }
    send(envelope) {
        const kind = envelope.kind || envelope.kind;
        if (kind && this.isPauseActive() && !this.isAllowedDuringPause(kind)) {
            const reason = this.pauseState?.reason ? ` (${this.pauseState?.reason})` : '';
            throw new Error(`Participant is paused${reason}`);
        }
        super.send(envelope);
    }
    /**
     * Check if we can send a specific envelope
     */
    canSend(envelope) {
        if (!this.participantInfo)
            return false;
        // Use matchesCapability directly to check against all capabilities
        return this.participantInfo.capabilities.some(cap => this.matcher.matchesCapability(cap, envelope));
    }
    /**
     * Send a smart MCP request - uses mcp/request or mcp/proposal based on capabilities
     */
    async mcpRequest(target, payload, timeoutMs) {
        const id = (0, uuid_1.v4)();
        const to = Array.isArray(target) ? target : [target];
        const timeout = timeoutMs || this.options.requestTimeout || 30000;
        return new Promise((resolve, reject) => {
            // Check if we can send direct request
            if (this.canSend({ kind: 'mcp/request', payload })) {
                // Send direct MCP request
                const envelope = {
                    protocol: PROTOCOL_VERSION,
                    id,
                    ts: new Date().toISOString(),
                    from: this.options.participant_id,
                    to,
                    kind: 'mcp/request',
                    payload
                };
                // Set up timeout
                const timer = setTimeout(() => {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request ${id} timed out after ${timeout}ms`));
                }, timeout);
                // Store pending request
                this.pendingRequests.set(id, { resolve, reject, timer });
                // Debug: Sending MCP request
                // Send the request
                this.send(envelope);
                return;
            }
            // Check if we can send proposal
            if (this.canSend({ kind: 'mcp/proposal', payload })) {
                // Create proposal for someone else to fulfill
                const envelope = {
                    protocol: PROTOCOL_VERSION,
                    id,
                    ts: new Date().toISOString(),
                    from: this.options.participant_id,
                    to, // Include target participant(s) if specified
                    kind: 'mcp/proposal',
                    payload
                };
                // Set up timeout for proposal
                const timer = setTimeout(() => {
                    this.pendingRequests.delete(id);
                    // Send withdrawal when timing out
                    const withdrawEnvelope = {
                        protocol: PROTOCOL_VERSION,
                        id: (0, uuid_1.v4)(),
                        ts: new Date().toISOString(),
                        from: this.options.participant_id,
                        kind: 'mcp/withdraw',
                        correlation_id: [id],
                        payload: {
                            reason: 'timeout'
                        }
                    };
                    this.send(withdrawEnvelope);
                    reject(new Error(`Proposal ${id} not fulfilled after ${timeout}ms`));
                }, timeout);
                // Store pending proposal with proposer info for security validation
                this.pendingRequests.set(id, {
                    resolve,
                    reject,
                    timer,
                    proposer: this.options.participant_id // Track who created this proposal
                });
                // Debug: Sending MCP proposal
                // Send the proposal
                this.send(envelope);
                return;
            }
            // Can't send request or proposal
            reject(new Error(`No capability to send request for method: ${payload.method}`));
        });
    }
    /**
     * Withdraw a pending proposal
     * Use when you no longer need the proposal (found alternative, user cancelled, etc)
     */
    withdrawProposal(proposalId, reason = 'no_longer_needed') {
        const pending = this.pendingRequests.get(proposalId);
        if (!pending)
            return;
        // Clear timeout
        if (pending.timer)
            clearTimeout(pending.timer);
        this.pendingRequests.delete(proposalId);
        // Send withdrawal
        const withdrawEnvelope = {
            protocol: PROTOCOL_VERSION,
            id: (0, uuid_1.v4)(),
            ts: new Date().toISOString(),
            from: this.options.participant_id,
            kind: 'mcp/withdraw',
            correlation_id: [proposalId],
            payload: { reason }
        };
        this.send(withdrawEnvelope);
        // Reject the promise
        pending.reject(new Error(`Proposal withdrawn: ${reason}`));
    }
    /**
     * Send a chat message
     */
    chat(text, to, format = 'plain') {
        if (!this.canSend({ kind: 'chat', payload: { text } })) {
            throw new Error('No capability to send chat messages');
        }
        const envelope = {
            kind: 'chat',
            payload: { text }
        };
        if (format && format !== 'plain') {
            envelope.payload.format = format;
        }
        if (to) {
            envelope.to = Array.isArray(to) ? to : [to];
        }
        this.send(envelope);
        this.recordContextUsage({ tokens: this.estimateTokens(text), messages: 1 });
    }
    acknowledgeChat(messageId, target, status = 'received') {
        const to = Array.isArray(target) ? target : [target];
        this.send({
            kind: 'chat/acknowledge',
            to,
            correlation_id: [messageId],
            payload: status ? { status } : {}
        });
    }
    cancelChat(messageId, target, reason = 'cancelled') {
        const envelope = {
            kind: 'chat/cancel',
            correlation_id: [messageId],
            payload: reason ? { reason } : {}
        };
        if (target) {
            envelope.to = Array.isArray(target) ? target : [target];
        }
        this.send(envelope);
    }
    requestParticipantStatus(target, fields) {
        const to = Array.isArray(target) ? target : [target];
        const payload = {};
        if (fields && fields.length > 0) {
            payload.fields = fields;
        }
        this.send({
            kind: 'participant/request-status',
            to,
            payload
        });
    }
    requestStream(payload, target = 'gateway') {
        const to = Array.isArray(target) ? target : [target];
        this.send({
            kind: 'stream/request',
            to,
            payload
        });
    }
    /**
     * Register a tool
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
    }
    /**
     * Register a resource
     */
    registerResource(resource) {
        this.resources.set(resource.uri, resource);
    }
    /**
     * Handle MCP proposal events
     */
    onMCPProposal(handler) {
        this.proposalHandlers.add(handler);
        return () => this.proposalHandlers.delete(handler);
    }
    /**
     * Handle MCP request events
     */
    onMCPRequest(handler) {
        this.requestHandlers.add(handler);
        return () => this.requestHandlers.delete(handler);
    }
    /**
     * Handle participant join events
     */
    onParticipantJoin(handler) {
        this.participantJoinHandlers.add(handler);
        return () => this.participantJoinHandlers.delete(handler);
    }
    /**
     * Discover tools from a specific participant
     */
    async discoverTools(participantId) {
        // Update discovery state
        const status = this.participantDiscoveryStatus.get(participantId) || {
            state: DiscoveryState.NOT_STARTED,
            attempts: 0,
            hasTools: false
        };
        status.state = DiscoveryState.IN_PROGRESS;
        status.lastAttempt = new Date();
        this.participantDiscoveryStatus.set(participantId, status);
        try {
            // Check cache first
            const cached = this.toolCache.find(entry => entry.participant === participantId &&
                Date.now() - entry.timestamp < entry.ttl);
            if (cached) {
                status.state = DiscoveryState.COMPLETED;
                status.hasTools = cached.tools.length > 0;
                this.participantDiscoveryStatus.set(participantId, status);
                return cached.tools;
            }
            // Fetch tools from participant (increased timeout for bridge initialization)
            const result = await this.mcpRequest([participantId], {
                method: 'tools/list'
            }, 15000);
            const tools = [];
            if (result?.tools) {
                for (const tool of result.tools) {
                    tools.push({
                        name: tool.name,
                        participantId,
                        description: tool.description,
                        inputSchema: tool.inputSchema
                    });
                }
            }
            // Update cache
            this.toolCache = this.toolCache.filter(e => e.participant !== participantId);
            this.toolCache.push({
                participant: participantId,
                tools,
                timestamp: Date.now(),
                ttl: this.defaultCacheTTL
            });
            // Store discovered tools
            this.discoveredTools.set(participantId, tools);
            // Update discovery state
            status.state = tools.length > 0 ? DiscoveryState.COMPLETED : DiscoveryState.NO_TOOLS;
            status.hasTools = tools.length > 0;
            this.participantDiscoveryStatus.set(participantId, status);
            return tools;
        }
        catch (error) {
            console.error(`Failed to discover tools from ${participantId}:`, error);
            // Update discovery state as failed
            status.state = DiscoveryState.FAILED;
            status.attempts++;
            this.participantDiscoveryStatus.set(participantId, status);
            return [];
        }
    }
    /**
     * Get all available tools (own + discovered)
     */
    getAvailableTools() {
        const allTools = [];
        // Add own tools
        for (const [name, tool] of this.tools.entries()) {
            allTools.push({
                name,
                participantId: this.options.participant_id,
                description: tool.description,
                inputSchema: tool.inputSchema
            });
        }
        // Add discovered tools
        for (const tools of this.discoveredTools.values()) {
            allTools.push(...tools);
        }
        return allTools;
    }
    /**
     * Enable automatic tool discovery when participants join
     */
    enableAutoDiscovery() {
        this.autoDiscoveryEnabled = true;
    }
    /**
     * Get discovery status for all participants
     */
    getDiscoveryStatus() {
        return new Map(this.participantDiscoveryStatus);
    }
    /**
     * Check if any discoveries are in progress
     */
    hasDiscoveriesInProgress() {
        for (const [_, status] of this.participantDiscoveryStatus) {
            if (status.state === DiscoveryState.IN_PROGRESS) {
                return true;
            }
        }
        return false;
    }
    /**
     * Wait for all pending discoveries to complete
     */
    async waitForPendingDiscoveries(maxWaitMs = 10000) {
        const startTime = Date.now();
        while (this.hasDiscoveriesInProgress() && (Date.now() - startTime) < maxWaitMs) {
            this.log('debug', 'Waiting for pending tool discoveries to complete...');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (this.hasDiscoveriesInProgress()) {
            this.log('warn', 'Some tool discoveries are still pending after timeout');
        }
    }
    /**
     * Get participants that haven't been discovered yet
     */
    getUndiscoveredParticipants() {
        const undiscovered = [];
        for (const [participantId, status] of this.participantDiscoveryStatus) {
            if (status.state === DiscoveryState.NOT_STARTED ||
                (status.state === DiscoveryState.FAILED && status.attempts < 3)) {
                undiscovered.push(participantId);
            }
        }
        return undiscovered;
    }
    /**
     * Check if a participant can respond to MCP requests
     */
    canParticipantRespondToMCP(participant) {
        return participant.capabilities?.some((cap) => cap.kind === 'mcp/response');
    }
    /**
     * Discover tools with retry logic for robustness
     */
    async discoverToolsWithRetry(participantId, attempt = 1) {
        const maxAttempts = 3;
        try {
            this.log('debug', `Attempting to discover tools from ${participantId} (attempt ${attempt}/${maxAttempts})`);
            const tools = await this.discoverTools(participantId);
            if (tools && tools.length > 0) {
                this.log('info', `✅ Successfully discovered ${tools.length} tools from ${participantId}`);
            }
            else {
                this.log('debug', `No tools found from ${participantId} (participant may not have tools)`);
            }
        }
        catch (error) {
            this.log('warn', `Failed to discover tools from ${participantId} (attempt ${attempt}/${maxAttempts}): ${error}`);
            if (attempt < maxAttempts) {
                const delay = attempt * 5000; // 5s, 10s, 15s
                this.log('debug', `Will retry discovery from ${participantId} in ${delay}ms`);
                setTimeout(() => this.discoverToolsWithRetry(participantId, attempt + 1), delay);
            }
            else {
                this.log('error', `Failed to discover tools from ${participantId} after ${maxAttempts} attempts`);
            }
        }
    }
    /**
     * Log helper (uses console for now, can be extended)
     */
    log(level, message) {
        const prefix = `[${level.toUpperCase()}] [${this.options.participant_id || 'participant'}]`;
        switch (level) {
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'info':
                console.log(`${prefix} ${message}`);
                break;
            case 'debug':
                if (process.env.DEBUG) {
                    console.log(`${prefix} ${message}`);
                }
                break;
        }
    }
    setContextTokenLimit(limit) {
        this.contextMaxTokens = limit;
        this.checkContextThreshold();
    }
    recordContextUsage(delta) {
        if (typeof delta.tokens === 'number' && !Number.isNaN(delta.tokens)) {
            this.contextTokens = Math.max(0, this.contextTokens + delta.tokens);
        }
        if (typeof delta.messages === 'number' && !Number.isNaN(delta.messages)) {
            this.contextMessages = Math.max(0, this.contextMessages + delta.messages);
        }
        this.checkContextThreshold();
    }
    resetContextUsage() {
        this.contextTokens = 0;
        this.contextMessages = 0;
        this.thresholdAlertActive = false;
    }
    getContextTokens() {
        return this.contextTokens;
    }
    getContextTokenLimit() {
        return this.contextMaxTokens;
    }
    getContextMessageCount() {
        return this.contextMessages;
    }
    estimateTokens(text) {
        if (!text)
            return 0;
        return Math.max(1, Math.ceil(text.length / 4));
    }
    buildStatusPayload(status) {
        const payload = {
            tokens: Math.round(this.contextTokens),
            max_tokens: this.contextMaxTokens,
            messages_in_context: Math.round(this.contextMessages)
        };
        const activeStatus = status || (this.isPauseActive() ? 'paused' : 'active');
        if (activeStatus) {
            payload.status = activeStatus;
        }
        return payload;
    }
    reportStatus(status, correlationId) {
        const payload = this.buildStatusPayload(status);
        if (!this.canSend({ kind: 'participant/status', payload })) {
            return;
        }
        const envelope = {
            kind: 'participant/status',
            payload
        };
        if (correlationId && correlationId.length > 0) {
            envelope.correlation_id = correlationId;
        }
        this.lastStatusBroadcastAt = Date.now();
        this.send(envelope);
    }
    async onForget(direction, entries) {
        return { messagesRemoved: 0, tokensFreed: 0 };
    }
    async onClear() {
        this.resetContextUsage();
    }
    async onRestart(_payload) {
        await this.onClear();
    }
    isAddressedToSelf(envelope) {
        if (!envelope.to || envelope.to.length === 0) {
            return true;
        }
        return envelope.to.includes(this.options.participant_id);
    }
    trackInboundEnvelope(envelope) {
        if (envelope.from === this.options.participant_id) {
            if (envelope.kind === 'stream/request') {
                this.pendingStreamRequests.set(envelope.id, {
                    description: envelope.payload?.description,
                    target: envelope.to
                });
            }
            return;
        }
        if (envelope.kind === 'chat' && this.isAddressedToSelf(envelope)) {
            const text = envelope.payload?.text;
            if (typeof text === 'string') {
                this.recordContextUsage({ tokens: this.estimateTokens(text), messages: 1 });
            }
        }
    }
    handleParticipantPauseMessage(envelope) {
        const payload = (envelope.payload || {});
        const timeoutSeconds = payload.timeout_seconds;
        const until = timeoutSeconds ? Date.now() + timeoutSeconds * 1000 : undefined;
        this.pauseState = {
            id: envelope.id,
            reason: payload.reason,
            until,
            from: envelope.from
        };
        this.reportStatus('paused', [envelope.id]);
    }
    handleParticipantResumeMessage(envelope) {
        this.pauseState = undefined;
        this.reportStatus('active', [envelope.id]);
    }
    async handleParticipantForgetMessage(envelope) {
        const payload = (envelope.payload || {});
        this.reportStatus('compacting', [envelope.id]);
        const result = await this.onForget(payload.direction, payload.entries);
        if (result) {
            this.recordContextUsage({
                tokens: result.tokensFreed ? -result.tokensFreed : 0,
                messages: result.messagesRemoved ? -result.messagesRemoved : 0
            });
        }
        this.reportStatus('compacted', [envelope.id]);
    }
    async handleParticipantClearMessage(envelope) {
        const payload = (envelope.payload || {});
        await this.onClear();
        this.resetContextUsage();
        const status = payload?.reason ? `cleared:${payload.reason}` : 'cleared';
        this.reportStatus(status, [envelope.id]);
    }
    async handleParticipantRestartMessage(envelope) {
        const payload = (envelope.payload || {});
        await this.onRestart(payload);
        this.resetContextUsage();
        this.reportStatus('restarted', [envelope.id]);
    }
    async handleParticipantShutdownMessage(envelope) {
        const payload = (envelope.payload || {});
        this.reportStatus(payload?.reason ? `shutting_down:${payload.reason}` : 'shutting_down', [envelope.id]);
        await this.onShutdown();
        this.disconnect();
    }
    handleParticipantRequestStatusMessage(envelope) {
        const request = (envelope.payload || {});
        const payload = this.buildStatusPayload();
        let filtered = { ...payload };
        if (request.fields && request.fields.length > 0) {
            filtered = { messages_in_context: payload.messages_in_context };
            for (const field of request.fields) {
                if (field in payload) {
                    filtered[field] = payload[field];
                }
            }
            filtered.status = payload.status;
            if (!request.fields.includes('messages_in_context')) {
                filtered.messages_in_context = payload.messages_in_context;
            }
        }
        if (!this.canSend({ kind: 'participant/status', payload: filtered })) {
            return;
        }
        this.send({
            kind: 'participant/status',
            to: [envelope.from],
            correlation_id: [envelope.id],
            payload: filtered
        });
    }
    isPauseActive() {
        if (!this.pauseState) {
            return false;
        }
        if (this.pauseState.until && Date.now() > this.pauseState.until) {
            this.pauseState = undefined;
            return false;
        }
        return true;
    }
    isAllowedDuringPause(kind) {
        const allowedKinds = new Set([
            'participant/status',
            'participant/resume',
            'participant/request-status',
            'chat/acknowledge',
            'chat/cancel',
            'reasoning/cancel',
            'participant/clear',
            'participant/forget',
            'participant/shutdown',
            'system/presence',
            'system/error'
        ]);
        if (allowedKinds.has(kind)) {
            return true;
        }
        return kind.startsWith('system/');
    }
    checkContextThreshold() {
        const threshold = this.contextMaxTokens * 0.9;
        if (this.contextTokens >= threshold) {
            if (!this.thresholdAlertActive && Date.now() - this.lastStatusBroadcastAt > this.proactiveStatusCooldownMs) {
                this.thresholdAlertActive = true;
                this.reportStatus('near_limit');
            }
        }
        else if (this.thresholdAlertActive && this.contextTokens < this.contextMaxTokens * 0.75) {
            this.thresholdAlertActive = false;
        }
    }
    /**
     * Lifecycle hooks for subclasses
     */
    async onReady() { }
    async onShutdown() { }
    /**
     * Set up lifecycle management
     */
    setupLifecycle() {
        // Handle connection
        this.onConnected(() => {
            if (!this.joined) {
                // Join is now handled by MEWClient
                this.joined = true;
            }
        });
        // Handle welcome message (including updates after grants)
        this.onWelcome(async (data) => {
            const previousCapabilities = this.participantInfo?.capabilities?.length || 0;
            this.participantInfo = {
                id: data.you.id,
                capabilities: data.you.capabilities
            };
            // Log capability updates
            const newCapabilities = data.you.capabilities?.length || 0;
            if (previousCapabilities > 0 && newCapabilities !== previousCapabilities) {
                console.log(`[MEWParticipant] Capabilities updated: ${previousCapabilities} -> ${newCapabilities}`);
                console.log('[MEWParticipant] New capabilities:', JSON.stringify(data.you.capabilities, null, 2));
            }
            // Initialize discovery status for all participants
            if (data.participants) {
                for (const participant of data.participants) {
                    if (participant.id !== data.you.id) {
                        // Initialize discovery status if not already tracked
                        if (!this.participantDiscoveryStatus.has(participant.id)) {
                            this.participantDiscoveryStatus.set(participant.id, {
                                state: DiscoveryState.NOT_STARTED,
                                attempts: 0,
                                hasTools: false
                            });
                        }
                    }
                }
                // Discover tools from existing participants if auto-discovery is enabled
                if (this.autoDiscoveryEnabled) {
                    this.log('debug', `Discovering tools from ${data.participants.length} existing participants`);
                    for (const participant of data.participants) {
                        if (participant.id !== data.you.id && this.canParticipantRespondToMCP(participant)) {
                            // Stagger discovery to avoid storms
                            const delay = 3000 + Math.random() * 2000; // 3-5 seconds
                            setTimeout(() => this.discoverToolsWithRetry(participant.id), delay);
                        }
                    }
                }
            }
            await this.onReady();
        });
        // Handle incoming messages
        this.onMessage(async (envelope) => {
            this.trackInboundEnvelope(envelope);
            if (envelope.kind === 'stream/open') {
                const correlationId = envelope.correlation_id?.[0];
                const streamId = envelope.payload?.stream_id;
                if (correlationId && streamId) {
                    const meta = this.pendingStreamRequests.get(correlationId);
                    if (meta) {
                        this.pendingStreamRequests.delete(correlationId);
                        this.activeStreams.set(streamId, { description: meta.description, correlationId });
                    }
                    else {
                        this.activeStreams.set(streamId, { description: envelope.payload?.description, correlationId });
                    }
                    this.openToStream.set(envelope.id, streamId);
                }
            }
            if (envelope.kind === 'stream/close') {
                const correlationId = envelope.correlation_id?.[0];
                if (correlationId) {
                    const streamId = this.openToStream.get(correlationId) || correlationId;
                    this.activeStreams.delete(streamId);
                    this.openToStream.delete(correlationId);
                }
            }
            if (this.isAddressedToSelf(envelope)) {
                if (envelope.kind === 'participant/pause') {
                    this.handleParticipantPauseMessage(envelope);
                }
                else if (envelope.kind === 'participant/resume') {
                    this.handleParticipantResumeMessage(envelope);
                }
                else if (envelope.kind === 'participant/request-status') {
                    this.handleParticipantRequestStatusMessage(envelope);
                }
                else if (envelope.kind === 'participant/forget') {
                    await this.handleParticipantForgetMessage(envelope);
                }
                else if (envelope.kind === 'participant/clear') {
                    await this.handleParticipantClearMessage(envelope);
                }
                else if (envelope.kind === 'participant/restart') {
                    await this.handleParticipantRestartMessage(envelope);
                }
                else if (envelope.kind === 'participant/shutdown') {
                    await this.handleParticipantShutdownMessage(envelope);
                    return;
                }
            }
            // Handle MCP responses
            if (envelope.kind === 'mcp/response') {
                // Debug: Received MCP response
                await this.handleMCPResponse(envelope);
            }
            // Handle MCP requests
            if (envelope.kind === 'mcp/request') {
                // Track if this request is fulfilling one of our proposals
                if (envelope.correlation_id && envelope.correlation_id.length > 0) {
                    const proposalId = envelope.correlation_id[0];
                    if (this.pendingRequests.has(proposalId)) {
                        // Someone is fulfilling our proposal - track it
                        this.proposalFulfillments.set(envelope.id, proposalId);
                    }
                }
                if (this.shouldHandleRequest(envelope)) {
                    await this.handleMCPRequest(envelope);
                }
            }
            // Handle MCP proposals (not from self)
            if (envelope.kind === 'mcp/proposal' && envelope.from !== this.options.participant_id) {
                for (const handler of this.proposalHandlers) {
                    await handler(envelope);
                }
            }
            // Handle proposal rejection
            if (envelope.kind === 'mcp/reject') {
                await this.handleProposalReject(envelope);
            }
            // Handle proposal withdrawal
            if (envelope.kind === 'mcp/withdraw') {
                await this.handleProposalWithdraw(envelope);
            }
            // Handle system presence for auto-discovery
            if (envelope.kind === 'system/presence' && this.autoDiscoveryEnabled) {
                await this.handlePresence(envelope);
            }
        });
    }
    /**
     * Check if we should handle a request
     */
    shouldHandleRequest(envelope) {
        // Handle if addressed to us or broadcast
        return !envelope.to ||
            envelope.to.length === 0 ||
            envelope.to.includes(this.options.participant_id);
    }
    /**
     * Handle MCP response
     */
    async handleMCPResponse(envelope) {
        const correlationId = envelope.correlation_id?.[0];
        if (!correlationId) {
            // Debug: MCP response received but no correlation_id
            return;
        }
        // First check if this is a direct response to our request
        const pending = this.pendingRequests.get(correlationId);
        if (pending) {
            // Debug: Resolving pending request
            if (pending.timer)
                clearTimeout(pending.timer);
            this.pendingRequests.delete(correlationId);
            if (envelope.payload.error) {
                // Debug: Request failed
                pending.reject(new Error(envelope.payload.error.message || 'Request failed'));
            }
            else {
                // Debug: Request succeeded
                pending.resolve(envelope.payload.result);
            }
            return;
        }
        // Check if this is a response to a fulfilled proposal
        const fulfillmentProposalId = this.proposalFulfillments.get(correlationId);
        if (fulfillmentProposalId) {
            // This response is for a request that fulfilled our proposal
            const pending = this.pendingRequests.get(fulfillmentProposalId);
            if (pending) {
                // Resolve our original proposal with the result
                if (pending.timer)
                    clearTimeout(pending.timer);
                this.pendingRequests.delete(fulfillmentProposalId);
                this.proposalFulfillments.delete(correlationId);
                if (envelope.payload.error) {
                    pending.reject(new Error(envelope.payload.error.message || 'Proposal fulfillment failed'));
                }
                else {
                    pending.resolve(envelope.payload.result);
                }
                return;
            }
        }
        // Debug: No pending request found for response
    }
    /**
     * Handle MCP request
     */
    async handleMCPRequest(envelope) {
        // Check if we have capability to respond
        if (!this.canSend({ kind: 'mcp/response' })) {
            return;
        }
        const { method, params } = envelope.payload;
        let result;
        let error;
        try {
            switch (method) {
                case 'tools/list':
                    result = await this.handleToolsList();
                    break;
                case 'tools/call':
                    result = await this.handleToolCall(params);
                    break;
                case 'resources/list':
                    result = await this.handleResourcesList();
                    break;
                case 'resources/read':
                    result = await this.handleResourceRead(params);
                    break;
                default:
                    // Let request handlers handle it
                    for (const handler of this.requestHandlers) {
                        await handler(envelope);
                    }
                    return; // Don't send automatic response
            }
        }
        catch (err) {
            error = {
                code: err.code || -32603,
                message: err.message || 'Internal error'
            };
        }
        // Send response
        const response = {
            protocol: PROTOCOL_VERSION,
            id: (0, uuid_1.v4)(),
            ts: new Date().toISOString(),
            from: this.options.participant_id,
            to: [envelope.from],
            correlation_id: [envelope.id],
            kind: 'mcp/response',
            payload: error ? { error } : { result }
        };
        // Debug: Sending MCP response
        this.send(response);
    }
    /**
     * Handle proposal rejection
     */
    async handleProposalReject(envelope) {
        const correlationId = envelope.correlation_id?.[0];
        if (!correlationId)
            return;
        const pending = this.pendingRequests.get(correlationId);
        if (pending) {
            if (pending.timer)
                clearTimeout(pending.timer);
            this.pendingRequests.delete(correlationId);
            // Include who rejected and why for better debugging
            const reason = envelope.payload?.reason || 'unknown';
            const errorMessage = `Proposal rejected by ${envelope.from}: ${reason}`;
            pending.reject(new Error(errorMessage));
        }
    }
    /**
     * Handle proposal withdrawal
     * SECURITY: Only the original proposer can withdraw their proposal
     */
    async handleProposalWithdraw(envelope) {
        const correlationId = envelope.correlation_id?.[0];
        if (!correlationId)
            return;
        const pending = this.pendingRequests.get(correlationId);
        if (!pending)
            return;
        // SECURITY CHECK: Verify the withdrawal is from the original proposer
        // This prevents privilege escalation where other participants try to cancel proposals
        if (envelope.from !== pending.proposer) {
            console.warn(`[SECURITY] Ignoring withdrawal from ${envelope.from} for proposal created by ${pending.proposer}`);
            return;
        }
        // Valid withdrawal from the original proposer
        if (pending.timer)
            clearTimeout(pending.timer);
        this.pendingRequests.delete(correlationId);
        // Only reject if this is our own proposal
        if (envelope.from === this.options.participant_id) {
            const reason = envelope.payload?.reason || 'no_longer_needed';
            pending.reject(new Error(`Proposal withdrawn: ${reason}`));
        }
        // Otherwise, we're an observer/auto-fulfiller and should stop processing
    }
    /**
     * Handle tools/list request
     */
    async handleToolsList() {
        const tools = Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
        // Debug: Returning tools list
        return { tools };
    }
    /**
     * Handle tools/call request
     */
    async handleToolCall(params) {
        const { name, arguments: args } = params;
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return await tool.execute(args);
    }
    /**
     * Handle resources/list request
     */
    async handleResourcesList() {
        const resources = Array.from(this.resources.values()).map(resource => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType
        }));
        return { resources };
    }
    /**
     * Handle resources/read request
     */
    async handleResourceRead(params) {
        const { uri } = params;
        const resource = this.resources.get(uri);
        if (!resource) {
            throw new Error(`Resource not found: ${uri}`);
        }
        const contents = await resource.read();
        return {
            uri,
            mimeType: resource.mimeType,
            contents
        };
    }
    /**
     * Handle presence events for auto-discovery
     */
    async handlePresence(envelope) {
        const { event, participant } = envelope.payload;
        if (event === 'join' && participant.id !== this.options.participant_id) {
            // Initialize discovery status for new participant
            if (!this.participantDiscoveryStatus.has(participant.id)) {
                this.participantDiscoveryStatus.set(participant.id, {
                    state: DiscoveryState.NOT_STARTED,
                    attempts: 0,
                    hasTools: false
                });
            }
            // Notify join handlers
            for (const handler of this.participantJoinHandlers) {
                handler(participant);
            }
            // Auto-discover tools if enabled
            if (this.autoDiscoveryEnabled) {
                if (this.canParticipantRespondToMCP(participant)) {
                    // Discover tools with a delay to let participant fully initialize
                    const delay = 3000 + Math.random() * 2000; // 3-5 seconds
                    setTimeout(() => this.discoverToolsWithRetry(participant.id), delay);
                }
            }
        }
        else if (event === 'leave') {
            // Remove cached tools and discovery status for leaving participant
            this.discoveredTools.delete(participant.id);
            this.toolCache = this.toolCache.filter(e => e.participant !== participant.id);
            this.participantDiscoveryStatus.delete(participant.id);
        }
    }
}
exports.MEWParticipant = MEWParticipant;
//# sourceMappingURL=MEWParticipant.js.map