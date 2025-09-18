import { ConnectionOptions, Envelope, StreamRecord } from '@mew-protocol/client';
import { Capability, StreamFormatDescriptor } from '@mew-protocol/types';

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: any) => Promise<any> | any;
}

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  read: () => Promise<any> | any;
}

export interface ParticipantOptions extends Omit<ConnectionOptions, 'capabilities'> {
  // Capabilities will be learned from welcome message
}

export interface ParticipantInfo {
  id: string;
  capabilities: Capability[];
}

export interface MCPRequest {
  method: string;
  params?: any;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export type ProposalHandler = (proposal: Envelope) => Promise<void> | void;
export type RequestHandler = (request: Envelope) => Promise<MCPResponse> | MCPResponse;

export interface PendingRequest {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface StreamAnnouncementOptions {
  intent?: string;
  desiredId?: string;
  formats: StreamFormatDescriptor[];
  scope?: string[];
  timeoutMs?: number;
}

export interface StreamHandle {
  streamId: string;
  namespace: string;
  formats: StreamFormatDescriptor[];
  intent?: string;
  scope?: string[];
}

export interface StreamStartOptions {
  startTs?: string;
}

export interface StreamDataOptions {
  sequence?: number;
  formatId?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamCompleteOptions {
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamErrorOptions extends StreamCompleteOptions {
  code: string;
  message: string;
}
