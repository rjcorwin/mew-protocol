import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { table } from '../utils/table';

interface ComponentStatus {
  name: string;
  type: string;
  status: string;
  url?: string;
  pid?: number;
}

export async function showStatus(options: any): Promise<void> {
  const components: ComponentStatus[] = [];
  const baseDir = path.join(os.homedir(), '.mcpx');
  
  // Check server status
  const serverPidFile = path.join(baseDir, 'runtime', 'server.pid');
  let serverRunning = false;
  if (await fs.pathExists(serverPidFile)) {
    const pid = parseInt(await fs.readFile(serverPidFile, 'utf-8'));
    try {
      process.kill(pid, 0);
      serverRunning = true;
      components.push({
        name: 'server',
        type: 'server',
        status: chalk.green('●'),
        url: 'ws://localhost:3000',
        pid
      });
    } catch {
      components.push({
        name: 'server',
        type: 'server',
        status: chalk.gray('○')
      });
    }
  } else {
    components.push({
      name: 'server',
      type: 'server',
      status: chalk.gray('○')
    });
  }

  // Check frontend status
  const frontendPidFile = path.join(baseDir, 'runtime', 'frontend.pid');
  if (await fs.pathExists(frontendPidFile)) {
    const pid = parseInt(await fs.readFile(frontendPidFile, 'utf-8'));
    try {
      process.kill(pid, 0);
      components.push({
        name: 'frontend',
        type: 'frontend',
        status: chalk.green('●'),
        url: 'http://localhost:3001',
        pid
      });
    } catch {
      components.push({
        name: 'frontend',
        type: 'frontend',
        status: chalk.gray('○')
      });
    }
  } else {
    components.push({
      name: 'frontend',
      type: 'frontend',
      status: chalk.gray('○')
    });
  }

  // Check bridges
  const bridgesDir = path.join(baseDir, 'bridges');
  if (await fs.pathExists(bridgesDir)) {
    const bridgeDirs = await fs.readdir(bridgesDir);
    for (const dir of bridgeDirs) {
      const runtimeFile = path.join(baseDir, 'runtime', `bridge-${dir}.json`);
      if (await fs.pathExists(runtimeFile)) {
        const runtime = await fs.readJson(runtimeFile);
        components.push({
          name: `bridge-${dir}`,
          type: 'bridge',
          status: runtime.running ? chalk.green('●') : chalk.gray('○'),
          pid: runtime.pid
        });
      } else {
        components.push({
          name: `bridge-${dir}`,
          type: 'bridge',
          status: chalk.gray('○')
        });
      }
    }
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
          status: runtime.status === 'running' ? chalk.green('●') : chalk.gray('○'),
          pid: runtime.pid
        });
      } else {
        components.push({
          name: dir,
          type: 'agent',
          status: chalk.gray('○')
        });
      }
    }
  }

  // Display status
  console.log(chalk.bold('\nMCPx System Status\n'));
  
  if (options.json) {
    console.log(JSON.stringify(components.map(c => ({
      ...c,
      status: c.status === chalk.green('●') ? 'running' : 'stopped'
    })), null, 2));
  } else {
    const data = components.map(c => ({
      name: c.name,
      type: c.type,
      status: c.status,
      url: c.url || '-',
      pid: c.pid || '-'
    }));
    
    console.log(table(data, ['name', 'type', 'status', 'url', 'pid']));
    
    // Summary
    const running = components.filter(c => c.status === chalk.green('●')).length;
    const total = components.length;
    console.log(`\n${running}/${total} components running`);
    
    if (running === 0) {
      console.log(chalk.gray('\nStart everything with: mcpx start'));
    }
  }
}

