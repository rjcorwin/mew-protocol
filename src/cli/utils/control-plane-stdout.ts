// @ts-nocheck
import { Writable } from 'node:stream';

const CSI_FINAL_BYTE_PATTERN = /[@-~]/;

export class ControlPlaneStdout extends Writable {
  #target;
  #buffer = '';
  #frames = 0;
  #lastFrame = new Date(0);
  #maxBuffer;
  #cursor;
  #frameLines = [''];
  #frameCursor = { x: 0, y: 0 };
  #frameCursorSnapshot = { x: 0, y: 0 };
  #maxRows;

  constructor(target) {
    super();
    this.#target = target;
    this.columns = target?.columns;
    this.rows = target?.rows;
    this.#maxRows = typeof target?.rows === 'number' && target.rows > 0 ? target.rows : null;
    const envValue = Number(process.env.CONTROL_PLANE_BUFFER);
    this.#maxBuffer = Number.isFinite(envValue) && envValue > 0 ? envValue : 4000;

    target?.on?.('resize', () => {
      this.columns = target?.columns;
      this.rows = target?.rows;
      this.#maxRows = typeof target?.rows === 'number' && target.rows > 0 ? target.rows : this.#maxRows;
    });
  }

  _write(chunk, encoding, callback) {
    this.#frames += 1;
    this.#lastFrame = new Date();

    const text = typeof chunk === 'string'
      ? chunk
      : Buffer.isBuffer(chunk)
        ? chunk.toString(typeof encoding === 'string' && encoding !== 'buffer' ? encoding : 'utf8')
        : '';

    if (text) {
      this.#buffer += text;
      if (this.#buffer.length > this.#maxBuffer) {
        this.#buffer = this.#buffer.slice(-this.#maxBuffer);
      }
      this.#applyToFrame(text);
    }

    if (typeof this.#target?.write === 'function') {
      if (Buffer.isBuffer(chunk)) {
        this.#target.write(chunk, callback);
      } else {
        this.#target.write(chunk, encoding, callback);
      }
    } else if (callback) {
      callback();
    }
  }

  snapshot() {
    const width = this.columns ?? this.#target?.columns ?? 0;
    const height = this.rows ?? this.#target?.rows ?? 0;
    const plain = this.#frameLines.join('\n');
    const cursor = this.#cursor ?? { ...this.#frameCursorSnapshot };

    return {
      current: {
        raw: plain,
        plain,
        lines: this.#frameLines.slice(),
        dimensions: { width, height },
        cursor
      },
      history: {
        raw: this.#buffer,
        bufferSize: this.#buffer.length,
        truncated: this.#buffer.length >= this.#maxBuffer
      },
      lastFrame: this.#lastFrame,
      framesRendered: this.#frames
    };
  }

  setCursor(cursor) {
    this.#cursor = cursor ? { x: cursor.x ?? 0, y: cursor.y ?? 0 } : undefined;
  }

  #applyToFrame(text) {
    if (!text) {
      return;
    }

    let index = 0;
    while (index < text.length) {
      const char = text[index];

      if (char === '\r') {
        this.#frameCursor.x = 0;
        index += 1;
        continue;
      }

      if (char === '\n') {
        this.#lineFeed();
        index += 1;
        continue;
      }

      if (char === '\b') {
        this.#frameCursor.x = Math.max(0, this.#frameCursor.x - 1);
        index += 1;
        continue;
      }

      if (char === '\t') {
        const spaces = 4 - (this.#frameCursor.x % 4 || 4);
        for (let i = 0; i < spaces; i += 1) {
          this.#writeChar(' ');
        }
        index += 1;
        continue;
      }

      if (char === '\u001b') {
        index = this.#handleEscapeSequence(text, index);
        continue;
      }

      if (char >= ' ' || char === '\u0000') {
        this.#writeChar(char);
      }

      index += 1;
    }

    this.#frameCursorSnapshot = { ...this.#frameCursor };
  }

  #handleEscapeSequence(text, startIndex) {
    if (startIndex + 1 >= text.length) {
      return text.length;
    }

    const nextChar = text[startIndex + 1];

    if (nextChar === '[') {
      let cursor = startIndex + 2;
      while (cursor < text.length && !CSI_FINAL_BYTE_PATTERN.test(text[cursor])) {
        cursor += 1;
      }

      if (cursor >= text.length) {
        return text.length;
      }

      const finalChar = text[cursor];
      let paramsSection = text.slice(startIndex + 2, cursor);
      const params = this.#parseParams(paramsSection);
      this.#applyCSI(finalChar, params);
      return cursor + 1;
    }

