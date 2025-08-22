import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import Debug from 'debug';

const debug = Debug('mcpx:cli:agent-manager');

export interface AgentConfig {
  name: string;
  type: 'agent' | 'bridge';
  enabled: boolean;
  config: {
    serverUrl: string;
    topic: string;
    participantId: string;
    participantName?: string;
    authToken?: string;
    [key: string]: any;
  };
  cwd?: string;
  script?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRuntime {
  pid?: number;
  startedAt?: string;
  status: 'stopped' | 'running' | 'error' | 'starting';
  exitCode?: number;
  error?: string;
}

export class AgentManager {
  private baseDir: string;
  private agentsDir: string;
  private templatesDir: string;
  private runtimeDir: string;
  private logsDir: string;
  private runningAgents: Map<string, ChildProcess> = new Map();

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(os.homedir(), '.mcpx');
    this.agentsDir = path.join(this.baseDir, 'agents');
    this.templatesDir = path.join(this.baseDir, 'templates');
    this.runtimeDir = path.join(this.baseDir, 'runtime');
    this.logsDir = path.join(this.baseDir, 'logs');
  }
  
  async initialize(): Promise<void> {
    await this.ensureDirectories();
    await this.loadTemplates();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.baseDir);
    await fs.ensureDir(this.agentsDir);
    await fs.ensureDir(this.templatesDir);
    await fs.ensureDir(this.runtimeDir);
    await fs.ensureDir(this.logsDir);
  }

  private async loadTemplates(): Promise<void> {
    // Create default templates if they don't exist
    const agentPath = path.join(__dirname, '..', '..', '..', 'agent');
    
    const basicTemplate = {
      type: 'agent',
      enabled: true,
      config: {
        serverUrl: 'ws://localhost:3000',
        topic: 'room:general',
        participantId: '{{name}}',
        participantName: '{{name}}'
      },
      cwd: agentPath,
      script: 'npx',
      args: ['tsx', 'src/cli.ts', 'start', '--basic']
    };

    const openaiTemplate = {
      type: 'agent',
      enabled: true,
      config: {
        serverUrl: 'ws://localhost:3000',
        topic: 'room:general',
        participantId: '{{name}}',
        participantName: '{{name}}',
        openai: {
          apiKey: '{{openaiApiKey}}',
          model: '{{model}}',
          temperature: 0.7
        }
      },
      cwd: agentPath,
      script: 'npx',
      args: ['tsx', 'src/cli.ts', 'start']
    };

    const claudeTemplate = {
      type: 'agent',
      enabled: true,
      config: {
        serverUrl: 'ws://localhost:3000',
        topic: 'room:general',
        participantId: '{{name}}',
        participantName: '{{name}}',
        anthropic: {
          apiKey: '{{anthropicApiKey}}',
          model: '{{model}}',
          maxTokens: 1000
        }
      },
      cwd: agentPath,
      script: 'npx',
      args: ['tsx', 'src/cli.ts', 'start']  // Would need Claude support added to agent
    };

    const templatePath = (name: string) => path.join(this.templatesDir, `${name}.json`);
    
    if (!await fs.pathExists(templatePath('basic'))) {
      await fs.writeJson(templatePath('basic'), basicTemplate, { spaces: 2 });
    }
    if (!await fs.pathExists(templatePath('openai'))) {
      await fs.writeJson(templatePath('openai'), openaiTemplate, { spaces: 2 });
    }
    if (!await fs.pathExists(templatePath('claude'))) {
      await fs.writeJson(templatePath('claude'), claudeTemplate, { spaces: 2 });
    }
  }

  async createAgent(name: string, template: string = 'basic', options: any = {}): Promise<AgentConfig> {
    const agentDir = path.join(this.agentsDir, name);
    
    if (await fs.pathExists(agentDir)) {
      throw new Error(`Agent '${name}' already exists`);
    }

    // Load template
    const templatePath = path.join(this.templatesDir, `${template}.json`);
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template '${template}' not found`);
    }
    
    const templateConfig = await fs.readJson(templatePath);
    
    // Apply template variables
    const config: AgentConfig = {
      name,
      type: templateConfig.type,
      enabled: templateConfig.enabled,
      config: this.applyTemplateVars(templateConfig.config, { name, ...options }),
      cwd: templateConfig.cwd,
      script: templateConfig.script,
      command: templateConfig.command,
      args: templateConfig.args?.map((arg: string) => 
        this.applyTemplateVar(arg, { name, ...options })
      ),
      env: templateConfig.env,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save configuration
    await fs.ensureDir(agentDir);
    await fs.writeJson(path.join(agentDir, 'config.json'), config, { spaces: 2 });
    
    // Create logs directory
    await fs.ensureDir(path.join(this.logsDir, name));
    
    debug(`Created agent '${name}' from template '${template}'`);
    return config;
  }

  private applyTemplateVars(obj: any, vars: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.applyTemplateVar(obj, vars);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.applyTemplateVars(item, vars));
    }
    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.applyTemplateVars(value, vars);
      }
      return result;
    }
    return obj;
  }

  private applyTemplateVar(str: string, vars: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return vars[varName] || match;
    });
  }

  async getAgent(name: string): Promise<AgentConfig | null> {
    const configPath = path.join(this.agentsDir, name, 'config.json');
    
    if (!await fs.pathExists(configPath)) {
      return null;
    }
    
    return await fs.readJson(configPath);
  }

  async listAgents(): Promise<AgentConfig[]> {
    const agents: AgentConfig[] = [];
    
    if (!await fs.pathExists(this.agentsDir)) {
      return agents;
    }
    
    const dirs = await fs.readdir(this.agentsDir);
    
    for (const dir of dirs) {
      const configPath = path.join(this.agentsDir, dir, 'config.json');
      if (await fs.pathExists(configPath)) {
        try {
          const config = await fs.readJson(configPath);
          agents.push(config);
        } catch (error) {
          debug(`Failed to load agent config for '${dir}':`, error);
        }
      }
    }
    
    return agents;
  }

  async startAgent(name: string, options: any = {}): Promise<void> {
    const agent = await this.getAgent(name);
    if (!agent) {
      throw new Error(`Agent '${name}' not found`);
    }

    if (!agent.enabled) {
      throw new Error(`Agent '${name}' is disabled`);
    }

    // Check if already running
    const runtime = await this.getRuntime(name);
    if (runtime.status === 'running') {
      throw new Error(`Agent '${name}' is already running`);
    }

    // Prepare environment
    const env = {
      ...process.env,
      ...agent.env,
      MCPX_AGENT_NAME: name,
      MCPX_AGENT_CONFIG: JSON.stringify(agent.config)
    };

    // Determine command and args
    let command: string;
    let args: string[] = [];

    if (agent.script) {
      command = agent.script;
      args = agent.args || [];
    } else if (agent.command) {
      command = agent.command;
      args = agent.args || [];
    } else {
      // Default: Use the agent runner from the agent package
      command = 'npx';
      args = ['tsx', path.join(__dirname, '..', '..', 'agent', 'src', 'cli.ts'), 'start'];
    }

    // Create log streams
    const logFile = path.join(this.logsDir, name, `${Date.now()}.log`);
    await fs.ensureFile(logFile);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    // Spawn process
    debug(`Starting agent '${name}': ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      cwd: agent.cwd,
      env,
      detached: options.detached,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Always pipe to log file
    child.stdout?.on('data', (data) => {
      logStream.write(data);
      if (!options.detached) {
        process.stdout.write(data);
      }
    });

    child.stderr?.on('data', (data) => {
      logStream.write(data);
      if (!options.detached) {
        process.stderr.write(data);
      }
    });

    child.on('exit', (code, signal) => {
      debug(`Agent '${name}' exited with code ${code}, signal ${signal}`);
      this.updateRuntime(name, {
        status: 'stopped',
        exitCode: code || 0
      });
      this.runningAgents.delete(name);
      logStream.end();
    });

    child.on('error', (error) => {
      debug(`Agent '${name}' error:`, error);
      this.updateRuntime(name, {
        status: 'error',
        error: error.message
      });
      this.runningAgents.delete(name);
      logStream.end();
    });

    // Store process reference
    this.runningAgents.set(name, child);

    // Update runtime info
    await this.updateRuntime(name, {
      pid: child.pid,
      startedAt: new Date().toISOString(),
      status: 'running'
    });

    if (options.detached) {
      child.unref();
    }
  }

  async stopAgent(name: string, force: boolean = false): Promise<void> {
    const child = this.runningAgents.get(name);
    
    if (!child) {
      // Try to find by PID from runtime file
      const runtime = await this.getRuntime(name);
      if (runtime.pid) {
        try {
          process.kill(runtime.pid, force ? 'SIGKILL' : 'SIGTERM');
          await this.updateRuntime(name, { status: 'stopped' });
        } catch (error: any) {
          if (error.code !== 'ESRCH') {
            throw error;
          }
          // Process not found, update status
          await this.updateRuntime(name, { status: 'stopped' });
        }
      }
      return;
    }

    child.kill(force ? 'SIGKILL' : 'SIGTERM');
    this.runningAgents.delete(name);
  }

  async restartAgent(name: string): Promise<void> {
    await this.stopAgent(name);
    // Wait a moment for clean shutdown
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.startAgent(name);
  }

  async removeAgent(name: string, force: boolean = false): Promise<void> {
    // Stop if running
    const runtime = await this.getRuntime(name);
    if (runtime.status === 'running') {
      if (!force) {
        throw new Error(`Agent '${name}' is running. Stop it first or use --force`);
      }
      await this.stopAgent(name, true);
    }

    // Remove directories
    await fs.remove(path.join(this.agentsDir, name));
    await fs.remove(path.join(this.logsDir, name));
    await fs.remove(path.join(this.runtimeDir, `${name}.json`));
    
    debug(`Removed agent '${name}'`);
  }

  async getRuntime(name: string): Promise<AgentRuntime> {
    const runtimePath = path.join(this.runtimeDir, `${name}.json`);
    
    if (!await fs.pathExists(runtimePath)) {
      return { status: 'stopped' };
    }
    
    try {
      return await fs.readJson(runtimePath);
    } catch {
      return { status: 'stopped' };
    }
  }

  private async updateRuntime(name: string, runtime: Partial<AgentRuntime>): Promise<void> {
    const runtimePath = path.join(this.runtimeDir, `${name}.json`);
    const current = await this.getRuntime(name);
    
    await fs.writeJson(runtimePath, {
      ...current,
      ...runtime
    }, { spaces: 2 });
  }

  async getLogs(name: string, lines: number = 50, follow: boolean = false): Promise<string[]> {
    const logsDir = path.join(this.logsDir, name);
    
    if (!await fs.pathExists(logsDir)) {
      return [];
    }

    // Get most recent log file
    const files = await fs.readdir(logsDir);
    if (files.length === 0) {
      return [];
    }

    files.sort((a, b) => b.localeCompare(a));
    const latestLog = path.join(logsDir, files[0]);

    if (follow) {
      // TODO: Implement log following
      throw new Error('Log following not yet implemented');
    }

    const content = await fs.readFile(latestLog, 'utf-8');
    const allLines = content.split('\n');
    return allLines.slice(-lines);
  }
}