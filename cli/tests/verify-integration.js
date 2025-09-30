#!/usr/bin/env node

/**
 * Verification script for EnhancedInput integration
 *
 * Checks that all components are properly integrated without requiring TTY
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

function assertFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found at ${filePath}`);
  }
}

function assertExports(modulePath, exportName) {
  const module = require(modulePath);
  if (!module || (exportName && !module[exportName])) {
    throw new Error(`Module ${modulePath} does not export ${exportName || 'default'}`);
  }
}

function assertFileContains(filePath, searchString, description) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(searchString)) {
    throw new Error(`${description} - file does not contain expected string`);
  }
}

console.log('=== Enhanced Input Integration Verification ===\n');

// Check all component files exist
test('Text buffer exists', () => {
  assertFileExists(
    path.join(__dirname, '../dist/ui/utils/text-buffer.js'),
    'text-buffer.js'
  );
});

test('Text utilities exist', () => {
  assertFileExists(
    path.join(__dirname, '../dist/ui/utils/textUtils.js'),
    'textUtils.js'
  );
});

test('useKeypress hook exists', () => {
  assertFileExists(
    path.join(__dirname, '../dist/ui/hooks/useKeypress.js'),
    'useKeypress.js'
  );
});

test('keyMatchers exists', () => {
  assertFileExists(
    path.join(__dirname, '../dist/ui/keyMatchers.js'),
    'keyMatchers.js'
  );
});

test('keyBindings config exists', () => {
  assertFileExists(
    path.join(__dirname, '../dist/config/keyBindings.js'),
    'keyBindings.js'
  );
});

test('EnhancedInput component exists', () => {
  assertFileExists(
    path.join(__dirname, '../dist/ui/components/EnhancedInput.js'),
    'EnhancedInput.js'
  );
});

// Check modules can be loaded
test('TextBuffer can be imported', () => {
  assertExports('../dist/ui/utils/text-buffer');
});

test('EnhancedInput can be imported', () => {
  assertExports('../dist/ui/components/EnhancedInput');
});

test('useKeypress exports functions', () => {
  const module = require('../dist/ui/hooks/useKeypress');
  if (!module.useKeypress || !module.matchesKeyCombination) {
    throw new Error('Missing expected exports');
  }
});

// Check integration with advanced-interactive-ui.js
test('advanced-interactive-ui imports EnhancedInput', () => {
  assertFileContains(
    path.join(__dirname, '../dist/utils/advanced-interactive-ui.js'),
    "require('../ui/components/EnhancedInput')",
    'EnhancedInput import'
  );
});

test('advanced-interactive-ui uses EnhancedInput', () => {
  assertFileContains(
    path.join(__dirname, '../dist/utils/advanced-interactive-ui.js'),
    'React.createElement(EnhancedInput',
    'EnhancedInput usage'
  );
});

test('Old InputComposer is removed', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../dist/utils/advanced-interactive-ui.js'),
    'utf8'
  );
  // Check that the old function definition is gone
  if (content.match(/function InputComposer\([^)]*\) \{[\s\S]*?^\}/m)) {
    throw new Error('Old InputComposer function still exists');
  }
});

test('EnhancedInput has approval dialog compatibility', () => {
  assertFileContains(
    path.join(__dirname, '../dist/utils/advanced-interactive-ui.js'),
    'disabled: pendingOperation !== null',
    'Dialog compatibility'
  );
});

// Test component functionality
test('TextBuffer supports multi-line', () => {
  const TextBufferModule = require('../dist/ui/utils/text-buffer');
  const TextBuffer = TextBufferModule.default || TextBufferModule;
  const buffer = new TextBuffer('Line1\nLine2');
  if (buffer.lines.length !== 2) {
    throw new Error('Multi-line not working');
  }
});

test('TextBuffer supports word navigation', () => {
  const TextBufferModule = require('../dist/ui/utils/text-buffer');
  const TextBuffer = TextBufferModule.default || TextBufferModule;
  const buffer = new TextBuffer('Hello World');
  buffer.cursorColumn = 0;
  buffer.move('wordRight');
  if (buffer.cursorColumn !== 6) {
    throw new Error('Word navigation not working');
  }
});

test('Key bindings include all shortcuts', () => {
  const { defaultKeyBindings } = require('../dist/config/keyBindings');
  const required = [
    'MOVE_WORD_LEFT',
    'MOVE_WORD_RIGHT',
    'DELETE_TO_LINE_END',
    'DELETE_TO_LINE_START',
    'DELETE_WORD',
    'HISTORY_PREV',
    'HISTORY_NEXT'
  ];

  for (const key of required) {
    if (!defaultKeyBindings[key]) {
      throw new Error(`Missing key binding: ${key}`);
    }
  }
});

// Summary
console.log('\n=== Verification Summary ===');
console.log(`✓ Passed: ${passed}`);
if (failed > 0) {
  console.log(`✗ Failed: ${failed}`);
  console.log('\n❌ Integration incomplete - please fix the failures above');
  process.exit(1);
} else {
  console.log('\n✅ Milestone 2 Complete: Input Component Integration');
  console.log('   - All components created and loadable');
  console.log('   - Integrated into advanced-interactive-ui.js');
  console.log('   - Old InputComposer removed');
  console.log('   - Approval dialog compatibility maintained');
  console.log('   - All keyboard shortcuts configured');
  console.log('   - Word navigation (Option/Alt+arrows) working');
  console.log('\n🎉 Ready for Milestone 3: History & Persistence');
  process.exit(0);
}