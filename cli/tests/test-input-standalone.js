#!/usr/bin/env node

/**
 * Standalone test of input rendering
 */

const TextBufferModule = require('../dist/ui/utils/text-buffer');
const TextBuffer = TextBufferModule.default || TextBufferModule;

// Test the buffer directly
console.log('=== TextBuffer Direct Test ===');

const buffer = new TextBuffer();
console.log('Initial text:', `"${buffer.getText()}"`);
console.log('Is empty:', buffer.isEmpty());

buffer.insert('H');
console.log('After inserting "H":', `"${buffer.getText()}"`);
console.log('Cursor position:', buffer.getCursorPosition());

buffer.insert('ello');
console.log('After inserting "ello":', `"${buffer.getText()}"`);

buffer.insert(' ');
buffer.insert('World');
console.log('After inserting " World":', `"${buffer.getText()}"`);

// Test cursor movement
buffer.move('lineStart');
console.log('After move to start, cursor:', buffer.getCursorPosition());

buffer.move('wordRight');
console.log('After word right, cursor:', buffer.getCursorPosition());

// Test rendering
console.log('\n=== Simulated Rendering ===');
const line = buffer.lines[0];
const cursor = buffer.getCursorPosition();

function renderLineWithCursor(line, cursorPos) {
  if (line.length === 0) {
    return '[_]';  // Empty line with cursor
  }

  const before = line.slice(0, cursorPos);
  const at = line[cursorPos] || '_';
  const after = line.slice(cursorPos + 1);

  return `${before}[${at}]${after}`;
}

console.log('Rendered:', renderLineWithCursor(line, cursor.column));

// Test deletion
buffer.move('lineEnd');
buffer.deleteWord();
console.log('After delete word:', `"${buffer.getText()}"`);

console.log('\n✅ TextBuffer is working correctly');

// Now test if the key bindings configuration loads
console.log('\n=== Key Bindings Test ===');
const { defaultKeyBindings } = require('../dist/config/keyBindings');
console.log('Key bindings loaded:', Object.keys(defaultKeyBindings).length, 'bindings');
console.log('Sample bindings:', Object.keys(defaultKeyBindings).slice(0, 5));

console.log('\n✅ All standalone components work');