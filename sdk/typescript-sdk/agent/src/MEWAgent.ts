import { MEWParticipant } from '@mew-protocol/participant';
import { Envelope, PartialEnvelope, Capability } from '@mew-protocol/types';
import { ClientEvents, PROTOCOL_VERSION } from '@mew-protocol/client';
import { Tool, Resource, ParticipantOptions } from '@mew-protocol/participant';

export interface AgentConfig extends ParticipantOptions {
  name?: string;
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  maxIterations?: number;
  thinkingEnabled?: boolean;
  autoRespond?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ThoughtStep {
  thought: string;
  action?: string;
  actionInput?: any;
  observation?: string;
}

export class MEWAgent extends MEWParticipant {
  private config: AgentConfig;
  private systemPrompt: string;
  private conversationHistory: Envelope[] = [];
  private activeRequests = new Map<string, { from: string; method: string }>();
  private thinkingContext: string | null = null;

  constructor(config: AgentConfig) {
    super(config);
    this.config = config;
    this.systemPrompt =
      config.systemPrompt || 'You are a helpful AI assistant in the MEW protocol ecosystem.';
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle incoming envelopes
    this.client.on(ClientEvents.MESSAGE, async (envelope: Envelope) => {
      await this.handleEnvelope(envelope);
    });

    // Handle welcome message
    this.client.on(ClientEvents.WELCOME, (welcomeData: any) => {
      this.log(
        'info',
        `Agent ${this.config.participant_id} joined with capabilities:`,
        welcomeData.you.capabilities,
      );
      if (this.config.autoRespond) {
        this.sendChat('Hello! I am an AI assistant ready to help. What can I do for you?');
      }
    });

    // Handle errors
    this.client.on(ClientEvents.ERROR, (error: any) => {
      this.log('error', 'Client error:', error);
    });
  }

  private async handleEnvelope(envelope: Envelope): Promise<void> {
    // Skip our own messages
    if (envelope.from === this.config.participant_id) {
      return;
    }

    // Store in conversation history
    this.conversationHistory.push(envelope);

    switch (envelope.kind) {
      case 'chat':
        await this.handleChat(envelope);
        break;

      case 'mcp/request':
        await this.handleAgentMCPRequest(envelope);
        break;

      case 'mcp/proposal':
        await this.handleMCPProposal(envelope);
        break;

      case 'mcp/response':
        await this.handleAgentMCPResponse(envelope);
        break;
    }
  }

  private async handleChat(envelope: Envelope): Promise<void> {
    const text = envelope.payload?.text;
    if (!text) return;

    // Check if message is directed at us
    const isDirected =
      envelope.to?.includes(this.config.participant_id!) ||
      text.toLowerCase().includes(this.config.name?.toLowerCase() || '') ||
      envelope.to?.length === 0; // Broadcast message

    if (!isDirected && !this.config.autoRespond) {
      return;
    }

    this.log('info', `Received chat from ${envelope.from}: ${text}`);

    // Start thinking process if enabled
    if (this.config.thinkingEnabled) {
      await this.startThinking(`Responding to message from ${envelope.from}: "${text}"`);
    }

    // Use ReAct loop to generate response
    await this.reactLoop(text, envelope.from);
  }

  private async handleAgentMCPRequest(envelope: Envelope): Promise<void> {
    // Check if request is for us
    if (!envelope.to?.includes(this.config.participant_id!)) {
      return;
    }

    const { method, params, id } = envelope.payload || {};
    this.log('info', `Received MCP request: ${method}`);

    // Store request for correlation
    this.activeRequests.set(envelope.id, { from: envelope.from, method });

    // Handle based on method
    switch (method) {
      case 'tools/list':
        await this.respondWithTools(envelope);
        break;

      case 'tools/call':
        await this.executeTool(envelope, params);
        break;

      case 'resources/list':
        await this.respondWithResources(envelope);
        break;

      case 'resources/read':
        await this.readAgentResource(envelope, params);
        break;

      default:
        await this.sendMCPError(envelope, `Unsupported method: ${method}`);
    }
  }

