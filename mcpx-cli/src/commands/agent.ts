import chalk from 'chalk';
import inquirer from 'inquirer';
import { AgentManager } from '../lib/AgentManager';
import { table } from '../utils/table';

let manager: AgentManager;

async function getManager(): Promise<AgentManager> {
  if (!manager) {
    manager = new AgentManager();
    const mgr = await getManager();
    await mgr.initialize();
  }
  return manager;
}

export async function createAgent(name: string, options: any): Promise<void> {
  try {
    let config: any = {};

    if (options.interactive) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'displayName',
          message: 'Display name:',
          default: name
        },
        {
          type: 'input',
          name: 'serverUrl',
          message: 'MCPx server URL:',
          default: 'ws://localhost:3000'
        },
        {
          type: 'input',
          name: 'topic',
          message: 'Topic to join:',
          default: 'room:general'
        },
        {
          type: 'list',
          name: 'template',
          message: 'Agent type:',
          choices: ['basic', 'openai', 'claude'],
          default: options.template || 'basic'
        }
      ]);

      if (answers.template === 'openai') {
        const openaiAnswers = await inquirer.prompt([
          {
            type: 'password',
            name: 'openaiApiKey',
            message: 'OpenAI API key:',
            mask: '*'
          },
          {
            type: 'input',
            name: 'model',
            message: 'Model:',
            default: 'gpt-4'
          }
        ]);
        config = { ...answers, ...openaiAnswers };
      } else if (answers.template === 'claude') {
        const claudeAnswers = await inquirer.prompt([
          {
            type: 'password',
            name: 'anthropicApiKey',
            message: 'Anthropic API key:',
            mask: '*'
          },
          {
            type: 'input',
            name: 'model',
            message: 'Model:',
            default: 'claude-3-opus-20240229'
          }
        ]);
        config = { ...answers, ...claudeAnswers };
      } else {
        config = answers;
      }
    }

    const mgr = await getManager();
    const agent = await mgr.createAgent(name, options.template || 'basic', config);
    console.log(chalk.green(`✓ Created agent '${name}'`));
    console.log(chalk.gray(`  Configuration: ~/.mcpx/agents/${name}/config.json`));
    console.log(chalk.gray(`  To start: mcpx agent start ${name}`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function startAgent(name: string, options: any): Promise<void> {
  try {
    console.log(chalk.gray(`Starting agent '${name}'...`));
    const mgr = await getManager();
    await mgr.startAgent(name, options);
    
    if (options.detached) {
      console.log(chalk.green(`✓ Agent '${name}' started in background`));
      console.log(chalk.gray(`  View logs: mcpx agent logs ${name}`));
      console.log(chalk.gray(`  Stop: mcpx agent stop ${name}`));
    } else {
      console.log(chalk.green(`✓ Agent '${name}' started`));
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function stopAgent(name: string, options: any): Promise<void> {
  try {
    console.log(chalk.gray(`Stopping agent '${name}'...`));
    const mgr = await getManager();
    await mgr.stopAgent(name, options.force);
    console.log(chalk.green(`✓ Agent '${name}' stopped`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function restartAgent(name: string): Promise<void> {
  try {
    console.log(chalk.gray(`Restarting agent '${name}'...`));
    const mgr = await getManager();
    await mgr.restartAgent(name);
    console.log(chalk.green(`✓ Agent '${name}' restarted`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function listAgents(options: any): Promise<void> {
  try {
    const mgr = await getManager();
    const agents = await mgr.listAgents();
    
    if (agents.length === 0) {
      console.log(chalk.yellow('No agents configured'));
      console.log(chalk.gray('Create one with: mcpx agent create <name>'));
      return;
    }

    if (options.json) {
      const agentsWithStatus = await Promise.all(
        agents.map(async (agent) => ({
          ...agent,
          runtime: await mgr.getRuntime(agent.name)
        }))
      );
      console.log(JSON.stringify(agentsWithStatus, null, 2));
      return;
    }

    const data = await Promise.all(
      agents.map(async (agent) => {
        const runtime = await mgr.getRuntime(agent.name);
        return {
          name: agent.name,
          type: agent.type,
          status: runtime.status === 'running' 
            ? chalk.green('●') 
            : runtime.status === 'error' 
              ? chalk.red('●') 
              : chalk.gray('○'),
          topic: agent.config.topic,
          created: new Date(agent.createdAt).toLocaleDateString()
        };
      })
    );

    if (options.running) {
      const running = data.filter(a => a.status === chalk.green('●'));
      if (running.length === 0) {
        console.log(chalk.yellow('No agents running'));
        return;
      }
      console.log(table(running, ['name', 'type', 'status', 'topic']));
    } else {
      console.log(table(data, ['name', 'type', 'status', 'topic', 'created']));
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function statusAgent(name: string): Promise<void> {
  try {
    const mgr = await getManager();
    const agent = await mgr.getAgent(name);
    if (!agent) {
      console.error(chalk.red(`Agent '${name}' not found`));
      process.exit(1);
    }

    const runtime = await mgr.getRuntime(name);

    console.log(chalk.bold(`Agent: ${name}`));
    console.log(`Type: ${agent.type}`);
    console.log(`Status: ${runtime.status === 'running' ? chalk.green(runtime.status) : chalk.gray(runtime.status)}`);
    console.log(`Enabled: ${agent.enabled ? chalk.green('yes') : chalk.gray('no')}`);
    
    if (runtime.pid) {
      console.log(`PID: ${runtime.pid}`);
    }
    if (runtime.startedAt) {
      console.log(`Started: ${new Date(runtime.startedAt).toLocaleString()}`);
    }
    
    console.log(`\nConfiguration:`);
    console.log(`  Server: ${agent.config.serverUrl}`);
    console.log(`  Topic: ${agent.config.topic}`);
    console.log(`  Participant ID: ${agent.config.participantId}`);
    
    if (runtime.error) {
      console.log(chalk.red(`\nError: ${runtime.error}`));
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function logsAgent(name: string, options: any): Promise<void> {
  try {
    const mgr = await getManager();
    const lines = await mgr.getLogs(name, parseInt(options.lines), options.follow);
    
    if (lines.length === 0) {
      console.log(chalk.yellow(`No logs found for agent '${name}'`));
      return;
    }

    lines.forEach(line => console.log(line));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function configAgent(name: string, options: any): Promise<void> {
  try {
    const { spawn } = require('child_process');
    const configPath = require('path').join(
      require('os').homedir(),
      '.mcpx',
      'agents',
      name,
      'config.json'
    );

    const editor = spawn(options.editor, [configPath], {
      stdio: 'inherit'
    });

    editor.on('exit', (code: number) => {
      if (code === 0) {
        console.log(chalk.green(`✓ Configuration updated`));
      }
    });
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function removeAgent(name: string, options: any): Promise<void> {
  try {
    if (!options.force) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove agent '${name}'?`,
          default: false
        }
      ]);

      if (!answers.confirm) {
        console.log('Cancelled');
        return;
      }
    }

    const mgr = await getManager();
    await mgr.removeAgent(name, options.force);
    console.log(chalk.green(`✓ Agent '${name}' removed`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

// Bridge-specific commands
export async function createBridge(name: string, options: any): Promise<void> {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'mcpServer',
        message: 'MCP server command:',
        default: options.mcpServer || 'mcp-server-filesystem'
      },
      {
        type: 'input',
        name: 'args',
        message: 'MCP server arguments (space-separated):',
        default: '/path/to/directory'
      },
      {
        type: 'input',
        name: 'topic',
        message: 'MCPx topic:',
        default: options.topic || 'room:general'
      }
    ]);

    const config = {
      displayName: `${name} Bridge`,
      serverUrl: 'ws://localhost:3000',
      topic: answers.topic,
      mcpServer: answers.mcpServer,
      mcpArgs: answers.args.split(' ')
    };

    const mgr = await getManager();
    await mgr.createAgent(name, 'bridge', config);
    console.log(chalk.green(`✓ Created bridge '${name}'`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function startBridge(name: string): Promise<void> {
  // Delegate to startAgent with bridge-specific options
  await startAgent(name, { detached: true });
}