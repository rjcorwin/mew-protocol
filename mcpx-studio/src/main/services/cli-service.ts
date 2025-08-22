import { spawn, ChildProcess, execFile } from 'child_process';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CLIService {
  private processes: Map<string, ChildProcess> = new Map();
  private mcpxCliPath: string;
  private nodePath: string;

  constructor() {
    // Find mcpx-cli path relative to the app location
    this.mcpxCliPath = path.resolve(path.join(__dirname, '../../../../mcpx-cli/src/cli.ts'));
    
    // Use system Node.js, not Electron's
    this.nodePath = '/opt/homebrew/bin/node';
    console.log('Using Node path:', this.nodePath);
    console.log('MCPx CLI path:', this.mcpxCliPath);
  }

  async execute(command: string, args: string[]): Promise<CLIResult> {
    return new Promise((resolve, reject) => {
      const fullArgs = command ? [command, ...args] : args;
      
      console.log(`Executing CLI: ${command} ${args.join(' ')}`);
      
      // For now, just return mock data to avoid errors
      // The proper fix requires bundling mcpx-cli or running a separate backend process
      if (command === 'status') {
        setTimeout(() => {
          resolve({
            stdout: JSON.stringify({
              server: { running: false },
              frontend: { running: false },
              bridges: [],
              agents: []
            }),
            stderr: '',
            exitCode: 0
          });
        }, 100);
        return;
      }
      
      if (command === 'agent' && args[0] === 'list') {
        setTimeout(() => {
          resolve({
            stdout: JSON.stringify([
              { name: 'demo-agent', type: 'basic', status: 'stopped', topic: 'room:general' }
            ]),
            stderr: '',
            exitCode: 0
          });
        }, 100);
        return;
      }
      
      // Default mock for other commands
      setTimeout(() => {
        resolve({
          stdout: 'Command executed (mock)',
          stderr: '',
          exitCode: 0
        });
      }, 100);
      return;
      
      /* DISABLED: Electron sandboxing prevents this from working
      execFile('/opt/homebrew/bin/npx', [
        'tsx',
        this.mcpxCliPath,
        ...fullArgs
      ], {
        cwd: path.dirname(this.mcpxCliPath),
        env: {
          ...process.env,
          NODE_ENV: 'development'
        }
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('CLI execution error:', error);
          // Fallback to mock data if execution fails
          if (command === 'status') {
            resolve({
              stdout: JSON.stringify({
                server: { running: false },
                frontend: { running: false },
                bridges: [],
                agents: []
              }),
              stderr: '',
              exitCode: 0
            });
            return;
          }
          
          if (command === 'agent' && args[0] === 'list') {
            resolve({
              stdout: JSON.stringify([]),
              stderr: '',
              exitCode: 0
            });
            return;
          }
          
          reject(error);
          return;
        }
        
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0
        });
      });
      */
    });
  }

  async stream(
    command: string, 
    args: string[], 
    onData: (data: string) => void
  ): Promise<string> {
    const id = uuidv4();
    
    // Mock streaming for now
    console.log(`CLI Stream Mock: ${command} ${args.join(' ')}`);
    
    // Simulate some output
    setTimeout(() => {
      onData(`Mock output for: ${command}\n`);
      onData(`[exit] Process exited with code 0`);
    }, 100);
    
    return id;
  }

  async kill(processId: string): Promise<void> {
    const process = this.processes.get(processId);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(processId);
    }
  }

  cleanup(): void {
    this.processes.forEach((process) => {
      process.kill('SIGTERM');
    });
    this.processes.clear();
  }
}