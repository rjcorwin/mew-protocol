/**
 * Core MEUP Protocol Types
 *
 * These types define the Multi-Entity Unified-context Protocol v0.2
 */
export declare const PROTOCOL_VERSION = "meup/v0.2";
export declare const MCP_VERSION = "2025-06-18";
/**
 * MEUP envelope - the top-level wrapper for all messages
 */
export interface Envelope {
    protocol: 'meup/v0.2';
    id: string;
    ts: string;
    from: string;
    to?: string[];
    kind: string;
    correlation_id?: string;
    context?: ContextField;
    payload: any;
}
/**
 * Partial envelope for sending (auto-fills protocol, id, ts, from)
 */
export interface PartialEnvelope {
    to?: string[];
    kind: string;
    correlation_id?: string;
    context?: ContextField;
    payload: any;
}
/**
 * Context field for sub-context protocol
 */
export interface ContextField {
    operation: 'push' | 'pop' | 'resume';
    topic?: string;
    correlation_id?: string;
}
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
export interface MeupProposalPayload {
    proposal: Proposal;
}
export interface MeupProposalAcceptPayload {
    correlation_id: string;
    accepted_by: string;
    envelope: Envelope;
}
export interface MeupProposalRejectPayload {
    correlation_id: string;
    rejected_by: string;
    reason?: string;
}
export interface MeupCapabilityGrantPayload {
    grant: CapabilityGrant;
}
export interface MeupCapabilityRevokePayload {
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
export declare const MessageKinds: {
    readonly SYSTEM_WELCOME: "system/welcome";
    readonly SYSTEM_ERROR: "system/error";
    readonly SYSTEM_PRESENCE: "system/presence";
    readonly SYSTEM_HEARTBEAT: "system/heartbeat";
    readonly MCP_REQUEST: "mcp/request";
    readonly MCP_RESPONSE: "mcp/response";
    readonly MCP_NOTIFICATION: "mcp/notification";
    readonly MEUP_PROPOSAL: "meup/proposal";
    readonly MEUP_PROPOSAL_ACCEPT: "meup/proposal/accept";
    readonly MEUP_PROPOSAL_REJECT: "meup/proposal/reject";
    readonly MEUP_CAPABILITY_GRANT: "meup/capability/grant";
    readonly MEUP_CAPABILITY_REVOKE: "meup/capability/revoke";
    readonly MEUP_CONTEXT: "meup/context";
    readonly CHAT: "chat";
};
export type MessageKind = typeof MessageKinds[keyof typeof MessageKinds];
//# sourceMappingURL=protocol.d.ts.map