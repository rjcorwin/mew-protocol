/**
 * Unit tests for Enhanced Input components
 *
 * Ported from cli/tests/enhanced-input-unit-test.js to Vitest format
 */

import { describe, it, expect } from 'vitest';
import TextBuffer from './utils/text-buffer.js';
import { matchesKeyCombination } from './hooks/useKeypress.js';
import { matches, matchesAny, KeyPatterns } from './keyMatchers.js';
import { defaultKeyBindings, getBindingDisplay, validateBindings } from '../config/keyBindings.js';

// Test useKeypress helpers
describe('useKeypress', () => {
  describe('matchesKeyCombination', () => {
    it('matches simple key', () => {
      const key = { name: 'a', ctrl: false, alt: false, shift: false };
      expect(matchesKeyCombination(key, 'a')).toBe(true);
      expect(matchesKeyCombination(key, 'b')).toBe(false);
    });

    it('matches ctrl combination', () => {
      const key = { name: 'a', ctrl: true, alt: false, shift: false };
      expect(matchesKeyCombination(key, 'ctrl+a')).toBe(true);
      expect(matchesKeyCombination(key, 'a')).toBe(false);
      expect(matchesKeyCombination(key, 'ctrl+b')).toBe(false);
    });

    it('matches alt combination', () => {
      const key = { name: 'left', alt: true, ctrl: false, shift: false, meta: false, left: true };
      expect(matchesKeyCombination(key, 'alt+left')).toBe(true);
      expect(matchesKeyCombination(key, 'left')).toBe(false);
    });

    it('matches special keys', () => {
      expect(matchesKeyCombination({ return: true }, 'enter')).toBe(true);
      expect(matchesKeyCombination({ escape: true }, 'escape')).toBe(true);
      expect(matchesKeyCombination({ backspace: true }, 'backspace')).toBe(true);
    });
  });
});

// Test keyMatchers
describe('keyMatchers', () => {
  describe('matches', () => {
    it('matches simple pattern', () => {
      const key = { name: 'a', input: 'a' };
      expect(matches(key, { key: 'a' })).toBe(true);
      expect(matches(key, { key: 'b' })).toBe(false);
    });

    it('matches modifier pattern', () => {
      const key = { name: 'a', ctrl: true };
      expect(matches(key, { key: 'a', ctrl: true })).toBe(true);
      expect(matches(key, { key: 'a', ctrl: false })).toBe(false);
    });

    it('matches printable pattern', () => {
      const result1 = matches({ input: 'x' }, { printable: true });
      const result2 = matches({ input: 'x', ctrl: true }, { printable: true });

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });
  });

  describe('matchesAny', () => {
    it('matches multiple patterns', () => {
      const key = { alt: true, key: 'left', left: true };
      expect(matchesAny(key, KeyPatterns.WORD_LEFT)).toBe(true);

      const key2 = { meta: true, key: 'left', left: true };
      expect(matchesAny(key2, KeyPatterns.WORD_LEFT)).toBe(true);
    });
  });

  describe('KeyPatterns - navigation', () => {
    it('matches navigation keys', () => {
      expect(matches({ up: true, key: 'up' }, KeyPatterns.UP)).toBe(true);
      expect(matches({ down: true, key: 'down' }, KeyPatterns.DOWN)).toBe(true);
      expect(matches({ left: true, key: 'left' }, KeyPatterns.LEFT)).toBe(true);
      expect(matches({ right: true, key: 'right' }, KeyPatterns.RIGHT)).toBe(true);
    });
  });

  describe('KeyPatterns - line editing', () => {
    it('matches line start patterns', () => {
      expect(matchesAny({ ctrl: true, key: 'a', name: 'a' }, KeyPatterns.LINE_START)).toBe(true);
      expect(matchesAny({ key: 'home', home: true, name: 'home' }, KeyPatterns.LINE_START)).toBe(true);
    });

    it('matches delete to end', () => {
      expect(matches({ ctrl: true, key: 'k', name: 'k' }, KeyPatterns.DELETE_TO_END)).toBe(true);
    });
  });
});

