const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');
const { GatewayCore } = require('../gateway/core');
const { FIFOTransport } = require('../gateway/transports/fifo');

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
  const spaceDir = path.dirname(configPath);
  const fifoDir = options.fifoDir
    ? path.resolve(options.fifoDir)
    : path.join(spaceDir, '.mew', 'fifos');

  logger.log(`Starting STDIO gateway for space ${spaceId}`);
  logger.log(`Using FIFO directory ${fifoDir}`);

  ensureDirectory(fifoDir);

  const participantEntries = Object.entries(config.participants || {});
  const participantConfigs = new Map(participantEntries);
  const tokensByParticipant = new Map();

  for (const [participantId, participantConfig] of participantEntries) {
    const token = resolveToken(spaceDir, participantId, participantConfig, logger);
    tokensByParticipant.set(participantId, token);
  }

  const gatewayCore = new GatewayCore({
    spaceId,
    participants: participantConfigs,
    tokensByParticipant,
    logger,
  });

  const transport = new FIFOTransport({
    fifoDir,
    participantIds: participantEntries.map(([participantId]) => participantId),
    logger,
  });

  gatewayCore.attachTransport(transport);
  await transport.start();

  logger.log('Gateway ready and attached to FIFO transport');

  return new Promise((resolve, reject) => {
    const shutdown = (signal) => {
      logger.log(`Received ${signal}, shutting down gateway`);
      try {
        for (const participantId of tokensByParticipant.keys()) {
          const connection = gatewayCore.connections.get(participantId);
          connection?.channel?.close?.();
        }
      } finally {
        resolve();
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
  .description('Start the MEW gateway using STDIO transport')
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
