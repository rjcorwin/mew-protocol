// Import base types from @meup/types if needed
// For now, define locally to maintain compatibility

export interface Message {
  kind: string;
  payload?: unknown;
  // Additional MEUP v0.2 fields can be added as needed
  from?: string;
  to?: string | string[];
}

export interface CapabilityPattern {
  kind: string | string[];
  payload?: PayloadPattern;
}

export type PayloadPrimitive = string | number | boolean | null;

export type PayloadValue =
  | PayloadPrimitive
  | RegExp
  | PayloadPattern
  | PayloadValue[];

export interface PayloadPattern {
  [key: string]: PayloadValue;
}

export interface Participant {
  participantId: string;
  capabilities: CapabilityPattern[];
  tokens?: string[];  // Added for space.yaml integration
}

export interface MatchOptions {
  cache?: boolean;
  strict?: boolean;
}

// Export type for space.yaml capability definitions (from ADR-q8f)
export type CapabilityDefinition = string | CapabilityPattern;