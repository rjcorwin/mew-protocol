/**
 * Key Matchers for Terminal Input
 *
 * Provides utilities for matching keyboard input patterns and combinations.
 * Supports cross-platform key detection for consistent behavior.
 *
 * Adapted from Gemini CLI patterns for MEW Protocol CLI.
 *
 * @license MIT
 */

import type { KeyBinding, KeyPattern } from '../config/keyBindings';

export interface EnhancedKey {
  name?: string;
  input?: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  return?: boolean;
  enter?: boolean;
  escape?: boolean;
  backspace?: boolean;
  delete?: boolean;
  tab?: boolean;
  space?: boolean;
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  home?: boolean;
  end?: boolean;
  pageup?: boolean;
  pagedown?: boolean;
  [key: string]: unknown;
}

/**
 * Check if a key event matches a specific pattern
 */
export function matches(key: EnhancedKey | null | undefined, pattern: KeyPattern | null | undefined): boolean {
  if (!key || !pattern) return false;

  // Check modifiers if specified
  if ('ctrl' in pattern && key.ctrl !== pattern.ctrl) return false;
  if ('alt' in pattern && key.alt !== pattern.alt) return false;
  if ('shift' in pattern && key.shift !== pattern.shift) return false;
  if ('meta' in pattern && key.meta !== pattern.meta) return false;

  // Check specific key
  if (pattern.key) {
    switch (pattern.key) {
      case 'enter':
        return Boolean(key.return || key.enter);
      case 'escape':
        return Boolean(key.escape);
      case 'backspace':
        return Boolean(key.backspace);
      case 'delete':
        return Boolean(key.delete);
      case 'tab':
        return Boolean(key.tab);
      case 'space':
        return key.input === ' ' || Boolean(key.space);
      case 'up':
        return Boolean(key.up);
      case 'down':
        return Boolean(key.down);
      case 'left':
        return Boolean(key.left);
      case 'right':
        return Boolean(key.right);
      case 'home':
        return Boolean(key.home);
      case 'end':
        return Boolean(key.end);
      default:
        return key.name === pattern.key || key.input === pattern.key;
    }
  }

  // Check for any printable character
  if (pattern.printable) {
    // Exclude special keys from being considered printable
    return Boolean(
      key.input &&
        key.input !== '\r' &&
        key.input !== '\n' &&
        key.input !== '\x7F' && // DEL character (127)
        key.input !== '\x1B' && // ESC character
        !key.return &&
        !key.enter &&
        !key.backspace &&
        !key.delete &&
        !key.escape &&
        !key.tab &&
        !key.up &&
        !key.down &&
        !key.left &&
        !key.right &&
        !key.home &&
        !key.end &&
        !key.pageup &&
        !key.pagedown &&
        key.ctrl !== true &&
        key.alt !== true &&
        key.meta !== true,
    );
  }

  return true; // Pattern matches if no specific requirements
}

/**
 * Common key patterns for easy matching
 */
export const KeyPatterns: Record<string, KeyBinding> = {
  // Text editing
  CHARACTER: { printable: true },
  BACKSPACE: { key: 'backspace' },
  DELETE: { key: 'delete' },
  ENTER: { key: 'enter' },
  TAB: { key: 'tab' },
  ESCAPE: { key: 'escape' },

  // Navigation
  UP: { key: 'up' },
  DOWN: { key: 'down' },
  LEFT: { key: 'left' },
  RIGHT: { key: 'right' },
  HOME: { key: 'home' },
  END: { key: 'end' },

  // Word navigation (cross-platform)
  WORD_LEFT: [
    { alt: true, key: 'left' }, // Alt+Left (Linux/Windows)
    { meta: true, key: 'left' }, // Option+Left (Mac)
  ],
  WORD_RIGHT: [
    { alt: true, key: 'right' }, // Alt+Right (Linux/Windows)
    { meta: true, key: 'right' }, // Option+Right (Mac)
  ],

  // Line editing
  LINE_START: [
    { ctrl: true, key: 'a' },
    { key: 'home' },
  ],
  LINE_END: [
    { ctrl: true, key: 'e' },
    { key: 'end' },
  ],

  // Deletion
  DELETE_TO_END: { ctrl: true, key: 'k' },
  DELETE_TO_START: { ctrl: true, key: 'u' },
  DELETE_WORD: { ctrl: true, key: 'w' },

  // History navigation
  HISTORY_PREV: { key: 'up' },
  HISTORY_NEXT: { key: 'down' },

  // Multi-line
  NEWLINE: [
    { shift: true, key: 'enter' },
    { alt: true, key: 'enter' },
  ],

  // Commands
  SUBMIT: { key: 'enter' },
  CANCEL: { key: 'escape' },

  // Autocomplete
  COMPLETE: { key: 'tab' },
  COMPLETE_PREV: { shift: true, key: 'tab' },

  // Special
  QUIT: { ctrl: true, key: 'c' },
  CLEAR: { ctrl: true, key: 'l' },

  // Number shortcuts
  NUMBER_1: { key: '1' },
  NUMBER_2: { key: '2' },
  NUMBER_3: { key: '3' },
  NUMBER_4: { key: '4' },
  NUMBER_5: { key: '5' },
  NUMBER_6: { key: '6' },
  NUMBER_7: { key: '7' },
  NUMBER_8: { key: '8' },
  NUMBER_9: { key: '9' },
  NUMBER_0: { key: '0' },
};

