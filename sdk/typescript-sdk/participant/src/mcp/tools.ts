import { Tool, MCPResponse } from '../types';

export class ToolRegistry {
  private tools = new Map<string, Tool>();
  
  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }
  
  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }
  
  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * List all tools in MCP format
   */
  list(): MCPResponse {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return {
      result: { tools }
    };
  }
  
  /**
   * Execute a tool
   */
  async execute(name: string, args: any): Promise<MCPResponse> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        error: {
          code: -32601,
          message: `Tool not found: ${name}`
        }
      };
    }
    
    try {
      const result = await tool.execute(args);
      
      // Format result as MCP content
      const content = [];
      
      if (typeof result === 'string') {
        content.push({
          type: 'text',
          text: result
        });
      } else if (typeof result === 'object') {
        content.push({
          type: 'text',
          text: JSON.stringify(result, null, 2)
        });
      } else {
        content.push({
          type: 'text',
          text: String(result)
        });
      }
      
      return {
        result: { content }
      };
    } catch (error: any) {
      return {
        error: {
          code: -32603,
          message: error.message || 'Tool execution failed',
          data: error.stack
        }
      };
    }
  }
  
  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Get all tool names
   */
  names(): string[] {
    return Array.from(this.tools.keys());
  }
}