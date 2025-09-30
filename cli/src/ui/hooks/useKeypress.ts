/**
 * useKeypress Hook
 *
 * Provides enhanced keyboard input handling for the terminal UI.
 * Captures and processes keyboard events with support for special keys,
 * modifiers, and key combinations.
 *
 * Adapted from Gemini CLI patterns for MEW Protocol CLI.
 *
 * @license MIT
 */

import fs from 'fs';
import path from 'path';
import { useInput, type Key } from 'ink';
import { useCallback, useRef } from 'react';

import type { EnhancedKey } from '../keyMatchers';

export interface UseKeypressOptions {
  isActive?: boolean;
  preventDefault?: boolean;
  captureNumbers?: boolean;
  captureArrows?: boolean;
}

export type KeypressHandler = (key: EnhancedKey, input: string) => void;

/**
 * Enhanced keypress hook with better key detection
 */
export function useKeypress(handler: KeypressHandler, options: UseKeypressOptions = {}): void {
  const {
    isActive = true,
    preventDefault = true,
    captureNumbers = true,
    captureArrows = true, // eslint-disable-line @typescript-eslint/no-unused-vars
  } = options;

  const handlerRef = useRef<KeypressHandler>(handler);
  handlerRef.current = handler;

  const processKey = useCallback(
    (input: string, key: Key) => {
      if (!isActive) return;

      // Debug logging for raw key from Ink
      const keyAny = key as any;
      if (input === '\x7F' || keyAny.sequence === '\x7F' || keyAny.name === 'delete') {
        const logFile = path.join(process.cwd(), '.mew', 'debug.log');
        fs.appendFileSync(logFile, `\nRAW DELETE KEY FROM INK: ${JSON.stringify({ input, key })}\n`);
      }

      // Determine special cases before building the enhanced key
      const isTabKey =
        keyAny.name === 'tab' ||
        keyAny.tab === true ||
        input === '\t' ||
        keyAny.sequence === '\t';

      let resolvedName = keyAny.name || input || '';
      if (!resolvedName && isTabKey) {
        resolvedName = 'tab';
      }

      // Build enhanced key object
      const enhancedKey: EnhancedKey & {
        shiftEnter: boolean;
        number?: number;
        isNumber?: boolean;
        sequence?: string;
        raw: Key;
      } = {
        // Basic key info
        input: input || '',
        name: resolvedName,

        // Modifiers
        ctrl: Boolean(key.ctrl),
        alt: Boolean((key as unknown as { meta?: boolean; alt?: boolean }).meta || keyAny.alt),
        shift: Boolean(key.shift),
        meta: Boolean(key.meta),

        // Special keys
        // Check both ways Ink might report the Enter key
        // Also check for Shift+Enter escape sequence: ESC[27;2;13~ or just [27;2;13~
        return: keyAny.name === 'return' || keyAny.name === 'enter' || input === '\r' || input === '\n',
        enter: keyAny.name === 'return' || keyAny.name === 'enter' || input === '\r' || input === '\n',
        shiftEnter:
          input === '\x1b[27;2;13~' ||
          input === '[27;2;13~' ||
          (Boolean(key.shift) && (Boolean(keyAny.return) || Boolean(keyAny.enter))),
        backspace: keyAny.name === 'backspace' || input === '\x7F' || input === '\b',
        delete: keyAny.name === 'delete' || keyAny.sequence === '\x1B[3~',
        tab: isTabKey,
        escape: keyAny.name === 'escape' || keyAny.name === 'esc',
        space: keyAny.name === 'space' || input === ' ',

        // Arrow keys - check both name and arrow properties from Ink
        up: keyAny.name === 'up' || Boolean(keyAny.upArrow),
        down: keyAny.name === 'down' || Boolean(keyAny.downArrow),
        left: keyAny.name === 'left' || Boolean(keyAny.leftArrow),
        right: keyAny.name === 'right' || Boolean(keyAny.rightArrow),

        // Navigation keys
        home: keyAny.name === 'home',
        end: keyAny.name === 'end',
        pageup: keyAny.name === 'pageup',
        pagedown: keyAny.name === 'pagedown',

        // Function keys
        f1: keyAny.name === 'f1',
        f2: keyAny.name === 'f2',
        f3: keyAny.name === 'f3',
        f4: keyAny.name === 'f4',
        f5: keyAny.name === 'f5',
        f6: keyAny.name === 'f6',
        f7: keyAny.name === 'f7',
        f8: keyAny.name === 'f8',
        f9: keyAny.name === 'f9',
        f10: keyAny.name === 'f10',
        f11: keyAny.name === 'f11',
        f12: keyAny.name === 'f12',

        // Original key object for debugging
        raw: key,
      };

      // Handle number keys specially if enabled
      if (captureNumbers && input && /^[0-9]$/.test(input)) {
        enhancedKey.number = parseInt(input, 10);
        enhancedKey.isNumber = true;
      }

      // Create string representation for easy matching
      const modifiers: string[] = [];
      if (enhancedKey.ctrl) modifiers.push('ctrl');
      if (enhancedKey.alt) modifiers.push('alt');
      if (enhancedKey.shift) modifiers.push('shift');

      let keyName = enhancedKey.name as string;
      if (enhancedKey.return) keyName = 'enter';
      if (enhancedKey.escape) keyName = 'escape';
      if (enhancedKey.tab) keyName = 'tab';

      enhancedKey.sequence = modifiers.length > 0 ? `${modifiers.join('+')}+${keyName}` : keyName;

      // Call the handler with enhanced key object
      handlerRef.current(enhancedKey, input);

      // Prevent default behavior if requested
      if (preventDefault && (key.ctrl || key.meta)) {
        // This helps prevent terminal shortcuts from interfering
        return false;
      }

      return undefined;
    },
    [isActive, preventDefault, captureNumbers],
  );

  // Use Ink's useInput hook
  useInput(processKey, { isActive });
}