    // Unsupported escape sequence, skip ESC
    return startIndex + 1;
  }

  #parseParams(section) {
    if (!section) {
      return [];
    }

    if (section.includes(':')) {
      section = section.replace(/:/g, ';');
    }

    const rawParts = section.split(';').filter(Boolean);
    if (rawParts.length === 0) {
      return [];
    }

    return rawParts.map((part) => {
      let value = part.trim();
      if (!value) {
        return 0;
      }
      if (value.startsWith('?')) {
        value = value.slice(1);
      }
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
  }

  #applyCSI(finalChar, params) {
    switch (finalChar) {
      case 'A':
        this.#moveCursorVertical(-this.#resolveCount(params[0]));
        break;
      case 'B':
        this.#moveCursorVertical(this.#resolveCount(params[0]));
        break;
      case 'C':
        this.#moveCursorHorizontal(this.#resolveCount(params[0]));
        break;
      case 'D':
        this.#moveCursorHorizontal(-this.#resolveCount(params[0]));
        break;
      case 'E':
        this.#moveCursorVertical(this.#resolveCount(params[0]));
        this.#frameCursor.x = 0;
        break;
      case 'F':
        this.#moveCursorVertical(-this.#resolveCount(params[0]));
        this.#frameCursor.x = 0;
        break;
      case 'G':
        this.#setCursorColumn(this.#resolveColumn(params[0]));
        break;
      case 'H':
      case 'f':
        this.#setCursorPosition({
          row: this.#resolveRow(params[0]),
          column: this.#resolveColumn(params[1])
        });
        break;
      case 'J':
        this.#clearScreen(params[0] ?? 0);
        break;
      case 'K':
        this.#clearLine(params[0] ?? 0);
        break;
      case 'L':
        this.#insertLines(this.#resolveCount(params[0]));
        break;
      case 'M':
        this.#deleteLines(this.#resolveCount(params[0]));
        break;
      case 'P':
        this.#deleteCharacters(this.#resolveCount(params[0]));
        break;
      case 'X':
        this.#eraseCharacters(this.#resolveCount(params[0]));
        break;
      case '~':
        if ((params[0] ?? 0) === 3) {
          this.#deleteCharacters(1);
        }
        break;
      case 'm':
      case 'h':
      case 'l':
      case 't':
      case 's':
      case 'u':
        // Formatting / mode commands – not required for plain snapshot
        break;
      default:
        break;
    }

    this.#frameCursorSnapshot = { ...this.#frameCursor };
  }

  #resolveCount(value) {
    return value && value > 0 ? value : 1;
  }

  #resolveRow(value) {
    const row = value && value > 0 ? value - 1 : 0;
    return row;
  }

  #resolveColumn(value) {
    const col = value && value > 0 ? value - 1 : 0;
    return col;
  }

  #moveCursorHorizontal(delta) {
    this.#frameCursor.x = Math.max(0, this.#frameCursor.x + delta);
    this.#ensureCursorLine();
  }

  #moveCursorVertical(delta) {
    this.#frameCursor.y = Math.max(0, this.#frameCursor.y + delta);
    this.#ensureCursorLine();
  }

  #setCursorColumn(column) {
    this.#frameCursor.x = Math.max(0, column);
    this.#ensureCursorLine();
  }

  #setCursorPosition({ row, column }) {
    this.#frameCursor.y = Math.max(0, row);
    this.#frameCursor.x = Math.max(0, column ?? 0);
    this.#ensureCursorLine();
  }

  #lineFeed() {
    this.#frameCursor.y += 1;
    this.#frameCursor.x = 0;
    this.#ensureCursorLine();
    this.#enforceRowLimit();
  }

  #ensureCursorLine() {
    const limit = typeof this.#maxRows === 'number' && this.#maxRows > 0 ? this.#maxRows : null;
    while (this.#frameLines.length <= this.#frameCursor.y) {
      this.#frameLines.push('');
    }
    if (limit && this.#frameLines.length > limit) {
      const excess = this.#frameLines.length - limit;
      this.#frameLines.splice(0, excess);
      this.#frameCursor.y = Math.max(0, this.#frameCursor.y - excess);
      this.#frameCursorSnapshot = { ...this.#frameCursor };
    }
  }

  #enforceRowLimit() {
    const limit = typeof this.#maxRows === 'number' && this.#maxRows > 0 ? this.#maxRows : null;
    if (!limit) {
      return;
    }
    if (this.#frameLines.length > limit) {
      const excess = this.#frameLines.length - limit;
      this.#frameLines.splice(0, excess);
      this.#frameCursor.y = Math.max(0, this.#frameCursor.y - excess);
    }
  }

  #writeChar(char) {
    this.#ensureCursorLine();
    const line = this.#frameLines[this.#frameCursor.y] ?? '';
    const paddingLength = Math.max(0, this.#frameCursor.x - line.length);
    const padding = paddingLength > 0 ? ' '.repeat(paddingLength) : '';
    const baseLine = line + padding;
    const before = baseLine.slice(0, this.#frameCursor.x);
    const after = baseLine.slice(this.#frameCursor.x + 1);
    this.#frameLines[this.#frameCursor.y] = `${before}${char}${after}`;
    this.#frameCursor.x += 1;
    this.#frameCursorSnapshot = { ...this.#frameCursor };
  }

  #clearScreen(mode) {
    if (mode === 2 || mode === 3) {
      this.#frameLines = [''];
      this.#frameCursor = { x: 0, y: 0 };
      this.#frameCursorSnapshot = { x: 0, y: 0 };
      return;
    }

    if (mode === 0) {
      this.#clearLine(0);
      const startingRow = this.#frameCursor.y;
      for (let row = startingRow + 1; row < this.#frameLines.length; row += 1) {
        this.#frameLines[row] = '';
      }
    } else if (mode === 1) {
      for (let row = 0; row <= this.#frameCursor.y; row += 1) {
        this.#frameLines[row] = '';
      }
    }
  }

  #clearLine(mode) {
    this.#ensureCursorLine();
    const line = this.#frameLines[this.#frameCursor.y] ?? '';

    switch (mode) {
      case 0: { // clear to end
        const keep = line.slice(0, this.#frameCursor.x);
        this.#frameLines[this.#frameCursor.y] = keep;
        break;
      }
      case 1: { // clear to start
        const suffix = line.slice(this.#frameCursor.x);
        this.#frameLines[this.#frameCursor.y] = ' '.repeat(Math.min(this.#frameCursor.x, line.length)) + suffix;
        break;
      }
      case 2:
      default:
        this.#frameLines[this.#frameCursor.y] = '';
        break;
    }
  }

  #insertLines(count) {
    if (count <= 0) {
      return;
    }
    this.#ensureCursorLine();
    this.#frameLines.splice(this.#frameCursor.y, 0, ...Array.from({ length: count }, () => ''));
    this.#enforceRowLimit();
  }

  #deleteLines(count) {
    if (count <= 0) {
      return;
    }
    this.#ensureCursorLine();
    this.#frameLines.splice(this.#frameCursor.y, count);
    if (this.#frameLines.length === 0) {
      this.#frameLines = [''];
      this.#frameCursor = { x: 0, y: 0 };
    } else {
      this.#frameCursor.y = Math.min(this.#frameCursor.y, this.#frameLines.length - 1);
    }
  }

  #deleteCharacters(count) {
    if (count <= 0) {
      return;
    }
    this.#ensureCursorLine();
    const line = this.#frameLines[this.#frameCursor.y] ?? '';
    const before = line.slice(0, this.#frameCursor.x);
    const after = line.slice(this.#frameCursor.x + count);
    this.#frameLines[this.#frameCursor.y] = before + after;
  }

  #eraseCharacters(count) {
    if (count <= 0) {
      return;
    }
    this.#ensureCursorLine();
    const line = this.#frameLines[this.#frameCursor.y] ?? '';
    const before = line.slice(0, this.#frameCursor.x);
    const after = line.slice(this.#frameCursor.x + count);
    this.#frameLines[this.#frameCursor.y] = before + ' '.repeat(count) + after;
  }
}

export function createEmptyScreenSnapshot() {
  const width = typeof process.stdout?.columns === 'number' ? process.stdout.columns : 0;
  const height = typeof process.stdout?.rows === 'number' ? process.stdout.rows : 0;
  return {
    current: {
      raw: '',
      plain: '',
      lines: [],
      dimensions: { width, height },
      cursor: { x: 0, y: 0 }
    },
    history: {
      raw: '',
      bufferSize: 0,
      truncated: false
    },
    lastFrame: new Date(0),
    framesRendered: 0
  };
}
