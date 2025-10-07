/**
 * Test suite for TextBuffer implementation
 *
 * Ported from cli/tests/text-buffer.test.js to Vitest format
 */

import { describe, it, expect } from 'vitest';
import TextBuffer from './text-buffer.js';
import * as textUtils from './textUtils.js';

// TextBuffer Tests
describe('TextBuffer', () => {
  describe('Creation and basic operations', () => {
    it('creates empty buffer', () => {
      const buffer = new TextBuffer();
      expect(buffer.getText()).toBe('');
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.lines).toEqual(['']);
    });

    it('creates buffer with initial text', () => {
      const buffer = new TextBuffer('Hello\nWorld');
      expect(buffer.getText()).toBe('Hello\nWorld');
      expect(buffer.lines).toEqual(['Hello', 'World']);
      expect(buffer.isEmpty()).toBe(false);
    });
  });

  describe('Character insertion', () => {
    it('inserts single character', () => {
      const buffer = new TextBuffer();
      buffer.insert('H');
      expect(buffer.getText()).toBe('H');
      expect(buffer.cursorColumn).toBe(1);
    });

    it('inserts multiple characters', () => {
      const buffer = new TextBuffer();
      buffer.insert('Hello');
      expect(buffer.getText()).toBe('Hello');
      expect(buffer.cursorColumn).toBe(5);
    });

    it('inserts newline', () => {
      const buffer = new TextBuffer('Hello');
      buffer.cursorColumn = 5;
      buffer.insertNewline();
      expect(buffer.getText()).toBe('Hello\n');
      expect(buffer.cursorLine).toBe(1);
      expect(buffer.cursorColumn).toBe(0);
    });

    it('inserts multi-line text', () => {
      const buffer = new TextBuffer();
      buffer.insert('Line1\nLine2\nLine3');
      expect(buffer.getText()).toBe('Line1\nLine2\nLine3');
      expect(buffer.cursorLine).toBe(2);
      expect(buffer.cursorColumn).toBe(5);
    });
  });

  describe('Deletion operations', () => {
    it('deletes backward (backspace)', () => {
      const buffer = new TextBuffer('Hello');
      buffer.cursorColumn = 5;
      buffer.deleteBackward();
      expect(buffer.getText()).toBe('Hell');
      expect(buffer.cursorColumn).toBe(4);
    });

    it('deletes backward at line start joins lines', () => {
      const buffer = new TextBuffer('Line1\nLine2');
      buffer.cursorLine = 1;
      buffer.cursorColumn = 0;
      buffer.deleteBackward();
      expect(buffer.getText()).toBe('Line1Line2');
      expect(buffer.cursorLine).toBe(0);
      expect(buffer.cursorColumn).toBe(5);
    });

    it('deletes forward', () => {
      const buffer = new TextBuffer('Hello');
      buffer.cursorColumn = 2;
      buffer.deleteForward();
      expect(buffer.getText()).toBe('Helo');
      expect(buffer.cursorColumn).toBe(2);
    });

    it('deletes to line end', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 5;
      buffer.deleteToLineEnd();
      expect(buffer.getText()).toBe('Hello');
      expect(buffer.cursorColumn).toBe(5);
    });

    it('deletes to line start', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 6;
      buffer.deleteToLineStart();
      expect(buffer.getText()).toBe('World');
      expect(buffer.cursorColumn).toBe(0);
    });

    it('deletes word', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 11;
      buffer.deleteWord();
      expect(buffer.getText()).toBe('Hello ');
      expect(buffer.cursorColumn).toBe(6);
    });
  });

  describe('Cursor movement', () => {
    it('moves cursor left', () => {
      const buffer = new TextBuffer('Hello');
      buffer.cursorColumn = 3;
      buffer.move('left');
      expect(buffer.cursorColumn).toBe(2);
    });

    it('moves cursor right', () => {
      const buffer = new TextBuffer('Hello');
      buffer.cursorColumn = 2;
      buffer.move('right');
      expect(buffer.cursorColumn).toBe(3);
    });

    it('moves cursor up', () => {
      const buffer = new TextBuffer('Line1\nLine2\nLine3');
      buffer.cursorLine = 2;
      buffer.move('up');
      expect(buffer.cursorLine).toBe(1);
    });

    it('moves cursor down', () => {
      const buffer = new TextBuffer('Line1\nLine2\nLine3');
      buffer.cursorLine = 0;
      buffer.move('down');
      expect(buffer.cursorLine).toBe(1);
    });

    it('moves to line start', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 5;
      buffer.move('lineStart');
      expect(buffer.cursorColumn).toBe(0);
    });

    it('moves to line end', () => {
      const buffer = new TextBuffer('Hello World');
      buffer.cursorColumn = 5;
      buffer.move('lineEnd');
      expect(buffer.cursorColumn).toBe(11);
    });

    it('moves word left', () => {
      const buffer = new TextBuffer('Hello World Test');
      buffer.cursorColumn = 11; // At 'T' in Test
      buffer.move('wordLeft');
      expect(buffer.cursorColumn).toBe(6); // At 'W' in World
    });

    it('moves word right', () => {
      const buffer = new TextBuffer('Hello World Test');
      buffer.cursorColumn = 0;
      buffer.move('wordRight');
      expect(buffer.cursorColumn).toBe(6); // After 'Hello '
    });
  });

  describe('Visible lines', () => {
    it('gets visible lines', () => {
      const buffer = new TextBuffer('Line1\nLine2\nLine3');
      const visible = buffer.getVisibleLines(10, 3);
      expect(visible).toEqual(['Line1', 'Line2', 'Line3']);
    });

    it('gets visible lines with wrapping', () => {
      const buffer = new TextBuffer('This is a very long line that needs to wrap');
      const visible = buffer.getVisibleLines(10, 5);
      expect(visible[0]).toBe('This is a ');
      expect(visible[1]).toBe('very long ');
    });
  });
});

