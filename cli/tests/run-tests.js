#!/usr/bin/env node

/**
 * Lightweight test runner for the MEW CLI package.
 *
 * Aggregates the deterministic test scripts that do not require a TTY and
 * reports a consolidated pass/fail status for npm test.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const CWD = __dirname;

const TEST_SCRIPTS = [
  {
    name: 'TextBuffer unit tests',
    script: path.join(CWD, 'text-buffer.test.js'),
  },
  {
    name: 'Enhanced input utilities',
    script: path.join(CWD, 'enhanced-input-unit-test.js'),
  },
  {
    name: 'Enhanced input integration verification',
    script: path.join(CWD, 'verify-integration.js'),
  },
  {
    name: 'Standalone input smoke test',
    script: path.join(CWD, 'test-input-standalone.js'),
  },
];

let failures = 0;

for (const { name, script } of TEST_SCRIPTS) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' },
  });

  if (result.error) {
    failures += 1;
    console.error(`Test runner error for ${name}:`, result.error.message);
    continue;
  }

  if (result.status !== 0) {
    failures += 1;
    console.error(`✗ ${name} failed with exit code ${result.status}`);
  } else {
    console.log(`✓ ${name} passed`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} test group${failures === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

console.log('\nAll CLI test groups passed.');
process.exit(0);
