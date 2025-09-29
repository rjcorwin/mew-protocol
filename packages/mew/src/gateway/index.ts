import gatewayModule from '../cli/commands/gateway.js';

export interface GatewayLoggingSectionConfig {
  enabled?: boolean;
}

export interface GatewayLoggingConfig {
  enabled?: boolean;
  envelope_history?: GatewayLoggingSectionConfig;
  capability_decisions?: GatewayLoggingSectionConfig;
}

export interface GatewayEnvelopeLogMetadata extends Record<string, unknown> {}

export interface GatewayEnvelopeLogEntry {
  event?: string;
  id?: string;
  envelope?: unknown;
  participant?: string;
  space_id?: string;
  direction?: string;
  transport?: string;
  metadata?: GatewayEnvelopeLogMetadata;
}

export interface GatewayCapabilityDecisionMetadata extends Record<string, unknown> {
  source?: string;
  transport?: string;
  correlation_id?: string | string[];
}

export interface GatewayCapabilityDecisionEntry {
  event?: string;
  envelope_id?: string;
  participant?: string;
  space_id?: string;
  result?: string;
  required_capability?: unknown;
  matched_capability?: unknown;
  matched_source?: string;
  granted_capabilities?: unknown[];
  metadata?: GatewayCapabilityDecisionMetadata;
}

export interface GatewayLogger {
  logEnvelopeEvent(entry?: GatewayEnvelopeLogEntry): void;
  logCapabilityDecision(entry?: GatewayCapabilityDecisionEntry): void;
}

export interface GatewayLoggerOptions {
  logsDir: string;
  config?: GatewayLoggingConfig;
  env?: NodeJS.ProcessEnv;
  logger?: Pick<Console, 'warn'> | { warn?: (...args: unknown[]) => void } | undefined;
}

type CreateGatewayLogger = (options: GatewayLoggerOptions) => GatewayLogger;

type ParseOptionalBoolean = (value: unknown) => boolean | undefined;

type GatewayModuleExports = {
  createGatewayLogger?: CreateGatewayLogger;
  parseOptionalBoolean?: ParseOptionalBoolean;
};

const { createGatewayLogger: createGatewayLoggerImpl, parseOptionalBoolean: parseOptionalBooleanImpl } =
  gatewayModule as GatewayModuleExports;

if (typeof createGatewayLoggerImpl !== 'function') {
  throw new Error('Gateway command module does not expose createGatewayLogger');
}

export const createGatewayLogger: CreateGatewayLogger = (options) => createGatewayLoggerImpl(options);

export const parseOptionalBoolean: ParseOptionalBoolean = (value) => {
  if (parseOptionalBooleanImpl) {
    return parseOptionalBooleanImpl(value);
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return undefined;
};
