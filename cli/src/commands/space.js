const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawn } = require('child_process');
const crypto = require('crypto');
const readline = require('readline');
const chalk = require('chalk');
const EventEmitter = require('events');

const { encodeEnvelope, FrameParser } = require('../stdio/utils');
const {
  resolveParticipant,
  getInteractiveOverrides,
} = require('../utils/participant-resolver');
const { startAdvancedInteractiveUI } = require('../utils/advanced-interactive-ui');

const space = new Command('space').description('Manage MEW spaces');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadSpaceConfig(configPath) {
  const resolved = path.resolve(configPath);
  const content = fs.readFileSync(resolved, 'utf8');
  const config = yaml.load(content);
  return { config, configPath: resolved };
}

function ensureToken(spaceDir, participantId, participantConfig) {
  const envVar = `MEW_TOKEN_${participantId.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envVar]) {
    return process.env[envVar];
  }

  const tokensDir = path.join(spaceDir, '.mew', 'tokens');
  ensureDir(tokensDir);
  const tokenFile = path.join(tokensDir, `${participantId}.token`);

  if (fs.existsSync(tokenFile)) {
    const token = fs.readFileSync(tokenFile, 'utf8').trim();
    if (token) {
      return token;
    }
  }

  if (participantConfig.tokens && participantConfig.tokens.length > 0) {
    const token = participantConfig.tokens[0];
    fs.writeFileSync(tokenFile, token, { mode: 0o600 });
    return token;
  }

  const token = crypto.randomBytes(24).toString('base64url');
  if (!fs.existsSync(path.join(tokensDir, '.gitignore'))) {
    fs.writeFileSync(path.join(tokensDir, '.gitignore'), '*\n!.gitignore\n');
  }
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  return token;
}

async function ensureFifo(fifoPath) {
  if (fs.existsSync(fifoPath)) {
    const stats = fs.statSync(fifoPath);
    if (!stats.isFIFO()) {
      throw new Error(`${fifoPath} exists but is not a FIFO`);
    }
    return;
  }

  const mkfifo = spawn('mkfifo', [fifoPath]);
  return new Promise((resolve, reject) => {
    mkfifo.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`mkfifo exited with code ${code}`));
    });
    mkfifo.on('error', reject);
  });
}

function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function readState(spaceDir) {
  const runDir = path.join(spaceDir, '.mew', 'run');
  const statePath = path.join(runDir, 'state.json');
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

function writeState(spaceDir, state) {
  const runDir = path.join(spaceDir, '.mew', 'run');
  ensureDir(runDir);
  const statePath = path.join(runDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return statePath;
}

function removeState(spaceDir) {
  const runDir = path.join(spaceDir, '.mew', 'run');
  const statePath = path.join(runDir, 'state.json');
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

function spawnDetached(command, args, { cwd, env, stdout, stderr }) {
  ensureDir(path.dirname(stdout));
  ensureDir(path.dirname(stderr));
  const outFd = fs.openSync(stdout, 'a');
  const errFd = fs.openSync(stderr, 'a');

  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', outFd, errFd],
  });

  child.unref();

  fs.closeSync(outFd);
  fs.closeSync(errFd);

  return child.pid;
}

async function createFifoPair(fifoDir, participantId) {
  const inboundPath = path.join(fifoDir, `${participantId}.in`);
  const outboundPath = path.join(fifoDir, `${participantId}.out`);

  await ensureFifo(inboundPath);
  await ensureFifo(outboundPath);

  return { inboundPath, outboundPath };
}

function formatParticipantList(participants = []) {
  if (!participants.length) return 'none';
  return participants
    .map((p) => (typeof p === 'string' ? p : p.id || p.participantId || 'unknown'))
    .join(', ');
}

function describeEnvelope(envelope, { spaceId, participantId, useColor, debug }) {
  const kind = envelope.kind || 'unknown';
  const from = envelope.from || envelope.participant || '<gateway>';
  const ts = envelope.ts ? ` ${envelope.ts}` : '';

  const colorize = (value, color) => (useColor ? chalk[color](value) : value);

  if (debug) {
    const raw = JSON.stringify(envelope, null, 2);
    console.log(colorize(`[${kind}]${ts} ${from}`, 'gray'));
    console.log(raw);
    return;
  }

  switch (kind) {
    case 'system/welcome': {
      const participants = envelope.payload?.participants || [];
      console.log(
        colorize(
          `✔ Joined space ${spaceId} as ${participantId}. Participants: ${formatParticipantList(participants)}`,
          'green',
        ),
      );
      return;
    }
    case 'system/presence': {
      const event = envelope.payload?.event;
      const participant = envelope.payload?.participant?.id || envelope.payload?.participantId;
      if (event && participant) {
        const prefix = event === 'join' ? '➕' : event === 'leave' ? '➖' : 'ℹ';
        console.log(
          colorize(
            `${prefix} ${participant} ${event === 'join' ? 'joined' : event === 'leave' ? 'left' : event}`,
            event === 'join' ? 'green' : event === 'leave' ? 'yellow' : 'gray',
          ),
        );
      }
      return;
    }
    case 'chat': {
      const text = envelope.payload?.text || '';
      const target = envelope.to && envelope.to.length ? ` → ${envelope.to.join(', ')}` : '';
      console.log(`${colorize(from, 'cyan')}${target}: ${text}`);
      return;
    }
    case 'mcp/proposal':
    case 'mcp/request':
    case 'mcp/response': {
      const method = envelope.payload?.method || '';
      console.log(
        `${colorize(kind, 'magenta')} from ${colorize(from, 'cyan')}${method ? ` (${method})` : ''}`,
      );
      if (envelope.payload) {
        console.log(JSON.stringify(envelope.payload, null, 2));
      }
      return;
    }
    default: {
      console.log(colorize(`[${kind}] from ${from}`, 'gray'));
      if (envelope.payload) {
        console.log(JSON.stringify(envelope.payload, null, 2));
      }
    }
  }
}

function resolveWebsocketListen(value) {
  let host = '127.0.0.1';
  let port = 4700;

  if (typeof value === 'number') {
    port = value;
  } else if (typeof value === 'string') {
    if (value.includes(':')) {
      const [hostPart, portPart] = value.split(':');
      if (hostPart) {
        host = hostPart;
      }
      if (portPart) {
        const parsed = Number(portPart);
        if (!Number.isNaN(parsed) && parsed > 0) {
          port = parsed;
        }
      }
    } else {
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && parsed > 0) {
        port = parsed;
      }
    }
  }

  return `${host}:${port}`;
}

async function spaceConnectAction(options = {}) {
  const spaceDir = path.resolve(options.spaceDir || '.');
  const state = readState(spaceDir);

  if (!state) {
    throw new Error('No running space found. Start the space with "mew space up" first.');
  }

  if (!isPidRunning(state.gateway?.pid)) {
    throw new Error('Gateway process not running. Start the space again with "mew space up".');
  }

  const { config: spaceConfig } = loadSpaceConfig(state.configPath);

  const participantSelection = await resolveParticipant({
    participantId: options.participant,
    spaceConfig,
    interactive: options.interactiveSelection !== false,
  });

  const participantId = participantSelection.id;
  const participantTransportConfig = spaceConfig.space?.transport || {};
  const participantTransport =
    spaceConfig.participants?.[participantId]?.transport ||
    participantTransportConfig.overrides?.[participantId] ||
    participantTransportConfig.default ||
    'stdio';

  if (participantTransport !== 'stdio') {
    throw new Error(
      `Participant ${participantId} uses transport '${participantTransport}'. Use a compatible remote client to connect.`,
    );
  }

  const baseParticipantConfig = spaceConfig.participants[participantId] || participantSelection;
  const participantConfig = getInteractiveOverrides(baseParticipantConfig);

  const token = ensureToken(spaceDir, participantId, baseParticipantConfig);
  const fifoDir = state.fifoDir || path.join(spaceDir, '.mew', 'fifos');

  const { inboundPath, outboundPath } = await createFifoPair(fifoDir, participantId);

  const preferAdvancedUi =
    !options.noUi && !options.debug && !options.simple && process.stdout.isTTY;
  const useAdvancedUi = preferAdvancedUi;
  const debug = Boolean(options.debug || options.simple);
  const useColor = !options.noColor && !options.noUi && process.stdout.isTTY;

  if (!useAdvancedUi) {
    console.log(
      `${useColor ? chalk.blue('ℹ') : 'ℹ'} Connecting to ${state.spaceId} as ${participantId}…`,
    );
  }

  const gatewayRead = fs.createReadStream(inboundPath);
  const gatewayWrite = fs.createWriteStream(outboundPath);

  let closed = false;
  let resolveSession;
  const sessionDone = new Promise((resolve) => {
    resolveSession = resolve;
  });

  let writeReady = false;
  let canWrite = true;
  const pendingEnvelopes = [];

  const sendRawEnvelope = (envelope) => {
    if (!canWrite) return;
    try {
      const payload = encodeEnvelope(envelope);
      gatewayWrite.write(payload);
    } catch (error) {
      if (!useAdvancedUi) {
        console.error('Failed to send envelope to gateway:', error.message);
      }
    }
  };

  const flushPending = () => {
    while (pendingEnvelopes.length) {
      sendRawEnvelope(pendingEnvelopes.shift());
    }
  };

  const queueEnvelope = (envelope) => {
    if (!canWrite) return;
    if (!writeReady) {
      pendingEnvelopes.push(envelope);
      return;
    }
    sendRawEnvelope(envelope);
  };

  const eventBus = useAdvancedUi ? new EventEmitter() : null;
  const socket = useAdvancedUi
    ? {
        readyState: 0,
        send(data) {
          if (!canWrite) return;
          let envelope = data;
          try {
            if (typeof data === 'string') {
              envelope = JSON.parse(data);
            }
            queueEnvelope(envelope);
          } catch (error) {
            eventBus.emit('error', error);
          }
        },
        close() {
          if (this.readyState === 3) {
            eventBus.emit('close');
            return;
          }
          this.readyState = 3;
          eventBus.emit('close');
        },
        on(event, handler) {
          eventBus.on(event, handler);
        },
        once(event, handler) {
          eventBus.once(event, handler);
        },
        off(event, handler) {
          if (eventBus.off) {
            eventBus.off(event, handler);
          } else {
            eventBus.removeListener(event, handler);
          }
        },
      }
    : null;

  let sigintHandler = null;
  let rl = null;
  let rlIsActive = false;
  let rlClosedByShutdown = false;

  const shutdown = (code = 0) => {
    if (closed) return;
    closed = true;

    canWrite = false;
    pendingEnvelopes.length = 0;

    if (socket && socket.readyState !== 3) {
      socket.close();
    }

    try {
      gatewayWrite.end();
    } catch (error) {
      // ignore
    }

    try {
      gatewayRead.destroy();
    } catch (error) {
      // ignore
    }

    if (rl && rlIsActive) {
      rlClosedByShutdown = true;
      rl.close();
    }

    if (sigintHandler) {
      process.off('SIGINT', sigintHandler);
      sigintHandler = null;
    }

    process.exitCode = process.exitCode ?? code;

    if (resolveSession) {
      resolveSession();
      resolveSession = null;
    }
  };

  let handleEnvelope;

  if (useAdvancedUi) {
    handleEnvelope = (envelope) => {
      eventBus.emit('message', JSON.stringify(envelope));
    };

    const uiInstance = startAdvancedInteractiveUI(socket, participantId, state.spaceId);
    if (uiInstance.waitUntilExit) {
      uiInstance.waitUntilExit().finally(() => {
        shutdown(0);
      });
    } else {
      eventBus.once('close', () => shutdown(0));
    }
  } else {
    const sendChat = (text) => {
      if (!text.trim()) return;
      queueEnvelope({
        protocol: 'mew/v0.3',
        kind: 'chat',
        payload: {
          text,
          format: 'plain',
        },
      });
    };

    const handleCommand = (line) => {
      const [command, ...rest] = line.trim().split(' ');
      const arg = rest.join(' ');

      switch (command) {
        case '/help':
          console.log('Commands:');
          console.log('  /help        Show this help');
          console.log('  /json <obj>  Send raw JSON envelope (merged with defaults)');
          console.log('  /quit        Disconnect');
          console.log('  /participants List participants from configuration');
          break;
        case '/quit':
          if (rl) rl.close();
          break;
        case '/participants': {
          const participants = Object.keys(spaceConfig.participants || {});
          console.log(`Participants: ${participants.join(', ') || 'none'}`);
          break;
        }
        case '/json': {
          if (!arg) {
            console.log('Usage: /json {"kind":"chat","payload":{...}}');
            break;
          }
          try {
            const envelope = JSON.parse(arg);
            if (!envelope.protocol) {
              envelope.protocol = 'mew/v0.3';
            }
            queueEnvelope(envelope);
          } catch (error) {
            console.error('Invalid JSON:', error.message);
          }
          break;
        }
        default:
          console.log(`Unknown command ${command}. Type /help for help.`);
      }
    };

    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: useColor ? chalk.green('mew> ') : 'mew> ',
    });
    rlIsActive = true;

    rl.on('line', (line) => {
      if (!line.trim()) {
        rl.prompt();
        return;
      }

      if (line.startsWith('/')) {
        handleCommand(line);
      } else {
        sendChat(line);
      }

      rl.prompt();
    });

    rl.on('close', () => {
      rlIsActive = false;
      if (!rlClosedByShutdown) {
        console.log('Disconnecting…');
      }
      shutdown(0);
    });

    rl.on('SIGINT', () => {
      rl.close();
    });

    sigintHandler = () => {
      rl.close();
    };
    process.on('SIGINT', sigintHandler);

    handleEnvelope = (envelope) => {
      describeEnvelope(envelope, {
        spaceId: state.spaceId,
        participantId,
        useColor,
        debug,
      });
      if (!debug && rl) {
        rl.prompt(true);
      }
    };

    rl.prompt();
  }

  const parser = new FrameParser((envelope) => {
    if (!handleEnvelope) return;
    try {
      handleEnvelope(envelope);
    } catch (error) {
      if (!useAdvancedUi) {
        console.error('Failed to handle envelope:', error.message);
      }
    }
  });

  gatewayRead.on('data', (chunk) => {
    try {
      parser.push(chunk);
    } catch (error) {
      if (useAdvancedUi) {
        eventBus.emit('error', error);
      } else {
        console.error('Failed to parse data from gateway:', error.message);
      }
    }
  });

  gatewayRead.on('error', (error) => {
    if (useAdvancedUi) {
      eventBus.emit('error', error);
    } else {
      console.error('Gateway read error:', error.message);
    }
    shutdown(1);
  });

  gatewayRead.on('close', () => {
    if (!useAdvancedUi) {
      console.log('Gateway closed the connection.');
    }
    shutdown(0);
  });

  gatewayWrite.on('error', (error) => {
    if (useAdvancedUi) {
      eventBus.emit('error', error);
    } else {
      console.error('Gateway write error:', error.message);
    }
    shutdown(1);
  });

  gatewayWrite.on('open', () => {
    writeReady = true;
    if (useAdvancedUi) {
      socket.readyState = 1;
      eventBus.emit('open');
    }
    const joinEnvelope = {
      protocol: 'mew/v0.3',
      kind: 'system/join',
      id: `join-${Date.now()}`,
      payload: {
        space: state.spaceId,
        participantId,
        token,
      },
      ts: new Date().toISOString(),
    };
    if (debug) {
      console.log('Sending join envelope:', JSON.stringify(joinEnvelope));
    }
    sendRawEnvelope(joinEnvelope);
    flushPending();
  });

  await sessionDone;
}

async function spaceUpAction(options) {
  const spaceDir = path.resolve(options.spaceDir || '.');
  let configPath = options.config
    ? (path.isAbsolute(options.config)
        ? options.config
        : path.join(spaceDir, options.config))
    : path.join(spaceDir, 'space.yaml');

  if (!fs.existsSync(configPath)) {
    const altConfig = path.join(spaceDir, '.mew', 'space.yaml');
    if (fs.existsSync(altConfig)) {
      configPath = altConfig;
    }
  }

  const { config, configPath: resolvedConfigPath } = loadSpaceConfig(configPath);
  const spaceId = config?.space?.id;
  if (!spaceId) {
    console.error('space.id missing from configuration');
    process.exit(1);
  }

  const transportConfig = config.space?.transport || {};
  const defaultTransport = transportConfig.default || 'stdio';
  const transportOverrides = transportConfig.overrides || {};

  const existingState = readState(spaceDir);
  if (existingState && isPidRunning(existingState.gateway?.pid)) {
    console.error('Space already appears to be running. Run "mew space down" first.');
    process.exit(1);
  }

  console.log(`Starting space ${spaceId} in ${spaceDir}`);

  const logsDir = path.join(spaceDir, 'logs');
  ensureDir(logsDir);
  const fifoDir = path.join(spaceDir, '.mew', 'fifos');
  ensureDir(fifoDir);

  const participantEntries = Object.entries(config.participants || {});
  const participantsState = {};
  const tokens = new Map();
  const participantTransports = new Map();

  for (const [participantId, participantConfig] of participantEntries) {
    const resolvedTransport =
      participantConfig.transport || transportOverrides[participantId] || defaultTransport;
    participantTransports.set(participantId, resolvedTransport);

    const token = ensureToken(spaceDir, participantId, participantConfig);
    tokens.set(participantId, token);

    if (resolvedTransport === 'stdio') {
      await createFifoPair(fifoDir, participantId);
    }
  }

  const gatewayLog = path.join(logsDir, 'gateway.log');
  const gatewayErrLog = path.join(logsDir, 'gateway-error.log');

  const gatewayPid = spawnDetached(
    process.execPath,
    [path.join(__dirname, '../../bin/mew.js'), 'gateway', 'start', '--space-config', resolvedConfigPath, '--fifo-dir', fifoDir, '--log-level', options.logLevel || 'info'],
    {
      cwd: spaceDir,
      env: process.env,
      stdout: gatewayLog,
      stderr: gatewayErrLog,
    },
  );

  console.log(`Gateway started (PID ${gatewayPid})`);

  const tokenDir = path.join(spaceDir, '.mew', 'tokens');

  const remoteParticipants = [];

  for (const [participantId, participantConfig] of participantEntries) {
    const transport = participantTransports.get(participantId) || 'stdio';

    if (transport !== 'stdio') {
      participantsState[participantId] = {
        transport,
        tokenPath: path.join(tokenDir, `${participantId}.token`),
      };

      if (participantConfig.auto_start) {
        console.warn(
          `Participant ${participantId} has transport '${transport}' so auto_start is ignored.`,
        );
      }
      remoteParticipants.push(participantId);
      continue;
    }

    if (!participantConfig.auto_start) {
      participantsState[participantId] = {
        transport,
        fifoIn: path.join(fifoDir, `${participantId}.in`),
        fifoOut: path.join(fifoDir, `${participantId}.out`),
        tokenPath: path.join(tokenDir, `${participantId}.token`),
      };
      continue;
    }

    const fifoIn = path.join(fifoDir, `${participantId}.in`);
    const fifoOut = path.join(fifoDir, `${participantId}.out`);
    const adapterLog = path.join(logsDir, `${participantId}-adapter.log`);
    const adapterErrLog = path.join(logsDir, `${participantId}-adapter-error.log`);

    const args = [
      path.join(__dirname, '../../bin/mew-stdio-adapter.js'),
      '--fifo-in',
      fifoIn,
      '--fifo-out',
      fifoOut,
      '--space',
      spaceId,
      '--participant-id',
      participantId,
      '--token',
      tokens.get(participantId),
      '--log-file',
      adapterLog,
    ];

    if (participantConfig.command) {
      args.push('--command', participantConfig.command);
    }
    if (participantConfig.args && participantConfig.args.length) {
      args.push('--args', ...participantConfig.args);
    }
    if (participantConfig.cwd) {
      args.push('--cwd', participantConfig.cwd);
    }
    if (participantConfig.env) {
      const envPairs = Object.entries(participantConfig.env).map(
        ([key, value]) => `${key}=${value}`,
      );
      if (envPairs.length) {
        args.push('--env', ...envPairs);
      }
    }

    const adapterPid = spawnDetached(process.execPath, args, {
      cwd: spaceDir,
      env: process.env,
      stdout: adapterLog,
      stderr: adapterErrLog,
    });

    participantsState[participantId] = {
      transport,
      adapterPid,
      fifoIn,
      fifoOut,
      logs: {
        adapter: adapterLog,
        error: adapterErrLog,
      },
      tokenPath: path.join(tokenDir, `${participantId}.token`),
    };

    console.log(`Adapter started for ${participantId} (PID ${adapterPid})`);
  }

  const websocketListenValueRaw = config.gateway?.websocket?.listen;
  const websocketListenResolved = resolveWebsocketListen(websocketListenValueRaw);

  const websocketRequired =
    remoteParticipants.length > 0 || defaultTransport === 'websocket';

  if (remoteParticipants.length > 0) {
    console.log(
      `Awaiting WebSocket participants (${remoteParticipants.join(', ')}). Gateway listening at ws://${websocketListenResolved}.`,
    );
    console.log('Tokens are stored under .mew/tokens/<participant>.token.');
  }

  const statePath = writeState(spaceDir, {
    spaceId,
    configPath: resolvedConfigPath,
    fifoDir,
    gateway: {
      pid: gatewayPid,
      logs: {
        out: gatewayLog,
        err: gatewayErrLog,
      },
    },
    participants: participantsState,
    transports: {
      default: defaultTransport,
      overrides: transportOverrides,
      websocket: websocketRequired ? websocketListenResolved : null,
    },
  });

  console.log(`Space state written to ${statePath}`);

  if (options.interactive) {
    await spaceConnectAction({
      spaceDir,
      participant: options.participant,
      debug: options.debug || options.simple,
      noUi: options.noUi,
      noColor: options.noColor,
      interactiveSelection: options.interactiveSelection,
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}

async function spaceDownAction(options) {
  const spaceDir = path.resolve(options.spaceDir || '.');
  const state = readState(spaceDir);
  if (!state) {
    console.error('No running space found.');
    process.exit(1);
  }

  console.log(`Stopping space ${state.spaceId}...`);

  for (const [participantId, participantState] of Object.entries(state.participants || {})) {
    if (participantState.adapterPid && isPidRunning(participantState.adapterPid)) {
      try {
        process.kill(participantState.adapterPid, 'SIGTERM');
        console.log(`Sent SIGTERM to adapter ${participantId}`);
      } catch (error) {
        console.error(`Failed to stop adapter ${participantId}: ${error.message}`);
      }
    }
  }

  if (state.gateway?.pid && isPidRunning(state.gateway.pid)) {
    try {
      process.kill(state.gateway.pid, 'SIGTERM');
      console.log('Sent SIGTERM to gateway');
    } catch (error) {
      console.error(`Failed to stop gateway: ${error.message}`);
    }
  }

  removeState(spaceDir);
  console.log('Space stopped');
}

function spaceStatusAction(options) {
  const spaceDir = path.resolve(options.spaceDir || '.');
  const state = readState(spaceDir);
  if (!state) {
    console.log('No running space found.');
    return;
  }

  const gatewayRunning = isPidRunning(state.gateway?.pid);
  console.log(`Space ${state.spaceId}`);
  console.log(`  Gateway PID: ${state.gateway?.pid || 'n/a'} (${gatewayRunning ? 'running' : 'stopped'})`);
  if (state.transports?.websocket) {
    console.log(`  WebSocket listen: ws://${state.transports.websocket}`);
  }

  for (const [participantId, participantState] of Object.entries(state.participants || {})) {
    const transport = participantState.transport || state.transports?.default || 'stdio';
    if (transport === 'stdio') {
      const running = participantState.adapterPid && isPidRunning(participantState.adapterPid);
      console.log(
        `  Adapter ${participantId}: PID ${participantState.adapterPid || 'n/a'} (${running ? 'running' : 'stopped'})`,
      );
    } else {
      console.log(
        `  Remote participant ${participantId}: transport=${transport} (token: ${
          participantState.tokenPath || 'see .mew/tokens'
        })`,
      );
    }
  }
}

function removeFifos(spaceDir) {
  const fifoDir = path.join(spaceDir, '.mew', 'fifos');
  if (!fs.existsSync(fifoDir)) return;
  for (const entry of fs.readdirSync(fifoDir)) {
    const target = path.join(fifoDir, entry);
    try {
      fs.unlinkSync(target);
    } catch (error) {
      // ignore cleanup error
    }
  }
}

function removeLogs(spaceDir) {
  const logsDir = path.join(spaceDir, 'logs');
  if (!fs.existsSync(logsDir)) return;
  for (const entry of fs.readdirSync(logsDir)) {
    const target = path.join(logsDir, entry);
    try {
      fs.unlinkSync(target);
    } catch (error) {
      // ignore cleanup error
    }
  }
}

function spaceCleanAction() {
  const spaceDir = process.cwd();
  removeLogs(spaceDir);
  removeFifos(spaceDir);
  console.log('Cleaned logs and FIFOs');
}

space
  .command('up')
  .description('Start a space with gateway and adapters')
  .option('-c, --config <path>', 'Path to space.yaml', './space.yaml')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .option('-l, --log-level <level>', 'Gateway log level', 'info')
  .option('-i, --interactive', 'Connect interactively after starting the space')
  .option('-p, --participant <id>', 'Participant ID to connect as')
  .option('--debug', 'Show raw envelopes while connected')
  .option('--simple', 'Alias for --debug')
  .option('--no-ui', 'Disable fancy formatting for interactive mode')
  .option('--no-color', 'Disable colored output')
  .action((options) => {
    spaceUpAction(options).catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
  });

space
  .command('connect')
  .description('Attach an interactive terminal to a running space')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .option('-p, --participant <id>', 'Participant ID to connect as')
  .option('--debug', 'Show raw envelopes while connected')
  .option('--simple', 'Alias for --debug')
  .option('--no-ui', 'Disable fancy formatting')
  .option('--no-color', 'Disable colored output')
  .action((options) => {
    spaceConnectAction(options).catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
  });

space
  .command('down')
  .description('Stop a running space')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .action(spaceDownAction);

space
  .command('status')
  .description('Show basic space status')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .action(spaceStatusAction);

space
  .command('clean')
  .description('Remove space logs and FIFOs')
  .action(spaceCleanAction);

space.spaceUpAction = spaceUpAction;
space.spaceDownAction = spaceDownAction;
space.spaceStatusAction = spaceStatusAction;
space.spaceCleanAction = spaceCleanAction;
space.spaceConnectAction = spaceConnectAction;

module.exports = space;
