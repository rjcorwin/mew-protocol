#!/usr/bin/env node

/**
 * MEW Protocol CLI - Minimal implementation for testing
 *
 * Commands:
 * - mew gateway start    - Start a gateway server
 * - mew client connect   - Connect to gateway with FIFO mode
 * - mew agent start      - Start a built-in agent
 * - mew token create     - Create a test token
 */
try {
  require('../dist/index.js');
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    console.error('The MEW CLI has not been built yet. Run "npm run build --workspace @mew-protocol/cli" to compile.');
    process.exit(1);
  }
  throw error;
}

