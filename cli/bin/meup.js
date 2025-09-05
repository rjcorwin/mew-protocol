#!/usr/bin/env node

/**
 * MEUP CLI - Minimal implementation for testing
 * 
 * Commands:
 * - meup gateway start    - Start a gateway server
 * - meup client connect   - Connect to gateway with FIFO mode
 * - meup agent start      - Start a built-in agent
 * - meup token create     - Create a test token
 */

require('../src/index.js');