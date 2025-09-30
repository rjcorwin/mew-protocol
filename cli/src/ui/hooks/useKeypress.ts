// @ts-nocheck
/**
 * useKeypress Hook
 *
 * Provides enhanced keyboard input handling for the terminal UI.
 * Captures and processes keyboard events with support for special keys,
 * modifiers, and key combinations.
 *
 * Adapted from Gemini CLI patterns for MEW Protocol CLI.
 *
 * @license MIT
 */

const { useInput } = require('ink');
const { useCallback, useRef } = require('react');

/**
 * Enhanced keypress hook with better key detection
 * @param {Function} handler - Callback function for key events
 * @param {Object} options - Configuration options
 * @returns {void}
 */
function useKeypress(handler, options = {}) {
  const {
    isActive = true,
    preventDefault = true,
    captureNumbers = true,
    captureArrows = true
  } = options;

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const processKey = useCallback((input, key) => {
    if (!isActive) return;

    // Debug logging for raw key from Ink
    if (input === '\x7F' || key.sequence === '\x7F' || key.name === 'delete') {
      const fs = require('fs');
      const path = require('path');
      const logFile = path.join(process.cwd(), '.mew', 'debug.log');
      fs.appendFileSync(logFile, `\nRAW DELETE KEY FROM INK: ${JSON.stringify({ input, key })}\n`);
    }

    // Determine special cases before building the enhanced key
    const isTabKey = key.name === 'tab' || key.tab === true || input === '\t' || key.sequence === '\t';

    let resolvedName = key.name || input || '';
    if (!resolvedName && isTabKey) {
      resolvedName = 'tab';
    }

    // Build enhanced key object
    const enhancedKey = {
      // Basic key info
      input: input || '',
      name: resolvedName,

      // Modifiers
      ctrl: Boolean(key.ctrl),
      alt: Boolean(key.meta || key.alt), // Meta on Mac, Alt on Linux/Windows
      shift: Boolean(key.shift),
      meta: Boolean(key.meta),

      // Special keys
      // Check both ways Ink might report the Enter key
      // Also check for Shift+Enter escape sequence: ESC[27;2;13~ or just [27;2;13~
      return: key.name === 'return' || key.name === 'enter' || (input === '\r') || (input === '\n'),
      enter: key.name === 'return' || key.name === 'enter' || (input === '\r') || (input === '\n'),
      shiftEnter: input === '\x1b[27;2;13~' || input === '[27;2;13~' || (key.shift && (key.return || key.enter)),
      backspace: key.name === 'backspace' || input === '\x7F' || input === '\b',
      delete: key.name === 'delete' || key.sequence === '\x1B[3~',
      tab: isTabKey,
      escape: key.name === 'escape' || key.name === 'esc',
      space: key.name === 'space' || input === ' ',

      // Arrow keys - check both name and arrow properties from Ink
      up: key.name === 'up' || Boolean(key.upArrow),
      down: key.name === 'down' || Boolean(key.downArrow),
      left: key.name === 'left' || Boolean(key.leftArrow),
      right: key.name === 'right' || Boolean(key.rightArrow),

      // Navigation keys
      home: key.name === 'home',
      end: key.name === 'end',
      pageup: key.name === 'pageup',
      pagedown: key.name === 'pagedown',

      // Function keys
      f1: key.name === 'f1',
      f2: key.name === 'f2',
      f3: key.name === 'f3',
      f4: key.name === 'f4',
      f5: key.name === 'f5',
      f6: key.name === 'f6',
      f7: key.name === 'f7',
      f8: key.name === 'f8',
      f9: key.name === 'f9',
      f10: key.name === 'f10',
      f11: key.name === 'f11',
      f12: key.name === 'f12',

      // Original key object for debugging
      raw: key
    };

    // Handle number keys specially if enabled
    if (captureNumbers && input && /^[0-9]$/.test(input)) {
      enhancedKey.number = parseInt(input, 10);
      enhancedKey.isNumber = true;
    }

    // Create string representation for easy matching
    const modifiers = [];
    if (enhancedKey.ctrl) modifiers.push('ctrl');
    if (enhancedKey.alt) modifiers.push('alt');
    if (enhancedKey.shift) modifiers.push('shift');

    let keyName = enhancedKey.name;
    if (enhancedKey.return) keyName = 'enter';
    if (enhancedKey.escape) keyName = 'escape';
    if (enhancedKey.tab) keyName = 'tab';

    enhancedKey.sequence = modifiers.length > 0
      ? `${modifiers.join('+')}+${keyName}`
      : keyName;

    // Call the handler with enhanced key object
    handlerRef.current(enhancedKey, input);

    // Prevent default behavior if requested
    if (preventDefault && (key.ctrl || key.meta)) {
      // This helps prevent terminal shortcuts from interfering
      return false;
    }
  }, [isActive, preventDefault, captureNumbers]);

  // Use Ink's useInput hook
  useInput(processKey, { isActive });
}

/**
 * Key combination matcher
 * @param {Object} key - Enhanced key object
 * @param {string} combination - Key combination string (e.g., 'ctrl+a', 'alt+left')
 * @returns {boolean}
 */
function matchesKeyCombination(key, combination) {
  if (!key || !combination) return false;

  const parts = combination.toLowerCase().split('+');
  const modifiers = [];
  let mainKey = parts[parts.length - 1];

  // Extract modifiers
  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i];
    if (['ctrl', 'alt', 'shift', 'meta'].includes(mod)) {
      modifiers.push(mod);
    }
  }

  // Check modifiers
  if (modifiers.includes('ctrl') && !key.ctrl) return false;
  if (modifiers.includes('alt') && !key.alt) return false;
  if (modifiers.includes('shift') && !key.shift) return false;
  if (modifiers.includes('meta') && !key.meta) return false;

  // Check for unexpected modifiers
  if (!modifiers.includes('ctrl') && key.ctrl) return false;
  if (!modifiers.includes('alt') && key.alt) return false;
  if (!modifiers.includes('shift') && key.shift) return false;
  if (!modifiers.includes('meta') && key.meta) return false;

  // Check main key
  switch (mainKey) {
    case 'enter':
    case 'return':
      return key.return;
    case 'escape':
    case 'esc':
      return key.escape;
    case 'backspace':
      return key.backspace;
    case 'delete':
    case 'del':
      return key.delete;
    case 'tab':
      return key.tab;
    case 'space':
      return key.space;
    case 'up':
      return key.up;
    case 'down':
      return key.down;
    case 'left':
      return key.left;
    case 'right':
      return key.right;
    case 'home':
      return key.home;
    case 'end':
      return key.end;
    case 'pageup':
      return key.pageup;
    case 'pagedown':
      return key.pagedown;
    default:
      // Check for letter keys (a-z)
      if (/^[a-z]$/.test(mainKey)) {
        return key.name.toLowerCase() === mainKey;
      }
      // Check for number keys
      if (/^[0-9]$/.test(mainKey)) {
        return key.input === mainKey;
      }
      // Check for function keys
      if (/^f[0-9]+$/.test(mainKey)) {
        return key[mainKey];
      }
      return key.name === mainKey;
  }
}

module.exports = {
  useKeypress,
  matchesKeyCombination
};
