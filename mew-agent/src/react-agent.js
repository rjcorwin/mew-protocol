/**
 * ReAct (Reason, Act, Reflect) Agent
 * A configurable agent that follows the ReAct pattern for decision making
 */

const EventEmitter = require('events');
const winston = require('winston');
const OpenAI = require('openai');

class ReActAgent extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Default prompts that can be overridden via config
    this.prompts = {
      system: config.systemPrompt || 'You are a helpful AI assistant.',
      reason: config.reasonPrompt || 'Given the following context and input, reason about what action to take:\nContext: {context}\nInput: {input}\nProvide your reasoning:',
      reflect: config.reflectPrompt || 'Reflect on your previous action and its outcome:\nAction: {action}\nOutcome: {outcome}\nWhat did you learn? How can you improve?',
      ...config.prompts
    };
    
    // Agent configuration
    this.name = config.name || 'react-agent';
    this.maxIterations = config.maxIterations || 5;
    this.memory = [];
    this.context = {};
    
    // OpenAI configuration
    this.useOpenAI = config.useOpenAI !== false && process.env.OPENAI_API_KEY;
    if (this.useOpenAI) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.model = config.model || 'gpt-4o';
      this.temperature = config.temperature || 0.7;
    }
    
    // Logger setup
    this.logger = winston.createLogger({
      level: config.logLevel || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${this.name}] ${level}: ${message}`;
        })
      ),
      transports: [
        new winston.transports.Console()
      ]
    });
    
    if (this.useOpenAI) {
      this.logger.info('OpenAI integration enabled');
    } else {
      this.logger.warn('OpenAI not configured - using placeholder logic. Set OPENAI_API_KEY to enable.');
    }
  }
  
  /**
   * Reason about what action to take
   */
  async reason(input, context = {}) {
    // Create serializable context by excluding non-serializable fields
    const serializableContext = {
      messages: context.messages,
      participants: context.participants,
      memory: context.memory,
      iteration: context.iteration,
      lastAction: context.lastAction,
      lastOutcome: context.lastOutcome,
      lastReflection: context.lastReflection
    };
    
    const reasoningPrompt = this.prompts.reason
      .replace('{context}', JSON.stringify(serializableContext))
      .replace('{input}', input);
    
    this.logger.debug(`Reasoning with prompt: ${reasoningPrompt}`);
    
    if (this.useOpenAI) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.prompts.system },
            { role: 'user', content: reasoningPrompt + '\n\nPlease respond in JSON format with keys: thought, action (object with type and optionally content/tool/params), and confidence.' }
          ],
          temperature: this.temperature,
          response_format: { type: "json_object" }
        });
        
        const response = JSON.parse(completion.choices[0].message.content);
        const reasoning = {
          thought: response.thought || response.reasoning || 'Analyzing request',
          action: response.action || this.determineAction(input, context),
          confidence: response.confidence || 0.8
        };
        
        // Emit reasoning/thought if we have a MEW client in context
        if (context.mewClient && context.reasoningStartId) {
          context.mewClient.send({
            kind: 'reasoning/thought',
            context: context.reasoningStartId,
            payload: {
              message: reasoning.thought
            }
          });
        }
        
        this.logger.info(`Reasoning complete: ${reasoning.thought}`);
        return reasoning;
      } catch (error) {
        this.logger.error(`OpenAI reasoning error: ${error.message}`);
        // Fall back to placeholder logic
      }
    }
    
    // Placeholder logic when OpenAI is not available
    const reasoning = {
      thought: `Processing input: "${input}"`,
      action: this.determineAction(input, context),
      confidence: 0.8
    };
    
    this.logger.info(`Reasoning complete: ${reasoning.thought}`);
    return reasoning;
  }
  
  /**
   * Execute an action based on reasoning
   */
  async act(action) {
    this.logger.info(`Executing action: ${action.type}`);
    
    let result = null;
    
    switch (action.type) {
      case 'respond':
        result = {
          type: 'message',
          content: action.content
        };
        break;
        
      case 'query':
        result = {
          type: 'query',
          question: action.question,
          // This would query available tools/resources
          answer: 'Query result placeholder'
        };
        break;
        
      case 'tool':
        result = await this.executeTool(action.tool, action.params);
        break;
        
      case 'wait':
        result = {
          type: 'wait',
          duration: action.duration || 1000
        };
        await new Promise(resolve => setTimeout(resolve, result.duration));
        break;
        
      default:
        result = {
          type: 'unknown',
          error: `Unknown action type: ${action.type}`
        };
    }
    
    this.logger.debug(`Action result: ${JSON.stringify(result)}`);
    return result;
  }
  
  /**
   * Reflect on the action and outcome
   */
  async reflect(action, outcome, context = {}) {
    const reflectionPrompt = this.prompts.reflect
      .replace('{action}', JSON.stringify(action))
      .replace('{outcome}', JSON.stringify(outcome));
    
    this.logger.debug(`Reflecting with prompt: ${reflectionPrompt}`);
    
    let learning = '';
    
    if (this.useOpenAI) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: this.prompts.system },
            { role: 'user', content: reflectionPrompt }
          ],
          temperature: this.temperature,
          max_tokens: 150
        });
        
        learning = completion.choices[0].message.content;
        
        // Emit reasoning/thought for reflection if we have MEW client
        if (context.mewClient && context.reasoningStartId) {
          context.mewClient.send({
            kind: 'reasoning/thought',
            context: context.reasoningStartId,
            payload: {
              message: `Reflection: ${learning}`
            }
          });
        }
      } catch (error) {
        this.logger.error(`OpenAI reflection error: ${error.message}`);
        learning = this.extractLearning(action, outcome);
      }
    } else {
      learning = this.extractLearning(action, outcome);
    }
    
    // Store in memory for future reference
    const reflection = {
      timestamp: new Date().toISOString(),
      action,
      outcome,
      learning
    };
    
    this.memory.push(reflection);
    
    // Keep memory size manageable
    if (this.memory.length > 100) {
      this.memory = this.memory.slice(-50);
    }
    
    this.logger.info(`Reflection: ${reflection.learning}`);
    return reflection;
  }
  
  /**
   * Main ReAct loop
   */
  async process(input, context = {}) {
    this.logger.info(`Processing input: ${input}`);
    
    let iterations = 0;
    let finalResult = null;
    
    while (iterations < this.maxIterations) {
      iterations++;
      this.logger.debug(`Iteration ${iterations}/${this.maxIterations}`);
      
      try {
        // Reason phase
        const reasoning = await this.reason(input, {
          ...context,
          memory: this.memory.slice(-5), // Last 5 memories
          iteration: iterations
        });
        
        // Act phase
        const outcome = await this.act(reasoning.action);
        
        // Reflect phase
        const reflection = await this.reflect(reasoning.action, outcome, context);
        
        // Check if we should continue or return
        if (this.shouldComplete(outcome, reflection)) {
          finalResult = outcome;
          break;
        }
        
        // Update context for next iteration
        context = {
          ...context,
          lastAction: reasoning.action,
          lastOutcome: outcome,
          lastReflection: reflection
        };
        
      } catch (error) {
        this.logger.error(`Error in iteration ${iterations}: ${error.message}`);
        this.emit('error', error);
        break;
      }
    }
    
    if (!finalResult) {
      finalResult = {
        type: 'incomplete',
        message: `Reached maximum iterations (${this.maxIterations})`,
        summary: 'Processing incomplete - reached iteration limit'
      };
    }
    
    // Add summary to final result if not present
    if (!finalResult.summary) {
      finalResult.summary = finalResult.content || finalResult.message || 'Processing complete';
    }
    
    this.logger.info(`Processing complete after ${iterations} iterations`);
    return finalResult;
  }
  
  /**
   * Determine what action to take based on input
   */
  determineAction(input, context) {
    // This is a simplified action determination
    // In a real implementation, this would use the LLM
    
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('help') || lowerInput.includes('?')) {
      return {
        type: 'respond',
        content: this.getHelpMessage()
      };
    }
    
    if (lowerInput.includes('calculate') || lowerInput.includes('compute')) {
      return {
        type: 'tool',
        tool: 'calculator',
        params: { expression: input }
      };
    }
    
    if (lowerInput.includes('search') || lowerInput.includes('find')) {
      return {
        type: 'query',
        question: input
      };
    }
    
    // Default response
    return {
      type: 'respond',
      content: `I understand you said: "${input}". How can I help you with that?`
    };
  }
  
  /**
   * Execute a tool
   */
  async executeTool(toolName, params) {
    this.logger.debug(`Executing tool: ${toolName} with params: ${JSON.stringify(params)}`);
    
    // Send MCP request if client is available
    if (this.mcpClient) {
      try {
        const result = await this.mcpClient.sendToolRequest(toolName, params);
        return {
          type: 'tool_result',
          tool: toolName,
          result: result,
          params
        };
      } catch (error) {
        this.logger.error(`MCP tool execution failed: ${error.message}`);
        return {
          type: 'tool_result',
          tool: toolName,
          error: error.message,
          params
        };
      }
    }
    
    // Fallback for testing without MCP
    return {
      type: 'tool_result',
      tool: toolName,
      result: `Tool ${toolName} executed successfully`,
      params
    };
  }
  
  /**
   * Set MCP client for tool execution
   */
  setMCPClient(client) {
    this.mcpClient = client;
  }
  
  /**
   * Extract learning from action and outcome
   */
  extractLearning(action, outcome) {
    // Simplified learning extraction
    if (outcome.error) {
      return `Action ${action.type} failed: ${outcome.error}`;
    }
    
    if (outcome.type === 'message') {
      return `Successfully responded with message`;
    }
    
    return `Action ${action.type} completed with outcome ${outcome.type}`;
  }
  
  /**
   * Determine if processing should complete
   */
  shouldComplete(outcome, reflection) {
    // Complete if we've sent a message or encountered an error
    // Don't complete on tool_result - need to generate a response
    return outcome.type === 'message' || outcome.error;
  }
  
  /**
   * Get help message
   */
  getHelpMessage() {
    return `I'm ${this.name}, a ReAct agent. I can help you with various tasks. Try asking me to:
- Answer questions
- Perform calculations
- Search for information
- Execute tools and actions

What would you like me to help with?`;
  }
  
  /**
   * Update agent configuration
   */
  updateConfig(config) {
    if (config.prompts) {
      this.prompts = { ...this.prompts, ...config.prompts };
    }
    
    if (config.name) {
      this.name = config.name;
    }
    
    if (config.maxIterations) {
      this.maxIterations = config.maxIterations;
    }
    
    this.logger.info('Configuration updated');
  }
  
  /**
   * Clear agent memory
   */
  clearMemory() {
    this.memory = [];
    this.context = {};
    this.logger.info('Memory cleared');
  }
}

module.exports = ReActAgent;