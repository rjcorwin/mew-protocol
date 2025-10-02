#!/usr/bin/env node

const readline = require('readline');

const WALL = '⬛';
const WALKWAY = '🟩';

const LEVEL_DEFINITIONS = [
  {
    name: 'Kitten Steps',
    hint: 'A gentle warm-up corridor with just a short turn.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫',
      '🟫S  🟫 🟫',
      '🟫🟫🟫 🟫 🟫',
      '🟫    G🟫',
      '🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Alley Twist',
    hint: 'Stick near the walls—only one column leads all the way through.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫     🟫',
      '🟫 🟫 🟫🟫🟫🟫🟫',
      '🟫 🟫     🟫',
      '🟫 🟫🟫🟫🟫🟫 🟫',
      '🟫      G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Branching Paths',
    hint: 'Detours abound, but only one reaches the far corner.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫       🟫',
      '🟫 🟫🟫🟫🟫🟫 🟫 🟫',
      '🟫     🟫 🟫 🟫',
      '🟫🟫🟫🟫🟫 🟫🟫🟫 🟫',
      '🟫   🟫   🟫 🟫',
      '🟫 🟫 🟫🟫🟫 🟫 🟫',
      '🟫 🟫      G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Crossroads',
    hint: 'Look for gaps that let you snake between the pillars.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫       🟫',
      '🟫 🟫 🟫 🟫🟫🟫 🟫',
      '🟫 🟫 🟫   🟫 🟫',
      '🟫 🟫 🟫🟫🟫 🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫   🟫 🟫 🟫',
      '🟫 🟫🟫🟫🟫🟫 🟫 🟫',
      '🟫       🟫G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Garden Loops',
    hint: 'Dead ends lurk near the edges—keep weaving inward.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S  🟫       🟫',
      '🟫🟫🟫 🟫🟫🟫 🟫🟫🟫 🟫',
      '🟫 🟫   🟫   🟫 🟫',
      '🟫 🟫🟫🟫 🟫 🟫🟫🟫 🟫',
      '🟫   🟫 🟫 🟫   🟫',
      '🟫 🟫🟫🟫 🟫 🟫 🟫🟫🟫',
      '🟫 🟫   🟫 🟫   🟫',
      '🟫 🟫 🟫🟫🟫🟫🟫🟫🟫 🟫',
      '🟫          G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Corridor Crunch',
    hint: 'Wide halls give way to narrow squeezes—watch the center columns.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫   🟫   🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫 🟫 🟫',
      '🟫   🟫   🟫 🟫 🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫 🟫 🟫',
      '🟫   🟫   🟫   🟫',
      '🟫 🟫 🟫🟫🟫 🟫🟫🟫 🟫',
      '🟫 🟫     🟫   🟫',
      '🟫 🟫🟫🟫🟫🟫🟫🟫 🟫🟫🟫',
      '🟫          G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Switchbacks',
    hint: 'Back-and-forth climbs will eventually line up with the exit.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫       🟫   🟫',
      '🟫 🟫🟫🟫 🟫🟫🟫🟫🟫 🟫 🟫',
      '🟫   🟫 🟫     🟫 🟫',
      '🟫🟫🟫 🟫 🟫 🟫🟫🟫🟫🟫 🟫',
      '🟫 🟫 🟫     🟫   🟫',
      '🟫 🟫 🟫🟫🟫🟫🟫🟫🟫 🟫🟫🟫',
      '🟫   🟫     🟫   🟫',
      '🟫 🟫🟫🟫 🟫🟫🟫 🟫🟫🟫 🟫',
      '🟫   🟫 🟫   🟫   🟫',
      '🟫🟫🟫 🟫 🟫 🟫🟫🟫 🟫 🟫',
      '🟫     🟫     🟫G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Courtyard Crawl',
    hint: 'Courtyards open up the center—spiral outward to find the finish.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫           🟫',
      '🟫 🟫🟫🟫🟫🟫🟫🟫 🟫🟫🟫 🟫',
      '🟫       🟫   🟫 🟫',
      '🟫🟫🟫🟫🟫🟫🟫 🟫🟫🟫 🟫 🟫',
      '🟫     🟫   🟫 🟫 🟫',
      '🟫 🟫 🟫🟫🟫🟫🟫 🟫 🟫 🟫',
      '🟫 🟫     🟫   🟫 🟫',
      '🟫 🟫🟫🟫 🟫🟫🟫🟫🟫🟫🟫 🟫',
      '🟫 🟫 🟫 🟫     🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫 🟫🟫🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫     🟫',
      '🟫 🟫 🟫 🟫 🟫🟫🟫🟫🟫🟫🟫',
      '🟫   🟫        G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Keep of Knots',
    hint: 'Two large chambers are connected by a thin winding hallway.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S          🟫   🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫 🟫🟫🟫 🟫',
      '🟫     🟫 🟫   🟫   🟫',
      '🟫 🟫🟫🟫 🟫 🟫 🟫🟫🟫 🟫 🟫',
      '🟫   🟫   🟫 🟫   🟫 🟫',
      '🟫 🟫 🟫🟫🟫 🟫 🟫 🟫🟫🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫   🟫 🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫🟫🟫🟫🟫 🟫 🟫',
      '🟫 🟫 🟫     🟫     🟫',
      '🟫 🟫 🟫 🟫🟫🟫🟫🟫 🟫🟫🟫🟫🟫',
      '🟫 🟫 🟫 🟫   🟫 🟫   🟫',
      '🟫 🟫 🟫🟫🟫 🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫     🟫     🟫G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
  {
    name: 'Nine Lives Finale',
    hint: 'A zig-zagging gauntlet—stay calm and keep course corrections small.',
    layout: [
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
      '🟫S🟫           🟫 🟫',
      '🟫 🟫🟫🟫🟫🟫🟫🟫🟫🟫 🟫 🟫 🟫',
      '🟫     🟫     🟫   🟫',
      '🟫🟫🟫🟫🟫 🟫 🟫🟫🟫🟫🟫🟫🟫 🟫',
      '🟫 🟫   🟫 🟫     🟫 🟫',
      '🟫 🟫 🟫🟫🟫 🟫 🟫🟫🟫 🟫 🟫',
      '🟫   🟫   🟫   🟫 🟫 🟫',
      '🟫 🟫🟫🟫 🟫 🟫🟫🟫🟫🟫 🟫 🟫',
      '🟫 🟫   🟫 🟫   🟫   🟫',
      '🟫 🟫🟫🟫 🟫 🟫 🟫 🟫 🟫🟫🟫',
      '🟫   🟫 🟫   🟫 🟫 🟫 🟫',
      '🟫🟫🟫 🟫🟫🟫🟫🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫 🟫   🟫 🟫 🟫 🟫 🟫',
      '🟫 🟫 🟫 🟫 🟫🟫🟫 🟫 🟫 🟫',
      '🟫     🟫     🟫  G🟫',
      '🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫🟫',
    ],
  },
];

const TOOL_DEFINITIONS = [
  {
    name: 'view',
    description: 'Show the current maze board, level progress, and hint.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'up',
    description: 'Move the cat one tile north (⬆️).',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'down',
    description: 'Move the cat one tile south (⬇️).',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'left',
    description: 'Move the cat one tile west (⬅️).',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'right',
    description: 'Move the cat one tile east (➡️).',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'restart',
    description: 'Restart the adventure from level 1 with fresh move counters.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

const DIRECTIONS = {
  up: { delta: [-1, 0], label: 'north', emoji: '⬆️' },
  down: { delta: [1, 0], label: 'south', emoji: '⬇️' },
  left: { delta: [0, -1], label: 'west', emoji: '⬅️' },
  right: { delta: [0, 1], label: 'east', emoji: '➡️' },
};

function buildLevels(definitions) {
  return definitions.map((def) => {
    const grid = def.layout.map((row) => Array.from(row));
    let start = null;
    let goal = null;

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const cell = grid[row][col];
        if (cell === 'S') {
          start = { row, col };
          grid[row][col] = WALKWAY;
        } else if (cell === 'G') {
          goal = { row, col };
          grid[row][col] = WALKWAY;
        } else if (cell === ' ') {
          grid[row][col] = WALKWAY;
        } else if (cell === '🟫') {
          grid[row][col] = WALL;
        }
      }
    }

    if (!start || !goal) {
      throw new Error(`Level "${def.name}" is missing a start or goal`);
    }

    return {
      name: def.name,
      hint: def.hint,
      grid,
      start,
      goal,
      width: grid[0].length,
      height: grid.length,
    };
  });
}

const levels = buildLevels(LEVEL_DEFINITIONS);

const state = {
  levelIndex: 0,
  cat: { ...levels[0].start },
  movesThisLevel: 0,
  totalMoves: 0,
  runsCompleted: 0,
};

function resetToLevel(index) {
  state.levelIndex = index;
  state.cat = { ...levels[index].start };
  state.movesThisLevel = 0;
}

function restartAdventure() {
  resetToLevel(0);
  state.totalMoves = 0;
  const board = buildBoardString();
  const summary = buildStateSummary({ board });
  sendMoveNotification({
    direction: 'restart',
    status: 'restart',
    board,
    state: summary,
  });
  return {
    content: [
      {
        type: 'text',
        text: [
          '🔄 Restarting the maze adventure!',
          `Back to level 1/${levels.length}: ${levels[0].name}.`,
          board,
          `Moves this level: ${summary.movesThisLevel} | Total moves: ${summary.totalMoves}`,
          `Runs completed: ${summary.runsCompleted}`,
          levels[0].hint ? `Hint: ${levels[0].hint}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    state: summary,
  };
}

function buildBoardString() {
  const level = levels[state.levelIndex];
  return level.grid
    .map((row, rowIdx) =>
      row
        .map((cell, colIdx) => {
          if (state.cat.row === rowIdx && state.cat.col === colIdx) {
            return '🐈';
          }
          if (level.goal.row === rowIdx && level.goal.col === colIdx) {
            return '🏡';
          }
          return cell === WALL ? WALL : WALKWAY;
        })
        .join(''),
    )
    .join('\n');
}

function buildStateSummary(extra = {}) {
  const level = levels[state.levelIndex];
  return {
    level: state.levelIndex + 1,
    levelName: level.name,
    totalLevels: levels.length,
    movesThisLevel: state.movesThisLevel,
    totalMoves: state.totalMoves,
    runsCompleted: state.runsCompleted,
    cat: { row: state.cat.row, col: state.cat.col },
    goal: { row: level.goal.row, col: level.goal.col },
    width: level.width,
    height: level.height,
    ...extra,
  };
}

function sendMoveNotification({
  direction,
  status,
  board,
  state: summary,
  ...extra
}) {
  const payload = {
    category: 'cat-maze/move',
    direction,
    status,
    board: board ?? summary?.board ?? buildBoardString(),
    state: summary,
    timestamp: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  sendNotification('notifications/message', payload);
}

function formatView() {
  const level = levels[state.levelIndex];
  const board = buildBoardString();
  const lines = [
    `Level ${state.levelIndex + 1}/${levels.length}: ${level.name}`,
    board,
    `Moves this level: ${state.movesThisLevel} | Total moves: ${state.totalMoves}`,
    `Runs completed: ${state.runsCompleted}`,
  ];
  if (level.hint) {
    lines.push(`Hint: ${level.hint}`);
  }
  return {
    content: [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ],
    state: buildStateSummary({ board }),
  };
}

function attemptMove(directionName) {
  const info = DIRECTIONS[directionName];
  if (!info) {
    return {
      content: [
        {
          type: 'text',
          text: `Unknown direction: ${directionName}`,
        },
      ],
      state: buildStateSummary(),
    };
  }

  const level = levels[state.levelIndex];
  const targetRow = state.cat.row + info.delta[0];
  const targetCol = state.cat.col + info.delta[1];

  if (
    targetRow < 0 ||
    targetRow >= level.height ||
    targetCol < 0 ||
    targetCol >= level.width ||
    level.grid[targetRow][targetCol] === WALL
  ) {
    const board = buildBoardString();
    const text = `Thud! A wall blocks the path to the ${info.label}.`;
    return {
      content: [
        {
          type: 'text',
          text: `${text}\n${board}`,
        },
      ],
      state: buildStateSummary({ board }),
    };
  }

  state.cat = { row: targetRow, col: targetCol };
  state.movesThisLevel += 1;
  state.totalMoves += 1;

  const boardAfterMove = buildBoardString();
  const moveLine = `The cat pads ${info.label} ${info.emoji}.`;

  const reachedGoal = targetRow === level.goal.row && targetCol === level.goal.col;

  const sections = [
    `${moveLine}\n${boardAfterMove}`,
    `Moves this level: ${state.movesThisLevel} | Total moves: ${state.totalMoves}`,
  ];

  const moveSummary = buildStateSummary({ board: boardAfterMove });

  if (!reachedGoal) {
    if (level.hint) {
      sections.push(`Hint: ${level.hint}`);
    }
    const response = {
      content: [
        {
          type: 'text',
          text: sections.join('\n'),
        },
      ],
      state: moveSummary,
    };
    sendMoveNotification({
      direction: directionName,
      status: 'moved',
      board: moveSummary.board,
      state: moveSummary,
      directionLabel: info.label,
      emoji: info.emoji,
    });
    return response;
  }

  const completedLevelNumber = state.levelIndex + 1;
  const completedLevelName = level.name;
  const previousBoard = moveSummary.board;

  if (state.levelIndex + 1 < levels.length) {
    const nextIndex = state.levelIndex + 1;
    const nextLevel = levels[nextIndex];
    resetToLevel(nextIndex);
    const nextBoard = buildBoardString();
    const nextSummary = buildStateSummary({ board: nextBoard });
    sections.push(`🎉 Level ${completedLevelNumber} complete! ${completedLevelName}`);
    sections.push(`Starting level ${nextIndex + 1}/${levels.length}: ${nextLevel.name}`);
    if (nextLevel.hint) {
      sections.push(`Hint: ${nextLevel.hint}`);
    }
    sections.push(nextBoard);
    const response = {
      content: [
        {
          type: 'text',
          text: sections.join('\n\n'),
        },
      ],
      state: nextSummary,
    };
    sendMoveNotification({
      direction: directionName,
      status: 'level-complete',
      board: nextSummary.board,
      state: nextSummary,
      previousBoard,
      completedLevel: completedLevelNumber,
      completedLevelName,
      directionLabel: info.label,
      emoji: info.emoji,
    });
    return response;
  }

  state.runsCompleted += 1;
  resetToLevel(0);
  const newBoard = buildBoardString();
  const restartSummary = buildStateSummary({ board: newBoard });
  sections.push(`🎉 Level ${completedLevelNumber} complete! ${completedLevelName}`);
  sections.push(
    `You guided the cat through all ${levels.length} levels! Total runs: ${state.runsCompleted}.`
  );
  sections.push(`Restarting at level 1: ${levels[0].name}`);
  sections.push(newBoard);

  const response = {
    content: [
      {
        type: 'text',
        text: sections.join('\n\n'),
      },
    ],
    state: restartSummary,
  };
  sendMoveNotification({
    direction: directionName,
    status: 'adventure-complete',
    board: restartSummary.board,
    state: restartSummary,
    previousBoard,
    completedLevel: completedLevelNumber,
    completedLevelName,
    directionLabel: info.label,
    emoji: info.emoji,
  });
  return response;
}

function handleToolsCall(request) {
  const name = request.params?.name;
  const toolName = typeof name === 'string' ? name : undefined;

  if (!toolName) {
    throw { code: -32602, message: 'tools/call requires a tool name' };
  }

  switch (toolName) {
    case 'view':
      return formatView();
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return attemptMove(toolName);
    case 'restart':
      return restartAdventure();
    default:
      throw { code: -32601, message: `Unknown tool: ${toolName}` };
  }
}

function handleRequest(request) {
  const { id, method } = request;

  try {
    if (method === 'initialize') {
      const result = {
        protocolVersion: '0.1.0',
        serverInfo: {
          name: 'cat-maze-mcp',
          version: '1.0.0',
          description: 'Stateful MCP maze game starring a cat emoji.',
        },
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
      };
      sendResponse(id, result);
      return;
    }

    if (method === 'tools/list') {
      sendResponse(id, { tools: TOOL_DEFINITIONS });
      return;
    }

    if (method === 'tools/call') {
      const result = handleToolsCall(request);
      sendResponse(id, result);
      return;
    }

    if (method === 'shutdown') {
      sendResponse(id, {});
      process.exit(0);
      return;
    }

    throw { code: -32601, message: `Unknown method: ${method}` };
  } catch (error) {
    if (error && typeof error.code === 'number') {
      sendError(id, error.code, error.message);
    } else {
      sendError(id, -32603, error?.message || 'Internal error');
    }
  }
}

function sendResponse(id, result) {
  const message = {
    jsonrpc: '2.0',
    id,
    result,
  };
  process.stdout.write(JSON.stringify(message) + '\n');
}

function sendError(id, code, message) {
  const error = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };
  process.stdout.write(JSON.stringify(error) + '\n');
}

function sendNotification(method, params) {
  const message = {
    jsonrpc: '2.0',
    method,
    params,
  };
  process.stdout.write(JSON.stringify(message) + '\n');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch (error) {
    process.stderr.write(`Failed to parse MCP request: ${error.message}\n`);
    return;
  }

  if (message.id !== undefined && message.method) {
    handleRequest(message);
    return;
  }

  // Ignore notifications we don't handle explicitly
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
