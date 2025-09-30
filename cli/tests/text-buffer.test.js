#!/usr/bin/env node

/**
 * Test suite for TextBuffer implementation
 *
 * Run with: node tests/text-buffer.test.js
 */

const TextBuffer = require('../dist/ui/utils/text-buffer');
const textUtils = require('../dist/ui/utils/textUtils');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// TextBuffer Tests
console.log('\n=== TextBuffer Tests ===\n');

test('Create empty buffer', () => {
  const buffer = new TextBuffer();
  assertEqual(buffer.getText(), '');
  assert(buffer.isEmpty());
  assertDeepEqual(buffer.lines, ['']);
});

test('Create buffer with initial text', () => {
  const buffer = new TextBuffer('Hello\nWorld');
  assertEqual(buffer.getText(), 'Hello\nWorld');
  assertDeepEqual(buffer.lines, ['Hello', 'World']);
  assert(!buffer.isEmpty());
});

test('Insert single character', () => {
  const buffer = new TextBuffer();
  buffer.insert('H');
  assertEqual(buffer.getText(), 'H');
  assertEqual(buffer.cursorColumn, 1);
});

test('Insert multiple characters', () => {
  const buffer = new TextBuffer();
  buffer.insert('Hello');
  assertEqual(buffer.getText(), 'Hello');
  assertEqual(buffer.cursorColumn, 5);
});

test('Insert newline', () => {
  const buffer = new TextBuffer('Hello');
  buffer.cursorColumn = 5;
  buffer.insertNewline();
  assertEqual(buffer.getText(), 'Hello\n');
  assertEqual(buffer.cursorLine, 1);
  assertEqual(buffer.cursorColumn, 0);
});

test('Insert multi-line text', () => {
  const buffer = new TextBuffer();
  buffer.insert('Line1\nLine2\nLine3');
  assertEqual(buffer.getText(), 'Line1\nLine2\nLine3');
  assertEqual(buffer.cursorLine, 2);
  assertEqual(buffer.cursorColumn, 5);
});

test('Delete backward (backspace)', () => {
  const buffer = new TextBuffer('Hello');
  buffer.cursorColumn = 5;
  buffer.deleteBackward();
  assertEqual(buffer.getText(), 'Hell');
  assertEqual(buffer.cursorColumn, 4);
});

test('Delete backward at line start joins lines', () => {
  const buffer = new TextBuffer('Line1\nLine2');
  buffer.cursorLine = 1;
  buffer.cursorColumn = 0;
  buffer.deleteBackward();
  assertEqual(buffer.getText(), 'Line1Line2');
  assertEqual(buffer.cursorLine, 0);
  assertEqual(buffer.cursorColumn, 5);
});

test('Delete forward', () => {
  const buffer = new TextBuffer('Hello');
  buffer.cursorColumn = 2;
  buffer.deleteForward();
  assertEqual(buffer.getText(), 'Helo');
  assertEqual(buffer.cursorColumn, 2);
});

test('Move cursor left', () => {
  const buffer = new TextBuffer('Hello');
  buffer.cursorColumn = 3;
  buffer.move('left');
  assertEqual(buffer.cursorColumn, 2);
});

test('Move cursor right', () => {
  const buffer = new TextBuffer('Hello');
  buffer.cursorColumn = 2;
  buffer.move('right');
  assertEqual(buffer.cursorColumn, 3);
});

test('Move cursor up', () => {
  const buffer = new TextBuffer('Line1\nLine2\nLine3');
  buffer.cursorLine = 2;
  buffer.move('up');
  assertEqual(buffer.cursorLine, 1);
});

test('Move cursor down', () => {
  const buffer = new TextBuffer('Line1\nLine2\nLine3');
  buffer.cursorLine = 0;
  buffer.move('down');
  assertEqual(buffer.cursorLine, 1);
});

test('Move to line start', () => {
  const buffer = new TextBuffer('Hello World');
  buffer.cursorColumn = 5;
  buffer.move('lineStart');
  assertEqual(buffer.cursorColumn, 0);
});

test('Move to line end', () => {
  const buffer = new TextBuffer('Hello World');
  buffer.cursorColumn = 5;
  buffer.move('lineEnd');
  assertEqual(buffer.cursorColumn, 11);
});

test('Move word left', () => {
  const buffer = new TextBuffer('Hello World Test');
  buffer.cursorColumn = 11; // At 'T' in Test
  buffer.move('wordLeft');
  assertEqual(buffer.cursorColumn, 6); // At 'W' in World
});

