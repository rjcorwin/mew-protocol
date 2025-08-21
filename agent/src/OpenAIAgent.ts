import OpenAI from 'openai';
import { MCPxAgentClient, ChatMessage, Peer, Tool, ToolCallRequest } from '@mcpx/agent-client';
import Debug from 'debug';

const debug = Debug('mcpx:openai-agent');

export interface OpenAIAgentConfig {
  // Connection
  serverUrl: string;
  topic: string;
  participantId: string;
  participantName?: string;
  authToken: string;
  
  // OpenAI
  openaiApiKey: string;
  model?: string; // Default: gpt-4-turbo-preview, ready for gpt-5
  maxTokens?: number;
  temperature?: number;
  
  // Behavior
  systemPrompt?: string;
  respondToAllMessages?: boolean;
  responsePrefix?: string; // Optional prefix like "@username"
  
  // Tool calling
  enableToolCalls?: boolean;
  toolCallConfirmation?: boolean; // Ask before calling tools
  maxToolCalls?: number; // Prevent infinite loops
}

export class OpenAIAgent {
  private client: MCPxAgentClient;
  private openai: OpenAI;
  private config: OpenAIAgentConfig;
  private running = false;
  private conversationHistory: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  private availableTools: Map<string, OpenAI.Chat.ChatCompletionTool> = new Map();
  
