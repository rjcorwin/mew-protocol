import { Tool, MCPResponse } from '../types';
export declare class ToolRegistry {
    private tools;
    /**
     * Register a tool
     */
    register(tool: Tool): void;
    /**
     * Unregister a tool
     */
    unregister(name: string): boolean;
    /**
     * Get a tool by name
     */
    get(name: string): Tool | undefined;
    /**
     * List all tools in MCP format
     */
    list(): MCPResponse;
    /**
     * Execute a tool
     */
    execute(name: string, args: any): Promise<MCPResponse>;
    /**
     * Check if a tool exists
     */
    has(name: string): boolean;
    /**
     * Get all tool names
     */
    names(): string[];
}
//# sourceMappingURL=tools.d.ts.map