// Test keyBindings
describe('keyBindings', () => {
  describe('defaultKeyBindings', () => {
    it('exists with required bindings', () => {
      expect(typeof defaultKeyBindings).toBe('object');
      expect('MOVE_LEFT' in defaultKeyBindings).toBe(true);
      expect('DELETE_BACKWARD' in defaultKeyBindings).toBe(true);
      expect('SUBMIT' in defaultKeyBindings).toBe(true);
    });
  });

  describe('getBindingDisplay', () => {
    it('displays simple key', () => {
      expect(getBindingDisplay({ key: 'a' })).toBe('A');
      expect(getBindingDisplay({ key: 'enter' })).toBe('Enter');
    });

    it('displays keys with modifiers', () => {
      expect(getBindingDisplay({ ctrl: true, key: 'a' })).toBe('Ctrl+A');
      expect(getBindingDisplay({ alt: true, key: 'left' })).toBe('Alt+Left');
      expect(getBindingDisplay({ ctrl: true, alt: true, key: 'x' })).toBe('Ctrl+Alt+X');
    });

    it('displays array of bindings', () => {
      const display = getBindingDisplay([
        { ctrl: true, key: 'a' },
        { key: 'home' }
      ]);
      expect(display).toContain('Ctrl+A');
      expect(display).toContain('Home');
      expect(display).toContain(' or ');
    });
  });

  describe('validateBindings', () => {
    it('detects no conflicts', () => {
      const bindings = {
        MOVE_LEFT: { key: 'left' },
        MOVE_RIGHT: { key: 'right' }
      };
      const warnings = validateBindings(bindings);
      expect(warnings.length).toBe(0);
    });

    it('detects conflicts', () => {
      const bindings = {
        ACTION1: { ctrl: true, key: 'a' },
        ACTION2: { ctrl: true, key: 'a' }  // Same binding
      };
      const warnings = validateBindings(bindings);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].type).toBe('conflict');
    });
  });
});

// Integration tests with TextBuffer and key handling
describe('Integration Tests', () => {
  describe('TextBuffer with word navigation', () => {
    it('navigates by words', () => {
      const buffer = new TextBuffer('Hello World Test');

      // Test word navigation
      buffer.cursorColumn = 0;
      buffer.move('wordRight');
      expect(buffer.cursorColumn).toBe(6); // After "Hello "

      buffer.move('wordRight');
      expect(buffer.cursorColumn).toBe(12); // After "World "

      buffer.move('wordLeft');
      expect(buffer.cursorColumn).toBe(6); // Back to "World"
    });
  });

  describe('TextBuffer with line editing shortcuts', () => {
    it('deletes to end (Ctrl+K)', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 5;
      buffer.deleteToLineEnd();
      expect(buffer.getText()).toBe('Hello');
    });

    it('deletes to start (Ctrl+U)', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 6;
      buffer.deleteToLineStart();
      expect(buffer.getText()).toBe('World');
    });

    it('deletes word (Ctrl+W)', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 11;
      buffer.deleteWord();
      expect(buffer.getText()).toBe('Hello ');
    });
  });

  describe('Multi-line navigation', () => {
    it('moves between lines', () => {
      const buffer = new TextBuffer('Line 1\nLine 2\nLine 3');

      expect(buffer.cursorLine).toBe(0);
      buffer.move('down');
      expect(buffer.cursorLine).toBe(1);
      buffer.move('down');
      expect(buffer.cursorLine).toBe(2);
      buffer.move('up');
      expect(buffer.cursorLine).toBe(1);
    });

    it('handles line start/end', () => {
      const buffer = new TextBuffer('Line 1\nLine 2\nLine 3');
      buffer.cursorLine = 1;
      buffer.cursorColumn = 3;

      buffer.move('lineStart');
      expect(buffer.cursorColumn).toBe(0);

      buffer.move('lineEnd');
      expect(buffer.cursorColumn).toBe(6); // Length of "Line 2"
    });
  });
});
