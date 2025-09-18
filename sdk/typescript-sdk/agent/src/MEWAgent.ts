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
  baseURL?: string;  // Custom OpenAI API base URL (for alternative providers)
  reasoningEnabled?: boolean;  // Emit reasoning events (reasoning/start, reasoning/thought, reasoning/conclusion)
  autoRespond?: boolean;
  maxIterations?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  reasoningFormat?: 'native' | 'scratchpad';  // How to format previous thoughts for LLM (default: 'native')
  conversationHistoryLength?: number;  // Number of previous messages to include in context (default: 0 = only current)
  
  // Chat response configuration
  chatResponse?: {
    respondToQuestions?: boolean;    // Respond to questions (default: true)
    respondToMentions?: boolean;     // Respond when mentioned (default: true)
    respondToDirect?: boolean;       // Respond to direct messages (default: true)
    confidenceThreshold?: number;    // Min confidence to respond (0-1, default: 0.5)
    contextWindow?: number;          // Messages to consider for context (default: 10)
  };
  
  // Overridable prompts for different phases (ReAct pattern)
  prompts?: {
    system?: string;    // Override the base system prompt
    reason?: string;    // Template for reasoning/planning phase (ReAct: Reason)
    act?: string;       // Template for tool selection and execution (ReAct: Act)
    respond?: string;   // Template for formatting final response
    classify?: string;  // Template for chat classification
  };
}

interface Thought {
  reasoning: string;  // ReAct: reasoning step
  action: string;     // ReAct: action to take
  actionInput: any;   // ReAct: action parameters
  observation?: string; // ReAct: observation from action execution
}

