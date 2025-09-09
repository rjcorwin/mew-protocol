"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
class ToolRegistry {
    constructor() {
        this.tools = new Map();
    }
    /**
     * Register a tool
     */
    register(tool) {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool ${tool.name} is already registered`);
        }
        this.tools.set(tool.name, tool);
    }
    /**
     * Unregister a tool
     */
    unregister(name) {
        return this.tools.delete(name);
    }
    /**
     * Get a tool by name
     */
    get(name) {
        return this.tools.get(name);
    }
    /**
     * List all tools in MCP format
     */
    list() {
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
    async execute(name, args) {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                error: {
                    code: -32601,
                    message: `Unknown tool: ${name}`
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
            }
            else if (typeof result === 'object') {
                content.push({
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                });
            }
            else {
                content.push({
                    type: 'text',
                    text: String(result)
                });
            }
            return {
                result: { content }
            };
        }
        catch (error) {
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
    has(name) {
        return this.tools.has(name);
    }
    /**
     * Get all tool names
     */
    names() {
        return Array.from(this.tools.keys());
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=tools.js.map