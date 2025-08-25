#!/usr/bin/env node
import 'dotenv/config';
import { MCPxAgent, Tool, ToolExecutionContext, ToolExecutionResult } from '@mcpx-protocol/agent';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * OpenAI Agent - An intelligent MCPx agent powered by OpenAI
 * 
 * Features:
 * - Responds intelligently to chat messages using GPT
 * - Can discover and call tools from other agents
 * - Maintains conversation context
 * - Provides MCP tools for text generation and analysis
 */
class OpenAIAgent extends MCPxAgent {
  private openai: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private systemPrompt: string;
  private conversationHistory: ChatCompletionMessageParam[] = [];
  private maxHistoryLength = 20;
  private availableTools: Map<string, { participantId: string; tool: any }> = new Map();
  private tools: Tool[] = [];

  constructor(options: { gateway: string; topic: string; token: string }) {
    super(
      {
        gateway: options.gateway,
        topic: options.topic,
        token: options.token,
        reconnect: true,
      },
      {
        name: 'openai-agent',
        description: 'AI assistant powered by OpenAI GPT',
        version: '1.0.0',
      }
    );

    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500');
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
    this.systemPrompt = process.env.OPENAI_SYSTEM_PROMPT || 
      'You are a helpful AI assistant in an MCPx multi-agent chat room. Be concise and helpful.';

    // Define MCP tools
    this.tools = [
      {
        name: 'generate_text',
        description: 'Generate text based on a prompt',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'The prompt to generate text from' },
            max_tokens: { type: 'number', description: 'Maximum tokens to generate', default: 200 },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'analyze_sentiment',
        description: 'Analyze the sentiment of text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The text to analyze' },
          },
          required: ['text'],
        },
      },
      {
        name: 'summarize',
        description: 'Summarize text or conversation',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The text to summarize' },
            max_length: { type: 'number', description: 'Maximum summary length in words', default: 50 },
          },
          required: ['text'],
        },
      },
    ];
  }

  async onStart(): Promise<void> {
    console.log('OpenAI agent started!');
    console.log(`Using model: ${this.model}`);
    this.sendChat(`🤖 AI assistant online! I'm powered by ${this.model}. Ask me anything or say "help" for capabilities.`);
    
    // Initialize conversation with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: this.systemPrompt,
    });

    // Discover available tools from other agents
    setTimeout(() => this.discoverTools(), 2000);
    
    // Re-discover tools when new peers join
    (this as any).client.onPeerJoined((peer: any) => {
      console.log(`New peer joined: ${peer.id}, discovering tools...`);
      setTimeout(() => this.discoverToolsFromPeer(peer.id), 1000);
    });
  }

  async onStop(): Promise<void> {
    console.log('OpenAI agent stopping...');
    this.sendChat('🤖 AI assistant going offline.');
  }

  /**
   * Discover tools from other agents
   */
  private async discoverTools(): Promise<void> {
    const peers = this.getPeers();
    console.log('Discovering tools from peers:', peers);

    for (const peerId of peers) {
      if (peerId === this.getParticipantId()) continue;
      await this.discoverToolsFromPeer(peerId);
    }

    if (this.availableTools.size > 0) {
      console.log('Available tools discovered:', Array.from(this.availableTools.keys()));
    }
  }
  
  /**
   * Discover tools from a specific peer
   */
  private async discoverToolsFromPeer(peerId: string): Promise<void> {
    if (peerId === this.getParticipantId()) return;
    
    try {
      const tools = await this.listPeerTools(peerId);
      console.log(`Tools from ${peerId}:`, tools);
      
      tools.forEach(tool => {
        const toolKey = `${peerId}.${tool.name}`;
        this.availableTools.set(toolKey, { participantId: peerId, tool });
      });
      
      if (tools.length > 0) {
        console.log(`Discovered ${tools.length} tools from ${peerId}`);
      }
    } catch (error) {
      console.log(`Could not get tools from ${peerId}:`, error);
    }
  }

  /**
   * Handle incoming chat messages
   */
  protected async onChatMessage(text: string, from: string): Promise<void> {
    // Skip our own messages
    if (from === this.getParticipantId()) {
      return;
    }

    console.log(`[CHAT] ${from}: ${text}`);

    // Check if message is directed at us or mentions AI/help
    const isDirected = text.toLowerCase().includes('@openai-agent') || 
                      text.toLowerCase().includes('@openai') ||
                      (text.toLowerCase().includes('ai') && text.toLowerCase().includes('?')) ||
                      text.toLowerCase().includes('help');

    // Only respond to directed messages to avoid conversation history corruption
    const shouldRespond = isDirected;

    if (shouldRespond) {
      try {
        const response = await this.generateResponse(text, from);
        if (response) {
          this.sendChat(response);
        }
      } catch (error) {
        console.error('Error generating response:', error);
        this.sendChat('🤖 Sorry, I encountered an error processing that request.');
      }
    }
  }

  /**
   * Generate a response using OpenAI
   */
  private async generateResponse(message: string, from: string): Promise<string> {
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: `[${from}]: ${message}`,
    });

    // Prepare tools for OpenAI if available
    const tools: ChatCompletionTool[] = [];
    
    // Add discovered tools as OpenAI functions
    this.availableTools.forEach((toolInfo, toolKey) => {
      const [participantId, toolName] = toolKey.split('.');
      tools.push({
        type: 'function',
        function: {
          name: toolKey.replace('.', '_'), // OpenAI doesn't like dots in function names
          description: toolInfo.tool.description || `Call ${toolName} on ${participantId}`,
          parameters: toolInfo.tool.inputSchema || {
            type: 'object',
            properties: {},
          },
        },
      });
    });

    try {
      // Call OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: this.conversationHistory,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        tools: tools.length > 0 ? tools : undefined,
      });

      const responseMessage = completion.choices[0]?.message;
      if (!responseMessage) {
        return '🤖 I couldn\'t generate a response.';
      }

      // Handle tool calls if any
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const toolResults: string[] = [];
        
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name.replace('_', '.');
          const toolInfo = this.availableTools.get(functionName);
          
          if (toolInfo) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              console.log(`Calling tool ${functionName} with args:`, args);
              
              const result = await this.callTool(
                toolInfo.participantId,
                functionName.split('.')[1],
                args
              );
              
              toolResults.push(`Tool ${functionName}: ${JSON.stringify(result)}`);
            } catch (error) {
              console.error(`Error calling tool ${functionName}:`, error);
              toolResults.push(`Tool ${functionName}: Error - ${error}`);
            }
          }
        }

        // Add tool results to conversation and get final response
        if (toolResults.length > 0) {
          this.conversationHistory.push({
            role: 'assistant',
            content: responseMessage.content || '',
            tool_calls: responseMessage.tool_calls,
          });
          
          this.conversationHistory.push({
            role: 'tool',
            content: toolResults.join('\n'),
            tool_call_id: responseMessage.tool_calls[0].id,
          });

          // Get final response after tool execution
          const finalCompletion = await this.openai.chat.completions.create({
            model: this.model,
            messages: this.conversationHistory,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
          });

          const finalMessage = finalCompletion.choices[0]?.message?.content;
          if (finalMessage) {
            this.conversationHistory.push({
              role: 'assistant',
              content: finalMessage,
            });
            this.trimHistory();
            return `🤖 ${finalMessage}`;
          }
        }
      }

      // Regular response without tool calls
      if (responseMessage.content) {
        this.conversationHistory.push({
          role: 'assistant',
          content: responseMessage.content,
        });
        this.trimHistory();
        return `🤖 ${responseMessage.content}`;
      }

      return '🤖 I couldn\'t generate a response.';
    } catch (error: any) {
      console.error('OpenAI API error:', error);
      
      // If we get a tool/tool_calls mismatch error, reset conversation history
      if (error.message?.includes('messages with role \'tool\'')) {
        console.log('Resetting conversation history due to tool message corruption');
        // Keep only system messages and start fresh
        this.conversationHistory = this.conversationHistory.filter(m => m.role === 'system');
        // Add the current user message again
        this.conversationHistory.push({
          role: 'user',
          content: `[${from}]: ${message}`,
        });
        
        // Try again with clean history
        try {
          const retryCompletion = await this.openai.chat.completions.create({
            model: this.model,
            messages: this.conversationHistory,
            max_tokens: this.maxTokens,
            temperature: this.temperature,
            tools: tools.length > 0 ? tools : undefined,
          });
          
          const retryMessage = retryCompletion.choices[0]?.message;
          if (retryMessage?.content) {
            this.conversationHistory.push({
              role: 'assistant',
              content: retryMessage.content,
            });
            this.trimHistory();
            return `🤖 ${retryMessage.content}`;
          }
        } catch (retryError: any) {
          console.error('Retry failed:', retryError);
          return `🤖 Sorry, I encountered an error. Let's start fresh.`;
        }
      }
      
      return `🤖 Error: ${error.message}`;
    }
  }

  /**
   * Trim conversation history to prevent token overflow
   */
  private trimHistory(): void {
    // Keep system prompt and last N messages
    if (this.conversationHistory.length > this.maxHistoryLength) {
      const systemMessages = this.conversationHistory.filter(m => m.role === 'system');
      let recentMessages = this.conversationHistory.slice(-this.maxHistoryLength + systemMessages.length);
      
      // Ensure we don't start with a tool response without its corresponding tool_calls
      while (recentMessages.length > 0 && recentMessages[0].role === 'tool') {
        recentMessages = recentMessages.slice(1);
      }
      
      // Also ensure we don't have orphaned assistant messages with tool_calls but no tool response
      if (recentMessages.length > 0 && 
          recentMessages[recentMessages.length - 1].role === 'assistant' && 
          'tool_calls' in recentMessages[recentMessages.length - 1] &&
          (recentMessages[recentMessages.length - 1] as any).tool_calls) {
        // Remove the orphaned assistant message with tool_calls
        recentMessages = recentMessages.slice(0, -1);
      }
      
      this.conversationHistory = [...systemMessages, ...recentMessages];
    }
  }

  /**
   * Override MCPxAgent methods for MCP tool support
   */
  async listTools(): Promise<Tool[]> {
    return this.tools;
  }

  async executeTool(name: string, params: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    console.log(`Executing tool ${name} for ${context.from}`);
    
    switch (name) {
      case 'generate_text':
        return this.generateText(params);
      case 'analyze_sentiment':
        return this.analyzeSentiment(params);
      case 'summarize':
        return this.summarize(params);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * MCP Tool: Generate text
   */
  private async generateText(args: { prompt: string; max_tokens?: number }): Promise<ToolExecutionResult> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'Generate text based on the prompt.' },
          { role: 'user', content: args.prompt },
        ],
        max_tokens: args.max_tokens || 200,
        temperature: this.temperature,
      });

      const text = completion.choices[0]?.message?.content || '';
      
      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * MCP Tool: Analyze sentiment
   */
  private async analyzeSentiment(args: { text: string }): Promise<ToolExecutionResult> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: 'Analyze the sentiment of the text. Respond with: positive, negative, neutral, or mixed. Include a confidence score (0-1) and brief explanation.' 
          },
          { role: 'user', content: args.text },
        ],
        max_tokens: 100,
        temperature: 0.3,
      });

      const analysis = completion.choices[0]?.message?.content || '';
      
      return {
        content: [
          {
            type: 'text',
            text: analysis,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * MCP Tool: Summarize text
   */
  private async summarize(args: { text: string; max_length?: number }): Promise<ToolExecutionResult> {
    try {
      const maxWords = args.max_length || 50;
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { 
            role: 'system', 
            content: `Summarize the following text in ${maxWords} words or less. Be concise and capture the main points.` 
          },
          { role: 'user', content: args.text },
        ],
        max_tokens: Math.min(maxWords * 2, 200), // Rough token estimate
        temperature: 0.5,
      });

      const summary = completion.choices[0]?.message?.content || '';
      
      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
}

// Get auth token
async function getToken(participantId: string, topic: string): Promise<string> {
  const gateway = process.env.MCPX_GATEWAY?.replace('ws://', 'http://').replace('wss://', 'https://') || 'http://localhost:3000';
  
  const response = await fetch(`${gateway}/v0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId, topic }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get token: ${response.statusText}`);
  }
  
  const data = await response.json() as { token: string };
  return data.token;
}

// Main
async function main() {
  const participantId = process.env.MCPX_PARTICIPANT_ID || 'openai-agent';
  const topic = process.env.MCPX_TOPIC || 'test-room';
  const gateway = process.env.MCPX_GATEWAY || 'ws://localhost:3000';
  
  try {
    console.log('Getting auth token...');
    const token = await getToken(participantId, topic);
    
    console.log(`Starting OpenAI agent as ${participantId} in topic ${topic}...`);
    const agent = new OpenAIAgent({ gateway, topic, token });
    await agent.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await agent.stop();
      process.exit(0);
    });
    
    // Keep process running
    await new Promise(() => {});
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
}

main();