import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { AgentManager } from '../lib/AgentManager';

export async function migrateConfig(): Promise<void> {
  const oldConfigPath = path.join(os.homedir(), '.mcpx', 'agent-config.json');
  
  if (!await fs.pathExists(oldConfigPath)) {
    console.log(chalk.yellow('No old configuration found to migrate'));
    return;
  }

  console.log(chalk.blue('Found old agent configuration'));
  
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'migrate',
      message: 'Would you like to migrate your existing agent configuration?',
      default: true
    },
    {
      type: 'input',
      name: 'agentName',
      message: 'Name for the migrated agent:',
      default: 'default',
      when: (answers) => answers.migrate
    }
  ]);

  if (!answers.migrate) {
    console.log('Migration cancelled');
    return;
  }

  try {
    const oldConfig = await fs.readJson(oldConfigPath);
    const manager = new AgentManager();
    await manager.initialize();
    
    // Create new agent with old config
    const newConfig = {
      serverUrl: oldConfig.server?.url || 'ws://localhost:3000',
      topic: oldConfig.server?.topic || 'room:general',
      participantId: oldConfig.participant?.id || answers.agentName,
      participantName: oldConfig.participant?.name,
      ...oldConfig
    };

    await manager.createAgent(answers.agentName, 'basic', newConfig);
    
    console.log(chalk.green(`✓ Configuration migrated to ~/.mcpx/agents/${answers.agentName}/`));
    
    const backupPath = `${oldConfigPath}.backup`;
    await fs.move(oldConfigPath, backupPath);
    console.log(chalk.gray(`  Old config backed up to: ${backupPath}`));
    
    console.log(chalk.blue('\nNext steps:'));
    console.log(`  1. Review configuration: mcpx agent config ${answers.agentName}`);
    console.log(`  2. Start agent: mcpx agent start ${answers.agentName}`);
  } catch (error: any) {
    console.error(chalk.red(`Migration failed: ${error.message}`));
    process.exit(1);
  }
}