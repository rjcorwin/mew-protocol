import { Capability, Envelope } from '@mew-protocol/mew/types';
/**
 * Check if a message matches a capability pattern
 * Supports wildcards (*), negative patterns (!pattern), and nested object matching
 */
export declare function matchesCapability(capability: Capability, envelope: Partial<Envelope>): boolean;
/**
 * Check if a participant can send a specific kind of message
 */
export declare function canSend(capabilities: Capability[], kind: string, payload?: any): boolean;
/**
 * Filter capabilities by kind pattern
 */
export declare function filterCapabilities(capabilities: Capability[], kindPattern: string): Capability[];
//# sourceMappingURL=capabilities.d.ts.map