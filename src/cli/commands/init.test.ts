import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';

import InitCommand from './init.js';

const originalCwd = process.cwd();
let tempDir: string | undefined;

afterEach(() => {
  process.chdir(originalCwd);
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('InitCommand template discovery', () => {
  it('exposes the isometric-fleet built-in template', async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'mew-init-'));
    process.chdir(tempDir);

    const command = new InitCommand();
    const templates = await command.discoverTemplates();

    const isometricFleet = templates.find((template) => template.name === 'isometric-fleet');

    expect(isometricFleet).toBeDefined();
    expect(isometricFleet?.source).toBe('built-in');
  });

  it('prefers local templates over built-in templates with the same name', async () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'mew-init-'));
    const localTemplateDir = path.join(tempDir, 'templates', 'coder-agent');
    mkdirSync(localTemplateDir, { recursive: true });

    writeFileSync(
      path.join(localTemplateDir, 'template.json'),
      JSON.stringify(
        {
          name: 'coder-agent',
          description: 'Local override for testing',
          version: '1.0.0'
        },
        null,
        2
      )
    );

    process.chdir(tempDir);

    const command = new InitCommand();
    const templates = await command.discoverTemplates();
    const coderAgent = templates.find((template) => template.name === 'coder-agent');

    expect(coderAgent).toBeDefined();
    expect(coderAgent?.source).toBe('local');
  });
});

