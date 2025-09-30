/**
 * Text Buffer Implementation for MEW CLI
 *
 * Adapted from Gemini CLI patterns for terminal input handling.
 * Provides multi-line text editing, cursor management, and word navigation.
 *
 * Original inspiration from Gemini CLI (https://github.com/google/gemini-cli)
 * Simplified and adapted for MEW Protocol CLI needs.
 *
 * @license MIT
 */

/**
 * TextBuffer manages multi-line text with cursor position tracking
 */
class TextBuffer {
  constructor(initialText = '') {
    this.lines = initialText ? initialText.split('\n') : [''];
    this.cursorLine = 0;
    this.cursorColumn = 0;
  }

  /**
   * Get the current text content
   */
  getText() {
    return this.lines.join('\n');
  }

  /**
   * Set the entire buffer content
   */
  setText(text) {
    this.lines = text.split('\n');
    if (this.lines.length === 0) {
      this.lines = [''];
    }
    // Ensure cursor is within bounds
    this.cursorLine = Math.min(this.cursorLine, this.lines.length - 1);
    this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine].length);
  }

  /**
   * Get the absolute cursor index within the buffer text
   */
  getCursorIndex() {
    let index = 0;
    for (let lineIndex = 0; lineIndex < this.cursorLine; lineIndex++) {
      index += this.lines[lineIndex].length;
      index += 1; // Account for newline separator
    }
    return index + this.cursorColumn;
  }

  /**
   * Set cursor position from an absolute text index
   * @param {number} index
   */
  setCursorIndex(index) {
    if (typeof index !== 'number' || Number.isNaN(index)) {
      return;
    }

    let remaining = Math.max(0, index);

    for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
      const lineLength = this.lines[lineIndex].length;

      if (remaining <= lineLength) {
        this.cursorLine = lineIndex;
        this.cursorColumn = remaining;
        return;
      }

      // Skip newline separator
      remaining -= lineLength + 1;
    }

    // Clamp to end of buffer if index exceeds length
    this.cursorLine = this.lines.length - 1;
    this.cursorColumn = this.lines[this.cursorLine].length;
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.lines = [''];
    this.cursorLine = 0;
    this.cursorColumn = 0;
  }

  /**
   * Get current line text
   */
  getCurrentLine() {
    return this.lines[this.cursorLine] || '';
  }

  /**
   * Insert text at cursor position
   */
  insert(text) {
    const line = this.getCurrentLine();
    const before = line.slice(0, this.cursorColumn);
    const after = line.slice(this.cursorColumn);

    // Handle multi-line insert
    const insertLines = text.split('\n');
    if (insertLines.length === 1) {
      // Single line insert
      this.lines[this.cursorLine] = before + text + after;
      this.cursorColumn += text.length;
    } else {
      // Multi-line insert
      const firstLine = before + insertLines[0];
      const lastLine = insertLines[insertLines.length - 1] + after;
      const middleLines = insertLines.slice(1, -1);

      // Replace current line and insert new lines
      const newLines = [
        ...this.lines.slice(0, this.cursorLine),
        firstLine,
        ...middleLines,
        lastLine,
        ...this.lines.slice(this.cursorLine + 1)
      ];

      this.lines = newLines;
      this.cursorLine += insertLines.length - 1;
      this.cursorColumn = insertLines[insertLines.length - 1].length;
    }
  }

  /**
   * Delete character before cursor (backspace)
   */
  deleteBackward() {
    if (this.cursorColumn > 0) {
      // Delete within line
      const line = this.getCurrentLine();
      this.lines[this.cursorLine] =
        line.slice(0, this.cursorColumn - 1) +
        line.slice(this.cursorColumn);
      this.cursorColumn--;
    } else if (this.cursorLine > 0) {
      // Join with previous line
      const currentLine = this.lines[this.cursorLine];
      const prevLine = this.lines[this.cursorLine - 1];
      this.cursorColumn = prevLine.length;
      this.lines[this.cursorLine - 1] = prevLine + currentLine;
      this.lines.splice(this.cursorLine, 1);
      this.cursorLine--;
    }
  }

  /**
   * Delete character at cursor (delete key)
   */
  deleteForward() {
    const line = this.getCurrentLine();
    if (this.cursorColumn < line.length) {
      // Delete within line
      this.lines[this.cursorLine] =
        line.slice(0, this.cursorColumn) +
        line.slice(this.cursorColumn + 1);
    } else if (this.cursorLine < this.lines.length - 1) {
      // Join with next line
      this.lines[this.cursorLine] = line + this.lines[this.cursorLine + 1];
      this.lines.splice(this.cursorLine + 1, 1);
    }
  }

  /**
   * Move cursor operations
   */
  move(direction, amount = 1) {
    switch (direction) {
      case 'left':
        this.moveLeft();
        break;
      case 'right':
        this.moveRight();
        break;
      case 'up':
        this.moveUp();
        break;
      case 'down':
        this.moveDown();
        break;
      case 'lineStart':
        this.moveToLineStart();
        break;
      case 'lineEnd':
        this.moveToLineEnd();
        break;
      case 'bufferStart':
        this.moveToBufferStart();
        break;
      case 'bufferEnd':
        this.moveToBufferEnd();
        break;
      case 'wordLeft':
        this.moveWordLeft();
        break;
      case 'wordRight':
        this.moveWordRight();
        break;
    }
  }

  moveLeft() {
    if (this.cursorColumn > 0) {
      this.cursorColumn--;
    } else if (this.cursorLine > 0) {
      this.cursorLine--;
      this.cursorColumn = this.lines[this.cursorLine].length;
    }
  }

  moveRight() {
    const line = this.getCurrentLine();
    if (this.cursorColumn < line.length) {
      this.cursorColumn++;
    } else if (this.cursorLine < this.lines.length - 1) {
      this.cursorLine++;
      this.cursorColumn = 0;
    }
  }

  moveUp() {
    if (this.cursorLine > 0) {
      this.cursorLine--;
      this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine].length);
    }
  }

  moveDown() {
    if (this.cursorLine < this.lines.length - 1) {
      this.cursorLine++;
      this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine].length);
    }
  }

  moveToLineStart() {
    this.cursorColumn = 0;
  }

  moveToLineEnd() {
    this.cursorColumn = this.getCurrentLine().length;
  }

  moveToBufferStart() {
    this.cursorLine = 0;
    this.cursorColumn = 0;
  }

  moveToBufferEnd() {
    this.cursorLine = this.lines.length - 1;
    this.cursorColumn = this.lines[this.cursorLine].length;
  }

  moveWordLeft() {
    const line = this.getCurrentLine();
    let col = this.cursorColumn;

    // Skip whitespace backwards
    while (col > 0 && /\s/.test(line[col - 1])) {
      col--;
    }

    // Skip word characters backwards
    while (col > 0 && /\S/.test(line[col - 1])) {
      col--;
    }

    if (col !== this.cursorColumn) {
      this.cursorColumn = col;
    } else if (this.cursorLine > 0) {
      // Move to end of previous line if at start of line
      this.moveLeft();
    }
  }

  moveWordRight() {
    const line = this.getCurrentLine();
    let col = this.cursorColumn;

    // Skip word characters forwards
    while (col < line.length && /\S/.test(line[col])) {
      col++;
    }

    // Skip whitespace forwards
    while (col < line.length && /\s/.test(line[col])) {
      col++;
    }

    if (col !== this.cursorColumn) {
      this.cursorColumn = col;
    } else if (this.cursorLine < this.lines.length - 1) {
      // Move to start of next line if at end of line
      this.moveRight();
    }
  }

  /**
   * Delete operations
   */
  deleteToLineEnd() {
    const line = this.getCurrentLine();
    this.lines[this.cursorLine] = line.slice(0, this.cursorColumn);
  }

  deleteToLineStart() {
    const line = this.getCurrentLine();
    this.lines[this.cursorLine] = line.slice(this.cursorColumn);
    this.cursorColumn = 0;
  }

  deleteWord() {
    const line = this.getCurrentLine();
    let startCol = this.cursorColumn;

    // Move back to start of word
    while (startCol > 0 && /\s/.test(line[startCol - 1])) {
      startCol--;
    }
    while (startCol > 0 && /\S/.test(line[startCol - 1])) {
      startCol--;
    }

    // Delete from start of word to current position
    if (startCol < this.cursorColumn) {
      this.lines[this.cursorLine] =
        line.slice(0, startCol) +
        line.slice(this.cursorColumn);
      this.cursorColumn = startCol;
    } else if (this.cursorColumn === 0 && this.cursorLine > 0) {
      // At start of line, delete line break
      this.deleteBackward();
    }
  }

  /**
   * Insert a newline at cursor position
   */
  insertNewline() {
    const line = this.getCurrentLine();
    const before = line.slice(0, this.cursorColumn);
    const after = line.slice(this.cursorColumn);

    this.lines[this.cursorLine] = before;
    this.lines.splice(this.cursorLine + 1, 0, after);
    this.cursorLine++;
    this.cursorColumn = 0;
  }

  /**
   * Get visible lines for display (with wrapping if needed)
   */
  getVisibleLines(maxWidth = 80, maxHeight = 10) {
    const visibleLines = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.length <= maxWidth) {
        visibleLines.push(line);
      } else {
        // Word wrap long lines
        let remaining = line;
        while (remaining.length > 0) {
          visibleLines.push(remaining.slice(0, maxWidth));
          remaining = remaining.slice(maxWidth);
        }
      }
    }

    // Return last maxHeight lines if there are too many
    if (visibleLines.length > maxHeight) {
      return visibleLines.slice(-maxHeight);
    }

    return visibleLines;
  }

  /**
   * Get cursor position for display
   */
  getCursorPosition() {
    return {
      line: this.cursorLine,
      column: this.cursorColumn
    };
  }

  /**
   * Check if buffer is empty
   */
  isEmpty() {
    return this.lines.length === 1 && this.lines[0] === '';
  }

  /**
   * Get buffer statistics
   */
  getStats() {
    return {
      lines: this.lines.length,
      characters: this.getText().length,
      cursorLine: this.cursorLine,
      cursorColumn: this.cursorColumn
    };
  }
}

export default TextBuffer;