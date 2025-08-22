import chalk from 'chalk';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import Debug from 'debug';

const debug = Debug('mcpx:cli:frontend');

class FrontendManager {
  private process?: ChildProcess;
  private pidFile: string;
  private logFile: string;

  constructor() {
    const baseDir = path.join(os.homedir(), '.mcpx');
    this.pidFile = path.join(baseDir, 'runtime', 'frontend.pid');
    this.logFile = path.join(baseDir, 'logs', 'frontend.log');
    fs.ensureDirSync(path.dirname(this.pidFile));
    fs.ensureDirSync(path.dirname(this.logFile));
  }

  async start(options: any = {}): Promise<void> {
    // Check if already running
    if (await this.isRunning()) {
      throw new Error('Frontend is already running');
    }

    // Find the frontend directory
    const frontendPath = path.join(__dirname, '..', '..', '..', 'frontend');
    if (!await fs.pathExists(frontendPath)) {
      throw new Error('Frontend package not found. Please ensure MCPx frontend is installed.');
    }

    // Prepare environment
    const env = {
      ...process.env,
      PORT: String(options.port || 3001),
      REACT_APP_SERVER_URL: options.serverUrl || 'ws://localhost:3000'
    };

    // Create log stream
    const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });

    // Start the frontend
    const command = 'npm';
    const args = ['run', 'dev'];

    debug(`Starting frontend: ${command} ${args.join(' ')}`);
    
    this.process = spawn(command, args, {
      cwd: frontendPath,
      env,
      detached: options.detached !== false,
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
      debug(`Frontend exited with code ${code}, signal ${signal}`);
      this.cleanup();
    });

    this.process.on('error', (error) => {
      debug(`Frontend error:`, error);
      this.cleanup();
    });

    // Save PID
    if (this.process.pid) {
      await fs.writeFile(this.pidFile, String(this.process.pid));
    }

    if (options.detached !== false) {
      this.process.unref();
    }

    // Wait a moment to ensure it started
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!await this.isRunning()) {
      throw new Error('Frontend failed to start. Check logs for details.');
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
        await this.cleanup();
      }
    } else if (this.process) {
      this.process.kill(force ? 'SIGKILL' : 'SIGTERM');
      await this.cleanup();
    }
  }

  async isRunning(): Promise<boolean> {
    if (!await fs.pathExists(this.pidFile)) {
      return false;
    }

    const pid = parseInt(await fs.readFile(this.pidFile, 'utf-8'));
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      await this.cleanup();
      return false;
    }
  }

  async status(): Promise<any> {
    const running = await this.isRunning();
    
    let pid: number | undefined;
    if (running && await fs.pathExists(this.pidFile)) {
      pid = parseInt(await fs.readFile(this.pidFile, 'utf-8'));
    }

    return {
      running,
      pid,
      url: running ? 'http://localhost:3001' : undefined
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

const frontendManager = new FrontendManager();

export async function startFrontend(options: any): Promise<void> {
  try {
    console.log(chalk.gray('Starting MCPx frontend...'));
    await frontendManager.start(options);
    
    const status = await frontendManager.status();
    console.log(chalk.green(`✓ MCPx frontend started`));
    console.log(chalk.gray(`  URL: ${status.url}`));
    console.log(chalk.gray(`  PID: ${status.pid}`));
    console.log(chalk.gray(`  Logs: mcpx frontend logs`));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function stopFrontend(options: any): Promise<void> {
  try {
    console.log(chalk.gray('Stopping MCPx frontend...'));
    await frontendManager.stop(options.force);
    console.log(chalk.green('✓ MCPx frontend stopped'));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function statusFrontend(): Promise<void> {
  try {
    const status = await frontendManager.status();
    
    console.log(chalk.bold('MCPx Frontend Status'));
    console.log(`Status: ${status.running ? chalk.green('running') : chalk.gray('stopped')}`);
    
    if (status.running) {
      console.log(`URL: ${status.url}`);
      console.log(`PID: ${status.pid}`);
    }
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export async function logsFrontend(options: any): Promise<void> {
  try {
    const lines = await frontendManager.logs(parseInt(options.lines));
    
    if (lines.length === 0) {
      console.log(chalk.yellow('No frontend logs found'));
      return;
    }

    lines.forEach(line => console.log(line));
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}