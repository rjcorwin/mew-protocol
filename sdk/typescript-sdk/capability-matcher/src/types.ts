// Import base types from @meup/types if needed
// For now, define locally to maintain compatibility

export interface Message {
  kind: string;
  payload?: any;
  // Additional MEUP v0.2 fields can be added as needed
  from?: string;
  to?: string | string[];
}

export interface CapabilityPattern {
  kind: string | string[];
  payload?: PayloadPattern;
}

export interface PayloadPattern {
  [key: string]: any;
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