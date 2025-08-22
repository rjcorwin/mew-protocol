import express from 'express';
import cors from 'cors';
import { Server } from 'http';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as agentCommands from './agent';
import * as serverCommands from './server';
import * as frontendCommands from './frontend';
import * as bridgeCommands from './bridge';
import * as statusCommands from './status';

let server: Server | null = null;

async function getStatusComponents(): Promise<any[]> {
  const components: any[] = [];
  const baseDir = path.join(os.homedir(), '.mcpx');
  
  // Check server status
  const serverPidFile = path.join(baseDir, 'runtime', 'server.pid');
  if (await fs.pathExists(serverPidFile)) {
    const pidContent = await fs.readFile(serverPidFile, 'utf-8');
    const pid = parseInt(pidContent.trim());
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0);
        components.push({
          name: 'server',
          type: 'server',
          status: 'running',
          running: true,
          url: 'ws://localhost:3000',
          pid
        });
      } catch {
        components.push({
          name: 'server',
          type: 'server',
          status: 'stopped',
          running: false
        });
      }
    } else {
      components.push({
        name: 'server',
        type: 'server',
        status: 'stopped',
        running: false
      });
    }
  } else {
    components.push({
      name: 'server',
      type: 'server',
      status: 'stopped',
      running: false
    });
  }

  // Check frontend status
  const frontendPidFile = path.join(baseDir, 'runtime', 'frontend.pid');
  if (await fs.pathExists(frontendPidFile)) {
    const pidContent = await fs.readFile(frontendPidFile, 'utf-8');
    const pid = parseInt(pidContent.trim());
    if (!isNaN(pid)) {
      try {
        process.kill(pid, 0);
        components.push({
          name: 'frontend',
          type: 'frontend',
          status: 'running',
          running: true,
          url: 'http://localhost:3001',
          pid
        });
      } catch {
        components.push({
          name: 'frontend',
          type: 'frontend',
          status: 'stopped',
          running: false
        });
      }
    } else {
      components.push({
        name: 'frontend',
        type: 'frontend',
        status: 'stopped',
        running: false
      });
    }
  } else {
    components.push({
      name: 'frontend',
      type: 'frontend',
      status: 'stopped',
      running: false
    });
  }

  // Check agents
  const agentsDir = path.join(baseDir, 'agents');
  if (await fs.pathExists(agentsDir)) {
    const agentDirs = await fs.readdir(agentsDir);
    for (const dir of agentDirs) {
      const runtimeFile = path.join(baseDir, 'runtime', `${dir}.json`);
      if (await fs.pathExists(runtimeFile)) {
        const runtime = await fs.readJson(runtimeFile);
        components.push({
          name: dir,
          type: 'agent',
          status: runtime.status === 'running' ? 'running' : 'stopped',
          running: runtime.status === 'running',
          pid: runtime.pid
        });
      } else {
        components.push({
          name: dir,
          type: 'agent',
          status: 'stopped',
          running: false
        });
      }
    }
  }

  return components;
}

export async function startStudioServer(options: any): Promise<void> {
  const port = options.port || 3100;
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mcpx-studio-backend' });
  });
  
  // System status
  app.get('/api/status', async (req, res) => {
    try {
      // Get status components directly
      const components = await getStatusComponents();
      
      res.json({
        success: true,
        data: {
          server: components.find(c => c.type === 'server') || { running: false },
          frontend: components.find(c => c.type === 'frontend') || { running: false },
          bridges: components.filter(c => c.type === 'bridge'),
          agents: components.filter(c => c.type === 'agent')
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Agent endpoints
  app.get('/api/agents', async (req, res) => {
    try {
      // Get agents directly from AgentManager
      const AgentManager = (await import('../lib/AgentManager')).AgentManager;
      const manager = new AgentManager();
      await manager.initialize();
      const agents = await manager.listAgents();
      res.json({ success: true, data: agents });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/agents', async (req, res) => {
    try {
      const { name, template, ...extraOptions } = req.body;
      // Only pass template option that the CLI understands
      const cliOptions = { template: template || 'basic' };
      
      await agentCommands.createAgent(name, cliOptions);
      
      // If it's an AI agent, we need to update the config with AI settings
      if (template === 'ai' && extraOptions.aiProvider) {
        const configPath = path.join(os.homedir(), '.mcpx', 'agents', name, 'config.json');
        if (await fs.pathExists(configPath)) {
          const config = await fs.readJson(configPath);
          config.config.openai = {
            apiKey: '${OPENAI_API_KEY}',
            model: extraOptions.aiModel || 'gpt-4o',
            temperature: 0.7
          };
          await fs.writeJson(configPath, config, { spaces: 2 });
        }
      }
      
      res.json({ success: true, message: `Agent ${name} created` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/agents/:name/start', async (req, res) => {
    try {
      await agentCommands.startAgent(req.params.name, { detached: true });
      res.json({ success: true, message: `Agent ${req.params.name} started` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/agents/:name/stop', async (req, res) => {
    try {
      await agentCommands.stopAgent(req.params.name, {});
      res.json({ success: true, message: `Agent ${req.params.name} stopped` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.delete('/api/agents/:name', async (req, res) => {
    try {
      await agentCommands.removeAgent(req.params.name, {});
      res.json({ success: true, message: `Agent ${req.params.name} removed` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Server endpoints
  app.post('/api/server/start', async (req, res) => {
    try {
      await serverCommands.startServer({ detached: true, dev: true });
      res.json({ success: true, message: 'Server started' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/server/stop', async (req, res) => {
    try {
      await serverCommands.stopServer({});
      res.json({ success: true, message: 'Server stopped' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Frontend endpoints
  app.post('/api/frontend/start', async (req, res) => {
    try {
      await frontendCommands.startFrontend({ detached: true, dev: true });
      res.json({ success: true, message: 'Frontend started' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/frontend/stop', async (req, res) => {
    try {
      await frontendCommands.stopFrontend({});
      res.json({ success: true, message: 'Frontend stopped' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Bridge endpoints
  app.get('/api/bridges', async (req, res) => {
    try {
      const bridges = await bridgeCommands.listBridges({ json: true });
      res.json({ success: true, data: bridges });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/bridges', async (req, res) => {
    try {
      const { name, ...options } = req.body;
      await bridgeCommands.createBridge(name, options);
      res.json({ success: true, message: `Bridge ${name} created` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/bridges/:name/start', async (req, res) => {
    try {
      await bridgeCommands.startBridge(req.params.name, { detached: true });
      res.json({ success: true, message: `Bridge ${req.params.name} started` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/bridges/:name/stop', async (req, res) => {
    try {
      await bridgeCommands.stopBridge(req.params.name, {});
      res.json({ success: true, message: `Bridge ${req.params.name} stopped` });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // System control
  app.post('/api/system/start', async (req, res) => {
    try {
      await statusCommands.startAll({ ...req.body });
      res.json({ success: true, message: 'System started' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  app.post('/api/system/stop', async (req, res) => {
    try {
      await statusCommands.stopAll({});
      res.json({ success: true, message: 'System stopped' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Start server
  server = app.listen(port, () => {
    console.log(chalk.green(`✓ MCPx Studio Backend running on http://localhost:${port}`));
    console.log(chalk.gray('  Press Ctrl+C to stop'));
  });
}

export async function stopStudioServer(options: any): Promise<void> {
  if (server) {
    server.close(() => {
      console.log(chalk.yellow('MCPx Studio Backend stopped'));
    });
    server = null;
  }
}