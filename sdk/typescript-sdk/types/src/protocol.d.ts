/**
 * Core MEW Protocol Types
 *
 * These types define the Multi-Entity Workspace Protocol v0.3
 */
export declare const PROTOCOL_VERSION = "mew/v0.3";
export declare const MCP_VERSION = "2025-06-18";
/**
 * MEW envelope - the top-level wrapper for all messages
 */
export interface Envelope {
    protocol: 'mew/v0.3';
    id: string;
    ts: string;
    from: string;
    to?: string[];
    kind: string;
    correlation_id?: string | string[];
    context?: ContextField;
    payload: any;
}
/**
 * Partial envelope for sending (auto-fills protocol, id, ts, from)
 */
export interface PartialEnvelope {
    to?: string[];
    kind: string;
    correlation_id?: string | string[];
    context?: ContextField;
    payload: any;
}
/**
 * Structured context operations for sub-context protocol management.
 *
 * The type system allows both legacy string context identifiers and the
 * expanded operation objects so existing agents continue to function while we
 * phase in richer context semantics.
 */
export interface ContextOperation {
    operation: 'push' | 'pop' | 'resume';
    topic?: string;
    correlation_id?: string;
}
/**
 * Context field for sub-context protocol
 */
export type ContextField = string | ContextOperation;
/**
 * Participant in a space with capabilities
 */
export interface Participant {
    id: string;
    capabilities: Capability[];
}
/**
 * Capability definition with JSON pattern matching
 */
export interface Capability {
    id: string;
    kind: string;
    to?: string | string[];
    payload?: any;
}
/**
 * Capability grant from one participant to another
 */
export interface CapabilityGrant {
    from: string;
    to: string;
    capabilities: Capability[];
}
/**
 * Proposal for untrusted agents to request operations
 */
export interface Proposal {
    correlation_id: string;
    capability: string;
    envelope: PartialEnvelope;
}
/**
 * Welcome message payload sent when joining a space
 */
export interface SystemWelcomePayload {
    you: Participant;
    participants: Participant[];
}
/**
 * Error message payload
 */
export interface SystemErrorPayload {
    error: string;
    message: string;
    attempted_kind?: string;
    your_capabilities?: Capability[];
}
/**
 * Presence event payload
 */
export interface PresencePayload {
    event: 'join' | 'leave' | 'heartbeat';
    participant: Participant;
}
export type SystemPayload = SystemWelcomePayload | SystemErrorPayload | PresencePayload;
export interface MewProposalPayload {
    proposal: Proposal;
}
export interface MewProposalAcceptPayload {
    correlation_id: string;
    accepted_by: string;
    envelope: Envelope;
}
export interface MewProposalRejectPayload {
    correlation_id: string;
    rejected_by: string;
    reason?: string;
}
export interface MewCapabilityGrantPayload {
    grant: CapabilityGrant;
}
export interface MewCapabilityRevokePayload {
    from: string;
    to: string;
    capabilities: string[];
}
/**
 * Chat message format
 */
export interface ChatPayload {
    text: string;
    format?: 'plain' | 'markdown';
}
export interface ChatAcknowledgePayload {
    status?: string;
}
export interface ChatCancelPayload {
    reason?: string;
}
export interface ReasoningCancelPayload {
    reason?: string;
}
export interface ParticipantPausePayload {
    reason?: string;
    timeout_seconds?: number;
}
export interface ParticipantResumePayload {
    reason?: string;
}
export interface ParticipantRequestStatusPayload {
    fields?: string[];
}
export interface ParticipantStatusPayload {
    tokens?: number;
    max_tokens?: number;
    messages_in_context: number;
    status?: string;
    latency_ms?: number;
    [key: string]: any;
}
export interface ParticipantForgetPayload {
    direction: 'oldest' | 'newest';
    entries?: number;
}
export interface ParticipantClearPayload {
    reason?: string;
}
export interface ParticipantRestartPayload {
    mode?: string;
    reason?: string;
}
export interface ParticipantShutdownPayload {
    reason?: string;
}
export interface StreamRequestPayload {
    direction: string;
    expected_size_bytes?: number;
    description?: string;
}
export interface StreamOpenPayload {
    stream_id: string;
    encoding?: string;
    compression?: string;
}
export interface StreamClosePayload {
    reason?: string;
}
export declare const MessageKinds: {
    readonly SYSTEM_WELCOME: "system/welcome";
    readonly SYSTEM_ERROR: "system/error";
    readonly SYSTEM_PRESENCE: "system/presence";
    readonly SYSTEM_HEARTBEAT: "system/heartbeat";
    readonly MCP_REQUEST: "mcp/request";
    readonly MCP_RESPONSE: "mcp/response";
    readonly MCP_NOTIFICATION: "mcp/notification";
    readonly MEW_PROPOSAL: "mew/proposal";
    readonly MEW_PROPOSAL_ACCEPT: "mew/proposal/accept";
    readonly MEW_PROPOSAL_REJECT: "mew/proposal/reject";
    readonly MEW_CAPABILITY_GRANT: "mew/capability/grant";
    readonly MEW_CAPABILITY_REVOKE: "mew/capability/revoke";
    readonly MEW_CONTEXT: "mew/context";
    readonly CHAT: "chat";
    readonly CHAT_ACKNOWLEDGE: "chat/acknowledge";
    readonly CHAT_CANCEL: "chat/cancel";
    readonly REASONING_START: "reasoning/start";
    readonly REASONING_THOUGHT: "reasoning/thought";
    readonly REASONING_CONCLUSION: "reasoning/conclusion";
    readonly REASONING_CANCEL: "reasoning/cancel";
    readonly PARTICIPANT_PAUSE: "participant/pause";
    readonly PARTICIPANT_RESUME: "participant/resume";
    readonly PARTICIPANT_STATUS: "participant/status";
    readonly PARTICIPANT_REQUEST_STATUS: "participant/request-status";
    readonly PARTICIPANT_FORGET: "participant/forget";
    readonly PARTICIPANT_CLEAR: "participant/clear";
    readonly PARTICIPANT_RESTART: "participant/restart";
    readonly PARTICIPANT_SHUTDOWN: "participant/shutdown";
    readonly STREAM_REQUEST: "stream/request";
    readonly STREAM_OPEN: "stream/open";
    readonly STREAM_CLOSE: "stream/close";
    readonly STREAM_DATA: "stream/data";
};
export type MessageKind = typeof MessageKinds[keyof typeof MessageKinds];
//# sourceMappingURL=protocol.d.ts.map