  private async handleMCPProposal(envelope: Envelope): Promise<void> {
    const proposal = envelope.payload;
    this.log('info', `Received proposal from ${envelope.from}:`, proposal);

    // If we have approval capability, we could auto-approve safe operations
    if (this.canSend('mcp/request') && this.isSafeOperation(proposal)) {
      await this.fulfillProposal(envelope);
    } else {
      this.log('info', 'Cannot fulfill proposal - lacking capability or unsafe operation');
    }
  }

  private async handleAgentMCPResponse(envelope: Envelope): Promise<void> {
    // Check if this is a response to our request
    const correlationId = envelope.correlation_id;
    if (correlationId && this.activeRequests.has(correlationId)) {
      const request = this.activeRequests.get(correlationId);
      this.activeRequests.delete(correlationId);

      this.log('info', `Received response for ${request?.method}:`, envelope.payload);

      // Process the response in our thinking context if active
      if (this.thinkingContext) {
        await this.addThought(`Received response: ${JSON.stringify(envelope.payload)}`);
      }
    }
  }

  private async reactLoop(input: string, from: string): Promise<void> {
    const maxIterations = this.config.maxIterations || 5;
    const thoughts: ThoughtStep[] = [];

    for (let i = 0; i < maxIterations; i++) {
      // Think step
      const thought = await this.think(input, thoughts);
      thoughts.push(thought);

      if (this.thinkingContext) {
        await this.addThought(thought.thought);
      }

      // Check if we have an action to take
      if (thought.action) {
        // Act step
        const observation = await this.act(thought.action, thought.actionInput);
        thought.observation = observation;

        if (this.thinkingContext) {
          await this.addThought(`Action: ${thought.action}, Observation: ${observation}`);
        }
      }

      // Check if we have a final answer
      if (thought.action === 'respond' || thought.thought.toLowerCase().includes('final answer')) {
        const response = thought.actionInput || thought.thought;
        await this.sendChat(response, from);
        break;
      }
    }

    // End thinking process
    if (this.thinkingContext) {
      await this.concludeThinking('Completed response generation');
    }
  }

  private async think(input: string, previousThoughts: ThoughtStep[]): Promise<ThoughtStep> {
    // This would integrate with an LLM in a real implementation
    // For now, return a mock thought process

    if (previousThoughts.length === 0) {
      return {
        thought: `I need to understand what the user is asking: "${input}"`,
        action: 'analyze',
        actionInput: input,
      };
    }

    const lastThought = previousThoughts[previousThoughts.length - 1];
    if (lastThought.action === 'analyze') {
      return {
        thought: 'I should provide a helpful response based on my analysis',
        action: 'respond',
        actionInput: `I understand you're asking about "${input}". As an AI assistant in the MEW protocol, I can help coordinate with other agents and tools. How can I assist you specifically?`,
      };
    }

    return {
      thought: 'I have completed my analysis',
      action: 'respond',
      actionInput: 'How else can I help you?',
    };
  }

  private async act(action: string, input: any): Promise<string> {
    switch (action) {
      case 'analyze':
        return `Analyzed input: ${input}`;

      case 'search':
        // Could call a search tool here
        return `Search results for: ${input}`;

      case 'calculate':
        // Could call a calculator tool
        return `Calculation result: ${input}`;

      case 'respond':
        return 'Response prepared';

      default:
        return `Unknown action: ${action}`;
    }
  }

  private async startThinking(message: string): Promise<void> {
    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `think-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      kind: 'reasoning/start',
      payload: { message },
    };

    this.thinkingContext = envelope.id;
    this.client.send(envelope);
  }

  private async addThought(message: string): Promise<void> {
    if (!this.thinkingContext) return;

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `thought-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      kind: 'reasoning/thought',
      context: this.thinkingContext as any,
      payload: { message },
    };

    this.client.send(envelope);
  }