/**
 * Check if key matches any pattern in a list
 */
export function matchesAny(key: EnhancedKey, patterns: KeyBinding): boolean {
  if (!Array.isArray(patterns)) {
    return matches(key, patterns);
  }

  return patterns.some((pattern) => matches(key, pattern));
}

/**
 * Get the command for a key event based on configured bindings
 */
export function getCommand(key: EnhancedKey, bindings: Record<string, KeyBinding>): string | null {
  for (const [command, patterns] of Object.entries(bindings)) {
    if (matchesAny(key, patterns)) {
      return command;
    }
  }
  return null;
}

/**
 * Platform-specific key helpers
 */
export const Platform = {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',

  // Get the appropriate modifier key name for the platform
  getModifierName(): string {
    return this.isMac ? 'Option' : 'Alt';
  },

  // Get the appropriate word navigation pattern
  getWordNavigationPattern(direction: 'left' | 'right'): KeyPattern {
    const key = direction === 'left' ? 'left' : 'right';
    return this.isMac
      ? { meta: true, key } // Option+Arrow on Mac
      : { alt: true, key }; // Alt+Arrow on Linux/Windows
  },
};

/**
 * Create a key binding configuration from user preferences
 */
export function createBindings(preferences: Partial<Record<string, KeyBinding>> = {}): Record<string, KeyBinding> {
  const defaults: Record<string, KeyBinding> = {
    // Text input
    INSERT_CHAR: KeyPatterns.CHARACTER,
    DELETE_BACKWARD: KeyPatterns.BACKSPACE,
    DELETE_FORWARD: KeyPatterns.DELETE,

    // Cursor movement
    MOVE_LEFT: KeyPatterns.LEFT,
    MOVE_RIGHT: KeyPatterns.RIGHT,
    MOVE_UP: KeyPatterns.UP,
    MOVE_DOWN: KeyPatterns.DOWN,
    MOVE_WORD_LEFT: KeyPatterns.WORD_LEFT,
    MOVE_WORD_RIGHT: KeyPatterns.WORD_RIGHT,
    MOVE_LINE_START: KeyPatterns.LINE_START,
    MOVE_LINE_END: KeyPatterns.LINE_END,

    // Line editing
    DELETE_TO_END: KeyPatterns.DELETE_TO_END,
    DELETE_TO_START: KeyPatterns.DELETE_TO_START,
    DELETE_WORD: KeyPatterns.DELETE_WORD,

    // History
    HISTORY_PREV: KeyPatterns.HISTORY_PREV,
    HISTORY_NEXT: KeyPatterns.HISTORY_NEXT,

    // Actions
    SUBMIT: KeyPatterns.SUBMIT,
    CANCEL: KeyPatterns.CANCEL,
    INSERT_NEWLINE: KeyPatterns.NEWLINE,

    // Autocomplete
    AUTOCOMPLETE: KeyPatterns.COMPLETE,
    AUTOCOMPLETE_PREV: KeyPatterns.COMPLETE_PREV,
  };

  const sanitized = Object.fromEntries(
    Object.entries(preferences).filter(([, value]) => value !== undefined),
  ) as Record<string, KeyBinding>;

  return { ...defaults, ...sanitized };
}

export default {
  matches,
  matchesAny,
  getCommand,
  KeyPatterns,
  Platform,
  createBindings,
};
