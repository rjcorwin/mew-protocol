/**
 * Text Buffer Implementation for MEW CLI
 *
 * Provides multi-line text editing, cursor management, and word navigation.
 * Adapted from Gemini CLI patterns for terminal input handling.
 */

export interface CursorPosition {
  line: number;
  column: number;
}

export interface TextBufferStats {
  lines: number;
  characters: number;
  cursorLine: number;
  cursorColumn: number;
}

export default class TextBuffer {
  public lines: string[];
  private cursorLine = 0;
  private cursorColumn = 0;

  constructor(initialText = '') {
    this.lines = initialText ? initialText.split('\n') : [''];
  }

  getText(): string {
    return this.lines.join('\n');
  }

  setText(text: string): void {
    this.lines = text.split('\n');
    if (this.lines.length === 0) {
      this.lines = [''];
    }

    this.cursorLine = Math.min(this.cursorLine, this.lines.length - 1);
    this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine].length);
  }

  getCursorIndex(): number {
    let index = 0;
    for (let lineIndex = 0; lineIndex < this.cursorLine; lineIndex++) {
      index += this.lines[lineIndex].length + 1;
    }
    return index + this.cursorColumn;
  }

  setCursorIndex(index: number): void {
    if (Number.isNaN(index)) {
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

      remaining -= lineLength + 1;
    }

    this.cursorLine = this.lines.length - 1;
    this.cursorColumn = this.lines[this.cursorLine].length;
  }

  clear(): void {
    this.lines = [''];
    this.cursorLine = 0;
    this.cursorColumn = 0;
  }

  getCurrentLine(): string {
    return this.lines[this.cursorLine] || '';
  }

  insert(text: string): void {
    const line = this.getCurrentLine();
    const before = line.slice(0, this.cursorColumn);
    const after = line.slice(this.cursorColumn);

    const insertLines = text.split('\n');
    if (insertLines.length === 1) {
      this.lines[this.cursorLine] = before + text + after;
      this.cursorColumn += text.length;
      return;
    }

    const firstLine = before + insertLines[0];
    const lastLine = insertLines[insertLines.length - 1] + after;
    const middleLines = insertLines.slice(1, -1);

    this.lines = [
      ...this.lines.slice(0, this.cursorLine),
      firstLine,
      ...middleLines,
      lastLine,
      ...this.lines.slice(this.cursorLine + 1)
    ];

    this.cursorLine += insertLines.length - 1;
    this.cursorColumn = insertLines[insertLines.length - 1].length;
  }

  deleteBackward(): void {
    if (this.cursorColumn > 0) {
      const line = this.getCurrentLine();
      this.lines[this.cursorLine] = line.slice(0, this.cursorColumn - 1) + line.slice(this.cursorColumn);
      this.cursorColumn -= 1;
      return;
    }

    if (this.cursorLine > 0) {
      const currentLine = this.lines[this.cursorLine];
      const prevLine = this.lines[this.cursorLine - 1];
      this.cursorColumn = prevLine.length;
      this.lines[this.cursorLine - 1] = prevLine + currentLine;
      this.lines.splice(this.cursorLine, 1);
      this.cursorLine -= 1;
    }
  }

  deleteForward(): void {
    const line = this.getCurrentLine();
    if (this.cursorColumn < line.length) {
      this.lines[this.cursorLine] = line.slice(0, this.cursorColumn) + line.slice(this.cursorColumn + 1);
      return;
    }

    if (this.cursorLine < this.lines.length - 1) {
      this.lines[this.cursorLine] = line + this.lines[this.cursorLine + 1];
      this.lines.splice(this.cursorLine + 1, 1);
    }
  }

  move(direction: 'left' | 'right' | 'up' | 'down' | 'lineStart' | 'lineEnd' | 'bufferStart' | 'bufferEnd' | 'wordLeft' | 'wordRight', amount = 1): void {
    switch (direction) {
      case 'left':
        this.moveLeft(amount);
        break;
      case 'right':
        this.moveRight(amount);
        break;
      case 'up':
        this.moveUp(amount);
        break;
      case 'down':
        this.moveDown(amount);
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

  moveLeft(amount = 1): void {
    for (let i = 0; i < amount; i++) {
      if (this.cursorColumn > 0) {
        this.cursorColumn -= 1;
      } else if (this.cursorLine > 0) {
        this.cursorLine -= 1;
        this.cursorColumn = this.lines[this.cursorLine].length;
      }
    }
  }

  moveRight(amount = 1): void {
    for (let i = 0; i < amount; i++) {
      const line = this.getCurrentLine();
      if (this.cursorColumn < line.length) {
        this.cursorColumn += 1;
      } else if (this.cursorLine < this.lines.length - 1) {
        this.cursorLine += 1;
        this.cursorColumn = 0;
      }
    }
  }

  moveUp(amount = 1): void {
    for (let i = 0; i < amount; i++) {
      if (this.cursorLine > 0) {
        this.cursorLine -= 1;
        this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine].length);
      }
    }
  }

  moveDown(amount = 1): void {
    for (let i = 0; i < amount; i++) {
      if (this.cursorLine < this.lines.length - 1) {
        this.cursorLine += 1;
        this.cursorColumn = Math.min(this.cursorColumn, this.lines[this.cursorLine].length);
      }
    }
  }

  moveToLineStart(): void {
    this.cursorColumn = 0;
  }

  moveToLineEnd(): void {
    this.cursorColumn = this.getCurrentLine().length;
  }

  moveToBufferStart(): void {
    this.cursorLine = 0;
    this.cursorColumn = 0;
  }

  moveToBufferEnd(): void {
    this.cursorLine = this.lines.length - 1;
    this.cursorColumn = this.lines[this.cursorLine].length;
  }

  moveWordLeft(): void {
    if (this.cursorColumn > 0) {
      const line = this.getCurrentLine();
      let col = this.cursorColumn;

      while (col > 0 && /\s/.test(line[col - 1])) {
        col -= 1;
      }
      while (col > 0 && /\S/.test(line[col - 1])) {
        col -= 1;
      }

      this.cursorColumn = col;
      return;
    }

    if (this.cursorLine > 0) {
      this.cursorLine -= 1;
      this.cursorColumn = this.lines[this.cursorLine].length;
    }
  }

  moveWordRight(): void {
    const line = this.getCurrentLine();
    let col = this.cursorColumn;

    while (col < line.length && /\S/.test(line[col])) {
      col += 1;
    }
    while (col < line.length && /\s/.test(line[col])) {
      col += 1;
    }

    if (col !== this.cursorColumn) {
      this.cursorColumn = col;
    } else if (this.cursorLine < this.lines.length - 1) {
      this.moveRight();
    }
  }

  deleteToLineEnd(): void {
    const line = this.getCurrentLine();
    this.lines[this.cursorLine] = line.slice(0, this.cursorColumn);
  }

  deleteToLineStart(): void {
    const line = this.getCurrentLine();
    this.lines[this.cursorLine] = line.slice(this.cursorColumn);
    this.cursorColumn = 0;
  }

  deleteWord(): void {
    const line = this.getCurrentLine();
    let startCol = this.cursorColumn;

    while (startCol > 0 && /\s/.test(line[startCol - 1])) {
      startCol -= 1;
    }
    while (startCol > 0 && /\S/.test(line[startCol - 1])) {
      startCol -= 1;
    }

    if (startCol < this.cursorColumn) {
      this.lines[this.cursorLine] = line.slice(0, startCol) + line.slice(this.cursorColumn);
      this.cursorColumn = startCol;
    } else if (this.cursorColumn === 0 && this.cursorLine > 0) {
      this.deleteBackward();
    }
  }

  insertNewline(): void {
    const line = this.getCurrentLine();
    const before = line.slice(0, this.cursorColumn);
    const after = line.slice(this.cursorColumn);

    this.lines[this.cursorLine] = before;
    this.lines.splice(this.cursorLine + 1, 0, after);
    this.cursorLine += 1;
    this.cursorColumn = 0;
  }

  getVisibleLines(maxWidth = 80, maxHeight = 10): string[] {
    const visibleLines: string[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.length <= maxWidth) {
        visibleLines.push(line);
        continue;
      }

      let remaining = line;
      while (remaining.length > 0) {
        visibleLines.push(remaining.slice(0, maxWidth));
        remaining = remaining.slice(maxWidth);
      }
    }

    if (visibleLines.length > maxHeight) {
      return visibleLines.slice(-maxHeight);
    }

    return visibleLines;
  }

  getCursorPosition(): CursorPosition {
    return {
      line: this.cursorLine,
      column: this.cursorColumn
    };
  }

  setCursorPosition(line: number, column: number): void {
    const safeLine = Math.max(0, Math.min(line, this.lines.length - 1));
    const safeColumn = Math.max(0, Math.min(column, this.lines[safeLine].length));

    this.cursorLine = safeLine;
    this.cursorColumn = safeColumn;
  }

  isEmpty(): boolean {
    return this.lines.length === 1 && this.lines[0] === '';
  }

  getStats(): TextBufferStats {
    return {
      lines: this.lines.length,
      characters: this.getText().length,
      cursorLine: this.cursorLine,
      cursorColumn: this.cursorColumn
    };
  }
}
