const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const { GatewayCore } = require('../gateway/core');
const { FIFOTransport } = require('../gateway/transports/fifo');
const { WebSocketTransport } = require('../gateway/transports/websocket');

function createLogger(level) {
  const levels = ['error', 'warn', 'info', 'debug'];
  const normalized = levels.includes(level) ? level : 'info';
  const shouldLog = (target) => levels.indexOf(target) <= levels.indexOf(normalized);

  return {
    error: (...args) => shouldLog('error') && console.error('[gateway]', ...args),
    warn: (...args) => shouldLog('warn') && console.warn('[gateway]', ...args),
    log: (...args) => shouldLog('info') && console.log('[gateway]', ...args),
    debug: (...args) => shouldLog('debug') && console.debug('[gateway]', ...args),
  };
}

function loadSpaceConfig(configPath) {
  const resolved = path.resolve(configPath);
  const content = fs.readFileSync(resolved, 'utf8');
  const config = yaml.load(content);
  return { config, configPath: resolved };
}

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveToken(spaceDir, participantId, participantConfig, logger) {
  const envVar = `MEW_TOKEN_${participantId.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envVar]) {
    logger.debug(`Using token from env ${envVar}`);
    return process.env[envVar];
  }

  const tokensDir = path.join(spaceDir, '.mew', 'tokens');
  const tokenPath = path.join(tokensDir, `${participantId}.token`);
  if (fs.existsSync(tokenPath)) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    if (token) {
      return token;
    }
  }

  if (participantConfig.tokens && participantConfig.tokens.length > 0) {
    return participantConfig.tokens[0];
  }

  const token = crypto.randomBytes(24).toString('base64url');
  if (!fs.existsSync(tokensDir)) {
    fs.mkdirSync(tokensDir, { recursive: true, mode: 0o700 });
  }
  const gitignorePath = path.join(tokensDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', { mode: 0o600 });
  }
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  logger.warn(`Generated new token for participant ${participantId}`);
  return token;
}

async function startGateway(options) {
  const logger = createLogger(options.logLevel || 'info');
  const { config, configPath } = loadSpaceConfig(options.spaceConfig || './space.yaml');

  if (!config?.space?.id) {
    throw new Error('space.id missing from configuration');
  }

  const spaceId = config.space.id;
  let spaceDir = path.dirname(configPath);
  if (path.basename(spaceDir) === '.mew') {
    spaceDir = path.dirname(spaceDir);
  }
  const transportConfig = config.space?.transport || {};
  const defaultTransport = transportConfig.default || 'stdio';
  const transportOverrides = transportConfig.overrides || {};

  const fifoDir = options.fifoDir
    ? path.resolve(options.fifoDir)
    : path.join(spaceDir, '.mew', 'fifos');

  const participantEntries = Object.entries(config.participants || {});
  const participantConfigs = new Map();
  const tokensByParticipant = new Map();
  const stdioParticipants = [];
  const websocketParticipants = [];

  ensureDirectory(fifoDir);

  for (const [participantId, participantConfigRaw] of participantEntries) {
    const resolvedTransport =
      participantConfigRaw.transport || transportOverrides[participantId] || defaultTransport;
    const participantConfig = {
      ...participantConfigRaw,
      transport: resolvedTransport,
    };
    participantConfigs.set(participantId, participantConfig);

    const token = resolveToken(spaceDir, participantId, participantConfig, logger);
    tokensByParticipant.set(participantId, token);

    if (resolvedTransport === 'websocket') {
      websocketParticipants.push(participantId);
    } else {
      stdioParticipants.push(participantId);
    }
  }

  const gatewayCore = new GatewayCore({
    spaceId,
    participants: participantConfigs,
    tokensByParticipant,
    logger,
  });

  logger.debug?.(
    'Participant tokens:',
    Array.from(tokensByParticipant.entries()).map(([pid, token]) => [pid, token.slice(0, 8)]),
  );

  const transports = [];

  if (stdioParticipants.length > 0) {
    logger.log(`Starting STDIO gateway for space ${spaceId}`);
    logger.log(`Using FIFO directory ${fifoDir}`);

    const fifoTransport = new FIFOTransport({
      fifoDir,
      participantIds: stdioParticipants,
      logger,
    });
    transports.push(fifoTransport);
    gatewayCore.attachTransport(fifoTransport);
    await fifoTransport.start();
    logger.log('STDIO transport ready');
  }

  const shouldStartWebSocket = websocketParticipants.length > 0 || transportConfig.default === 'websocket';
  let websocketTransport = null;

  if (shouldStartWebSocket) {
    const listenValue = config.gateway?.websocket?.listen || '127.0.0.1:4700';
    let host = '127.0.0.1';
    let port = 4700;

    if (typeof listenValue === 'number') {
      port = listenValue;
    } else if (typeof listenValue === 'string') {
      if (listenValue.includes(':')) {
        const [hostPart, portPart] = listenValue.split(':');
        if (hostPart) host = hostPart;
        if (portPart) port = Number(portPart);
      } else {
        port = Number(listenValue);
      }
    }

    if (Number.isNaN(port) || port <= 0) {
      throw new Error(`Invalid websocket listen port: ${listenValue}`);
    }

    websocketTransport = new WebSocketTransport({ host, port, logger });
    transports.push(websocketTransport);
    gatewayCore.attachTransport(websocketTransport);
    await websocketTransport.start();
    logger.log(`WebSocket transport ready on ws://${host}:${port}`);
  }

  if (transports.length === 0) {
    logger.warn('No transports configured; gateway will not accept connections');
  }

  logger.log('Gateway ready');

  return new Promise((resolve, reject) => {
    const shutdown = (signal) => {
      logger.log(`Received ${signal}, shutting down gateway`);
      try {
        for (const participantId of tokensByParticipant.keys()) {
          const connection = gatewayCore.connections.get(participantId);
          connection?.channel?.close?.();
        }
        Promise.all(transports.map((t) => t.stop?.().catch(() => {}))).finally(() => {
          resolve();
        });
      } finally {
        // resolved above
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in gateway', error);
      reject(error);
    });
  });
}

const gateway = new Command('gateway').description('Gateway server management');

gateway
  .command('start')
  .description('Start the MEW gateway (STDIO/WebSocket based on configuration)')
  .option('-s, --space-config <path>', 'Path to space.yaml configuration', './space.yaml')
  .option('-f, --fifo-dir <path>', 'Directory containing participant FIFO pairs')
  .option('-l, --log-level <level>', 'Log level (error|warn|info|debug)', 'info')
  .action(async (options) => {
    try {
      await startGateway(options);
    } catch (error) {
      console.error('[gateway] Failed to start:', error.message);
      process.exit(1);
    }
  });

module.exports = gateway;
