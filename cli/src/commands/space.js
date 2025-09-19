const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawn } = require('child_process');
const crypto = require('crypto');

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

async function spaceUpAction(options) {
  const spaceDir = path.resolve(options.spaceDir || '.');
  const configPath = path.isAbsolute(options.config)
    ? options.config
    : path.join(spaceDir, options.config || './space.yaml');

  const { config, configPath: resolvedConfigPath } = loadSpaceConfig(configPath);
  const spaceId = config?.space?.id;
  if (!spaceId) {
    console.error('space.id missing from configuration');
    process.exit(1);
  }

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

  for (const [participantId, participantConfig] of participantEntries) {
    tokens.set(participantId, ensureToken(spaceDir, participantId, participantConfig));
    await createFifoPair(fifoDir, participantId);
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

  for (const [participantId, participantConfig] of participantEntries) {
    if (!participantConfig.auto_start) continue;

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
      adapterPid,
      fifoIn,
      fifoOut,
      logs: {
        adapter: adapterLog,
        error: adapterErrLog,
      },
    };

    console.log(`Adapter started for ${participantId} (PID ${adapterPid})`);
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
  });

  console.log(`Space state written to ${statePath}`);
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

  for (const [participantId, participantState] of Object.entries(state.participants || {})) {
    const running = isPidRunning(participantState.adapterPid);
    console.log(
      `  Adapter ${participantId}: PID ${participantState.adapterPid || 'n/a'} (${running ? 'running' : 'stopped'})`,
    );
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
  .action((options) => {
    spaceUpAction(options).catch((error) => {
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

module.exports = space;
module.exports.spaceUpAction = spaceUpAction;
module.exports.spaceDownAction = spaceDownAction;