export async function startAll(options: any): Promise<void> {
  console.log(chalk.bold('Starting MCPx system...\n'));
  
  // Import commands
  const { startServer } = await import('./server');
  const { startFrontend } = await import('./frontend');
  
  // Start server
  console.log(chalk.blue('1. Starting server...'));
  await startServer({ detached: true, dev: true });
  
  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Start frontend if requested
  if (!options.noFrontend) {
    console.log(chalk.blue('\n2. Starting frontend...'));
    await startFrontend({ detached: true });
  }
  
  // Start bridges
  const baseDir = path.join(os.homedir(), '.mcpx');
  const bridgesDir = path.join(baseDir, 'bridges');
  
  if (await fs.pathExists(bridgesDir)) {
    const bridgeDirs = await fs.readdir(bridgesDir);
    if (bridgeDirs.length > 0) {
      console.log(chalk.blue(`\n3. Starting ${bridgeDirs.length} bridge(s)...`));
      const { startBridge } = await import('./bridge');
      
      for (const bridge of bridgeDirs) {
        await startBridge(bridge, { detached: true });
        console.log(chalk.gray(`   ✓ Bridge '${bridge}' started`));
      }
    }
  }
  
  // Start agents if requested
  if (!options.noAgents) {
    const agentsDir = path.join(baseDir, 'agents');
    if (await fs.pathExists(agentsDir)) {
      const agentDirs = await fs.readdir(agentsDir);
      if (agentDirs.length > 0) {
        console.log(chalk.blue(`\n4. Starting ${agentDirs.length} agent(s)...`));
        
        for (const agentName of agentDirs) {
          try {
            const configPath = path.join(agentsDir, agentName, 'config.json');
            const config = await fs.readJson(configPath);
            
            if (config.enabled) {
              const AgentManager = (await import('../lib/AgentManager')).AgentManager;
              const manager = new AgentManager();
              await manager.initialize();
              await manager.startAgent(agentName, { detached: true });
              console.log(chalk.gray(`   ✓ Agent '${agentName}' started`));
            } else {
              console.log(chalk.gray(`   - Agent '${agentName}' is disabled`));
            }
          } catch (error: any) {
            console.log(chalk.yellow(`   ⚠ Failed to start '${agentName}': ${error.message}`));
          }
        }
      }
    }
  }
  
  console.log(chalk.green('\n✓ MCPx system started'));
  console.log(chalk.gray('\nView status: mcpx status'));
  console.log(chalk.gray('Stop everything: mcpx stop'));
  
  if (!options.noFrontend) {
    console.log(chalk.gray('Open frontend: http://localhost:3001'));
  }
}

export async function stopAll(options: any): Promise<void> {
  console.log(chalk.bold('Stopping MCPx system...\n'));
  
  const baseDir = path.join(os.homedir(), '.mcpx');
  
  // Stop agents
  const agentsDir = path.join(baseDir, 'agents');
  if (await fs.pathExists(agentsDir)) {
    const agentDirs = await fs.readdir(agentsDir);
    if (agentDirs.length > 0) {
      console.log(chalk.blue(`1. Stopping ${agentDirs.length} agent(s)...`));
      const AgentManager = (await import('../lib/AgentManager')).AgentManager;
      const manager = new AgentManager();
      await manager.initialize();
      
      for (const agentName of agentDirs) {
        const runtimeFile = path.join(baseDir, 'runtime', `${agentName}.json`);
        if (await fs.pathExists(runtimeFile)) {
          const runtime = await fs.readJson(runtimeFile);
          if (runtime.status === 'running') {
            await manager.stopAgent(agentName, options.force);
            console.log(chalk.gray(`   ✓ Agent '${agentName}' stopped`));
          }
        }
      }
    }
  }
  
  // Stop bridges
  const bridgesDir = path.join(baseDir, 'bridges');
  if (await fs.pathExists(bridgesDir)) {
    const bridgeDirs = await fs.readdir(bridgesDir);
    if (bridgeDirs.length > 0) {
      console.log(chalk.blue(`\n2. Stopping ${bridgeDirs.length} bridge(s)...`));
      const { stopBridge } = await import('./bridge');
      
      for (const bridge of bridgeDirs) {
        const runtimeFile = path.join(baseDir, 'runtime', `bridge-${bridge}.json`);
        if (await fs.pathExists(runtimeFile)) {
          const runtime = await fs.readJson(runtimeFile);
          if (runtime.running) {
            await stopBridge(bridge, { force: options.force });
            console.log(chalk.gray(`   ✓ Bridge '${bridge}' stopped`));
          }
        }
      }
    }
  }
  
  // Stop frontend
  const { stopFrontend } = await import('./frontend');
  console.log(chalk.blue('\n3. Stopping frontend...'));
  await stopFrontend({ force: options.force });
  
  // Stop server
  const { stopServer } = await import('./server');
  console.log(chalk.blue('\n4. Stopping server...'));
  await stopServer({ force: options.force });
  
  console.log(chalk.green('\n✓ MCPx system stopped'));
}