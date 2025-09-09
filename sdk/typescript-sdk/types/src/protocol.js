"use strict";
/**
 * Core MEUP Protocol Types
 *
 * These types define the Multi-Entity Unified-context Protocol v0.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageKinds = exports.MCP_VERSION = exports.PROTOCOL_VERSION = void 0;
// ============================================================================
// Protocol Constants
// ============================================================================
exports.PROTOCOL_VERSION = 'meup/v0.2';
exports.MCP_VERSION = '2025-06-18';
// ============================================================================
// Message Kind Constants
// ============================================================================
exports.MessageKinds = {
    // System messages
    SYSTEM_WELCOME: 'system/welcome',
    SYSTEM_ERROR: 'system/error',
    SYSTEM_PRESENCE: 'system/presence',
    SYSTEM_HEARTBEAT: 'system/heartbeat',
    // MCP messages
    MCP_REQUEST: 'mcp/request',
    MCP_RESPONSE: 'mcp/response',
    MCP_NOTIFICATION: 'mcp/notification',
    // MEUP messages
    MEUP_PROPOSAL: 'meup/proposal',
    MEUP_PROPOSAL_ACCEPT: 'meup/proposal/accept',
    MEUP_PROPOSAL_REJECT: 'meup/proposal/reject',
    MEUP_CAPABILITY_GRANT: 'meup/capability/grant',
    MEUP_CAPABILITY_REVOKE: 'meup/capability/revoke',
    MEUP_CONTEXT: 'meup/context',
    // Application messages
    CHAT: 'chat',
};
//# sourceMappingURL=protocol.js.map