/**
 * Debug Logging Utilities for MEW CLI
 *
 * Provides consistent debug logging to .mew/debug.log in the current working directory.
 */

import fs from 'fs';
import path from 'path';

/**
 * Writes a debug message to .mew/debug.log
 * @param message - The message to log
 */
export function debugLog(message: string): void {
  const logFile = path.join(process.cwd(), '.mew', 'debug.log');
  const mewDir = path.join(process.cwd(), '.mew');

  if (!fs.existsSync(mewDir)) {
    fs.mkdirSync(mewDir, { recursive: true });
  }

  fs.appendFileSync(logFile, message);
}

/**
 * Logs a formatted debug message with timestamp
 * @param label - Label for the log entry
 * @param data - Data to log (will be JSON stringified if object)
 */
export function debugLogWithTimestamp(label: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
  debugLog(`\n[${timestamp}] ${label}\n${dataStr ? `${dataStr}\n` : ''}`);
}
