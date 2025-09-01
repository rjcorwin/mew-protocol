export interface Message {
  kind: string;
  payload?: any;
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
}

export interface MatchOptions {
  cache?: boolean;
  strict?: boolean;
}