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
 */
function createFifos(spaceDir, participantId) {
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
    if (!fs.existsSync(inFifo)) {
      execSync(`mkfifo "${inFifo}"`);
    }
    if (!fs.existsSync(outFifo)) {
      execSync(`mkfifo "${outFifo}"`);
    }
  } catch (error) {
    console.error(`Failed to create FIFOs: ${error.message}`);
    throw error;
  }
  
  return { inFifo, outFifo };
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
      
      pids.gateway = gatewayApp.process.pid || gatewayApp.pm2_env.pm_id;
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
    
    // Start agents with auto_start: true
    for (const [participantId, participant] of Object.entries(config.participants || {})) {
      if (participant.auto_start && participant.command) {
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
          
          pids.agents[participantId] = agentApp.process.pid || agentApp.pm2_env.pm_id;
          console.log(`✓ ${participantId} started via PM2 (PID: ${pids.agents[participantId]})`);
        } catch (error) {
          console.error(`Failed to start ${participantId}: ${error.message}`);
        }
      }
      
      // Create FIFOs for participants with fifo: true
      if (participant.fifo === true) {
        console.log(`Creating FIFOs for ${participantId}...`);
        const { inFifo, outFifo } = createFifos(spaceDir, participantId);
        console.log(`✓ FIFOs created: ${participantId}-in, ${participantId}-out`);
        
        // If auto_connect is true, connect the participant
        if (participant.auto_connect === true) {
          console.log(`Connecting ${participantId} via FIFO...`);
          
          const clientLogPath = path.join(logsDir, `${participantId}-client.log`);
          
          try {
            const clientApp = await startPM2Process({
              name: `${spaceId}-${participantId}-client`,
              script: path.join(__dirname, '../../bin/meup.js'),
              args: [
                'client',
                'connect',
                '--gateway', `ws://localhost:${options.port}`,
                '--space', spaceId,
                '--participant-id', participantId,
                '--token', participant.tokens?.[0] || 'token',
                '--fifo-in', inFifo,
                '--fifo-out', outFifo
              ],
              cwd: spaceDir,
              autorestart: false,
              error_file: path.join(logsDir, `${participantId}-client-error.log`),
              out_file: clientLogPath,
              merge_logs: true,
              time: true
            });
            
            pids.clients[participantId] = clientApp.process.pid || clientApp.pm2_env.pm_id;
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

module.exports = space;