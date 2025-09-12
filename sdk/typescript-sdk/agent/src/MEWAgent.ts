import { MEWParticipant, ParticipantOptions, Tool, Resource } from '@mew-protocol/participant';
import { Envelope } from '@mew-protocol/types';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

const PROTOCOL_VERSION = 'mew/v0.3';

export interface AgentConfig extends ParticipantOptions {
  name?: string;
  systemPrompt?: string;
  model?: string;
  apiKey?: string;
  reasoningEnabled?: boolean;  // Enable ReAct pattern (false for models with built-in reasoning)
  autoRespond?: boolean;
  maxIterations?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Overridable prompts for different phases (ReAct pattern)
  prompts?: {
    system?: string;    // Override the base system prompt
    reason?: string;    // Template for reasoning/planning phase (ReAct: Reason)
    act?: string;       // Template for tool selection and execution (ReAct: Act)
    respond?: string;   // Template for formatting final response
  };
}

interface Thought {
  reasoning: string;  // ReAct: reasoning step
  action: string;     // ReAct: action to take
  actionInput: any;   // ReAct: action parameters
}

interface DiscoveredTool {
  name: string;
  participantId: string;
  description?: string;
  schema?: any;
}

interface LLMTool {
  name: string;        // "participant/tool" - hierarchical namespace
  description: string; // Includes participant context
  parameters?: any;    // Tool schema
}

interface OtherParticipant {
  id: string;
  joinedAt: Date;
  capabilities?: any[];
}

export class MEWAgent extends MEWParticipant {
  private config: AgentConfig;
  private openai?: OpenAI;
  private discoveredTools = new Map<string, DiscoveredTool>();
  private otherParticipants = new Map<string, OtherParticipant>();
  private isRunning = false;
  private currentConversation: Array<{ role: string; content: string }> = [];

  constructor(config: AgentConfig) {
    super(config);
    this.config = {
      reasoningEnabled: true,
      autoRespond: true,
      maxIterations: 10,
      logLevel: 'info',
      model: 'gpt-4-turbo-preview',
      ...config
    };

    // Initialize OpenAI if API key provided
    if (this.config.apiKey) {
      this.openai = new OpenAI({ apiKey: this.config.apiKey });
    }

    this.setupAgentBehavior();
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    await this.connect();
    this.isRunning = true;
    this.log('info', 'Agent started');
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.isRunning = false;
    this.disconnect();
    this.log('info', 'Agent stopped');
  }

  /**
   * Add a tool (extends parent)
   */
  addTool(tool: Tool): void {
    this.registerTool(tool);
    // Also track as discovered tool for our own tools
    this.discoveredTools.set(tool.name, {
      name: tool.name,
      participantId: this.options.participant_id!,
      description: tool.description,
      schema: tool.inputSchema
    });
  }

  /**
   * Add a resource (extends parent)
   */
  addResource(resource: Resource): void {
    this.registerResource(resource);
  }

  /**
   * Set up agent behavior
   */
  private setupAgentBehavior(): void {
    // Handle system presence events for tool discovery
    this.onMessage(async (envelope: Envelope) => {
      if (envelope.kind === 'system/presence') {
        await this.handlePresence(envelope);
      }
      
      // Auto-respond to chat messages if enabled
      if (this.config.autoRespond && envelope.kind === 'chat' && 
          envelope.from !== this.options.participant_id) {
        await this.handleChat(envelope);
      }
      
      // Handle proposals that need our attention
      if (envelope.kind === 'mcp/proposal' && 
          envelope.from !== this.options.participant_id) {
        await this.handleProposal(envelope);
      }
    });
  }

  /**
   * Handle presence events (participant join/leave)
   */
  private async handlePresence(envelope: Envelope): Promise<void> {
    const { action, participant } = envelope.payload;
    
    if (action === 'join' && participant.id !== this.options.participant_id) {
      // Track new participant
      this.otherParticipants.set(participant.id, {
        id: participant.id,
        joinedAt: new Date(),
        capabilities: participant.capabilities
      });
      
      // Discover their tools
      await this.discoverToolsFrom(participant.id);
    } else if (action === 'leave') {
      // Remove participant and their tools
      this.otherParticipants.delete(participant.id);
      for (const [key, tool] of this.discoveredTools.entries()) {
        if (tool.participantId === participant.id) {
          this.discoveredTools.delete(key);
        }
      }
    }
  }

