#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { program } = require('commander');
const { encodeEnvelope, FrameParser } = require('../src/stdio/utils');

program
  .requiredOption('--fifo-in <path>', 'Path to FIFO receiving data from gateway')
  .requiredOption('--fifo-out <path>', 'Path to FIFO sending data to gateway')
  .requiredOption('--space <id>', 'Space identifier')
  .requiredOption('--participant-id <id>', 'Participant identifier')
  .requiredOption('--token <token>', 'Participant token')
  .option('--command <cmd>', 'Command to spawn as participant process')
  .option('--args <args...>', 'Arguments for participant command')
  .option('--cwd <dir>', 'Working directory for participant command')
  .option('--env <pairs...>', 'Environment variable overrides for participant command (KEY=VALUE)')
  .option('--log-file <path>', 'Write adapter logs to the specified file')
  .allowUnknownOption(true)
  .parse(process.argv);

const options = program.opts();

const logTarget = options.logFile ? fs.createWriteStream(options.logFile, { flags: 'a' }) : null;
function log(...args) {
  const line = `[adapter:${options.participantId}] ${args.join(' ')}`;
  if (logTarget) {
    logTarget.write(`${line}\n`);
  } else {
    console.log(line);
  }
}

log('Adapter parsed args', JSON.stringify(options.args || []));
log('Adapter parsed token', options.token);

function logError(...args) {
  const line = `[adapter:${options.participantId}] ${args.join(' ')}`;
  if (logTarget) {
    logTarget.write(`${line}\n`);
  } else {
    console.error(line);
  }
}

function parseEnv(pairs) {
  if (!pairs || pairs.length === 0) {
    return process.env;
  }
  const env = { ...process.env };
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) {
      throw new Error(`Invalid env pair: ${pair}`);
    }
    const key = pair.slice(0, index);
    const value = pair.slice(index + 1);
    env[key] = value;
  }
  return env;
}

const fifoInPath = path.resolve(options.fifoIn);
const fifoOutPath = path.resolve(options.fifoOut);

const gatewayRead = fs.createReadStream(fifoInPath);
const gatewayWrite = fs.createWriteStream(fifoOutPath);

// Keep track of whether we have announced join
let joined = false;

function sendToGateway(envelope) {
  try {
    const payload = encodeEnvelope(envelope);
    gatewayWrite.write(payload);
  } catch (error) {
    logError('Failed to write to gateway FIFO:', error.message);
  }
}

function sendJoin() {
  if (joined) return;
  const joinEnvelope = {
    protocol: 'mew/v0.3',
    kind: 'system/join',
    payload: {
      space: options.space,
      participantId: options.participantId,
      token: options.token,
    },
  };
  log('Join envelope token', options.token);
  sendToGateway(joinEnvelope);
  joined = true;
  log('Sent join handshake to gateway');
}

let participantProcess = null;
let participantIn = process.stdin;
let participantOut = process.stdout;
let participantErr = process.stderr;

if (options.command) {
  const spawnOptions = {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: parseEnv(options.env),
  };
  if (options.cwd) {
    spawnOptions.cwd = path.resolve(options.cwd);
  }

  const childArgs = options.args && options.args[0] === '--' ? options.args.slice(1) : options.args || [];
  log(`Spawning participant process: ${options.command} ${(childArgs || []).join(' ')}`);
  participantProcess = spawn(options.command, childArgs, spawnOptions);
  participantIn = participantProcess.stdin;
  participantOut = participantProcess.stdout;
  participantErr = participantProcess.stderr;

  participantProcess.on('exit', (code, signal) => {
    log(`Participant exited (code=${code}, signal=${signal || 'null'})`);
    sendToGateway({
      protocol: 'mew/v0.3',
      kind: 'system/participant-left',
      payload: {
        participantId: options.participantId,
      },
    });
    process.exit(code ?? 0);
  });

  participantProcess.on('error', (error) => {
    logError('Participant process error:', error.message);
    process.exit(1);
  });
}

const gatewayParser = new FrameParser((envelope) => {
  if (participantIn.writable) {
    participantIn.write(encodeEnvelope(envelope));
  }
});

gatewayRead.on('data', (chunk) => {
  try {
    gatewayParser.push(chunk);
  } catch (error) {
    logError('Failed to parse data from gateway:', error.message);
  }
});

gatewayRead.on('error', (error) => {
  logError('Error reading from gateway FIFO:', error.message);
  process.exit(1);
});

gatewayRead.on('close', () => {
  log('Gateway FIFO closed, shutting down');
  if (participantProcess) {
    participantProcess.kill('SIGTERM');
  }
  process.exit(0);
});

const participantParser = new FrameParser((envelope) => {
  sendToGateway(envelope);
});

participantOut.on('data', (chunk) => {
  try {
    participantParser.push(chunk);
  } catch (error) {
    logError('Failed to parse participant output:', error.message);
  }
});

participantOut.on('error', (error) => {
  logError('Participant stdout error:', error.message);
});

participantOut.on('close', () => {
  log('Participant stdout closed');
});

if (participantErr && participantErr !== process.stderr) {
  participantErr.on('data', (chunk) => {
    logError(`Participant stderr: ${chunk.toString()}`.trim());
  });
}

gatewayWrite.on('open', () => {
  sendJoin();
});

if (!options.command) {
  // Bridge current process stdio if no command is provided
  process.stdin.on('data', (chunk) => {
    try {
      participantParser.push(chunk);
    } catch (error) {
      logError('Failed to parse stdin data:', error.message);
    }
  });

  process.stdin.on('close', () => {
    log('STDIN closed, exiting');
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  log('Adapter received SIGINT');
  if (participantProcess) {
    participantProcess.kill('SIGINT');
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Adapter received SIGTERM');
  if (participantProcess) {
    participantProcess.kill('SIGTERM');
  }
  process.exit(0);
});