  constructor(config: OpenAIAgentConfig) {
    this.config = {
      model: 'gpt-4-turbo-preview', // Will work for gpt-5 when available
      maxTokens: 1000,
      temperature: 0.7,
      enableToolCalls: true,
      toolCallConfirmation: false,
      maxToolCalls: 10,
      respondToAllMessages: true,
      ...config
    };
    
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey
    });
    
    this.client = new MCPxAgentClient({
      serverUrl: config.serverUrl,
      topic: config.topic,
      participantId: config.participantId,
      participantName: config.participantName,
      authToken: config.authToken
    });
    
    this.setupSystemPrompt();
    this.setupHandlers();
  }
  
  private setupSystemPrompt(): void {
    const defaultPrompt = `You are an intelligent agent participating in an MCPx topic called "${this.config.topic}".

Your role:
- You can see all messages in the topic
- You can call tools provided by other participants (peers)
- You should be helpful and respond naturally to questions and requests
- When users ask you to do something, analyze what tools you need and call them

Current context:
- Your ID: ${this.config.participantId}
- Your name: ${this.config.participantName || this.config.participantId}
- Topic: ${this.config.topic}

Guidelines:
- Be conversational and helpful
- When calling tools, explain what you're doing
- If a tool call fails, explain the error and suggest alternatives
- Keep responses concise but informative
- You can see tools from all peers - choose the right peer for each tool`;

    // Clear conversation history and add system prompt
    this.conversationHistory = [];
    this.conversationHistory.push({
      role: 'system',
      content: this.config.systemPrompt || defaultPrompt
    });
  }
  
  private setupHandlers(): void {
    // Handle chat messages with AI
    this.client.on('chat', async (message: ChatMessage) => {
      debug(`Chat from ${message.from}: ${message.text}`);
      
      // Skip our own messages
      if (message.from === this.config.participantId) return;
      
      // Check if we should respond
      const shouldRespond = this.shouldRespond(message);
      if (!shouldRespond) return;
      
      try {
        await this.processMessageWithAI(message);
      } catch (error) {
        console.error('Error processing message with AI:', error);
        this.client.sendChat(`Sorry, I encountered an error: ${error}`);
      }
    });
    
    // Update tools when peers join/update
    this.client.on('peerJoined', async (peer: Peer) => {
      debug(`Peer joined: ${peer.id}`);
      await this.updateAvailableTools();
      
      if (this.config.respondToAllMessages) {
        this.client.sendChat(`Welcome ${peer.name || peer.id}! I can help you use available tools.`);
      }
    });
    
    this.client.on('peerUpdated', async (peer: Peer) => {
      debug(`Peer updated: ${peer.id}`);
      await this.updateAvailableTools();
    });
    
    // Handle tool calls to our agent
    this.client.on('toolCall', async (request: ToolCallRequest) => {
      debug(`Tool call: ${request.tool} from ${request.from}`);
      
      // We can add local tools here if needed
      throw new Error(`Tool ${request.tool} not implemented`);
    });
    
    // Connection events
    this.client.on('connected', () => {
      console.log(`🤖 OpenAI Agent "${this.config.participantId}" connected`);
    });
    
    this.client.on('error', (error: Error) => {
      console.error('Agent error:', error);
    });
  }
  
  private shouldRespond(message: ChatMessage): boolean {
    if (!this.config.respondToAllMessages) {
      // Only respond if mentioned
      const mentions = [
        this.config.participantId,
        this.config.participantName,
        '@' + this.config.participantId,
        '@' + this.config.participantName
      ].filter(Boolean);
      
      return mentions.some(mention => 
        message.text.toLowerCase().includes(mention!.toLowerCase())
      );
    }
    
    return true;
  }
  
  private async processMessageWithAI(message: ChatMessage): Promise<void> {
    // Add message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: `[${message.from}]: ${message.text}`
    });
    
    // Keep conversation history manageable
    if (this.conversationHistory.length > 50) {
      // Keep system prompt and last 40 messages
      this.conversationHistory = [
        this.conversationHistory[0], // system prompt
        ...this.conversationHistory.slice(-40)
      ];
    }
    
    // Get available tools for function calling
    const tools = this.config.enableToolCalls ? Array.from(this.availableTools.values()) : [];
    
    debug(`Calling OpenAI with ${tools.length} tools available`);
    
    const completion = await this.openai.chat.completions.create({
      model: this.config.model!,
      messages: this.conversationHistory,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    });
    
    const choice = completion.choices[0];
    if (!choice.message) return;
    
    // Handle tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      await this.handleToolCalls(choice.message.tool_calls, message);
    }
    
    // Handle text response
    if (choice.message.content) {
      let response = choice.message.content;
      
      // Add optional prefix
      if (this.config.responsePrefix) {
        response = `${this.config.responsePrefix} ${response}`;
      }
      
      this.client.sendChat(response);
      
      // Add to conversation history
      this.conversationHistory.push(choice.message);
    }
  }
  
  private async handleToolCalls(
    toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[],
    originalMessage: ChatMessage
  ): Promise<void> {
    const results: any[] = [];
    
    for (const toolCall of toolCalls.slice(0, this.config.maxToolCalls)) {
      try {
        debug(`Executing tool call: ${toolCall.function.name}`);
        
        // Parse peer ID and tool name from function name
        const { peerId, toolName } = this.parseToolName(toolCall.function.name);
        const params = JSON.parse(toolCall.function.arguments);
        
        // Optional confirmation
        if (this.config.toolCallConfirmation) {
          this.client.sendChat(`🤔 About to call ${toolName} on ${peerId} with params: ${JSON.stringify(params)}`);
        }
        
        // Make the tool call
        const result = await this.client.callTool(peerId, toolName, params);
        
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: JSON.stringify(result)
        });
        
        debug(`Tool call result:`, result);
        
      } catch (error: any) {
        console.error(`Tool call failed:`, error);
        
        results.push({
          tool_call_id: toolCall.id,
          role: 'tool' as const,
          content: JSON.stringify({ error: error.message })
        });
      }
    }
    
    // Add tool call results to conversation
    if (results.length > 0) {
      try {
        // Add the assistant's tool call message
        this.conversationHistory.push({
          role: 'assistant',
          content: null,
          tool_calls: toolCalls
        });
        
        // Add tool results
        results.forEach(result => {
          this.conversationHistory.push(result);
        });
        
        // Get AI's response to tool results
        const completion = await this.openai.chat.completions.create({
          model: this.config.model!,
          messages: this.conversationHistory,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        });
        
        const followUp = completion.choices[0]?.message?.content;
        if (followUp) {
          this.client.sendChat(followUp);
          this.conversationHistory.push({
            role: 'assistant',
            content: followUp
          });
        }
      } catch (error: any) {
        console.error('Error getting AI response to tool results:', error);
        // Reset conversation history if we get an error about tool calls
        if (error.message?.includes('tool_call')) {
          console.log('Resetting conversation history due to tool call error');
          this.setupSystemPrompt();
        }
      }
    }
  }
  
  private parseToolName(functionName: string): { peerId: string; toolName: string } {
    // Parse peer-prefixed tool names like "weather-agent__getCurrentWeather"
    const parts = functionName.split('__');
    if (parts.length !== 2) {
      throw new Error(`Invalid tool name format: ${functionName}`);
    }
    
    return {
      peerId: parts[0],
      toolName: parts[1]
    };
  }
  
  private async updateAvailableTools(): Promise<void> {
    const tools = this.client.listTools();
    this.availableTools.clear();
    
    debug(`Updating ${tools.length} available tools`);
    
    for (const tool of tools) {
      const functionName = `${tool.peerId}__${tool.name}`;
      
      const openAITool: OpenAI.Chat.ChatCompletionTool = {
        type: 'function',
        function: {
          name: functionName,
          description: `${tool.description || tool.name} (provided by ${tool.peerId})`,
          parameters: tool.inputSchema || {
            type: 'object',
            properties: {},
            additionalProperties: true
          }
        }
      };
      
      this.availableTools.set(functionName, openAITool);
    }
    
    debug(`Available tools: ${Array.from(this.availableTools.keys()).join(', ')}`);
  }
  
  // Public API
  
  async start(): Promise<void> {
    this.running = true;
    await this.client.connect();
    
    // Wait a moment for peers to be discovered
    setTimeout(() => {
      this.updateAvailableTools();
    }, 2000);
    
    console.log(`🚀 OpenAI Agent started`);
    console.log(`Model: ${this.config.model}`);
    console.log(`Topic: ${this.config.topic}`);
  }
  
  async stop(): Promise<void> {
    this.running = false;
    this.client.disconnect();
    console.log(`OpenAI Agent stopped`);
  }
  
  // Direct message sending
  sendChat(message: string): void {
    this.client.sendChat(message);
  }
  
  // Get current state
  getPeers(): Peer[] {
    return this.client.getPeers();
  }
  
  getAvailableTools(): string[] {
    return Array.from(this.availableTools.keys());
  }
  
  getConversationHistory(): OpenAI.Chat.ChatCompletionMessageParam[] {
    return [...this.conversationHistory];
  }
  
  // Manual tool calling (for testing)
  async callTool(peerId: string, toolName: string, params: any): Promise<any> {
    return this.client.callTool(peerId, toolName, params);
  }
  
  getClient(): MCPxAgentClient {
    return this.client;
  }
}