  /**
   * Discover tools from a participant
   */
  private async discoverToolsFrom(participantId: string): Promise<void> {
    try {
      const result = await this.mcpRequest([participantId], {
        method: 'tools/list'
      }, 5000);
      
      if (result?.tools) {
        for (const tool of result.tools) {
          const key = `${participantId}/${tool.name}`;
          this.discoveredTools.set(key, {
            name: tool.name,
            participantId,
            description: tool.description,
            schema: tool.inputSchema
          });
        }
        
        this.log('debug', `Discovered ${result.tools.length} tools from ${participantId}`);
      }
    } catch (error) {
      this.log('warn', `Failed to discover tools from ${participantId}: ${error}`);
    }
  }

  /**
   * Handle chat messages
   */
  private async handleChat(envelope: Envelope): Promise<void> {
    const { text } = envelope.payload;
    
    // Start reasoning if enabled
    if (this.config.reasoningEnabled) {
      this.emitReasoning('reasoning/start', { input: text });
      
      try {
        const response = await this.processWithReAct(text);
        await this.sendResponse(response, envelope.from);
      } catch (error) {
        this.log('error', `Failed to process chat: ${error}`);
        await this.sendResponse(
          `I encountered an error processing your request: ${error}`,
          envelope.from
        );
      }
      
      this.emitReasoning('reasoning/conclusion', {});
    } else {
      // Use model's built-in reasoning
      try {
        const response = await this.processDirectly(text);
        await this.sendResponse(response, envelope.from);
      } catch (error) {
        this.log('error', `Failed to process chat: ${error}`);
      }
    }
  }

  /**
   * Handle proposals
   */
  private async handleProposal(envelope: Envelope): Promise<void> {
    const proposal = envelope.payload;
    
    // Check if we can fulfill this proposal
    if (this.canSend({ kind: 'mcp/request', payload: proposal }) && 
        this.isSafeOperation(proposal)) {
      await this.fulfillProposal(envelope);
    }
  }

  /**
   * Process with ReAct pattern
   */
  private async processWithReAct(input: string): Promise<string> {
    const thoughts: Thought[] = [];
    let iterations = 0;
    
    while (iterations < this.config.maxIterations!) {
      iterations++;
      
      // Reason phase
      const thought = await this.reason(input, thoughts);
      thoughts.push(thought);
      
      this.emitReasoning('reasoning/thought', thought);
      
      // Act phase
      if (thought.action === 'respond') {
        return thought.actionInput;
      }
      
      const observation = await this.act(thought.action, thought.actionInput);
      
      // Add observation to context
      thoughts.push({
        reasoning: `Observation: ${observation}`,
        action: 'observe',
        actionInput: observation
      });
    }
    
    return 'I exceeded the maximum number of reasoning iterations.';
  }

  /**
   * Process directly (for reasoning models)
   */
  private async processDirectly(input: string): Promise<string> {
    if (!this.openai) {
      return 'I need an API key to process requests.';
    }

    const tools = this.prepareLLMTools();
    const systemPrompt = this.config.prompts?.system || this.config.systemPrompt || 
                        'You are a helpful assistant with access to tools.';

    const response = await this.openai.chat.completions.create({
      model: this.config.model!,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ],
      tools: tools.length > 0 ? this.convertToOpenAITools(tools) : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined
    });

    const message = response.choices[0].message;
    