  private async concludeThinking(message: string): Promise<void> {
    if (!this.thinkingContext) return;

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `conclude-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      kind: 'reasoning/conclusion',
      context: this.thinkingContext as any,
      payload: { message },
    };

    this.client.send(envelope);
    this.thinkingContext = null;
  }

  private async sendChat(text: string, to?: string | string[]): Promise<void> {
    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `chat-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      to: to ? (Array.isArray(to) ? to : [to]) : undefined,
      kind: 'chat',
      payload: { text, format: 'plain' },
    };

    this.client.send(envelope);
  }

  private async respondWithTools(request: Envelope): Promise<void> {
    const response = this.tools.list();
    await this.sendMCPResponse(request, response.result);
  }

  private async executeTool(request: Envelope, params: any): Promise<void> {
    const { name, arguments: args } = params || {};

    try {
      const result = await this.tools.execute(name, args);
      await this.sendMCPResponse(request, result);
    } catch (error: any) {
      await this.sendMCPError(request, error.message);
    }
  }

  private async respondWithResources(request: Envelope): Promise<void> {
    const resources = Array.from(this.resources.values()).map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));

    await this.sendMCPResponse(request, { resources });
  }

  private async readAgentResource(request: Envelope, params: any): Promise<void> {
    const { uri } = params || {};
    const resource = this.resources.get(uri);

    if (!resource) {
      await this.sendMCPError(request, `Resource not found: ${uri}`);
      return;
    }

    try {
      const contents = await resource.read();
      await this.sendMCPResponse(request, { contents });
    } catch (error: any) {
      await this.sendMCPError(request, error.message);
    }
  }

  private async sendMCPResponse(request: Envelope, result: any): Promise<void> {
    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `resp-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      to: [request.from],
      kind: 'mcp/response',
      correlation_id: request.id,
      payload: {
        jsonrpc: '2.0',
        id: request.payload?.id,
        result,
      },
    };

    this.client.send(envelope);
  }

  private async sendMCPError(request: Envelope, message: string): Promise<void> {
    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `err-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      to: [request.from],
      kind: 'mcp/response',
      correlation_id: request.id,
      payload: {
        jsonrpc: '2.0',
        id: request.payload?.id,
        error: {
          code: -32603,
          message,
        },
      },
    };

    this.client.send(envelope);
  }

  private async fulfillProposal(proposal: Envelope): Promise<void> {
    const { method, params } = proposal.payload || {};

    const envelope: Envelope = {
      protocol: PROTOCOL_VERSION,
      id: `fulfill-${Date.now()}`,
      ts: new Date().toISOString(),
      from: this.config.participant_id!,
      kind: 'mcp/request',
      correlation_id: proposal.id,
      payload: {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      },
    };

    this.client.send(envelope);
  }

  private isSafeOperation(proposal: any): boolean {
    // Implement safety checks based on your requirements
    const method = proposal?.method?.toLowerCase() || '';

    // Only auto-approve read operations
    if (method.includes('list') || method.includes('read') || method.includes('browse')) {
      return true;
    }

    return false;
  }

  private log(level: string, ...args: any[]): void {
    const logLevel = this.config.logLevel || 'info';
    const levels = ['debug', 'info', 'warn', 'error'];

    if (levels.indexOf(level) >= levels.indexOf(logLevel)) {
      console.log(`[${level.toUpperCase()}] [${this.config.participant_id}]`, ...args);
    }
  }

  // Public methods for registering custom tools and resources
  public addTool(tool: Tool): void {
    this.registerTool(tool);
    this.log('info', `Registered tool: ${tool.name}`);
  }

  public addResource(resource: Resource): void {
    this.registerResource(resource);
    this.log('info', `Registered resource: ${resource.uri}`);
  }

  // Start the agent
  public async start(): Promise<void> {
    this.log('info', `Starting MEW Agent: ${this.config.participant_id}`);
    await this.connect();
  }

  // Stop the agent
  public stop(): void {
    this.log('info', `Stopping MEW Agent: ${this.config.participant_id}`);
    this.disconnect();
  }
}