/**
 * Key combination matcher
 */
export function matchesKeyCombination(key: EnhancedKey | null | undefined, combination: string): boolean {
  if (!key || !combination) return false;

  const parts = combination.toLowerCase().split('+');
  const modifiers: string[] = [];
  const mainKey = parts[parts.length - 1] ?? '';

  // Extract modifiers
  for (let i = 0; i < parts.length - 1; i += 1) {
    const mod = parts[i];
    if (['ctrl', 'alt', 'shift', 'meta'].includes(mod)) {
      modifiers.push(mod);
    }
  }

  // Check modifiers
  if (modifiers.includes('ctrl') && !key.ctrl) return false;
  if (modifiers.includes('alt') && !key.alt) return false;
  if (modifiers.includes('shift') && !key.shift) return false;
  if (modifiers.includes('meta') && !key.meta) return false;

  // Check for unexpected modifiers
  if (!modifiers.includes('ctrl') && key.ctrl) return false;
  if (!modifiers.includes('alt') && key.alt) return false;
  if (!modifiers.includes('shift') && key.shift) return false;
  if (!modifiers.includes('meta') && key.meta) return false;

  // Check main key
  switch (mainKey) {
    case 'enter':
    case 'return':
      return Boolean(key.return);
    case 'escape':
    case 'esc':
      return Boolean(key.escape);
    case 'backspace':
      return Boolean(key.backspace);
    case 'delete':
    case 'del':
      return Boolean(key.delete);
    case 'tab':
      return Boolean(key.tab);
    case 'space':
      return Boolean(key.space);
    case 'up':
      return Boolean(key.up);
    case 'down':
      return Boolean(key.down);
    case 'left':
      return Boolean(key.left);
    case 'right':
      return Boolean(key.right);
    case 'home':
      return Boolean(key.home);
    case 'end':
      return Boolean(key.end);
    case 'pageup':
      return Boolean(key.pageup);
    case 'pagedown':
      return Boolean(key.pagedown);
    default:
      // Check for letter keys (a-z)
      if (/^[a-z]$/.test(mainKey)) {
        return (key.name ?? '').toLowerCase() === mainKey;
      }
      // Check for number keys
      if (/^[0-9]$/.test(mainKey)) {
        return key.input === mainKey;
      }
      // Check for function keys
      if (/^f[0-9]+$/.test(mainKey)) {
        return Boolean((key as Record<string, unknown>)[mainKey]);
      }
      return key.name === mainKey;
  }
}

export default {
  useKeypress,
  matchesKeyCombination,
};