    // Handle tool calls if any
    if (message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if ('function' in toolCall) {
          const result = await this.executeLLMToolCall(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );
          // Would normally add tool result to conversation and continue
        }
      }
    }
    
    return message.content || 'I could not generate a response.';
  }

  /**
   * Reason phase (ReAct: Reason)
   */
  protected async reason(input: string, previousThoughts: Thought[]): Promise<Thought> {
    if (!this.openai) {
      return {
        reasoning: 'No API key available',
        action: 'respond',
        actionInput: 'I need an API key to process requests.'
      };
    }

    const tools = this.prepareLLMTools();
    const reasonPrompt = this.config.prompts?.reason || 
      `Analyze this request: {input}\nAvailable tools: {tools}\nReason about your approach:`;

    const prompt = reasonPrompt
      .replace('{input}', input)
      .replace('{tools}', JSON.stringify(tools.map(t => t.name)));

    const response = await this.openai.chat.completions.create({
      model: this.config.model!,
      messages: [
        { role: 'system', content: 'You are reasoning about how to handle a request.' },
        { role: 'user', content: prompt }
      ]
    });

    // Parse reasoning into thought structure
    const content = response.choices[0].message.content || '';
    
    // Simple parsing - in real implementation would be more sophisticated
    return {
      reasoning: content,
      action: 'respond',
      actionInput: content
    };
  }

  /**
   * Act phase (ReAct: Act)
   */
  protected async act(action: string, input: any): Promise<string> {
    if (action === 'tool') {
      const result = await this.executeLLMToolCall(input.tool, input.arguments);
      return JSON.stringify(result);
    }
    
    return 'Action completed';
  }

  /**
   * Prepare tools for LLM (per ADR-mpt)
   */
  protected prepareLLMTools(): LLMTool[] {
    return Array.from(this.discoveredTools.values()).map(tool => ({
      name: `${tool.participantId}/${tool.name}`,
      description: tool.description || `${tool.name} from ${tool.participantId}`,
      parameters: tool.schema
    }));
  }

  /**
   * Execute LLM tool call (per ADR-tns)
   */
  protected async executeLLMToolCall(namespacedTool: string, args: any): Promise<any> {
    const [participantId, toolName] = namespacedTool.split('/');
    
    // Check if we can send tools/call
    if (this.canSend({ kind: 'mcp/request', payload: { method: 'tools/call' } })) {
      // Direct call
      return await this.mcpRequest([participantId], {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });
    } else if (this.canSend({ kind: 'mcp/proposal', payload: { method: 'tools/call' } })) {
      // Create proposal
      const proposalId = uuidv4();
      
      const proposal: Envelope = {
        protocol: PROTOCOL_VERSION,
        id: proposalId,
        ts: new Date().toISOString(),
        from: this.options.participant_id!,
        kind: 'mcp/proposal',
        payload: {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        }
      };
      
      this.send(proposal);
      
      // Wait for fulfillment
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Proposal not fulfilled'));
        }, 30000);
        
        const handler = (envelope: Envelope) => {
          if (envelope.kind === 'mcp/response' && 
              envelope.correlation_id?.includes(proposalId)) {
            clearTimeout(timeout);
            this.removeListener('message', handler);
            resolve(envelope.payload.result);
          }
        };
        
        this.on('message', handler);
      });
    }
    
    throw new Error(`Cannot call tool ${namespacedTool}: no capability`);
  }

  /**
   * Convert to OpenAI tool format
   */
  private convertToOpenAITools(tools: LLMTool[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name.replace('/', '_'), // OpenAI doesn't like slashes
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} }
      }
    }));
  }

  /**
   * Send response
   */
  private async sendResponse(text: string, to: string): Promise<void> {
    this.chat(text, to);
  }

  /**
   * Check if operation is safe
   */
  private isSafeOperation(proposal: any): boolean {
    // Implement safety checks
    const { method } = proposal;
    
    // Only auto-approve read operations
    const safeOperations = ['tools/list', 'resources/list', 'resources/read'];
    return safeOperations.includes(method);
  }

  /**
   * Fulfill a proposal
   */
  private async fulfillProposal(envelope: Envelope): Promise<void> {
    const { method, params } = envelope.payload;
    
    try {
      // Find target that can handle this
      // For now, just try first available participant with the tool
      const targetId = Array.from(this.otherParticipants.keys())[0];
      
      if (targetId) {
        const result = await this.mcpRequest([targetId], {
          method,
          params
        });
        
        // Send response with correlation to proposal
        const response: Envelope = {
          protocol: PROTOCOL_VERSION,
          id: uuidv4(),
          ts: new Date().toISOString(),
          from: this.options.participant_id!,
          to: [envelope.from],
          correlation_id: [envelope.id],
          kind: 'mcp/response',
          payload: { result }
        };
        
        this.send(response);
      }
    } catch (error) {
      this.log('error', `Failed to fulfill proposal: ${error}`);
    }
  }

  /**
   * Logging helper
   */
  private log(level: string, message: string): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel || 'info');
    const msgLevel = levels.indexOf(level);
    
    if (msgLevel >= configLevel) {
      console.log(`[${level.toUpperCase()}] [${this.config.name || 'MEWAgent'}] ${message}`);
    }
  }

  /**
   * Emit reasoning events
   */
  private emitReasoning(event: string, data: any): void {
    const envelope: Partial<Envelope> = {
      kind: event as any,
      payload: data
    };
    
    if (this.canSend(envelope)) {
      this.send(envelope);
    }
  }
}