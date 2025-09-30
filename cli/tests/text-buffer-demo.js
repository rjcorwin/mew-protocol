#!/usr/bin/env node

/**
 * Interactive demo of TextBuffer implementation
 *
 * Run with: node tests/text-buffer-demo.js
 *
 * Controls:
 * - Type to insert text
 * - Arrow keys to move cursor
 * - Backspace/Delete for deletion
 * - Ctrl+A/Ctrl+E for line start/end
 * - Ctrl+K to delete to line end
 * - Ctrl+U to delete to line start
 * - Ctrl+W to delete word
 * - Enter for new line
 * - Ctrl+C to exit
 */

const readline = require('readline');
const TextBufferModule = require('../dist/ui/utils/text-buffer');
const TextBuffer = TextBufferModule.default || TextBufferModule;

// Create text buffer
const buffer = new TextBuffer('Hello World!\nThis is a multi-line text buffer demo.\nTry editing this text.');

// Setup readline interface
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

// Clear screen and render
function render() {
  console.clear();
  console.log('=== TextBuffer Demo ===');
  console.log('Use arrow keys to navigate, type to insert, Ctrl+C to exit\n');

  // Get buffer stats
  const stats = buffer.getStats();
  console.log(`Lines: ${stats.lines} | Characters: ${stats.characters} | Cursor: Line ${stats.cursorLine + 1}, Col ${stats.cursorColumn + 1}\n`);

  // Display the text with cursor
  const lines = buffer.lines;
  const cursor = buffer.getCursorPosition();

  lines.forEach((line, lineIndex) => {
    if (lineIndex === cursor.line) {
      // Show cursor on current line
      const before = line.slice(0, cursor.column);
      const after = line.slice(cursor.column);
      const cursorChar = after[0] || ' ';
      console.log(before + '\x1b[7m' + cursorChar + '\x1b[0m' + after.slice(1));
    } else {
      console.log(line);
    }
  });

  console.log('\n---');
  console.log('Controls: Arrows=move | Backspace=delete | Ctrl+A=start | Ctrl+E=end');
  console.log('Ctrl+K=delete to end | Ctrl+U=delete to start | Ctrl+W=delete word');
}

// Initial render
render();

// Handle keypress events
process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    // Exit
    console.clear();
    console.log('Goodbye!');
    process.exit(0);
  }

  if (key.name === 'up') {
    buffer.move('up');
  } else if (key.name === 'down') {
    buffer.move('down');
  } else if (key.name === 'left') {
    if (key.meta || key.alt) {
      buffer.move('wordLeft');
    } else {
      buffer.move('left');
    }
  } else if (key.name === 'right') {
    if (key.meta || key.alt) {
      buffer.move('wordRight');
    } else {
      buffer.move('right');
    }
  } else if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
    buffer.move('lineStart');
  } else if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
    buffer.move('lineEnd');
  } else if (key.name === 'backspace') {
    buffer.deleteBackward();
  } else if (key.name === 'delete') {
    buffer.deleteForward();
  } else if (key.ctrl && key.name === 'k') {
    buffer.deleteToLineEnd();
  } else if (key.ctrl && key.name === 'u') {
    buffer.deleteToLineStart();
  } else if (key.ctrl && key.name === 'w') {
    buffer.deleteWord();
  } else if (key.name === 'return') {
    buffer.insertNewline();
  } else if (str && !key.ctrl && !key.meta) {
    // Regular character input
    buffer.insert(str);
  }

  // Re-render after each change
  render();
});

// Handle exit
process.on('SIGINT', () => {
  console.clear();
  console.log('Interrupted!');
  process.exit(0);
});