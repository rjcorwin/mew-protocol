/**
 * Slash command metadata and fuzzy matching utilities for the MEW CLI.
 */

const slashCommandList = [
  { command: '/help', description: 'Show this help message', category: 'General' },
  { command: '/verbose', description: 'Toggle verbose output', category: 'General' },
  { command: '/streams', description: 'Toggle stream data display', category: 'General' },
  {
    command: '/ui board',
    usage: '/ui board [open|close|auto]',
    description: 'Control Signal Board visibility',
    category: 'General'
  },
  { command: '/ui-clear', description: 'Clear local UI buffers', category: 'General' },
  { command: '/ui-board', description: 'Toggle Signal Board visibility', category: 'General' },
  { command: '/exit', description: 'Exit the application', category: 'General' },

  {
    command: '/ack',
    usage: '/ack [selector] [status]',
    description: 'Acknowledge chat messages',
    category: 'Chat Queue'
  },
  {
    command: '/cancel',
    usage: '/cancel [selector] [reason]',
    description: 'Cancel reasoning or pending chats',
    category: 'Chat Queue'
  },

  {
    command: '/status',
    usage: '/status <participant> [fields...]',
    description: 'Request participant status',
    category: 'Participant Controls'
  },
  {
    command: '/pause',
    usage: '/pause <participant> [timeout] [reason]',
    description: 'Pause a participant',
    category: 'Participant Controls'
  },
  {
    command: '/resume',
    usage: '/resume <participant> [reason]',
    description: 'Resume a participant',
    category: 'Participant Controls'
  },
  {
    command: '/forget',
    usage: '/forget <participant> [oldest|newest] [count]',
    description: 'Forget participant history',
    category: 'Participant Controls'
  },
  {
    command: '/clear',
    usage: '/clear <participant> [reason]',
    description: 'Clear a participant queue',
    category: 'Participant Controls'
  },
  {
    command: '/restart',
    usage: '/restart <participant> [mode] [reason]',
    description: 'Restart a participant',
    category: 'Participant Controls'
  },
  {
    command: '/shutdown',
    usage: '/shutdown <participant> [reason]',
    description: 'Shut down a participant',
    category: 'Participant Controls'
  },

  {
    command: '/stream request',
    usage: '/stream request <participant> <direction> [description] [size=bytes]',
    description: 'Request a new stream',
    category: 'Streams'
  },
  {
    command: '/stream close',
    usage: '/stream close <streamId> [reason]',
    description: 'Close an existing stream',
    category: 'Streams'
  },
];

const slashCommandGroups = ['General', 'Chat Queue', 'Participant Controls', 'Streams'];

/**
 * Perform a basic fuzzy match between an input string and a command.
 * Returns a numeric score if the command matches, otherwise null.
 * Lower scores indicate better matches.
 *
 * @param {string} input - The user input.
 * @param {string} command - The command to score.
 * @returns {number|null}
 */
function fuzzyScore(input, command) {
  const needle = input.trim().toLowerCase();
  const haystack = command.toLowerCase();

  if (!needle) {
    return 0;
  }

  let score = 0;
  let lastIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, lastIndex + 1);
    if (index === -1) {
      return null;
    }
    // Penalise gaps to favour contiguous matches.
    score += index - (lastIndex + 1);
    lastIndex = index;
  }

  // Small penalty for commands that are much longer than the input.
  score += (haystack.length - needle.length) * 0.01;

  return score;
}

/**
 * Get fuzzy-matched slash commands for the current input.
 *
 * @param {string} input - Current input buffer contents.
 * @param {number} [limit=8] - Maximum number of suggestions to return.
 * @returns {Array<{command: string, description: string, category: string}>}
 */
function getSlashCommandSuggestions(input, limit = 8) {
  if (!input || !input.trim().startsWith('/')) {
    return [];
  }

  const scored = slashCommandList
    .map((entry) => {
      const score = fuzzyScore(input, entry.command);
      return score === null ? null : { ...entry, score };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      return a.command.localeCompare(b.command);
    });

  return scored.slice(0, limit).map(({ score, ...entry }) => entry);
}

module.exports = {
  slashCommandList,
  slashCommandGroups,
  getSlashCommandSuggestions,
};

