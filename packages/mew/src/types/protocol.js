"use strict";
/**
 * Core MEW Protocol Types
 *
 * These types define the Multi-Entity Workspace Protocol v0.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageKinds = exports.MCP_VERSION = exports.PROTOCOL_VERSION = void 0;
// ============================================================================
// Protocol Constants
// ============================================================================
exports.PROTOCOL_VERSION = 'mew/v0.4';
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
    // MEW messages
    MEW_PROPOSAL: 'mew/proposal',
    MEW_PROPOSAL_ACCEPT: 'mew/proposal/accept',
    MEW_PROPOSAL_REJECT: 'mew/proposal/reject',
    MEW_CAPABILITY_GRANT: 'mew/capability/grant',
    MEW_CAPABILITY_REVOKE: 'mew/capability/revoke',
    MEW_CONTEXT: 'mew/context',
    // Application messages
    CHAT: 'chat',
    CHAT_ACKNOWLEDGE: 'chat/acknowledge',
    CHAT_CANCEL: 'chat/cancel',
    // Reasoning transparency
    REASONING_START: 'reasoning/start',
    REASONING_THOUGHT: 'reasoning/thought',
    REASONING_CONCLUSION: 'reasoning/conclusion',
    REASONING_CANCEL: 'reasoning/cancel',
    // Participant control
    PARTICIPANT_PAUSE: 'participant/pause',
    PARTICIPANT_RESUME: 'participant/resume',
    PARTICIPANT_STATUS: 'participant/status',
    PARTICIPANT_REQUEST_STATUS: 'participant/request-status',
    PARTICIPANT_FORGET: 'participant/forget',
    PARTICIPANT_CLEAR: 'participant/clear',
    PARTICIPANT_RESTART: 'participant/restart',
    PARTICIPANT_SHUTDOWN: 'participant/shutdown',
    // Streams
    STREAM_REQUEST: 'stream/request',
    STREAM_OPEN: 'stream/open',
    STREAM_CLOSE: 'stream/close',
    STREAM_DATA: 'stream/data',
};
//# sourceMappingURL=protocol.js.map