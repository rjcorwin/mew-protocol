const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawn, execSync } = require('child_process');
const net = require('net');
const http = require('http');
const pm2 = require('pm2');

const space = new Command('space')
  .description('Manage MEUP spaces');

// PM2 connection helper
function connectPM2(spaceDir) {
  return new Promise((resolve, reject) => {
    // For now, use default PM2 home to avoid issues
    // TODO: Investigate why custom PM2_HOME causes hanging
    
    console.log('Connecting to PM2 (using default PM2_HOME)...');
    
    // Connect to PM2 daemon (will start if not running)
    pm2.connect((err) => {
      if (err) {
        console.error('PM2 connect error:', err);
        reject(err);
      } else {
        console.log('PM2 connected successfully');
        resolve();
      }
    });
  });
}

// PM2 start helper
function startPM2Process(config) {
  return new Promise((resolve, reject) => {
    pm2.start(config, (err, apps) => {
      if (err) {
        reject(err);
      } else {
        resolve(apps[0]);
      }
    });
  });
}

// PM2 list helper
function listPM2Processes() {
  return new Promise((resolve, reject) => {
    pm2.list((err, list) => {
      if (err) {
        reject(err);
      } else {
        resolve(list);
      }
    });
  });
}

// PM2 delete helper
function deletePM2Process(name) {
  return new Promise((resolve, reject) => {
    pm2.delete(name, (err) => {
      if (err && !err.message.includes('not found')) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// PM2 disconnect helper
function disconnectPM2() {
  pm2.disconnect();
}

// Get path to store running spaces info
function getSpacesFilePath() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const meupDir = path.join(homeDir, '.meup');
  if (!fs.existsSync(meupDir)) {
    fs.mkdirSync(meupDir, { recursive: true });
  }
  return path.join(meupDir, 'running-spaces.json');
}

// Load running spaces from file
function loadRunningSpaces() {
  const filePath = getSpacesFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return new Map(JSON.parse(content));
    } catch (error) {
      return new Map();
    }
  }
  return new Map();
}

// Save running spaces to file
function saveRunningSpaces(spaces) {
  const filePath = getSpacesFilePath();
  const data = Array.from(spaces.entries());
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Check if process is running
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

// Check if port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

// Wait for gateway to be ready
async function waitForGateway(port, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${port}/health`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
      
      const health = JSON.parse(response);
      if (health.status === 'ok') {
        return true;
      }
    } catch (error) {
      // Gateway not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

// Check if mkfifo is available
function hasMkfifo() {
  try {
    execSync('which mkfifo', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Load space configuration from yaml file
 */
function loadSpaceConfig(configPath) {
  try {
    const resolvedPath = path.resolve(configPath);
    const configContent = fs.readFileSync(resolvedPath, 'utf8');
    const config = yaml.load(configContent);
    return { config, configPath: resolvedPath };
  } catch (error) {
    console.error(`Failed to load space configuration: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Create PID file for space
 */
function savePidFile(spaceDir, pids) {
  const pidDir = path.join(spaceDir, '.meup');
  if (!fs.existsSync(pidDir)) {
    fs.mkdirSync(pidDir, { recursive: true });
  }
  
  const pidFile = path.join(pidDir, 'pids.json');
  fs.writeFileSync(pidFile, JSON.stringify(pids, null, 2));
  return pidFile;
}

/**
 * Load PID file for space
 */
function loadPidFile(spaceDir) {
  const pidFile = path.join(spaceDir, '.meup', 'pids.json');
  if (!fs.existsSync(pidFile)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(pidFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load PID file: ${error.message}`);
    return null;
  }
}

/**
 * Remove PID file
 */
function removePidFile(spaceDir) {
  const pidFile = path.join(spaceDir, '.meup', 'pids.json');
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

/**
 * Create FIFOs for participant if configured
 * @param {boolean} createOutputFifo - Whether to create output FIFO (false when output_log is set)
 */
function createFifos(spaceDir, participantId, createOutputFifo = true) {
  const fifoDir = path.join(spaceDir, 'fifos');
  if (!fs.existsSync(fifoDir)) {
    fs.mkdirSync(fifoDir, { recursive: true });
  }
  
  const inFifo = path.join(fifoDir, `${participantId}-in`);
  const outFifo = path.join(fifoDir, `${participantId}-out`);
  
  // Create FIFOs if they don't exist
  if (!hasMkfifo()) {
    throw new Error('mkfifo command not found. FIFOs are required for this participant.');
  }
  
  try {
    // Always create input FIFO
    if (!fs.existsSync(inFifo)) {
      execSync(`mkfifo "${inFifo}"`);
    }
    // Only create output FIFO if requested
    if (createOutputFifo && !fs.existsSync(outFifo)) {
      execSync(`mkfifo "${outFifo}"`);
    }
  } catch (error) {
    console.error(`Failed to create FIFOs: ${error.message}`);
    throw error;
  }
  
  return { inFifo, outFifo: createOutputFifo ? outFifo : null };
}

/**
 * Clean up FIFOs
 */
function cleanupFifos(spaceDir) {
  const fifoDir = path.join(spaceDir, 'fifos');
  if (fs.existsSync(fifoDir)) {
    const files = fs.readdirSync(fifoDir);
    for (const file of files) {
      const filePath = path.join(fifoDir, file);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  }
}

// Command: meup space up
space
  .command('up')
  .description('Start a space with gateway and configured participants')
  .option('-c, --config <path>', 'Path to space.yaml configuration', './space.yaml')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .option('-p, --port <port>', 'Gateway port', '8080')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .action(async (options) => {
    const spaceDir = path.resolve(options.spaceDir);
    const configPath = path.join(spaceDir, path.basename(options.config));
    
    console.log(`Starting space in ${spaceDir}...`);
    
    // Load space configuration
    const { config } = loadSpaceConfig(configPath);
    const spaceName = config.space?.name || 'unnamed-space';
    const spaceId = config.space?.id || 'space-' + Date.now();
    
    console.log(`Space: ${spaceName} (${spaceId})`);
    
    // Check if space is already running
    const existingPids = loadPidFile(spaceDir);
    if (existingPids && existingPids.gateway && isProcessRunning(existingPids.gateway)) {
      console.error('Space is already running. Run "meup space down" first.');
      process.exit(1);
    }
    
    // Check if port is available
    const portAvailable = await isPortAvailable(options.port);
    if (!portAvailable) {
      console.error(`Port ${options.port} is already in use. Choose a different port.`);
      process.exit(1);
    }
    
    const pids = {
      spaceId,
      spaceName,
      spaceDir,
      port: options.port,
      gateway: null,
      agents: {},
      clients: {}
    };
    
    // Create logs directory
    const logsDir = path.join(spaceDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Connect to PM2 with space-local daemon
    console.log('Initializing PM2 daemon...');
    try {
      await connectPM2(spaceDir);
    } catch (error) {
      console.error(`Failed to connect to PM2: ${error.message}`);
      process.exit(1);
    }
    
    // Start gateway using PM2
    console.log(`Starting gateway on port ${options.port}...`);
    const gatewayLogPath = path.join(logsDir, 'gateway.log');
    
    try {
      const gatewayApp = await startPM2Process({
        name: `${spaceId}-gateway`,
        script: path.join(__dirname, '../../bin/meup.js'),
        args: [
          'gateway',
          'start',
          '--port', options.port,
          '--log-level', options.logLevel,
          '--space-config', configPath
        ],
        cwd: spaceDir,
        autorestart: false,
        max_memory_restart: '500M',
        error_file: path.join(logsDir, 'gateway-error.log'),
        out_file: gatewayLogPath,
        merge_logs: true,
        time: true
      });
      
      pids.gateway = gatewayApp.pid || gatewayApp.pm2_env?.pm_id || 'unknown';
      console.log(`✓ Gateway started via PM2 (PID: ${pids.gateway})`);
    } catch (error) {
      console.error(`Failed to start gateway: ${error.message}`);
      disconnectPM2();
      process.exit(1);
    }
    
    // Wait for gateway to be ready
    console.log('Waiting for gateway to be ready...');
    const gatewayReady = await waitForGateway(options.port);
    if (!gatewayReady) {
      console.error('Gateway failed to become ready. Check logs/gateway.log for details.');
      await deletePM2Process(`${spaceId}-gateway`);
      disconnectPM2();
      process.exit(1);
    }
    console.log('✓ Gateway is ready');
    
    // Start agents and bridges with auto_start: true
    for (const [participantId, participant] of Object.entries(config.participants || {})) {
      // Handle MCP bridge participants
      if (participant.type === 'mcp-bridge' && participant.auto_start && participant.mcp_server) {
        console.log(`Starting MCP bridge: ${participantId}...`);
        
        const bridgeLogPath = path.join(logsDir, `${participantId}-bridge.log`);
        const mcpServer = participant.mcp_server;
        
        // Build bridge arguments
        const bridgeArgs = [
          '--gateway', `ws://localhost:${options.port}`,
          '--space', spaceId,
          '--participant-id', participantId,
          '--token', participant.tokens?.[0] || 'token',
          '--mcp-command', mcpServer.command,
        ];
        
        // Add MCP args if present
        if (mcpServer.args && mcpServer.args.length > 0) {
          bridgeArgs.push('--mcp-args', mcpServer.args.join(','));
        }
        
        // Add MCP env if present
        if (mcpServer.env) {
          const envPairs = Object.entries(mcpServer.env).map(([k, v]) => `${k}=${v}`).join(',');
          bridgeArgs.push('--mcp-env', envPairs);
        }
        
        // Add MCP cwd if present
        if (mcpServer.cwd) {
          bridgeArgs.push('--mcp-cwd', mcpServer.cwd);
        }
        
        // Add bridge config options if present
        if (participant.bridge_config) {
          if (participant.bridge_config.init_timeout) {
            bridgeArgs.push('--init-timeout', participant.bridge_config.init_timeout.toString());
          }
          if (participant.bridge_config.reconnect !== undefined) {
            bridgeArgs.push('--reconnect', participant.bridge_config.reconnect.toString());
          }
          if (participant.bridge_config.max_reconnects) {
            bridgeArgs.push('--max-reconnects', participant.bridge_config.max_reconnects.toString());
          }
        }
        
        try {
          // Find the bridge executable
          const bridgePath = path.resolve(__dirname, '..', '..', '..', 'bridge', 'bin', 'meup-bridge.js');
          
          const bridgeApp = await startPM2Process({
            name: `mcp_bridge_${participantId}`,
            script: bridgePath,
            args: bridgeArgs,
            cwd: spaceDir,
            autorestart: false,
            max_memory_restart: '200M',
            error_file: path.join(logsDir, `${participantId}-bridge-error.log`),
            out_file: bridgeLogPath,
            merge_logs: true,
            time: true,
            env: {
              ...process.env,
              NODE_ENV: process.env.NODE_ENV || 'production'
            }
          });
          
          pids.agents[participantId] = bridgeApp.pid || bridgeApp.pm2_env?.pm_id || 'unknown';
          console.log(`✓ MCP bridge ${participantId} started via PM2 (PID: ${pids.agents[participantId]})`);
        } catch (error) {
          console.error(`Failed to start MCP bridge ${participantId}: ${error.message}`);
        }
      }
      // Handle regular agent participants
      else if (participant.auto_start && participant.command) {
        console.log(`Starting agent: ${participantId}...`);
        
        const agentLogPath = path.join(logsDir, `${participantId}.log`);
        const agentArgs = participant.args || [];
        
        // Replace placeholders in args
        const processedArgs = agentArgs.map(arg => 
          arg.replace('${PORT}', options.port)
             .replace('${SPACE}', spaceId)
             .replace('${TOKEN}', participant.tokens?.[0] || 'token')
        );
        
        try {
          const agentApp = await startPM2Process({
            name: `${spaceId}-${participantId}`,
            script: participant.command,
            args: processedArgs,
            cwd: spaceDir,
            autorestart: false,
            max_memory_restart: '200M',
            error_file: path.join(logsDir, `${participantId}-error.log`),
            out_file: agentLogPath,
            merge_logs: true,
            time: true,
            env: participant.env || {}
          });
          
          pids.agents[participantId] = agentApp.pid || agentApp.pm2_env?.pm_id || 'unknown';
          console.log(`✓ ${participantId} started via PM2 (PID: ${pids.agents[participantId]})`);
        } catch (error) {
          console.error(`Failed to start ${participantId}: ${error.message}`);
        }
      }
      
      // Create FIFOs for participants with fifo: true
      if (participant.fifo === true) {
        // Determine if we need output FIFO (not needed if output_log is set)
        const createOutputFifo = !participant.output_log;
        
        console.log(`Creating FIFOs for ${participantId}...`);
        const { inFifo, outFifo } = createFifos(spaceDir, participantId, createOutputFifo);
        
        if (createOutputFifo) {
          console.log(`✓ FIFOs created: ${participantId}-in, ${participantId}-out`);
        } else {
          console.log(`✓ FIFO created: ${participantId}-in (output goes to ${participant.output_log})`);
        }
        
        // If auto_connect is true, connect the participant
        if (participant.auto_connect === true) {
          console.log(`Connecting ${participantId}...`);
          
          const clientLogPath = path.join(logsDir, `${participantId}-client.log`);
          
          // Build client arguments
          const clientArgs = [
            'client',
            'connect',
            '--gateway', `ws://localhost:${options.port}`,
            '--space', spaceId,
            '--participant-id', participantId,
            '--token', participant.tokens?.[0] || 'token',
            '--fifo-in', inFifo
          ];
          
          // Add output configuration
          if (participant.output_log) {
            // Ensure logs directory exists
            const outputLogPath = path.join(spaceDir, participant.output_log);
            const outputLogDir = path.dirname(outputLogPath);
            if (!fs.existsSync(outputLogDir)) {
              fs.mkdirSync(outputLogDir, { recursive: true });
            }
            clientArgs.push('--output-file', outputLogPath);
          } else {
            clientArgs.push('--fifo-out', outFifo);
          }
          
          try {
            const clientApp = await startPM2Process({
              name: `${spaceId}-${participantId}-client`,
              script: path.join(__dirname, '../../bin/meup.js'),
              args: clientArgs,
              cwd: spaceDir,
              autorestart: false,
              error_file: path.join(logsDir, `${participantId}-client-error.log`),
              out_file: clientLogPath,
              merge_logs: true,
              time: true
            });
            
            pids.clients[participantId] = clientApp.pid || clientApp.pm2_env?.pm_id || 'unknown';
            console.log(`✓ ${participantId} connected via PM2 (PID: ${pids.clients[participantId]})`);
          } catch (error) {
            console.error(`Failed to connect ${participantId}: ${error.message}`);
          }
        }
      }
    }
    
    // Save PID file
    const pidFile = savePidFile(spaceDir, pids);
    console.log(`\n✓ Space is up! (PID file: ${pidFile})`);
    console.log(`\nGateway: ws://localhost:${options.port}`);
    console.log(`Space ID: ${spaceId}`);
    console.log(`\nTo stop: meup space down`);
    
    // Store running space info
    const runningSpaces = loadRunningSpaces();
    runningSpaces.set(spaceDir, pids);
    saveRunningSpaces(runningSpaces);
    
    // Disconnect from PM2 daemon (it continues running)
    disconnectPM2();
  });

// Command: meup space down
space
  .command('down')
  .description('Stop a running space')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .action(async (options) => {
    const spaceDir = path.resolve(options.spaceDir);
    
    console.log(`Stopping space in ${spaceDir}...`);
    
    // Load PID file
    const pids = loadPidFile(spaceDir);
    if (!pids) {
      console.error('No running space found in this directory.');
      process.exit(1);
    }
    
    const spaceId = pids.spaceId;
    console.log(`Stopping ${pids.spaceName} (${spaceId})...`);
    
    // Connect to PM2
    try {
      await connectPM2(spaceDir);
    } catch (error) {
      console.error(`Failed to connect to PM2: ${error.message}`);
      console.log('Space may have been stopped manually.');
    }
    
    // Stop all PM2 processes for this space
    try {
      // Stop clients first
      for (const participantId of Object.keys(pids.clients || {})) {
        await deletePM2Process(`${spaceId}-${participantId}-client`);
        console.log(`✓ Stopped client: ${participantId}`);
      }
      
      // Stop agents
      for (const participantId of Object.keys(pids.agents || {})) {
        await deletePM2Process(`${spaceId}-${participantId}`);
        console.log(`✓ Stopped agent: ${participantId}`);
      }
      
      // Stop gateway
      if (pids.gateway) {
        await deletePM2Process(`${spaceId}-gateway`);
        console.log(`✓ Stopped gateway`);
      }
      
      // Kill PM2 daemon for this space
      try {
        await new Promise((resolve, reject) => {
          pm2.killDaemon((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        console.log('✓ Stopped PM2 daemon');
      } catch (error) {
        // Daemon might already be dead
      }
    } catch (error) {
      console.error(`Error stopping processes: ${error.message}`);
    }
    
    // Disconnect from PM2
    disconnectPM2();
    
    // Clean up PM2 directory
    const pm2Dir = path.join(spaceDir, '.meup', 'pm2');
    if (fs.existsSync(pm2Dir)) {
      try {
        fs.rmSync(pm2Dir, { recursive: true, force: true });
        console.log('✓ Cleaned up PM2 directory');
      } catch (error) {
        console.error(`Failed to clean PM2 directory: ${error.message}`);
      }
    }
    
    // Clean up FIFOs
    cleanupFifos(spaceDir);
    console.log('✓ Cleaned up FIFOs');
    
    // Remove PID file
    removePidFile(spaceDir);
    console.log('✓ Removed PID file');
    
    // Remove from running spaces
    const runningSpaces = loadRunningSpaces();
    runningSpaces.delete(spaceDir);
    saveRunningSpaces(runningSpaces);
    
    console.log('\n✓ Space stopped successfully!');
    process.exit(0);
  });

// Command: meup space status
space
  .command('status')
  .description('Show status of running spaces')
  .option('-d, --space-dir <path>', 'Space directory (optional)', null)
  .action(async (options) => {
    if (options.spaceDir) {
      // Show status for specific space
      const spaceDir = path.resolve(options.spaceDir);
      const pids = loadPidFile(spaceDir);
      
      if (!pids) {
        console.log('No running space found in this directory.');
        return;
      }
      
      const spaceId = pids.spaceId;
      console.log(`Space: ${pids.spaceName} (${spaceId})`);
      console.log(`Directory: ${pids.spaceDir}`);
      console.log(`Gateway: ws://localhost:${pids.port}`);
      
      // Connect to PM2 to get process status
      try {
        await connectPM2(spaceDir);
        const processes = await listPM2Processes();
        
        // Filter processes for this space
        const spaceProcesses = processes.filter(p => p.name && p.name.startsWith(spaceId));
        
        if (spaceProcesses.length > 0) {
          console.log('\nProcesses (via PM2):');
          for (const proc of spaceProcesses) {
            const status = proc.pm2_env.status === 'online' ? 'running' : proc.pm2_env.status;
            const memory = proc.monit ? `${Math.round(proc.monit.memory / 1024 / 1024)}MB` : 'N/A';
            console.log(`  - ${proc.name}: ${status} (PID: ${proc.pid}, Memory: ${memory})`);
          }
        }
        
        disconnectPM2();
      } catch (error) {
        // Fall back to PID checking if PM2 connection fails
        console.log('\nProcesses (PID check):');
        
        if (pids.gateway) {
          try {
            process.kill(pids.gateway, 0);
            console.log(`  - Gateway: running (PID: ${pids.gateway})`);
          } catch (error) {
            console.log(`  - Gateway: stopped (PID: ${pids.gateway})`);
          }
        }
        
        for (const [id, pid] of Object.entries(pids.agents || {})) {
          try {
            process.kill(pid, 0);
            console.log(`  - ${id}: running (PID: ${pid})`);
          } catch (error) {
            console.log(`  - ${id}: stopped (PID: ${pid})`);
          }
        }
        
        for (const [id, pid] of Object.entries(pids.clients || {})) {
          try {
            process.kill(pid, 0);
            console.log(`  - ${id}: connected (PID: ${pid})`);
          } catch (error) {
            console.log(`  - ${id}: disconnected (PID: ${pid})`);
          }
        }
      }
      
      // Check for FIFOs
      const fifoDir = path.join(spaceDir, 'fifos');
      if (fs.existsSync(fifoDir)) {
        const fifos = fs.readdirSync(fifoDir);
        if (fifos.length > 0) {
          console.log('\nFIFOs:');
          const participants = new Set();
          for (const fifo of fifos) {
            const match = fifo.match(/^(.+)-(in|out)$/);
            if (match) {
              participants.add(match[1]);
            }
          }
          for (const participant of participants) {
            console.log(`  - ${participant}: ${path.join(fifoDir, participant + '-in')}`);
            console.log(`               ${path.join(fifoDir, participant + '-out')}`);
          }
        }
      }
    } else {
      // Show all running spaces
      console.log('Running spaces:\n');
      
      let foundAny = false;
      
      // Check current directory
      const currentPids = loadPidFile('.');
      if (currentPids) {
        console.log(`Current directory:`);
        console.log(`  ${currentPids.spaceName} (${currentPids.spaceId})`);
        console.log(`  Gateway: ws://localhost:${currentPids.port}`);
        foundAny = true;
      }
      
      // Check saved running spaces
      const runningSpaces = loadRunningSpaces();
      if (runningSpaces.size > 0) {
        for (const [dir, pids] of runningSpaces.entries()) {
          // Validate that the space is actually running
          if (pids.gateway && isProcessRunning(pids.gateway)) {
            console.log(`\n${dir}:`);
            console.log(`  ${pids.spaceName} (${pids.spaceId})`);
            console.log(`  Gateway: ws://localhost:${pids.port}`);
            foundAny = true;
          }
        }
      }
      
      if (!foundAny) {
        console.log('No running spaces found.');
      }
    }
  });

// Command: meup space clean
space
  .command('clean')
  .description('Clean up space artifacts (logs, fifos, temporary files)')
  .option('--all', 'Clean everything including .meup directory')
  .option('--logs', 'Clean only log files')
  .option('--fifos', 'Clean only FIFO pipes')
  .option('--force', 'Skip confirmation prompts')
  .option('--dry-run', 'Show what would be cleaned without doing it')
  .action(async (options) => {
    const spaceDir = process.cwd();
    const spaceConfigPath = path.join(spaceDir, 'space.yaml');
    
    // Check if this is a valid space directory
    if (!fs.existsSync(spaceConfigPath)) {
      console.error('Error: space.yaml not found in current directory');
      process.exit(1);
    }
    
    // Check if space is running
    const pids = loadPidFile(spaceDir);
    const isRunning = pids && pids.gateway && isProcessRunning(pids.gateway);
    
    // Collect items to clean
    const itemsToClean = {
      logs: [],
      fifos: [],
      meup: false,
      pm2: false
    };
    
    // Determine what to clean based on options
    const cleanLogs = options.logs || (!options.fifos && !options.all) || options.all;
    const cleanFifos = options.fifos || (!options.logs && !options.all) || options.all;
    const cleanMeup = options.all;
    
    // Collect log files
    if (cleanLogs) {
      const logsDir = path.join(spaceDir, 'logs');
      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
          const filePath = path.join(logsDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            itemsToClean.logs.push({
              path: filePath,
              size: stats.size,
              name: file
            });
          }
        }
      }
    }
    
    // Collect FIFO pipes
    if (cleanFifos) {
      const fifosDir = path.join(spaceDir, 'fifos');
      if (fs.existsSync(fifosDir)) {
        const files = fs.readdirSync(fifosDir);
        for (const file of files) {
          const filePath = path.join(fifosDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFIFO()) {
            // Check if FIFO is in use
            let inUse = false;
            if (isRunning && pids.clients) {
              // Check if any client is using this FIFO
              for (const clientId of Object.keys(pids.clients)) {
                if (file === `${clientId}-in` || file === `${clientId}-out`) {
                  inUse = true;
                  break;
                }
              }
            }
            itemsToClean.fifos.push({
              path: filePath,
              name: file,
              inUse
            });
          }
        }
      }
    }
    
    // Check .meup directory
    if (cleanMeup) {
      const meupDir = path.join(spaceDir, '.meup');
      if (fs.existsSync(meupDir)) {
        itemsToClean.meup = true;
        // Check for PM2 directory
        const pm2Dir = path.join(meupDir, 'pm2');
        if (fs.existsSync(pm2Dir)) {
          itemsToClean.pm2 = true;
        }
      }
    }
    
    // Calculate total size
    let totalSize = 0;
    let totalFiles = 0;
    
    for (const log of itemsToClean.logs) {
      totalSize += log.size;
      totalFiles++;
    }
    
    // Show what will be cleaned
    if (options.dryRun) {
      console.log('Would clean:\n');
      
      if (itemsToClean.logs.length > 0) {
        console.log(`  - ${itemsToClean.logs.length} log files (${formatBytes(totalSize)})`);
        if (options.verbose) {
          for (const log of itemsToClean.logs) {
            console.log(`    - ${log.name} (${formatBytes(log.size)})`);
          }
        }
      }
      
      if (itemsToClean.fifos.length > 0) {
        const activeFifos = itemsToClean.fifos.filter(f => f.inUse);
        const inactiveFifos = itemsToClean.fifos.filter(f => !f.inUse);
        if (inactiveFifos.length > 0) {
          console.log(`  - ${inactiveFifos.length} FIFO pipes (inactive)`);
        }
        if (activeFifos.length > 0) {
          console.log(`  - ${activeFifos.length} FIFO pipes (ACTIVE - will be skipped)`);
        }
      }
      
      if (itemsToClean.meup) {
        console.log('  - .meup directory (including process state)');
        if (itemsToClean.pm2) {
          console.log('    - PM2 daemon and logs');
        }
      }
      
      if (totalFiles > 0) {
        console.log(`\nTotal: ${formatBytes(totalSize)} would be freed`);
      }
      
      return;
    }
    
    // Warn if space is running
    if (isRunning && !options.force) {
      console.log(`Space "${pids.spaceName}" is currently running.`);
      
      if (cleanMeup) {
        console.error('Error: Cannot clean .meup directory while space is running.');
        console.error('Use "meup space down" first, or remove --all flag.');
        process.exit(1);
      }
      
      console.log('Warning: This will clean artifacts while space is active.');
      console.log('Use "meup space down" first, or use --force to proceed anyway.');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Continue? (y/N): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
      }
    }
    
    // Confirm destructive operations
    if (cleanMeup && !options.force) {
      console.log('This will remove ALL space artifacts including configuration.');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('Are you sure? (y/N): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
      }
    }
    
    // Perform cleaning
    let cleanedCount = 0;
    let errors = [];
    
    // Clean logs
    if (itemsToClean.logs.length > 0) {
      console.log('Cleaning logs...');
      for (const log of itemsToClean.logs) {
        try {
          fs.unlinkSync(log.path);
          cleanedCount++;
        } catch (error) {
          errors.push(`Failed to delete ${log.name}: ${error.message}`);
        }
      }
      console.log(`✓ Cleaned ${itemsToClean.logs.length} log files`);
    }
    
    // Clean FIFOs (skip active ones)
    if (itemsToClean.fifos.length > 0) {
      const inactiveFifos = itemsToClean.fifos.filter(f => !f.inUse);
      if (inactiveFifos.length > 0) {
        console.log('Cleaning FIFOs...');
        for (const fifo of inactiveFifos) {
          try {
            fs.unlinkSync(fifo.path);
            cleanedCount++;
          } catch (error) {
            errors.push(`Failed to delete ${fifo.name}: ${error.message}`);
          }
        }
        console.log(`✓ Cleaned ${inactiveFifos.length} FIFO pipes`);
      }
      
      const activeFifos = itemsToClean.fifos.filter(f => f.inUse);
      if (activeFifos.length > 0) {
        console.log(`⚠ Skipped ${activeFifos.length} active FIFO pipes`);
      }
    }
    
    // Clean .meup directory
    if (itemsToClean.meup) {
      console.log('Cleaning .meup directory...');
      const meupDir = path.join(spaceDir, '.meup');
      
      // If PM2 daemon is running, try to kill it first
      if (itemsToClean.pm2 && !isRunning) {
        try {
          await connectPM2(spaceDir);
          await new Promise((resolve, reject) => {
            pm2.killDaemon((err) => {
              if (err) reject(err);
              else resolve();
            });
          });
          console.log('✓ Stopped PM2 daemon');
        } catch (error) {
          // Daemon might already be dead
        }
      }
      
      // Remove the directory
      try {
        fs.rmSync(meupDir, { recursive: true, force: true });
        console.log('✓ Cleaned .meup directory');
      } catch (error) {
        errors.push(`Failed to clean .meup directory: ${error.message}`);
      }
    }
    
    // Report results
    if (errors.length > 0) {
      console.log('\n⚠ Some items could not be cleaned:');
      for (const error of errors) {
        console.log(`  - ${error}`);
      }
    }
    
    if (cleanedCount > 0 || itemsToClean.meup) {
      console.log(`\n✓ Cleanup complete! ${totalSize > 0 ? `Freed ${formatBytes(totalSize)}` : ''}`);
    } else {
      console.log('\nNothing to clean.');
    }
    
    // Disconnect from PM2 if we connected
    if (itemsToClean.pm2) {
      disconnectPM2();
    }
  });

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = space;