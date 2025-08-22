import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import Debug from 'debug';

const debug = Debug('mcpx:cli:bridge');

interface BridgeConfig {
  name: string;
  mcpx: {
    server: string;
    topic: string;
    token?: string;
  };
  participant: {
    id: string;
    name: string;
    kind: string;
  };
  mcp_server: {
    type: 'stdio' | 'websocket' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
  };
  options?: {
    reconnectAttempts?: number;
    reconnectDelay?: number;
    heartbeatInterval?: number;
    logLevel?: string;
  };
}

class BridgeManager {
  private baseDir: string;
  private bridgesDir: string;
  private runtimeDir: string;
  private logsDir: string;
  private runningBridges: Map<string, ChildProcess> = new Map();

  constructor() {
    this.baseDir = path.join(os.homedir(), '.mcpx');
    this.bridgesDir = path.join(this.baseDir, 'bridges');
    this.runtimeDir = path.join(this.baseDir, 'runtime');
    this.logsDir = path.join(this.baseDir, 'logs');
    
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.bridgesDir);
    await fs.ensureDir(this.runtimeDir);
    await fs.ensureDir(this.logsDir);
  }

  async create(name: string, options: any): Promise<BridgeConfig> {
    const bridgeDir = path.join(this.bridgesDir, name);
    
    if (await fs.pathExists(bridgeDir)) {
      throw new Error(`Bridge '${name}' already exists`);
    }

    const config: BridgeConfig = {
      name,
      mcpx: {
        server: options.server || 'ws://localhost:3000',
        topic: options.topic || 'room:general'
      },
      participant: {
        id: `bridge-${name}`,
        name: `${name} Bridge`,
        kind: 'robot'
      },
      mcp_server: {
        type: 'stdio',
        command: options.command,
        args: options.args || []
      },
      options: {
        reconnectAttempts: 5,
        reconnectDelay: 1000,
        heartbeatInterval: 30000,
        logLevel: 'info'
      }
    };

    await fs.ensureDir(bridgeDir);
    await fs.writeJson(path.join(bridgeDir, 'config.json'), config, { spaces: 2 });
    await fs.ensureDir(path.join(this.logsDir, `bridge-${name}`));
    
    return config;
  }

  async list(): Promise<BridgeConfig[]> {
    const bridges: BridgeConfig[] = [];
    
    if (!await fs.pathExists(this.bridgesDir)) {
      return bridges;
    }
    
    const dirs = await fs.readdir(this.bridgesDir);
    
    for (const dir of dirs) {
      const configPath = path.join(this.bridgesDir, dir, 'config.json');
      if (await fs.pathExists(configPath)) {
        try {
          const config = await fs.readJson(configPath);
          bridges.push(config);
        } catch (error) {
          debug(`Failed to load bridge config for '${dir}':`, error);
        }
      }
    }
    
    return bridges;
  }

  async get(name: string): Promise<BridgeConfig | null> {
    const configPath = path.join(this.bridgesDir, name, 'config.json');
    
    if (!await fs.pathExists(configPath)) {
      return null;
    }
    
    return await fs.readJson(configPath);
  }

  async start(name: string, options: any = {}): Promise<void> {
    const config = await this.get(name);
    if (!config) {
      throw new Error(`Bridge '${name}' not found`);
    }

    // Check if already running
    if (await this.isRunning(name)) {
      throw new Error(`Bridge '${name}' is already running`);
    }

    // Find mcpx-bridge package
    const bridgePath = path.join(__dirname, '..', '..', '..', 'bridge');
    if (!await fs.pathExists(bridgePath)) {
      throw new Error('Bridge package not found. Please ensure mcpx-bridge is installed.');
    }

    // Write temporary config file for the bridge
    const tempConfigPath = path.join(this.runtimeDir, `bridge-${name}-config.json`);
    await fs.writeJson(tempConfigPath, config, { spaces: 2 });

    // Create log file
    const logFile = path.join(this.logsDir, `bridge-${name}`, `${Date.now()}.log`);
    await fs.ensureFile(logFile);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Start the bridge
    const child = spawn('npx', ['tsx', 'src/cli.ts', 'start', '-c', tempConfigPath], {
      cwd: bridgePath,
      detached: options.detached !== false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Always pipe to log file
    child.stdout?.on('data', (data) => {
      logStream.write(data);
      if (options.detached === false) {
        process.stdout.write(data);
      }
    });

    child.stderr?.on('data', (data) => {
      logStream.write(data);
      if (options.detached === false) {
        process.stderr.write(data);
      }
    })

    child.on('exit', (code, signal) => {
      debug(`Bridge '${name}' exited with code ${code}, signal ${signal}`);
      this.updateRuntime(name, { running: false, pid: undefined });
      this.runningBridges.delete(name);
      logStream.end();
    });

    child.on('error', (error) => {
      debug(`Bridge '${name}' error:`, error);
      this.updateRuntime(name, { running: false, error: error.message });
      this.runningBridges.delete(name);
      logStream.end();
    });

    // Store process reference
    this.runningBridges.set(name, child);

    // Save runtime info
    await this.updateRuntime(name, {
      running: true,
      pid: child.pid,
      startedAt: new Date().toISOString()
    });

    if (options.detached !== false) {
      child.unref();
    }
  }

  async stop(name: string, force: boolean = false): Promise<void> {
    const child = this.runningBridges.get(name);
    
    if (child) {
      child.kill(force ? 'SIGKILL' : 'SIGTERM');
      this.runningBridges.delete(name);
      await this.updateRuntime(name, { running: false, pid: undefined });
      return;
    }

    // Try to find by PID from runtime
    const runtime = await this.getRuntime(name);
    if (runtime?.pid) {
      try {
        process.kill(runtime.pid, force ? 'SIGKILL' : 'SIGTERM');
        await this.updateRuntime(name, { running: false, pid: undefined });
      } catch (error: any) {
        if (error.code !== 'ESRCH') {
          throw error;
        }
        // Process not found
        await this.updateRuntime(name, { running: false, pid: undefined });
      }
    }
  }

  async remove(name: string, force: boolean = false): Promise<void> {
    // Check if running
    if (await this.isRunning(name)) {
      if (!force) {
        throw new Error(`Bridge '${name}' is running. Stop it first or use --force`);
      }
      await this.stop(name, true);
    }

    // Remove directories
    await fs.remove(path.join(this.bridgesDir, name));
    await fs.remove(path.join(this.logsDir, `bridge-${name}`));
    await fs.remove(path.join(this.runtimeDir, `bridge-${name}.json`));
  }

  async isRunning(name: string): Promise<boolean> {
    const runtime = await this.getRuntime(name);
    return runtime?.running || false;
  }

  async getRuntime(name: string): Promise<any> {
    const runtimePath = path.join(this.runtimeDir, `bridge-${name}.json`);
    
    if (!await fs.pathExists(runtimePath)) {
      return null;
    }
    
    try {
      return await fs.readJson(runtimePath);
    } catch {
      return null;
    }
  }

  private async updateRuntime(name: string, data: any): Promise<void> {
    const runtimePath = path.join(this.runtimeDir, `bridge-${name}.json`);
    const current = await this.getRuntime(name) || {};
    
    await fs.writeJson(runtimePath, {
      ...current,
      ...data,
      updatedAt: new Date().toISOString()
    }, { spaces: 2 });
  }

  async getLogs(name: string, lines: number = 50): Promise<string[]> {
    const logsDir = path.join(this.logsDir, `bridge-${name}`);
    
    if (!await fs.pathExists(logsDir)) {
      return [];
    }

    const files = await fs.readdir(logsDir);
    if (files.length === 0) {
      return [];
    }

    files.sort((a, b) => b.localeCompare(a));
    const latestLog = path.join(logsDir, files[0]);

    const content = await fs.readFile(latestLog, 'utf-8');
    const allLines = content.split('\n');
    return allLines.slice(-lines);
  }
}

const bridgeManager = new BridgeManager();

export async function createBridge(name: string, options: any): Promise<void> {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'command',
        message: 'MCP server command:',
        default: options.command || 'mcp-server-filesystem'
      },
      {
        type: 'input',
        name: 'args',
        message: 'MCP server arguments (space-separated):',
        default: options.args || '/Users/rj/Desktop/hello-world'
      },
      {
        type: 'input',
        name: 'server',
        message: 'MCPx server URL:',
        default: options.server || 'ws://localhost:3000'
      },
      {
        type: 'input',
        name: 'topic',
        message: 'MCPx topic:',
        default: options.topic || 'room:general'
      }
    ]);

    const config = {
      ...answers,
      args: answers.args.split(' ').filter(Boolean)
    };

    await bridgeManager.create(name, config);
    console.log(chalk.green(`✓ Created bridge '${name}'`));
    console.log(chalk.gray(`  Configuration: ~/.mcpx/bridges/${name}/config.json`));
    console.log(chalk.gray(`  To start: mcpx bridge start ${name}`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function startBridge(name: string, options: any): Promise<void> {
  try {
    console.log(chalk.gray(`Starting bridge '${name}'...`));
    await bridgeManager.start(name, options);
    console.log(chalk.green(`✓ Bridge '${name}' started`));
    console.log(chalk.gray(`  View logs: mcpx bridge logs ${name}`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function stopBridge(name: string, options: any): Promise<void> {
  try {
    console.log(chalk.gray(`Stopping bridge '${name}'...`));
    await bridgeManager.stop(name, options.force);
    console.log(chalk.green(`✓ Bridge '${name}' stopped`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function listBridges(options: any): Promise<void> {
  try {
    const bridges = await bridgeManager.list();
    
    if (bridges.length === 0) {
      console.log(chalk.yellow('No bridges configured'));
      console.log(chalk.gray('Create one with: mcpx bridge create <name>'));
      return;
    }

    console.log(chalk.bold('\nConfigured Bridges:\n'));
    
    for (const bridge of bridges) {
      const runtime = await bridgeManager.getRuntime(bridge.name);
      const status = runtime?.running ? chalk.green('●') : chalk.gray('○');
      
      console.log(`${status} ${chalk.cyan(bridge.name)}`);
      console.log(`  MCP Server: ${bridge.mcp_server.command} ${bridge.mcp_server.args?.join(' ')}`);
      console.log(`  Topic: ${bridge.mcpx.topic}`);
      
      if (runtime?.running) {
        console.log(`  PID: ${runtime.pid}`);
      }
      console.log();
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function statusBridge(name: string): Promise<void> {
  try {
    const bridge = await bridgeManager.get(name);
    if (!bridge) {
      console.error(chalk.red(`Bridge '${name}' not found`));
      process.exit(1);
    }

    const runtime = await bridgeManager.getRuntime(name);
    
    console.log(chalk.bold(`Bridge: ${name}`));
    console.log(`Status: ${runtime?.running ? chalk.green('running') : chalk.gray('stopped')}`);
    
    if (runtime?.pid) {
      console.log(`PID: ${runtime.pid}`);
    }
    if (runtime?.startedAt) {
      console.log(`Started: ${new Date(runtime.startedAt).toLocaleString()}`);
    }
    
    console.log(`\nConfiguration:`);
    console.log(`  MCP Server: ${bridge.mcp_server.command} ${bridge.mcp_server.args?.join(' ')}`);
    console.log(`  MCPx Server: ${bridge.mcpx.server}`);
    console.log(`  Topic: ${bridge.mcpx.topic}`);
    console.log(`  Participant ID: ${bridge.participant.id}`);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function logsBridge(name: string, options: any): Promise<void> {
  try {
    const lines = await bridgeManager.getLogs(name, parseInt(options.lines));
    
    if (lines.length === 0) {
      console.log(chalk.yellow(`No logs found for bridge '${name}'`));
      return;
    }

    lines.forEach(line => console.log(line));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function removeBridge(name: string, options: any): Promise<void> {
  try {
    if (!options.force) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove bridge '${name}'?`,
          default: false
        }
      ]);

      if (!answers.confirm) {
        console.log('Cancelled');
        return;
      }
    }

    await bridgeManager.remove(name, options.force);
    console.log(chalk.green(`✓ Bridge '${name}' removed`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}