// @ts-nocheck
/**
 * Text Utilities for Unicode and Terminal Handling
 *
 * Provides utilities for handling Unicode characters, emoji,
 * and terminal-specific text processing.
 *
 * Adapted from Gemini CLI patterns for robust text handling.
 *
 * @license MIT
 */

/**
 * Get the visual width of a string accounting for Unicode characters
 * This handles emoji, combining characters, and wide characters
 */
function getStringWidth(str) {
  if (!str || str.length === 0) return 0;

  let width = 0;
  // Simple implementation - can be enhanced with wcwidth library if needed
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    // Skip combining characters (zero width)
    if (code >= 0x0300 && code <= 0x036F) continue;

    // Handle surrogate pairs (emoji and other Unicode planes)
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
      const lowCode = str.charCodeAt(i + 1);
      if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
        // This is a valid surrogate pair (emoji or other)
        width += 2; // Most emoji are double width
        i++; // Skip the low surrogate
        continue;
      }
    }

    // CJK characters are typically double width
    if (
      (code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
      (code >= 0x2E80 && code <= 0x9FFF) || // CJK
      (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility
      (code >= 0xFE30 && code <= 0xFE6F) || // CJK Compatibility Forms
      (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
      (code >= 0xFFE0 && code <= 0xFFE6)    // Fullwidth Forms
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }

  return width;
}

/**
 * Get the character index at a visual position
 * This accounts for wide characters and combining marks
 */
function getCharacterIndexAtPosition(str, targetPosition) {
  if (!str || targetPosition <= 0) return 0;

  let visualPosition = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    // Skip combining characters
    if (code >= 0x0300 && code <= 0x036F) continue;

    // Handle surrogate pairs
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
      const lowCode = str.charCodeAt(i + 1);
      if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
        visualPosition += 2;
        if (visualPosition >= targetPosition) return i;
        i++; // Skip the low surrogate
        continue;
      }
    }

    // Check for wide characters
    const isWide = isWideCharacter(code);
    visualPosition += isWide ? 2 : 1;

    if (visualPosition >= targetPosition) return i + 1;
  }

  return str.length;
}

/**
 * Check if a character code represents a wide character
 */
function isWideCharacter(code) {
  return (
    (code >= 0x1100 && code <= 0x115F) ||
    (code >= 0x2E80 && code <= 0x9FFF) ||
    (code >= 0xAC00 && code <= 0xD7AF) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0xFE30 && code <= 0xFE6F) ||
    (code >= 0xFF00 && code <= 0xFF60) ||
    (code >= 0xFFE0 && code <= 0xFFE6)
  );
}

/**
 * Truncate a string to fit within a visual width
 */
function truncateToWidth(str, maxWidth, ellipsis = '...') {
  if (!str || maxWidth <= 0) return '';

  const fullWidth = getStringWidth(str);
  if (fullWidth <= maxWidth) return str;

  const ellipsisWidth = getStringWidth(ellipsis);
  const targetWidth = maxWidth - ellipsisWidth;

  if (targetWidth <= 0) return ellipsis.substring(0, maxWidth);

  let width = 0;
  let endIndex = 0;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);

    // Skip combining characters
    if (code >= 0x0300 && code <= 0x036F) continue;

    // Handle surrogate pairs
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
      const lowCode = str.charCodeAt(i + 1);
      if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
        width += 2;
        if (width > targetWidth) break;
        endIndex = i + 2;
        i++;
        continue;
      }
    }

    const charWidth = isWideCharacter(code) ? 2 : 1;
    if (width + charWidth > targetWidth) break;

    width += charWidth;
    endIndex = i + 1;
  }

  return str.substring(0, endIndex) + ellipsis;
}

/**
 * Find word boundaries in text
 */
function findWordBoundaries(text, position) {
  if (!text) return { start: 0, end: 0 };

  // Word characters pattern (letters, numbers, some punctuation)
  const wordChar = /[a-zA-Z0-9_-]/;

  let start = position;
  let end = position;

  // Find start of word
  while (start > 0 && wordChar.test(text[start - 1])) {
    start--;
  }

  // Find end of word
  while (end < text.length && wordChar.test(text[end])) {
    end++;
  }

  return { start, end };
}

/**
 * Split text into lines with proper handling of line endings
 */
function splitLines(text) {
  if (!text) return [''];

  // Handle different line endings (CRLF, LF, CR)
  const lines = text.split(/\r\n|\n|\r/);

  // Ensure at least one empty line if text is empty
  if (lines.length === 0) return [''];

  return lines;
}

/**
 * Join lines with consistent line endings
 */
function joinLines(lines, lineEnding = '\n') {
  if (!lines || lines.length === 0) return '';
  return lines.join(lineEnding);
}

/**
 * Escape special characters for terminal display
 */
function escapeForTerminal(text) {
  if (!text) return '';

  // Escape ANSI control sequences and other special characters
  return text
    .replace(/\x1b/g, '\\e') // Escape ESC character
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, (char) => {
      // Replace control characters with their escape sequences
      const code = char.charCodeAt(0);
      return `\\x${code.toString(16).padStart(2, '0')}`;
    });
}

/**
 * Strip ANSI escape codes from text
 */
const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-PR-TZcf-nq-uy=><]/g;
const OSC_PATTERN = /\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

function stripAnsi(text) {
  if (!text) return '';

  return text
    .replace(OSC_PATTERN, '')
    .replace(ANSI_PATTERN, '')
    .replace(/[\u0007\u0008]/g, '')
    .replace(/\r/g, '');
}

/**
 * Count grapheme clusters (user-perceived characters)
 * This is a simple implementation - for full support use a library like grapheme-splitter
 */
function countGraphemes(text) {
  if (!text) return 0;

  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // Skip combining characters
    if (code >= 0x0300 && code <= 0x036F) continue;

    // Skip low surrogates
    if (code >= 0xDC00 && code <= 0xDFFF) continue;

    count++;
  }

  return count;
}

/**
 * Check if character at position is emoji
 */
function isEmoji(text, position) {
  if (!text || position < 0 || position >= text.length) return false;

  const code = text.charCodeAt(position);

  // Check for surrogate pair (most emoji)
  if (code >= 0xD800 && code <= 0xDBFF && position + 1 < text.length) {
    const lowCode = text.charCodeAt(position + 1);
    if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
      // This is a surrogate pair - likely emoji
      const codePoint = (code - 0xD800) * 0x400 + (lowCode - 0xDC00) + 0x10000;

      // Common emoji ranges
      return (
        (codePoint >= 0x1F300 && codePoint <= 0x1F9FF) || // Misc symbols & pictographs
        (codePoint >= 0x1F000 && codePoint <= 0x1F0FF) || // Domino tiles & playing cards
        (codePoint >= 0x1FA00 && codePoint <= 0x1FA6F) || // Extended symbols
        (codePoint >= 0x2600 && codePoint <= 0x26FF) ||   // Misc symbols
        (codePoint >= 0x2700 && codePoint <= 0x27BF)      // Dingbats
      );
    }
  }

  // Check basic emoji in BMP
  return (code >= 0x2600 && code <= 0x27BF);
}

export {
  getStringWidth,
  getCharacterIndexAtPosition,
  isWideCharacter,
  truncateToWidth,
  findWordBoundaries,
  splitLines,
  joinLines,
  escapeForTerminal,
  stripAnsi,
  countGraphemes,
  isEmoji
};