test('Move word right', () => {
  const buffer = new TextBuffer('Hello World Test');
  buffer.cursorColumn = 0;
  buffer.move('wordRight');
  assertEqual(buffer.cursorColumn, 6); // After 'Hello '
});

test('Delete to line end', () => {
  const buffer = new TextBuffer('Hello World');
  buffer.cursorColumn = 5;
  buffer.deleteToLineEnd();
  assertEqual(buffer.getText(), 'Hello');
  assertEqual(buffer.cursorColumn, 5);
});

test('Delete to line start', () => {
  const buffer = new TextBuffer('Hello World');
  buffer.cursorColumn = 6;
  buffer.deleteToLineStart();
  assertEqual(buffer.getText(), 'World');
  assertEqual(buffer.cursorColumn, 0);
});

test('Delete word', () => {
  const buffer = new TextBuffer('Hello World');
  buffer.cursorColumn = 11;
  buffer.deleteWord();
  assertEqual(buffer.getText(), 'Hello ');
  assertEqual(buffer.cursorColumn, 6);
});

test('Get visible lines', () => {
  const buffer = new TextBuffer('Line1\nLine2\nLine3');
  const visible = buffer.getVisibleLines(10, 3);
  assertDeepEqual(visible, ['Line1', 'Line2', 'Line3']);
});

test('Get visible lines with wrapping', () => {
  const buffer = new TextBuffer('This is a very long line that needs to wrap');
  const visible = buffer.getVisibleLines(10, 5);
  assertEqual(visible[0], 'This is a ');
  assertEqual(visible[1], 'very long ');
});

// TextUtils Tests
console.log('\n=== TextUtils Tests ===\n');

test('Get string width for ASCII', () => {
  assertEqual(textUtils.getStringWidth('Hello'), 5);
  assertEqual(textUtils.getStringWidth(''), 0);
});

test('Get string width for emoji', () => {
  // Emoji typically have width of 2
  const emojiWidth = textUtils.getStringWidth('😀');
  assert(emojiWidth >= 2, 'Emoji should have width >= 2');
});

test('Get string width for CJK characters', () => {
  // CJK characters typically have width of 2
  assertEqual(textUtils.getStringWidth('中'), 2);
  assertEqual(textUtils.getStringWidth('文'), 2);
});

test('Truncate to width', () => {
  assertEqual(textUtils.truncateToWidth('Hello World', 8), 'Hello...');
  assertEqual(textUtils.truncateToWidth('Short', 10), 'Short');
});

test('Find word boundaries', () => {
  const text = 'Hello World Test';
  assertDeepEqual(textUtils.findWordBoundaries(text, 7), { start: 6, end: 11 });
  assertDeepEqual(textUtils.findWordBoundaries(text, 0), { start: 0, end: 5 });
});

test('Split lines', () => {
  assertDeepEqual(textUtils.splitLines('Line1\nLine2'), ['Line1', 'Line2']);
  assertDeepEqual(textUtils.splitLines('Line1\r\nLine2'), ['Line1', 'Line2']);
  assertDeepEqual(textUtils.splitLines(''), ['']);
});

test('Join lines', () => {
  assertEqual(textUtils.joinLines(['Line1', 'Line2']), 'Line1\nLine2');
  assertEqual(textUtils.joinLines([]), '');
});

test('Strip ANSI codes', () => {
  assertEqual(textUtils.stripAnsi('\x1b[31mRed Text\x1b[0m'), 'Red Text');
  assertEqual(textUtils.stripAnsi('No ANSI'), 'No ANSI');
});

test('Count graphemes', () => {
  assertEqual(textUtils.countGraphemes('Hello'), 5);
  // Combining characters should not increase count
  assertEqual(textUtils.countGraphemes('e\u0301'), 1); // é as e + combining accent
});

test('Check if emoji', () => {
  assert(textUtils.isEmoji('😀', 0), 'Should detect emoji');
  assert(!textUtils.isEmoji('A', 0), 'Should not detect regular character as emoji');
});

// Print summary
console.log('\n=== Test Summary ===');
console.log(`✓ Passed: ${testsPassed}`);
if (testsFailed > 0) {
  console.log(`✗ Failed: ${testsFailed}`);
  process.exit(1);
} else {
  console.log('All tests passed!');
  process.exit(0);
}