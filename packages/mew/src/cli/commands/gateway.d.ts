import type { Command } from 'commander';
import type {
  GatewayLogger,
  GatewayLoggerOptions,
} from '../../gateway';

declare const gateway: Command & {
  createGatewayLogger: (options: GatewayLoggerOptions) => GatewayLogger;
  parseOptionalBoolean: (value: unknown) => boolean | undefined;
};

export = gateway;
