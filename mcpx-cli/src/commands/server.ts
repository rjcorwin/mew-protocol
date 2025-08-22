import chalk from 'chalk';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import Debug from 'debug';

const debug = Debug('mcpx:cli:server');

interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
}

class ServerManager {
  private process?: ChildProcess;
  private configPath: string;
  private pidFile: string;
  private logFile: string;

  constructor() {
    const baseDir = path.join(os.homedir(), '.mcpx');
    this.configPath = path.join(baseDir, 'server-config.json');
    this.pidFile = path.join(baseDir, 'runtime', 'server.pid');
    this.logFile = path.join(baseDir, 'logs', 'server.log');
    fs.ensureDirSync(path.dirname(this.pidFile));
    fs.ensureDirSync(path.dirname(this.logFile));
  }

  async getConfig(): Promise<ServerConfig> {
    if (await fs.pathExists(this.configPath)) {
      return await fs.readJson(this.configPath);
    }
    
    // Default config
    const defaultConfig: ServerConfig = {
      port: 3000,
      host: 'localhost',
      logLevel: 'info'
    };
    
    await fs.writeJson(this.configPath, defaultConfig, { spaces: 2 });
    return defaultConfig;
  }

  async start(options: any = {}): Promise<void> {
    // Check if already running
    if (await this.isRunning()) {
      throw new Error('Server is already running');
    }

    const config = await this.getConfig();
    
    // Find the server directory
    const serverPath = path.join(__dirname, '..', '..', '..', 'server');
    if (!await fs.pathExists(serverPath)) {
      throw new Error('Server package not found. Please ensure MCPx server is installed.');
    }

    // Prepare environment
    const env = {
      ...process.env,
      PORT: String(config.port),
      HOST: config.host,
      LOG_LEVEL: config.logLevel,
      NODE_ENV: options.dev ? 'development' : 'production'
    };

    // Create log stream
    const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });

    // Start the server
    const command = options.dev ? 'npm' : 'node';
    const args = options.dev 
      ? ['run', 'dev'] 
      : ['dist/index.js'];

    debug(`Starting server: ${command} ${args.join(' ')}`);
    
    this.process = spawn(command, args, {
      cwd: serverPath,
      env,
      detached: options.detached !== false, // Default to detached
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Always pipe to log file
    this.process.stdout?.on('data', (data) => {
      logStream.write(data);
      if (options.detached === false) {
        process.stdout.write(data);
      }
    });

    this.process.stderr?.on('data', (data) => {
      logStream.write(data);
      if (options.detached === false) {
        process.stderr.write(data);
      }
    });

    this.process.on('exit', (code, signal) => {
      debug(`Server exited with code ${code}, signal ${signal}`);
      this.cleanup();
    });

    this.process.on('error', (error) => {
      debug(`Server error:`, error);
      this.cleanup();
    });

    // Save PID
    if (this.process.pid) {
      await fs.writeFile(this.pidFile, String(this.process.pid));
    }

    if (options.detached !== false) {
      this.process.unref();
      // In detached mode, just wait briefly to confirm it started
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      // In non-detached mode, wait longer to ensure it's ready
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (!await this.isRunning()) {
      throw new Error('Server failed to start. Check logs for details.');
    }
  }

  async stop(force: boolean = false): Promise<void> {
    // Try to find process by PID
    if (await fs.pathExists(this.pidFile)) {
      const pid = parseInt(await fs.readFile(this.pidFile, 'utf-8'));
      try {
        process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
        await this.cleanup();
      } catch (error: any) {
        if (error.code !== 'ESRCH') {
          throw error;
        }
        // Process not found, cleanup
        await this.cleanup();
      }
    } else if (this.process) {
      this.process.kill(force ? 'SIGKILL' : 'SIGTERM');
      await this.cleanup();
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
  }

  async isRunning(): Promise<boolean> {
    if (!await fs.pathExists(this.pidFile)) {
      return false;
    }

    const pid = parseInt(await fs.readFile(this.pidFile, 'utf-8'));
    try {
      process.kill(pid, 0); // Check if process exists
      return true;
    } catch {
      await this.cleanup(); // Clean up stale PID file
      return false;
    }
  }

  async status(): Promise<any> {
    const running = await this.isRunning();
    const config = await this.getConfig();
    
    let pid: number | undefined;
    if (running && await fs.pathExists(this.pidFile)) {
      pid = parseInt(await fs.readFile(this.pidFile, 'utf-8'));
    }

    return {
      running,
      pid,
      url: running ? `ws://${config.host}:${config.port}` : undefined,
      config
    };
  }

  async logs(lines: number = 50): Promise<string[]> {
    if (!await fs.pathExists(this.logFile)) {
      return [];
    }

    const content = await fs.readFile(this.logFile, 'utf-8');
    const allLines = content.split('\n');
    return allLines.slice(-lines);
  }

  private async cleanup(): Promise<void> {
    if (await fs.pathExists(this.pidFile)) {
      await fs.remove(this.pidFile);
    }
    this.process = undefined;
  }
}

const serverManager = new ServerManager();

export async function startServer(options: any): Promise<void> {
  try {
    console.log(chalk.gray('Starting MCPx server...'));
    await serverManager.start(options);
    
    const status = await serverManager.status();
    console.log(chalk.green(`✓ MCPx server started`));
    console.log(chalk.gray(`  URL: ${status.url}`));
    console.log(chalk.gray(`  PID: ${status.pid}`));
    console.log(chalk.gray(`  Logs: mcpx server logs`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function stopServer(options: any): Promise<void> {
  try {
    console.log(chalk.gray('Stopping MCPx server...'));
    await serverManager.stop(options.force);
    console.log(chalk.green('✓ MCPx server stopped'));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function restartServer(): Promise<void> {
  try {
    console.log(chalk.gray('Restarting MCPx server...'));
    await serverManager.restart();
    console.log(chalk.green('✓ MCPx server restarted'));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function statusServer(): Promise<void> {
  try {
    const status = await serverManager.status();
    
    console.log(chalk.bold('MCPx Server Status'));
    console.log(`Status: ${status.running ? chalk.green('running') : chalk.gray('stopped')}`);
    
    if (status.running) {
      console.log(`URL: ${status.url}`);
      console.log(`PID: ${status.pid}`);
    }
    
    console.log(`\nConfiguration:`);
    console.log(`  Port: ${status.config.port}`);
    console.log(`  Host: ${status.config.host}`);
    console.log(`  Log Level: ${status.config.logLevel}`);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function logsServer(options: any): Promise<void> {
  try {
    const lines = await serverManager.logs(parseInt(options.lines));
    
    if (lines.length === 0) {
      console.log(chalk.yellow('No server logs found'));
      return;
    }

    lines.forEach(line => console.log(line));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function configServer(options: any): Promise<void> {
  try {
    const config = await serverManager.getConfig();
    
    if (options.port) config.port = parseInt(options.port);
    if (options.host) config.host = options.host;
    if (options.logLevel) config.logLevel = options.logLevel;
    
    const configPath = path.join(os.homedir(), '.mcpx', 'server-config.json');
    await fs.writeJson(configPath, config, { spaces: 2 });
    
    console.log(chalk.green('✓ Server configuration updated'));
    console.log(chalk.gray('  Restart the server for changes to take effect'));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}