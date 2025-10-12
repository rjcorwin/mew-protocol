import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpyInstance } from 'vitest';
import { promises as fs, mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

import InitCommand from './init.js';

describe('InitCommand isometric fleet template', () => {
  let tmpDir: string;
  let cwdSpy: SpyInstance<[], string>;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'mew-init-test-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers and materializes the isometric fleet template', async () => {
    const command = new InitCommand();
    const templates = await command.discoverTemplates();

    const fleetTemplate = templates.find(
      template => template.name === 'isometric-fleet' && template.source === 'built-in'
    );

    expect(fleetTemplate).toBeDefined();
    if (!fleetTemplate) {
      return;
    }

    await command.createMewDirectory();
    await command.copyTemplateFiles(fleetTemplate.path);

    const mewDir = path.join(tmpDir, '.mew');
    const templatePath = path.join(mewDir, 'space.yaml.template');
    await expect(fs.stat(templatePath)).resolves.toBeDefined();

    const variables = {
      SPACE_NAME: 'fleet-space',
      UI_THEME: 'midnight',
      AGENT_BASE_URL: 'https://api.example.com',
      AGENT_MODEL: 'gpt-test',
      AGENT_PROMPT: 'Test fleet prompt'
    } as const;

    await command.processTemplateFiles({
      ...variables,
      AGENT_PROMPT_JSON: JSON.stringify(variables.AGENT_PROMPT)
    });

    await expect(fs.access(templatePath)).rejects.toBeDefined();
    const spaceYamlPath = path.join(mewDir, 'space.yaml');
    const spaceYaml = await fs.readFile(spaceYamlPath, 'utf8');

    expect(spaceYaml).toContain('fleet-space');
    expect(spaceYaml).not.toContain('{{SPACE_NAME}}');
    expect(spaceYaml).toContain('agent-4');
  });
});
