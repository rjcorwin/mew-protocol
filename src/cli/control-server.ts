// @ts-nocheck
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripAnsi } from './utils/ansi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, '../../package.json');
let packageVersion = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (pkg?.version) {
    packageVersion = String(pkg.version);
  }
} catch {
  packageVersion = process.env.npm_package_version || packageVersion;
}

class InputNotReadyError extends Error {
  constructor() {
    super('Input component not ready');
    this.name = 'InputNotReadyError';
  }
}

function normalizeKeySpec(spec) {
  if (!spec) {
    return null;
  }

  if (typeof spec === 'object') {
    return spec;
  }

  if (typeof spec !== 'string') {
    return null;
  }

  const normalized = spec.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split('+');
  let base = parts.pop();
  const modifiers = new Set(parts.map(part => part.trim()).filter(Boolean));

  if (base === 'esc') {
    base = 'escape';
  }
  if (base === 'return') {
    base = 'enter';
  }
  if (base === 'option') {
    modifiers.add('alt');
    base = 'alt';
  }

  const key = {
    input: '',
    name: base,
    ctrl: modifiers.has('ctrl'),
    alt: modifiers.has('alt'),
    shift: modifiers.has('shift'),
    meta: modifiers.has('meta'),
    sequence: normalized,
    return: false,
    enter: false,
    shiftEnter: false,
    backspace: false,
    delete: false,
    tab: false,
    escape: false,
    space: false,
    up: false,
    down: false,
    left: false,
    right: false,
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    home: false,
    end: false,
    pageup: false,
    pagedown: false,
    raw: { name: base }
  };

  const setDirectional = (direction) => {
    key[direction] = true;
    key[`${direction}Arrow`] = true;
    key.name = direction;
  };

  switch (base) {
    case 'enter':
      key.name = 'enter';
      key.return = true;
      key.enter = true;
      key.input = '\r';
      if (key.shift) {
        key.shiftEnter = true;
      }
      break;
    case 'escape':
      key.name = 'escape';
      key.escape = true;
      key.input = '\u001b';
      break;
    case 'tab':
      key.name = 'tab';
      key.tab = true;
      key.input = '\t';
      break;
    case 'backspace':
      key.name = 'backspace';
      key.backspace = true;
      key.input = '\x7F';
      break;
    case 'delete':
    case 'del':
      key.name = 'delete';
      key.delete = true;
      key.input = ''; // Delete is non-printing
      key.raw.sequence = '\x1B[3~';
      break;
    case 'space':
      key.name = 'space';
      key.space = true;
      key.input = ' ';
      break;
    case 'up':
      setDirectional('up');
      break;
    case 'down':
      setDirectional('down');
      break;
    case 'left':
      setDirectional('left');
      break;
    case 'right':
      setDirectional('right');
      break;
    case 'home':
      key.name = 'home';
      key.home = true;
      break;
    case 'end':
      key.name = 'end';
      key.end = true;
      break;
    case 'pageup':
    case 'page_up':
    case 'page-up':
      key.name = 'pageup';
      key.pageup = true;
      break;
    case 'pagedown':
    case 'page_down':
    case 'page-down':
      key.name = 'pagedown';
      key.pagedown = true;
      break;
    default:
      key.name = base;
      if (base.length === 1) {
        key.input = modifiers.has('ctrl') ? base : key.shift ? base.toUpperCase() : base;
      }
      break;
  }

  if (key.ctrl && key.input === '') {
    // For control combos, synthesize printable char when possible
    if (base.length === 1) {
      key.input = base;
    }
  }

  return key;
}

export function startControlServer(options) {
  if (!options || typeof options.port !== 'number') {
    throw new Error('Control server requires numeric port');
  }

  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/control/health', (req, res) => {
    res.json({ ok: true, version: packageVersion, uptime: process.uptime() });
  });

  app.post('/control/send_input', async (req, res) => {
    const { text, key } = req.body || {};
    if (typeof text !== 'string' && !key) {
      return res.status(400).json({ error: 'Missing text or key' });
    }

    const payload = typeof text === 'string' && text.length > 0 ? text : key;
    let normalizedPayload = payload;

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      normalizedPayload = payload;
    } else if (typeof payload === 'string') {
      if (typeof text === 'string' && text.length > 0 && !key) {
        normalizedPayload = text;
      } else {
        normalizedPayload = normalizeKeySpec(payload);
        if (!normalizedPayload) {
          return res.status(400).json({ error: 'Invalid key specification' });
        }
      }
    } else {
      return res.status(400).json({ error: 'Unsupported payload' });
    }

    try {
      await Promise.resolve(options.sendInput(normalizedPayload));
      res.json({ ok: true, injected: typeof text === 'string' && text.length > 0 ? text : key });
    } catch (error) {
      if (error instanceof InputNotReadyError || error?.message === 'INPUT_NOT_READY') {
        return res.status(503).json({ error: 'Input component not ready' });
      }
      res.status(500).json({ error: error?.message || 'Failed to send input' });
    }
  });

  app.get('/control/screen', (req, res) => {
    try {
      const screen = options.getScreen();
      const raw = screen?.raw ?? '';
      const plain = stripAnsi(raw);
      res.json({
        raw,
        plain,
        lines: plain.split('\n'),
        width: screen?.dimensions?.width ?? 0,
        height: screen?.dimensions?.height ?? 0,
        cursor: screen?.cursor ?? null,
        last_frame: screen?.lastFrame ? new Date(screen.lastFrame).toISOString() : new Date(0).toISOString(),
        frames_rendered: screen?.framesRendered ?? 0,
        scrollback: {
          buffer_size: screen?.bufferSize ?? raw.length,
          truncated: Boolean(screen?.truncated)
        }
      });
    } catch (error) {
      res.status(500).json({ error: error?.message || 'Failed to capture screen' });
    }
  });

  app.get('/control/state', (req, res) => {
    try {
      const state = options.getState();
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: error?.message || 'Failed to read state' });
    }
  });

  const server = app.listen(options.port, '127.0.0.1');
  const resolvedPort = server.address()?.port ?? options.port;

  return {
    port: resolvedPort,
    stop: () => new Promise((resolve) => {
      server.close(() => resolve(undefined));
    })
  };
}

export { InputNotReadyError };
