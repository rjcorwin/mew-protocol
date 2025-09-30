/**
 * Key Bindings Configuration for MEW CLI
 *
 * Defines the default keyboard shortcuts and allows customization.
 * Supports cross-platform key combinations.
 *
 * Adapted from Gemini CLI patterns for MEW Protocol CLI.
 *
 * @license MIT
 */

/**
 * Default key bindings for the MEW CLI
 * Each binding can be a single pattern or array of patterns
 */
const defaultKeyBindings = {
  // Text editing
  INSERT_CHAR: { printable: true },
  DELETE_BACKWARD: { key: 'backspace' },
  DELETE_FORWARD: { key: 'delete' },

  // Cursor movement
  MOVE_LEFT: { key: 'left' },
  MOVE_RIGHT: { key: 'right' },
  MOVE_UP: { key: 'up' },
  MOVE_DOWN: { key: 'down' },

  // Word navigation (both Alt and Meta for cross-platform)
  MOVE_WORD_LEFT: [
    { alt: true, key: 'left' },
    { meta: true, key: 'left' },
    { ctrl: true, key: 'left' }  // Some terminals
  ],
  MOVE_WORD_RIGHT: [
    { alt: true, key: 'right' },
    { meta: true, key: 'right' },
    { ctrl: true, key: 'right' }  // Some terminals
  ],

  // Line navigation
  MOVE_LINE_START: [
    { ctrl: true, key: 'a' },
    { key: 'home' }
  ],
  MOVE_LINE_END: [
    { ctrl: true, key: 'e' },
    { key: 'end' }
  ],

  // Buffer navigation
  MOVE_BUFFER_START: [
    { ctrl: true, alt: true, key: 'a' },
    { ctrl: true, key: 'home' }
  ],
  MOVE_BUFFER_END: [
    { ctrl: true, alt: true, key: 'e' },
    { ctrl: true, key: 'end' }
  ],

  // Deletion commands
  DELETE_TO_LINE_END: { ctrl: true, key: 'k' },
  DELETE_TO_LINE_START: { ctrl: true, key: 'u' },
  DELETE_WORD: { ctrl: true, key: 'w' },

  // Multi-line support
  INSERT_NEWLINE: [
    { shift: true, key: 'enter' },
    { alt: true, key: 'enter' }
  ],

  // Submission and cancellation
  SUBMIT: { key: 'enter' },
  CANCEL: { key: 'escape' },

  // History navigation
  HISTORY_PREV: { key: 'up' },
  HISTORY_NEXT: { key: 'down' },

  // Autocomplete
  AUTOCOMPLETE: { key: 'tab' },
  AUTOCOMPLETE_PREV: { shift: true, key: 'tab' },
  AUTOCOMPLETE_ACCEPT: { key: 'enter' },
  AUTOCOMPLETE_CANCEL: { key: 'escape' },

  // Special commands
  CLEAR_SCREEN: { ctrl: true, key: 'l' },
  QUIT: { ctrl: true, key: 'c' },

  // Slash commands
  TRIGGER_COMMAND: { key: '/' },

  // File path completion
  TRIGGER_PATH: { key: '@' }
};

/**
 * Command descriptions for help text
 */
const commandDescriptions = {
  // Text editing
  INSERT_CHAR: 'Insert character',
  DELETE_BACKWARD: 'Delete character before cursor',
  DELETE_FORWARD: 'Delete character at cursor',

  // Cursor movement
  MOVE_LEFT: 'Move cursor left',
  MOVE_RIGHT: 'Move cursor right',
  MOVE_UP: 'Move cursor up / History previous',
  MOVE_DOWN: 'Move cursor down / History next',
  MOVE_WORD_LEFT: 'Move cursor to previous word',
  MOVE_WORD_RIGHT: 'Move cursor to next word',
  MOVE_LINE_START: 'Move cursor to start of line',
  MOVE_LINE_END: 'Move cursor to end of line',
  MOVE_BUFFER_START: 'Move cursor to start of text',
  MOVE_BUFFER_END: 'Move cursor to end of text',

  // Deletion
  DELETE_TO_LINE_END: 'Delete from cursor to end of line',
  DELETE_TO_LINE_START: 'Delete from cursor to start of line',
  DELETE_WORD: 'Delete word before cursor',

  // Multi-line
  INSERT_NEWLINE: 'Insert new line',
  SUBMIT: 'Submit input',
  CANCEL: 'Cancel input',

  // History
  HISTORY_PREV: 'Previous command from history',
  HISTORY_NEXT: 'Next command from history',

  // Autocomplete
  AUTOCOMPLETE: 'Trigger autocomplete',
  AUTOCOMPLETE_PREV: 'Previous autocomplete suggestion',
  AUTOCOMPLETE_ACCEPT: 'Accept autocomplete suggestion',
  AUTOCOMPLETE_CANCEL: 'Cancel autocomplete',

  // Special
  CLEAR_SCREEN: 'Clear screen',
  QUIT: 'Quit application',
  TRIGGER_COMMAND: 'Start slash command',
  TRIGGER_PATH: 'Start file path completion'
};