// DiscoveredTool interface now comes from MEWParticipant

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
  private otherParticipants = new Map<string, OtherParticipant>();
  private isRunning = false;
  private currentConversation: Array<{ role: string; content: string }> = [];
  private conversationHistory: any[] = [];  // Full conversation history for context

  constructor(config: AgentConfig) {
    super(config);
    this.config = {
      reasoningEnabled: true,
      autoRespond: true,
      maxIterations: 10,
      logLevel: 'debug',
      model: 'gpt-4o',
      reasoningFormat: 'native',
      conversationHistoryLength: 0,
      ...config
    };

    // LOUDLY FAIL if no API key provided
    if (!this.config.apiKey) {
      console.error('');
      console.error('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
      console.error('❌ FATAL ERROR: OPENAI_API_KEY is not configured! ❌');
      console.error('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
      console.error('');
      console.error('MEWAgent requires an OpenAI API key to function.');
      console.error('');
      console.error('Please provide the API key using one of these methods:');
      console.error('  1. Pass it in the config: new MEWAgent({ apiKey: "sk-..." })');
      console.error('  2. Set the OPENAI_API_KEY environment variable');
      console.error('  3. Include it in your configuration file');
      console.error('');
      console.error('Get your API key from: https://platform.openai.com/api-keys');
      console.error('');
      console.error('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');

      // Exit the process with error code
      process.exit(1);
    }

    // Initialize OpenAI with the API key
    const openaiConfig: any = { apiKey: this.config.apiKey };
    if (this.config.baseURL) {
      openaiConfig.baseURL = this.config.baseURL;
    }
    this.openai = new OpenAI(openaiConfig);

    this.setupAgentBehavior();
    
    // Enable auto-discovery for agents
    this.enableAutoDiscovery();
    
    // Set up participant join handler for tracking
    this.onParticipantJoin((participant) => {
    this.onStreamReady((envelope) => {
      const stream = envelope.payload?.stream;
      if (stream) {
        this.log('info', `📡 Stream ready: ${stream.namespace || stream.stream_id} (creator: ${stream.creator})`);
      }
    });

    this.onStreamData((envelope) => {
      const stream = envelope.payload?.stream;
      const seq = envelope.payload?.sequence;
      if (stream) {
        this.log('debug', `🔄 stream/data ${stream.stream_id} seq=${typeof seq === 'number' ? seq : '?'} from ${envelope.from}`);
      }
    });

    this.onStreamComplete((envelope) => {
      const stream = envelope.payload?.stream;
      if (stream) {
        this.log('info', `✅ Stream completed: ${stream.namespace || stream.stream_id}`);
      }
    });

    this.onStreamError((envelope) => {
      const stream = envelope.payload?.stream;
      const code = envelope.payload?.code;
      const message = envelope.payload?.message;
      if (stream) {
        this.log('warn', `⚠️ Stream error (${code || 'unknown'}): ${message || 'no message'} [${stream.namespace || stream.stream_id}]`);
      }
    });

      if (participant.id !== this.options.participant_id) {
        this.log('info', `New participant joined: ${participant.id}`);
        this.otherParticipants.set(participant.id, {
          id: participant.id,
          joinedAt: new Date(),
          capabilities: participant.capabilities
        });
      }
    });
  }
  
  /**
   * Override discoverTools to announce what we find
   */
  async discoverTools(participantId: string): Promise<any> {
    this.log('info', `🔍 Discovering tools from participant: ${participantId}...`);

    try {
      const tools = await super.discoverTools(participantId);

      if (tools && tools.length > 0) {
        this.log('info', `✅ Discovered ${tools.length} tool(s) from ${participantId}:`);
        for (const tool of tools) {
          this.log('info', `   - ${tool.name}${tool.description ? `: ${tool.description}` : ''}`);
        }
      } else {
        this.log('warn', `⚠️ No tools discovered from ${participantId} (participant may not have any tools or may not support tools/list)`);
      }

      return tools;
    } catch (error) {
      this.log('error', `❌ Failed to discover tools from ${participantId}: ${error}`);
      return [];
    }
  }

  /**
   * Override onReady to log agent readiness and announce available tools
   */
  protected async onReady(): Promise<void> {
    // Tool discovery is handled by parent MEWParticipant with auto-discovery
    this.log('info', `Agent ready`);
    await super.onReady();

    // Announce total available tools after initial discovery
    setTimeout(() => {
      const allTools = this.getAvailableTools();
      if (allTools.length > 0) {
        this.log('info', `📦 Total tools available: ${allTools.length}`);
        const byParticipant = new Map<string, string[]>();
        for (const tool of allTools) {
          if (!byParticipant.has(tool.participantId)) {
            byParticipant.set(tool.participantId, []);
          }
          byParticipant.get(tool.participantId)!.push(tool.name);
        }
        for (const [participant, tools] of byParticipant) {
          this.log('info', `   ${participant}: ${tools.join(', ')}`);
        }
      } else {
        this.log('warn', `⚠️ No tools available yet. Waiting for other participants to join...`);
      }
    }, 2000); // Wait a bit for initial discovery to complete
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
    // Handle messages for agent behavior
    this.onMessage(async (envelope: Envelope) => {
      // Only log presence and welcome for debugging
      if (envelope.kind === 'system/presence' || envelope.kind === 'system/welcome') {
        this.log('debug', `Received ${envelope.kind} from: ${envelope.from}`);
      }
      
      // Track presence for other participants
      if (envelope.kind === 'system/presence') {
        const { event, participant } = envelope.payload;
        if (event === 'leave') {
          this.otherParticipants.delete(participant.id);
        }
      }
      
      // Handle chat messages (autoRespond check is inside handleChat)
      if (envelope.kind === 'chat' && 
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
   * Handle chat messages
   */
  private async handleChat(envelope: Envelope): Promise<void> {
    const { text } = envelope.payload;
    
    // Track conversation history
    this.conversationHistory.push({
      role: 'user',
      content: text,
      name: envelope.from  // Track who sent the message
    });
    
    // Check if we should respond to this message
    const shouldRespond = await this.shouldRespondToChat(envelope);
    
    if (!shouldRespond) {
      this.log('debug', `Skipping response to chat from ${envelope.from}: did not meet response criteria`);
      return;
    }
    
    // Start reasoning if enabled
    if (this.config.reasoningEnabled) {
      this.emitReasoning('reasoning/start', { input: text });
      
      try {
        const response = await this.processWithReAct(text);
        this.log('info', `Processed response: ${response}`);
        await this.sendResponse(response, envelope.from);
        this.log('info', `Sent response to ${envelope.from}`);
      } catch (error) {
        this.log('error', `Failed to process chat: ${error}`);
        await this.sendResponse(
          `I encountered an error processing your request: ${error}`,
          envelope.from
        );
      }
      
      this.emitReasoning('reasoning/conclusion', {});
    }
  }
  
  /**
   * Determine if agent should respond to a chat message
   */
  private async shouldRespondToChat(envelope: Envelope): Promise<boolean> {
    // First check if autoRespond is enabled
    if (!this.config.autoRespond) {
      return false;
    }
    
    const chatConfig = {
      respondToQuestions: true,
      respondToMentions: true,
      respondToDirect: true,
      confidenceThreshold: 0.5,
      contextWindow: 10,
      ...this.config.chatResponse
    };
    
    // Priority 1: Check if directly addressed
    if (chatConfig.respondToDirect && envelope.to?.includes(this.options.participant_id!)) {
      this.log('debug', 'Responding to directly addressed message');
      return true;
    }
    
    // Priority 2: Check if mentioned by name/ID
    const { text } = envelope.payload;
    const myId = this.options.participant_id!;
    const myName = this.config.name || myId;
    
    if (chatConfig.respondToMentions) {
      const mentionPatterns = [
        new RegExp(`@${myId}\\b`, 'i'),
        new RegExp(`@${myName}\\b`, 'i'),
        new RegExp(`\\b${myId}\\b`, 'i'),
        new RegExp(`\\b${myName}\\b`, 'i')
      ];
      
      if (mentionPatterns.some(pattern => pattern.test(text))) {
        this.log('debug', 'Responding to message with mention');
        return true;
      }
    }
    
    // Priority 3: Use LLM classification for relevance
    // We now guarantee OpenAI is initialized in constructor
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - this should never happen!');
    }
    
    // Perform LLM classification
    try {
      const classification = await this.classifyChat(text);
      
      if (classification.shouldRespond && classification.confidence >= chatConfig.confidenceThreshold) {
        this.log('debug', `Responding based on LLM classification (confidence: ${classification.confidence}, reason: ${classification.reason})`);
        return true;
      }
      
      this.log('debug', `Not responding based on LLM classification (confidence: ${classification.confidence}, reason: ${classification.reason})`);
      return false;
    } catch (error) {
      this.log('warn', `Failed to classify chat message: ${error}`);
      // Fall back to simple heuristics
      if (chatConfig.respondToQuestions && text.includes('?')) {
        return true;
      }
      return false;
    }
  }
  
  /**
   * Use LLM to classify whether to respond to a chat message
   */
  private async classifyChat(text: string): Promise<{shouldRespond: boolean; confidence: number; reason: string}> {
    // We now guarantee OpenAI is initialized in constructor
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - this should never happen!');
    }
    
    const allTools = this.getAvailableTools();
    const tools = allTools.map(t => `${t.participantId}/${t.name}`);
    
    const classificationPrompt = this.config.prompts?.classify || `
You are an AI agent with the following tools: ${JSON.stringify(tools)}

A message was sent in the conversation: "${text}"

Should you respond to this message?
Consider:
1. Is this a question you can answer?
2. Does it relate to your tools or capabilities?
3. Can you provide unique value by responding?

Return a JSON object:
{
  "shouldRespond": boolean,
  "confidence": number (0-1),
  "reason": string
}`;
    
    const response = await this.openai.chat.completions.create({
      model: this.config.model!,
      messages: [
        { role: 'system', content: 'You are a classification system. Return only valid JSON.' },
        { role: 'user', content: classificationPrompt }
      ],
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
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
      this.log('debug', `ReAct iteration ${iterations}/${this.config.maxIterations}`);
      
      // Reason phase
      const thought = await this.reason(input, thoughts);
      
      // Generate tool call ID if not provided (for non-native format)
      if (thought.action === 'tool' && !thought.actionInput?.toolCallId) {
        thought.actionInput.toolCallId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      
      thoughts.push(thought);
      
      this.log('debug', `Thought action: ${thought.action}, reasoning: ${thought.reasoning}`);
      this.emitReasoning('reasoning/thought', thought);
      
      // Track reasoning in conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: `[Reasoning] ${thought.reasoning}`,
        metadata: { type: 'reasoning', thought }
      });
      
      // Act phase
      if (thought.action === 'respond') {
        return thought.actionInput;
      }
      
      // Track tool call in conversation history
      if (thought.action === 'tool') {
        this.conversationHistory.push({
          role: 'assistant',
          content: `[Tool Call] ${thought.actionInput.tool}: ${JSON.stringify(thought.actionInput.arguments)}`,
          metadata: { type: 'tool_call', tool: thought.actionInput.tool, arguments: thought.actionInput.arguments }
        });
      }
      
      try {
        const observation = await this.act(thought.action, thought.actionInput);
        this.log('debug', `Observation: ${observation}`);
        
        // Store the observation for the next iteration
        thought.observation = observation;
        
        // Track observation in conversation history
        this.conversationHistory.push({
          role: 'system',
          content: `[Observation] ${observation}`,
          metadata: { type: 'observation' }
        });
        
        // Don't immediately return on tool results - let the LLM decide if more work is needed
        // The LLM will analyze the observation and decide whether to:
        // 1. Continue with more tool calls
        // 2. Respond with the final answer
        // This allows for multi-step workflows
      } catch (error) {
        this.log('error', `Error in act phase: ${error}`);
        
        // Store error as observation so the LLM can decide how to handle it
        thought.observation = `Error: ${error}`;
        
        // Track error in conversation history
        this.conversationHistory.push({
          role: 'system',
          content: `[Error] ${error}`,
          metadata: { type: 'error' }
        });
        
        // Continue the loop - let the LLM decide if it can recover or needs to respond with error
      }
    }
    
    return 'I exceeded the maximum number of reasoning iterations.';
  }

  /**
   * Reason phase (ReAct: Reason)
   */
  protected async reason(input: string, previousThoughts: Thought[]): Promise<Thought> {
    // We now guarantee OpenAI is initialized in constructor
    if (!this.openai) {
      throw new Error('OpenAI client not initialized - this should never happen!');
    }

    // Check if there are pending discoveries and wait for them if this is the first reasoning iteration
    if (previousThoughts.length === 0 && this.hasDiscoveriesInProgress()) {
      this.log('info', '⏳ Waiting for tool discoveries to complete before reasoning...');
      await this.waitForPendingDiscoveries(5000); // Wait up to 5 seconds for discoveries

      // After waiting, check if we got any new tools
      const afterWaitTools = this.getAvailableTools();
      if (afterWaitTools.length > 0) {
        this.log('info', `✅ Tool discovery completed. ${afterWaitTools.length} tools now available.`);
      }
    }

    const tools = this.prepareLLMTools();

    // LOUDLY warn if no tools are available
    if (tools.length === 0) {
      console.error('');
      console.error('🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧');
      console.error('⚠️  WARNING: NO TOOLS AVAILABLE FOR REASONING! ⚠️');
      console.error('🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧');
      console.error('');
      console.error('The agent is attempting to process a request but has NO TOOLS to work with!');
      console.error('');
      console.error('Possible causes:');
      console.error('  1. No other participants with tools have joined the space yet');
      console.error('  2. Tool discovery failed or is still in progress');
      console.error('  3. Other participants are not sharing their tools (no tools/list support)');
      console.error('');
      console.error('The agent can only respond with text and cannot perform any actions.');
      console.error('Waiting for tool-providing participants to join the workspace...');
      console.error('');
      console.error('🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧🔧');
      console.error('');

      this.log('warn', '⚠️ No tools available for reasoning! The agent may have limited capabilities.');
      this.log('warn', '   Waiting for other participants to join and share their tools...');
    }

    // Build messages based on configured format
    let messages: any[];
    
    if (this.config.reasoningFormat === 'native') {
      // Native OpenAI format with proper tool call/result messages
      messages = this.buildNativeFormatMessages(input, previousThoughts);
    } else {
      // Scratchpad format (original implementation)
      messages = this.buildScratchpadFormatMessages(input, previousThoughts);
    }
    
    // Add guidance about proposal timeouts if we've encountered them
    const hasProposalTimeout = previousThoughts.some(t => 
      t.observation && t.observation.includes('PROPOSAL_TIMEOUT')
    );
    
    if (hasProposalTimeout) {
      const guidanceMessage = {
        role: 'system',
        content: 'Important: Some tool calls require approval (proposals). When you see PROPOSAL_TIMEOUT, it means the operation needs human approval. You should either: 1) Try a different approach that doesn\'t require that tool, 2) Explain to the user what you need approval for and what it will do, or 3) If you\'ve already tried multiple approaches, provide a clear explanation of what you were trying to accomplish and what approvals are needed.'
      };
      messages.splice(1, 0, guidanceMessage); // Insert after system prompt
    }
    
    // Add conversation history if configured
    if (this.config.conversationHistoryLength && this.config.conversationHistoryLength > 0) {
      // Insert historical messages after system prompt but before current request
      const historyToInclude = this.conversationHistory.slice(-this.config.conversationHistoryLength);
      messages.splice(1, 0, ...historyToInclude);
    }
    
    // Add warning to system prompt if no tools available
    if (tools.length === 0 && messages.length > 0 && messages[0].role === 'system') {
      messages[0].content += '\n\nIMPORTANT: No tools are currently available. You can only respond with text. If the user asks you to perform actions that would require tools, explain that you are waiting for tool-providing participants to join the workspace and cannot perform the requested action yet.';
    }

    // Use function calling to let the model decide whether to use tools
    const response = await this.openai.chat.completions.create({
      model: this.config.model!,
      messages,
      tools: tools.length > 0 ? this.convertToOpenAITools(tools) : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined
    });

    const message = response.choices[0].message;
    
    // Check if the model wants to use a tool
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0] as any;
      // Convert back from OpenAI format: replace underscore separator with slash
      // Note: Participant IDs must not contain underscores for this to work correctly
      const toolName = toolCall.function.name.replace('_', '/'); // e.g., 'weather-service_get_weather' -> 'weather-service/get_weather'
      const args = JSON.parse(toolCall.function.arguments);
      
      return {
        reasoning: message.content || `Using tool ${toolName}`,
        action: 'tool',
        actionInput: {
          tool: toolName,
          arguments: args,
          toolCallId: toolCall.id  // Store for native format
        }
      };
    }
    
    // No tool needed, just respond
    return {
      reasoning: message.content || 'Responding directly',
      action: 'respond',
      actionInput: message.content || 'I can help with that.'
    };
  }

  /**
   * Build messages in native OpenAI format with tool calls and results
   */
  private buildNativeFormatMessages(input: string, previousThoughts: Thought[]): any[] {
    const messages: any[] = [
      { 
        role: 'system', 
        content: this.config.systemPrompt || 'You are a helpful assistant. When asked to perform calculations or tasks, use the available tools. Only respond directly if no tool is needed.' 
      }
    ];
    
    // Add the original user request
    messages.push({ role: 'user', content: input });
    
    // Add previous thoughts as proper assistant/tool messages
    for (const thought of previousThoughts) {
      if (thought.action === 'tool' && thought.actionInput?.toolCallId) {
        // Assistant message with tool call
        messages.push({
          role: 'assistant',
          content: thought.reasoning || null,
          tool_calls: [{
            id: thought.actionInput.toolCallId,
            type: 'function',
            function: {
              name: thought.actionInput.tool.replace('/', '_'),
              arguments: JSON.stringify(thought.actionInput.arguments)
            }
          }]
        });
        
        // Tool result message
        if (thought.observation) {
          messages.push({
            role: 'tool',
            tool_call_id: thought.actionInput.toolCallId,
            content: thought.observation
          });
        }
      } else if (thought.action === 'respond') {
        // Regular assistant response
        messages.push({
          role: 'assistant',
          content: thought.reasoning
        });
      }
    }
    
    return messages;
  }

  /**
   * Build messages in scratchpad format (original implementation)
   */
  private buildScratchpadFormatMessages(input: string, previousThoughts: Thought[]): any[] {
    const messages: any[] = [
      { 
        role: 'system', 
        content: this.config.systemPrompt || 'You are a helpful assistant. When asked to perform calculations or tasks, use the available tools. Only respond directly if no tool is needed.' 
      }
    ];
    
    // Add the original user request
    messages.push({ role: 'user', content: input });
    
    // Add previous thoughts and observations to maintain context
    if (previousThoughts.length > 0) {
      // Build context from previous iterations
      let context = "Previous actions and observations:\n";
      for (const thought of previousThoughts) {
        context += `\nReasoning: ${thought.reasoning}\n`;
        context += `Action: ${thought.action}\n`;
        if (thought.action === 'tool' && thought.actionInput?.tool) {
          context += `Tool used: ${thought.actionInput.tool}\n`;
        }
        if (thought.observation) {
          context += `Observation: ${thought.observation}\n`;
        }
      }
      context += "\nBased on the above context, continue processing the user's request.";
      
      messages.push({ role: 'assistant', content: context });
      messages.push({ role: 'user', content: "Continue with the next step, or provide the final response if all tasks are complete." });
    }
    
    return messages;
  }

  
  /**
   * Act phase (ReAct: Act)
   */
  protected async act(action: string, input: any): Promise<string> {
    if (action === 'tool') {
      const result = await this.executeLLMToolCall(input.tool, input.arguments);
      
      // Format the result as a string response
      if (typeof result === 'object' && result.content) {
        // MCP response format
        if (Array.isArray(result.content)) {
          return result.content.map((c: any) => c.text || '').join('\n');
        }
        return result.content;
      } else if (typeof result === 'string') {
        return result;
      } else {
        return JSON.stringify(result);
      }
    }
    
    return 'Action completed';
  }

  /**
   * Prepare tools for LLM (per ADR-mpt)
   */
  protected prepareLLMTools(): LLMTool[] {
    const tools: LLMTool[] = [];
    const allTools = this.getAvailableTools();
    
    // Format all tools for LLM consumption
    for (const tool of allTools) {
      tools.push({
        name: `${tool.participantId}/${tool.name}`,
        description: tool.description || `${tool.name} from ${tool.participantId}`,
        parameters: tool.inputSchema
      });
    }
    
    return tools;
  }

  /**
   * Execute LLM tool call (per ADR-tns)
   */
  protected async executeLLMToolCall(namespacedTool: string, args: any): Promise<any> {
    const [participantId, toolName] = namespacedTool.split('/');

    // Check if we have any tools at all
    const allTools = this.getAvailableTools();
    if (allTools.length === 0) {
      console.error('');
      console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
      console.error('❌ ERROR: ATTEMPTING TO EXECUTE TOOL BUT NONE AVAILABLE! ❌');
      console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
      console.error('');
      console.error(`Tried to execute: ${namespacedTool}`);
      console.error(`With arguments: ${JSON.stringify(args)}`);
      console.error('');
      console.error('But there are NO TOOLS available in the workspace!');
      console.error('Other participants need to join and share their tools first.');
      console.error('');
      console.error('❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌');
      console.error('');

      throw new Error(`Cannot execute tool ${namespacedTool}: No tools available in workspace`);
    }

    // Check if this is our own tool
    if (participantId === this.options.participant_id) {
      // Execute our own tool directly
      const tool = this.tools.get(toolName);
      if (tool && tool.execute) {
        const result = await tool.execute(args);
        return result;
      } else {
        throw new Error(`Tool ${toolName} not found`);
      }
    }
    
    // For remote tools, use mcpRequest which handles capability routing automatically
    // It will use direct request if we have mcp/request capability for tools/call,
    // or create a proposal if we only have mcp/proposal capability
    try {
      this.log('debug', `Calling tool ${toolName} on ${participantId} with args: ${JSON.stringify(args)}`);
      
      const result = await this.mcpRequest([participantId], {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      }, 30000); // 30 second timeout for proposals
      
      this.log('debug', `Tool call result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.log('error', `Failed to execute tool ${namespacedTool}: ${error}`);
      
      // If it's a proposal that wasn't fulfilled, provide helpful feedback
      if (error instanceof Error && error.message.includes('Proposal') && error.message.includes('not fulfilled')) {
        return `PROPOSAL_TIMEOUT: I proposed using the ${toolName} tool, but it requires human approval. The proposal is waiting for fulfillment. I should try a different approach or explain what I need approval for.`;
      }
      
      throw error;
    }
  }

  /**
   * Convert to OpenAI tool format
   */
  private convertToOpenAITools(tools: LLMTool[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        // Replace slash with underscore for OpenAI compatibility (slashes not allowed)
        // Note: Participant IDs must not contain underscores for this to work correctly
        name: tool.name.replace('/', '_'), // e.g., 'weather-service/get_weather' -> 'weather-service_get_weather'
        description: tool.description,
        parameters: tool.parameters || { type: 'object', properties: {} }
      }
    }));
  }

  /**
   * Send response
   */
  private async sendResponse(text: string, to: string): Promise<void> {
    this.log('info', `Attempting to send chat response to ${to}: ${text}`);
    try {
      this.chat(text, to);
      
      // Track assistant's response in conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: text
      });
      
      this.log('info', `Chat message sent successfully to ${to}`);
    } catch (error) {
      this.log('error', `Failed to send chat to ${to}: ${error}`);
      throw error; // Re-throw to ensure we know about failures
    }
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
   * Logging helper - override parent to add agent-specific formatting
   */
  protected log(level: string, message: string): void {
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