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

    // Initialize OpenAI if API key provided
    if (this.config.apiKey) {
      const openaiConfig: any = { apiKey: this.config.apiKey };
      if (this.config.baseURL) {
        openaiConfig.baseURL = this.config.baseURL;
      }
      this.openai = new OpenAI(openaiConfig);
    }

    this.setupAgentBehavior();
    
    // Enable auto-discovery for agents
    this.enableAutoDiscovery();
    
    // Set up participant join handler for tracking
    this.onParticipantJoin((participant) => {
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
   * Override onReady to log agent readiness
   */
  protected async onReady(): Promise<void> {
    // Tool discovery is handled by parent MEWParticipant with auto-discovery
    this.log('info', `Agent ready`);
    await super.onReady();
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
    if (!this.openai) {
      // No LLM available, use simple heuristics
      if (chatConfig.respondToQuestions && text.includes('?')) {
        this.log('debug', 'Responding to question (heuristic)');
        return true;
      }
      return false;
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
    if (!this.openai) {
      throw new Error('No OpenAI client available for classification');
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
      
      // Act phase
      if (thought.action === 'respond') {
        return thought.actionInput;
      }
      
      try {
        const observation = await this.act(thought.action, thought.actionInput);
        this.log('debug', `Observation: ${observation}`);
        
        // If we got a result from the tool, return it
        if (observation && thought.action === 'tool') {
          return observation;
        }
        
        // Add observation to context
        thoughts.push({
          reasoning: `Observation: ${observation}`,
          action: 'observe',
          actionInput: observation
        });
      } catch (error) {
        this.log('error', `Error in act phase: ${error}`);
        return `I encountered an error: ${error}`;
      }
    }
    
    return 'I exceeded the maximum number of reasoning iterations.';
  }

  /**
   * Reason phase (ReAct: Reason)
   */
  protected async reason(input: string, previousThoughts: Thought[]): Promise<Thought> {
    if (!this.openai) {
      // Fallback to simple pattern matching without LLM
      return this.reasonWithoutLLM(input, previousThoughts);
    }

    const tools = this.prepareLLMTools();
    
    // Build messages based on configured format
    let messages: any[];
    
    if (this.config.reasoningFormat === 'native') {
      // Native OpenAI format with proper tool call/result messages
      messages = this.buildNativeFormatMessages(input, previousThoughts);
    } else {
      // Scratchpad format (original implementation)
      messages = this.buildScratchpadFormatMessages(input, previousThoughts);
    }
    
    // Add conversation history if configured
    if (this.config.conversationHistoryLength && this.config.conversationHistoryLength > 0) {
      // Insert historical messages after system prompt but before current request
      const historyToInclude = this.conversationHistory.slice(-this.config.conversationHistoryLength);
      messages.splice(1, 0, ...historyToInclude);
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
   * Reason without LLM (fallback for no API key)
   */
  protected reasonWithoutLLM(input: string, _previousThoughts: Thought[]): Thought {
    const lowerInput = input.toLowerCase();
    
    // Get available tools from parent
    const allTools = this.getAvailableTools();
    
    // Debug: Check available tools
    this.log('info', `ReasonWithoutLLM - Tool count: ${allTools.length}`);
    if (allTools.length > 0) {
      this.log('info', `ReasonWithoutLLM - Available tools: ${allTools.map(t => `${t.participantId}/${t.name}`).join(', ')}`);
    }
    
    // Check for file operations (read, list, etc.)
    if (lowerInput.includes('read') || lowerInput.includes('show') || lowerInput.includes('see') || 
        lowerInput.includes('look at') || lowerInput.includes('view') || lowerInput.includes('check')) {
      // Look for file-related tools
      for (const tool of allTools) {
        if (tool.name.includes('read') || tool.name === 'read_file') {
          // Extract potential file path from input
          const pathMatch = input.match(/['"`]([^'"`]+)['"`]/) || input.match(/(\S+\.(txt|js|ts|json|md|yaml|yml))/i);
          if (pathMatch) {
            const filePath = pathMatch[1];
            return {
              reasoning: `The user wants to read file ${filePath}. I'll use the ${tool.name} tool from ${tool.participantId}.`,
              action: 'tool',
              actionInput: {
                tool: `${tool.participantId}/${tool.name}`,
                arguments: { path: filePath }
              }
            };
          }
        }
      }
    }
    
    // Check for list/directory operations
    if (lowerInput.includes('list') || lowerInput.includes('ls') || lowerInput.includes('dir') || 
        lowerInput.includes('files') || lowerInput.includes('directory')) {
      // Look for list-related tools
      for (const tool of allTools) {
        if (tool.name.includes('list') || tool.name === 'list_directory') {
          // Extract potential directory path from input
          const pathMatch = input.match(/['"`]([^'"`]+)['"`]/) || input.match(/in\s+(\S+)/);
          const dirPath = pathMatch ? pathMatch[1] : '.';
          return {
            reasoning: `The user wants to list files in ${dirPath}. I'll use the ${tool.name} tool from ${tool.participantId}.`,
            action: 'tool',
            actionInput: {
              tool: `${tool.participantId}/${tool.name}`,
              arguments: { path: dirPath }
            }
          };
        }
      }
    }
    
    // Check for simple arithmetic with discovered tools
    if (lowerInput.includes('calculate') || lowerInput.includes('add') || lowerInput.includes('plus') || lowerInput.includes('+')) {
      // Look for calculation tools
      for (const tool of allTools) {
        if (tool.name === 'add' || tool.name.includes('calc') || tool.name.includes('math')) {
          const numbers = input.match(/\d+/g);
          if (numbers && numbers.length >= 2) {
            const a = parseInt(numbers[0]);
            const b = parseInt(numbers[1]);
            return {
              reasoning: `The user wants to calculate ${a} + ${b}. I'll use the ${tool.name} tool from ${tool.participantId}.`,
              action: 'tool',
              actionInput: {
                tool: `${tool.participantId}/${tool.name}`,
                arguments: { a, b }
              }
            };
          }
        }
      }
      
      // Fallback: do calculation locally if no tools available
      const numbers = input.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const a = parseInt(numbers[0]);
        const b = parseInt(numbers[1]);
        const result = a + b;
        return {
          reasoning: `The user wants to calculate ${a} + ${b}. No calculation tools available, so I'll compute it directly.`,
          action: 'respond',
          actionInput: `The result of ${a} + ${b} is ${result}.`
        };
      }
    }
    
    // Check for greetings
    if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
      const toolList = allTools.length > 0 
        ? `I have access to the following tools: ${allTools.map(t => t.name).join(', ')}.` 
        : 'I\'m still discovering available tools.';
      return {
        reasoning: 'The user is greeting me.',
        action: 'respond',
        actionInput: `Hello! I'm the coder agent. ${toolList} What would you like me to help with?`
      };
    }
    
    // Default response with available tools
    if (allTools.length > 0) {
      const toolDescriptions = allTools
        .map(t => `${t.name} (from ${t.participantId})`)
        .join(', ');
      return {
        reasoning: 'I should inform the user about available tools.',
        action: 'respond',
        actionInput: `I have these tools available: ${toolDescriptions}. How can I help you use them?`
      };
    }
    
    // No tools discovered yet
    return {
      reasoning: 'I haven\'t discovered any tools yet.',
      action: 'respond',
      actionInput: 'I\'m still discovering available tools. Please wait a moment and try again.'
    };
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
      if (error instanceof Error && error.message.includes('proposal')) {
        return `I've proposed using the ${toolName} tool from ${participantId}, but it requires approval. The proposal has been sent and is waiting for a participant with appropriate capabilities to fulfill it.`;
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