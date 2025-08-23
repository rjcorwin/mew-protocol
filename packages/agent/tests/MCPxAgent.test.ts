import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPxAgent } from '../src/MCPxAgent';
import { Tool, ServerCapabilities, ToolExecutionContext, ToolExecutionResult } from '../src/types';
import { ConnectionOptions } from '@mcpx-protocol/client';

// Create a concrete implementation for testing
class TestAgent extends MCPxAgent {
  private tools: Tool[] = [];
  
  constructor(tools: Tool[] = []) {
    const config = {
      name: 'TestAgent',
      version: '1.0.0',
      description: 'Test agent',
    };
    
    const connectionOptions: ConnectionOptions = {
      gateway: 'ws://localhost:8080',
      topic: 'test-topic',
      token: 'test-token',
      reconnect: false,
    };
    
    super(config, connectionOptions);
    this.tools = tools;
  }

  async onStart(): Promise<void> {
    // Test implementation
  }

  async onStop(): Promise<void> {
    // Test implementation
  }

  async getCapabilities(): Promise<ServerCapabilities> {
    return {
      tools: { list: true },
      resources: { list: false },
    };
  }

  async listTools(): Promise<Tool[]> {
    return this.tools;
  }

  async executeTool(name: string, params: any, context: ToolExecutionContext): Promise<ToolExecutionResult> {
    if (name === 'test-tool') {
      return {
        content: [{
          type: 'text',
          text: `Executed ${name} with params: ${JSON.stringify(params)}`,
        }],
      };
    }
    throw new Error(`Tool ${name} not found`);
  }

  // Expose protected methods for testing
  testSetContext(key: string, value: any): void {
    this.setContext(key, value);
  }

  testGetContext(key: string): any {
    return this.getContext(key);
  }

  testSendProgress(to: string, progress: number, total: number): void {
    this.sendProgress(to, { progress, total });
  }
}

describe('MCPxAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent([
      {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
      },
    ]);
  });

  describe('Agent Configuration', () => {
    it('should create agent with configuration', () => {
      expect(agent).toBeDefined();
      expect(agent.getStatus()).toBe('idle');
    });
  });

  describe('Context Management', () => {
    it('should store and retrieve context', () => {
      agent.testSetContext('key1', 'value1');
      agent.testSetContext('key2', { nested: 'object' });
      
      expect(agent.testGetContext('key1')).toBe('value1');
      expect(agent.testGetContext('key2')).toEqual({ nested: 'object' });
    });

    it('should clear context', () => {
      agent.testSetContext('key1', 'value1');
      agent.clearContext();
      
      expect(agent.testGetContext('key1')).toBeUndefined();
    });
  });

  describe('State Management', () => {
    it('should manage agent status', () => {
      expect(agent.getStatus()).toBe('idle');
      
      agent.setStatus('busy');
      expect(agent.getStatus()).toBe('busy');
      
      agent.setStatus('error');
      expect(agent.getStatus()).toBe('error');
    });
  });

  describe('MCP Server Functionality', () => {
    it('should provide capabilities', async () => {
      const capabilities = await agent.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.tools?.list).toBe(true);
      expect(capabilities.resources?.list).toBe(false);
    });

    it('should list tools', async () => {
      const tools = await agent.listTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test-tool');
      expect(tools[0].description).toBe('A test tool');
    });

    it('should execute tools', async () => {
      const context: ToolExecutionContext = {
        tool: 'test-tool',
        params: { message: 'hello' },
        from: 'peer-1',
        requestId: 1,
      };
      
      const result = await agent.executeTool('test-tool', context.params, context);
      
      expect(result.content).toBeDefined();
      expect(result.content?.[0].type).toBe('text');
      expect(result.content?.[0].text).toContain('test-tool');
    });

    it('should throw error for unknown tool', async () => {
      const context: ToolExecutionContext = {
        tool: 'unknown-tool',
        params: {},
        from: 'peer-1',
        requestId: 1,
      };
      
      await expect(
        agent.executeTool('unknown-tool', {}, context)
      ).rejects.toThrow('Tool unknown-tool not found');
    });
  });

  describe('Tool Definition', () => {
    it('should create valid tool definition', () => {
      const tool: Tool = {
        name: 'move',
        description: 'Move the robot to a location',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['x', 'y'],
        },
      };

      expect(tool.name).toBe('move');
      expect(tool.inputSchema?.properties).toHaveProperty('x');
      expect(tool.inputSchema?.properties).toHaveProperty('y');
      expect(tool.inputSchema?.required).toContain('x');
      expect(tool.inputSchema?.required).toContain('y');
    });
  });

  describe('Event Handlers', () => {
    it('should have default event handlers', () => {
      // Create an agent that tracks event calls
      class EventTestAgent extends TestAgent {
        chatMessageReceived = false;
        cancellationReceived = false;
        progressReceived = false;

        protected onChatMessage(text: string, from: string): void {
          this.chatMessageReceived = true;
        }

        protected onCancellation(requestId: string | number, reason: string): void {
          this.cancellationReceived = true;
        }

        protected onProgress(from: string, params: any): void {
          this.progressReceived = true;
        }
      }

      const eventAgent = new EventTestAgent();
      
      // Test that the methods exist and can be called
      eventAgent['onChatMessage']('test', 'peer-1');
      expect(eventAgent.chatMessageReceived).toBe(true);
      
      eventAgent['onCancellation'](1, 'timeout');
      expect(eventAgent.cancellationReceived).toBe(true);
      
      eventAgent['onProgress']('peer-1', { progress: 50 });
      expect(eventAgent.progressReceived).toBe(true);
    });
  });
});