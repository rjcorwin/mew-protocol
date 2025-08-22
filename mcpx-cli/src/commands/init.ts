import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';

export async function initConfig(): Promise<void> {
  const baseDir = path.join(os.homedir(), '.mcpx');
  
  if (await fs.pathExists(baseDir)) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reinit',
        message: 'MCPx configuration already exists. Reinitialize?',
        default: false
      }
    ]);

    if (!answers.reinit) {
      console.log('Initialization cancelled');
      return;
    }
  }

  console.log(chalk.blue('Initializing MCPx configuration...'));

  // Create directory structure
  const dirs = [
    baseDir,
    path.join(baseDir, 'agents'),
    path.join(baseDir, 'templates'),
    path.join(baseDir, 'runtime'),
    path.join(baseDir, 'logs')
  ];

  for (const dir of dirs) {
    await fs.ensureDir(dir);
  }

  // Create default config
  const config = {
    version: '0.1.0',
    defaults: {
      serverUrl: 'ws://localhost:3000',
      topic: 'room:general'
    },
    createdAt: new Date().toISOString()
  };

  await fs.writeJson(path.join(baseDir, 'config.json'), config, { spaces: 2 });

  console.log(chalk.green('✓ MCPx configuration initialized'));
  console.log(chalk.gray(`  Configuration directory: ${baseDir}`));
  console.log(chalk.blue('\nNext steps:'));
  console.log('  1. Create an agent: mcpx agent create my-agent');
  console.log('  2. Start the agent: mcpx agent start my-agent');
  console.log('  3. List agents: mcpx agent list');
}