// TextUtils Tests
describe('TextUtils', () => {
  describe('String width', () => {
    it('gets string width for ASCII', () => {
      expect(textUtils.getStringWidth('Hello')).toBe(5);
      expect(textUtils.getStringWidth('')).toBe(0);
    });

    it('gets string width for emoji', () => {
      // Emoji typically have width of 2
      const emojiWidth = textUtils.getStringWidth('😀');
      expect(emojiWidth).toBeGreaterThanOrEqual(2);
    });

    it('gets string width for CJK characters', () => {
      // CJK characters typically have width of 2
      expect(textUtils.getStringWidth('中')).toBe(2);
      expect(textUtils.getStringWidth('文')).toBe(2);
    });
  });

  describe('Truncation', () => {
    it('truncates to width', () => {
      expect(textUtils.truncateToWidth('Hello World', 8)).toBe('Hello...');
      expect(textUtils.truncateToWidth('Short', 10)).toBe('Short');
    });
  });

  describe('Word boundaries', () => {
    it('finds word boundaries', () => {
      const text = 'Hello World Test';
      expect(textUtils.findWordBoundaries(text, 7)).toEqual({ start: 6, end: 11 });
      expect(textUtils.findWordBoundaries(text, 0)).toEqual({ start: 0, end: 5 });
    });
  });

  describe('Line operations', () => {
    it('splits lines', () => {
      expect(textUtils.splitLines('Line1\nLine2')).toEqual(['Line1', 'Line2']);
      expect(textUtils.splitLines('Line1\r\nLine2')).toEqual(['Line1', 'Line2']);
      expect(textUtils.splitLines('')).toEqual(['']);
    });

    it('joins lines', () => {
      expect(textUtils.joinLines(['Line1', 'Line2'])).toBe('Line1\nLine2');
      expect(textUtils.joinLines([])).toBe('');
    });
  });

  describe('ANSI handling', () => {
    it('strips ANSI codes', () => {
      expect(textUtils.stripAnsi('\x1b[31mRed Text\x1b[0m')).toBe('Red Text');
      expect(textUtils.stripAnsi('No ANSI')).toBe('No ANSI');
      expect(textUtils.stripAnsi('\u001b[2K\u001b[1;32mPrompt\u001b[0m')).toBe('Prompt');
    });
  });

  describe('Grapheme counting', () => {
    it('counts graphemes', () => {
      expect(textUtils.countGraphemes('Hello')).toBe(5);
      // Combining characters should not increase count
      expect(textUtils.countGraphemes('e\u0301')).toBe(1); // é as e + combining accent
    });
  });

  describe('Emoji detection', () => {
    it('checks if emoji', () => {
      expect(textUtils.isEmoji('😀', 0)).toBe(true);
      expect(textUtils.isEmoji('A', 0)).toBe(false);
    });
  });
});