/**
 * Get human-readable key combination string
 * @param {Object|Array} binding - Key binding pattern(s)
 * @returns {string} - Human-readable string
 */
function getBindingDisplay(binding) {
  if (Array.isArray(binding)) {
    return binding.map(b => getBindingDisplay(b)).join(' or ');
  }

  const parts = [];

  if (binding.ctrl) parts.push('Ctrl');
  if (binding.alt) parts.push('Alt');
  if (binding.meta) parts.push('Option');
  if (binding.shift) parts.push('Shift');

  if (binding.key) {
    const keyName = binding.key.charAt(0).toUpperCase() + binding.key.slice(1);
    parts.push(keyName);
  } else if (binding.printable) {
    return 'Any character';
  }

  return parts.join('+');
}

/**
 * Get help text for all key bindings
 * @param {Object} bindings - Key bindings object
 * @returns {Array} - Array of help text lines
 */
function getHelpText(bindings = defaultKeyBindings) {
  const helpLines = [];
  const categories = {
    'Text Editing': ['INSERT_CHAR', 'DELETE_BACKWARD', 'DELETE_FORWARD'],
    'Cursor Movement': [
      'MOVE_LEFT', 'MOVE_RIGHT', 'MOVE_UP', 'MOVE_DOWN',
      'MOVE_WORD_LEFT', 'MOVE_WORD_RIGHT',
      'MOVE_LINE_START', 'MOVE_LINE_END'
    ],
    'Deletion': ['DELETE_TO_LINE_END', 'DELETE_TO_LINE_START', 'DELETE_WORD'],
    'Multi-line': ['INSERT_NEWLINE', 'SUBMIT', 'CANCEL'],
    'History': ['HISTORY_PREV', 'HISTORY_NEXT'],
    'Autocomplete': ['AUTOCOMPLETE', 'TRIGGER_COMMAND', 'TRIGGER_PATH'],
    'Special': ['CLEAR_SCREEN', 'QUIT']
  };

  for (const [category, commands] of Object.entries(categories)) {
    helpLines.push(`\n${category}:`);
    for (const command of commands) {
      if (bindings[command] && commandDescriptions[command]) {
        const binding = getBindingDisplay(bindings[command]);
        const description = commandDescriptions[command];
        helpLines.push(`  ${binding.padEnd(20)} - ${description}`);
      }
    }
  }

  return helpLines;
}

/**
 * Load user-customized key bindings
 * @param {Object} customBindings - User's custom bindings
 * @returns {Object} - Merged bindings
 */
function loadCustomBindings(customBindings = {}) {
  // Merge custom bindings with defaults
  return {
    ...defaultKeyBindings,
    ...customBindings
  };
}

/**
 * Validate key bindings for conflicts
 * @param {Object} bindings - Key bindings to validate
 * @returns {Array} - Array of conflict warnings
 */
function validateBindings(bindings) {
  const warnings = [];
  const usedCombinations = new Map();

  for (const [command, binding] of Object.entries(bindings)) {
    const patterns = Array.isArray(binding) ? binding : [binding];

    for (const pattern of patterns) {
      if (pattern.printable) continue; // Skip printable char pattern

      const key = JSON.stringify(pattern);
      if (usedCombinations.has(key)) {
        const existingCommand = usedCombinations.get(key);
        warnings.push({
          type: 'conflict',
          message: `Key binding conflict: ${getBindingDisplay(pattern)} is used by both ${command} and ${existingCommand}`,
          commands: [command, existingCommand],
          binding: pattern
        });
      } else {
        usedCombinations.set(key, command);
      }
    }
  }

  return warnings;
}

export {
  defaultKeyBindings,
  commandDescriptions,
  getBindingDisplay,
  getHelpText,
  loadCustomBindings,
  validateBindings
};