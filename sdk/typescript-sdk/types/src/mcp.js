"use strict";
/**
 * MCP (Model Context Protocol) Types
 *
 * Types for MCP operations within MEUP
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPMethods = void 0;
// ============================================================================
// MCP Method Names
// ============================================================================
exports.MCPMethods = {
    // Initialization
    INITIALIZE: 'initialize',
    // Tools
    TOOLS_LIST: 'tools/list',
    TOOLS_CALL: 'tools/call',
    // Resources
    RESOURCES_LIST: 'resources/list',
    RESOURCES_READ: 'resources/read',
    RESOURCES_SUBSCRIBE: 'resources/subscribe',
    RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',
    // Prompts
    PROMPTS_LIST: 'prompts/list',
    PROMPTS_GET: 'prompts/get',
    // Notifications
    PROGRESS: 'progress',
    RESOURCES_UPDATED: 'resources/updated',
};
//# sourceMappingURL=mcp.js.map