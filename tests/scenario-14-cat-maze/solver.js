#!/usr/bin/env node
/**
 * Scenario 14 solver - drives the cat maze MCP server from level 1 to the finale.
 */

const fs = require('fs');
const { spawn } = require('child_process');
const readline = require('readline');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--server') {
      options.server = args[++i];
    } else if (arg === '--log') {
      options.logPath = args[++i];
    } else if (arg === '--timeout') {
      options.timeoutMs = Number(args[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.server) {
    throw new Error('Missing required --server path');
  }
  options.timeoutMs = options.timeoutMs || 5000;
  return options;
}

function createLogger(logPath) {
  if (!logPath) {
    return { info: () => {}, error: () => {} };
  }
  const stream = fs.createWriteStream(logPath, { flags: 'a' });
  return {
    info(message) {
      stream.write(`[INFO] ${message}\n`);
    },
    error(message) {
      stream.write(`[ERROR] ${message}\n`);
    },
    close() {
      stream.end();
    },
  };
}

const WALL = '🟫';

function findPath(board) {
  const rows = board.split('\n');
  const height = rows.length;
  const width = Array.from(rows[0] || '').length;
  const grid = rows.map((row) => Array.from(row));
  let start = null;
  let goal = null;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const cell = grid[row][col];
      if (cell === '🐈') {
        start = { row, col };
        grid[row][col] = ' ';
      } else if (cell === '🏁') {
        goal = { row, col };
        grid[row][col] = ' ';
      }
    }
  }

  if (!start || !goal) {
    throw new Error('Board missing start or goal');
  }

  const deltas = [
    { name: 'up', row: -1, col: 0 },
    { name: 'down', row: 1, col: 0 },
    { name: 'left', row: 0, col: -1 },
    { name: 'right', row: 0, col: 1 },
  ];

  const queue = [];
  const visited = new Set();
  const prev = new Map();

  function key(pos) {
    return `${pos.row},${pos.col}`;
  }

  queue.push(start);
  visited.add(key(start));

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.row === goal.row && current.col === goal.col) {
      break;
    }
    for (const delta of deltas) {
      const next = { row: current.row + delta.row, col: current.col + delta.col };
      if (
        next.row < 0 ||
        next.row >= height ||
        next.col < 0 ||
        next.col >= width ||
        grid[next.row][next.col] === WALL
      ) {
        continue;
      }
      const nextKey = key(next);
      if (visited.has(nextKey)) {
        continue;
      }
      visited.add(nextKey);
      prev.set(nextKey, { from: current, dir: delta.name });
      queue.push(next);
    }
  }

  if (!visited.has(`${goal.row},${goal.col}`)) {
    throw new Error('No path from start to goal on board');
  }

  const path = [];
  let cursorKey = key(goal);
  while (cursorKey !== key(start)) {
    const step = prev.get(cursorKey);
    if (!step) {
      throw new Error('Failed to reconstruct path');
    }
    path.push(step.dir);
    cursorKey = key(step.from);
  }

  return path.reverse();
}

async function main() {
  const options = parseArgs();
  const logger = createLogger(options.logPath);
  logger.info(`Launching cat maze server: ${options.server}`);

  const server = spawn('node', [options.server], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  });

  server.stderr.on('data', (chunk) => {
    logger.error(chunk.toString().trim());
  });

  const rl = readline.createInterface({ input: server.stdout });

  const pending = new Map();
  let nextId = 1;

  function send(method, params) {
    const id = nextId;
    nextId += 1;
    const message = { jsonrpc: '2.0', id, method, params };
    const payload = JSON.stringify(message);
    logger.info(`→ ${payload}`);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request ${id} timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
      pending.set(id, { resolve, reject, timeout });
      server.stdin.write(`${payload}\n`);
    });
  }

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    logger.info(`← ${trimmed}`);
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch (error) {
      logger.error(`Failed to parse server output: ${error.message}`);
      return;
    }
    if (typeof message.id === 'undefined') {
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) {
      logger.error(`No pending request for response id ${message.id}`);
      return;
    }
    clearTimeout(entry.timeout);
    pending.delete(message.id);
    if (message.error) {
      entry.reject(new Error(message.error.message || 'Server returned error'));
    } else {
      entry.resolve(message.result);
    }
  });

  try {
    await send('initialize', {});
    await send('tools/list', {});

    let currentState = null;
    const encounteredLevels = [];
    let targetRunCompletions = 1;
    let runComplete = false;

    async function callTool(name, args = {}) {
      return send('tools/call', { name, arguments: args });
    }

    const updateEncountered = (state) => {
      const { level } = state;
      if (encounteredLevels[encounteredLevels.length - 1] !== level) {
        encounteredLevels.push(level);
      }
    };

    while (!runComplete) {
      if (!currentState) {
        const view = await callTool('view');
        currentState = view.state;
      }

      updateEncountered(currentState);

      const path = findPath(currentState.board);
      if (path.length === 0) {
        throw new Error(`No moves found for level ${currentState.level}`);
      }

      for (let i = 0; i < path.length; i += 1) {
        const direction = path[i];
        const response = await callTool(direction, {});
        const state = response.state;
        if (!state) {
          throw new Error(`Missing state after move ${direction}`);
        }
        currentState = state;
        if (state.runsCompleted >= targetRunCompletions) {
          runComplete = true;
          break;
        }
        if (state.level !== encounteredLevels[encounteredLevels.length - 1]) {
          updateEncountered(state);
          break;
        }
      }
    }

    if (currentState.runsCompleted !== targetRunCompletions) {
      throw new Error(`Expected runsCompleted=${targetRunCompletions}, got ${currentState.runsCompleted}`);
    }

    const { totalLevels } = currentState;
    const uniqueLevels = Array.from(new Set(encounteredLevels));
    if (uniqueLevels.length !== totalLevels) {
      throw new Error(
        `Expected to see ${totalLevels} levels, saw ${uniqueLevels.length}: ${uniqueLevels.join(', ')}`,
      );
    }

    const expectedSequence = Array.from({ length: totalLevels }, (_, idx) => idx + 1).join(',');
    const actualSequence = encounteredLevels.slice(0, totalLevels).join(',');
    if (actualSequence !== expectedSequence) {
      throw new Error(`Levels were visited in unexpected order. Expected ${expectedSequence}, got ${actualSequence}`);
    }

    if (currentState.level !== 1) {
      throw new Error(`Expected to restart at level 1, got level ${currentState.level}`);
    }

    await send('shutdown', {});
    logger.info('Cat maze run completed.');
    logger.close();
  } catch (error) {
    logger.error(error.stack || error.message);
    logger.close();
    server.kill('SIGTERM');
    throw error;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
