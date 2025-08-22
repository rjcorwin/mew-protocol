// This file acts as a wrapper to directly require the mcpx-cli
// This avoids child_process issues in Electron

import path from 'path';

export class CLIWrapper {
  private cliPath: string;
  private cli: any;

  constructor() {
    this.cliPath = path.resolve(path.join(__dirname, '../../../../mcpx-cli/src'));
  }

  async execute(command: string, args: string[]): Promise<any> {
    try {
      // Import the specific command module
      if (command === 'status') {
        const statusModule = await import(path.join(this.cliPath, 'commands/status.ts'));
        return await this.captureOutput(() => statusModule.status({}));
      }
      
      if (command === 'agent') {
        const agentModule = await import(path.join(this.cliPath, 'commands/agent.ts'));
        
        if (args[0] === 'list') {
          return await this.captureOutput(() => agentModule.listAgents({ json: true }));
        }
        
        if (args[0] === 'start') {
          return await this.captureOutput(() => agentModule.startAgent(args[1], {}));
        }
        
        if (args[0] === 'stop') {
          return await this.captureOutput(() => agentModule.stopAgent(args[1], {}));
        }
        
        if (args[0] === 'create') {
          const options = this.parseArgs(args.slice(2));
          return await this.captureOutput(() => agentModule.createAgent(args[1], options));
        }
      }
      
      if (command === 'server') {
        const serverModule = await import(path.join(this.cliPath, 'commands/server.ts'));
        
        if (args[0] === 'start') {
          return await this.captureOutput(() => serverModule.startServer({ detached: true }));
        }
        
        if (args[0] === 'stop') {
          return await this.captureOutput(() => serverModule.stopServer({}));
        }
      }
      
      return { success: false, error: 'Command not implemented' };
    } catch (error) {
      console.error('CLI Wrapper Error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  private async captureOutput(fn: Function): Promise<any> {
    // Capture console output
    const oldLog = console.log;
    const oldError = console.error;
    let output = '';
    let errorOutput = '';
    
    console.log = (...args) => {
      output += args.join(' ') + '\n';
    };
    
    console.error = (...args) => {
      errorOutput += args.join(' ') + '\n';
    };
    
    try {
      const result = await fn();
      
      // Restore console
      console.log = oldLog;
      console.error = oldError;
      
      return {
        success: true,
        data: result,
        output,
        error: errorOutput
      };
    } catch (error) {
      // Restore console
      console.log = oldLog;
      console.error = oldError;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        output,
        errorOutput
      };
    }
  }
  
  private parseArgs(args: string[]): any {
    const options: any = {};
    
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) {
        const key = args[i].substring(2);
        const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
        options[key] = value;
        if (value !== true) i++;
      }
    }
    
    return options;
  }
}