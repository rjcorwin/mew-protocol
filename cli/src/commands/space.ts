// @ts-nocheck
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { spawn, execSync } = require('child_process');
const net = require('net');
const http = require('http');
const pm2 = require('pm2');
const crypto = require('crypto');

function findMonorepoRoot(startDir) {
  let dir = startDir;
  const root = path.parse(dir).root;

  while (dir && dir !== root) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (
          pkg?.name === 'mew-protocol' &&
          Array.isArray(pkg.workspaces) &&
          pkg.workspaces.some((entry) => String(entry).includes('sdk/typescript-sdk/agent'))
        ) {
          return dir;
        }
      } catch (error) {
        // Ignore parse errors and keep walking up
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

function ensureLocalWorkspaceDependencies(spaceDir) {
  const mewDir = path.join(spaceDir, '.mew');
  const packagePath = path.join(mewDir, 'package.json');

  if (!fs.existsSync(packagePath)) {
    return;
  }

  const repoRoot = findMonorepoRoot(spaceDir);
  if (!repoRoot) {
    return;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    console.warn('⚠ Unable to read .mew/package.json:', error.message);
    return;
  }

  const targets = {
    '@mew-protocol/agent': path.join(repoRoot, 'sdk/typescript-sdk/agent'),
    '@mew-protocol/bridge': path.join(repoRoot, 'bridge'),
    '@mew-protocol/client': path.join(repoRoot, 'sdk/typescript-sdk/client'),
    '@mew-protocol/participant': path.join(repoRoot, 'sdk/typescript-sdk/participant'),
    '@mew-protocol/types': path.join(repoRoot, 'sdk/typescript-sdk/types')
  };

  let changed = false;
  for (const [dep, targetPath] of Object.entries(targets)) {
    if (!packageJson?.dependencies?.[dep]) {
      continue;
    }

    try {
      fs.accessSync(targetPath);
    } catch {
      continue;
    }

    const relativePath = path.relative(mewDir, targetPath) || '.';
    const normalized = relativePath.split(path.sep).join('/');
    const linkSpec = normalized.startsWith('.') ? `link:${normalized}` : `link:./${normalized}`;

    if (packageJson.dependencies[dep] !== linkSpec) {
      packageJson.dependencies[dep] = linkSpec;
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('Linking local MEW workspace packages…');

  try {
    execSync('npm install --loglevel=error', {
      cwd: mewDir,
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('⚠ Failed to reinstall .mew dependencies with local workspace links');
    if (error.message) {
      console.warn('  ', error.message);
    }
  }
}

const space = new Command('space').description('Manage MEW spaces');

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

/**
 * Generate a secure random token
 */
function generateSecureToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Ensure a token exists for a participant, generating if needed
 * @param {string} spaceDir - Directory containing the space
 * @param {string} participantId - Participant ID to get/generate token for
 * @returns {Promise<string>} The token
 */
async function ensureTokenExists(spaceDir, participantId) {
  const tokensDir = path.join(spaceDir, '.mew', 'tokens');
  const tokenPath = path.join(tokensDir, `${participantId}.token`);

  // Check environment variable override first
  const envVarName = `MEW_TOKEN_${participantId.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envVarName]) {
    console.log(`Using token from environment variable ${envVarName}`);
    return process.env[envVarName];
  }

  // Ensure tokens directory exists
  if (!fs.existsSync(tokensDir)) {
    fs.mkdirSync(tokensDir, { recursive: true, mode: 0o700 });

    // Create .gitignore in tokens directory
    const tokenGitignore = path.join(tokensDir, '.gitignore');
    fs.writeFileSync(tokenGitignore, '*\n!.gitignore\n', { mode: 0o600 });
  }

  // Check if token file exists
  if (fs.existsSync(tokenPath)) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    console.log(`Loaded existing token for ${participantId}`);
    return token;
  }

  // Generate new token
  const token = generateSecureToken();
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  console.log(`Generated new token for ${participantId}`);

  return token;
}

/**
 * Load participant tokens from secure storage or generate them
 * @param {string} spaceDir - Directory containing the space
 * @param {object} config - Space configuration
 * @returns {Promise<Map>} Map of participant IDs to tokens
 */
async function loadParticipantTokens(spaceDir, config) {
  const tokenMap = new Map();

  for (const [participantId, participantConfig] of Object.entries(config.participants || {})) {
    // Generate or load token
    const token = await ensureTokenExists(spaceDir, participantId);
    tokenMap.set(participantId, token);
  }

  return tokenMap;
}

// Get path to store running spaces info
function getSpacesFilePath() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const mewDir = path.join(homeDir, '.mew');
  if (!fs.existsSync(mewDir)) {
    fs.mkdirSync(mewDir, { recursive: true });
  }
  return path.join(mewDir, 'running-spaces.json');
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
    const tester = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port);
  });
}

// Find next available port starting from the given port
async function findAvailablePort(startPort, maxTries = 10) {
  let port = parseInt(startPort);
  for (let i = 0; i < maxTries; i++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  return null;
}

// Wait for gateway to be ready
async function waitForGateway(port, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await new Promise((resolve, reject) => {
        http
          .get(`http://localhost:${port}/health`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
          })
          .on('error', reject);
      });

      const health = JSON.parse(response);
      if (health.status === 'ok') {
        return true;
      }
    } catch (error) {
      // Gateway not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
 * Checks .mew/space.yaml first, then falls back to provided path
 */
function loadSpaceConfig(configPath) {
  try {
    let resolvedPath;

    // Check if the path ends with space.yaml (common default)
    if (configPath.endsWith('space.yaml') && !configPath.includes('.mew')) {
      // Extract the directory from the path
      const dir = path.dirname(configPath);
      const mewConfigPath = path.join(dir, '.mew/space.yaml');

      // Check .mew/space.yaml first
      if (fs.existsSync(mewConfigPath)) {
        resolvedPath = mewConfigPath;
      } else if (fs.existsSync(configPath)) {
        // Fall back to the original path
        resolvedPath = configPath;
      } else {
        // Neither exists, try to give a helpful error
        throw new Error(`No space configuration found. Checked:\n  - ${mewConfigPath}\n  - ${configPath}`);
      }
    } else {
      // Use the explicit path provided (e.g., already includes .mew or is absolute)
      resolvedPath = path.resolve(configPath);
    }

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
  const pidDir = path.join(spaceDir, '.mew');
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
  const pidFile = path.join(spaceDir, '.mew', 'pids.json');
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
  const pidFile = path.join(spaceDir, '.mew', 'pids.json');
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

/**
 * Resolve environment variables in an object
 * Replaces ${VAR_NAME} with process.env.VAR_NAME
 */
function resolveEnvVariables(envObj) {
  const resolved = {};
  for (const [key, value] of Object.entries(envObj)) {
    if (typeof value === 'string') {
      // Replace ${VAR_NAME} with actual environment variable value
      resolved[key] = value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return process.env[varName] || match; // Keep original if env var doesn't exist
      });
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
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

// Action handler for space up
async function spaceUpAction(options) {
    // Check for incompatible flags
    if (options.interactive && options.detach) {
      console.error('Error: --interactive and --detach flags are mutually exclusive');
      process.exit(1);
    }
    const spaceDir = path.resolve(options.spaceDir);

    // Construct config path - if options.config is relative, make it relative to spaceDir
    let configPath;
    if (path.isAbsolute(options.config)) {
      configPath = options.config;
    } else {
      configPath = path.join(spaceDir, options.config);
    }

    console.log(`Starting space in ${spaceDir}...`);

    // Load space configuration (will check .mew/space.yaml first)
    const { config, configPath: actualConfigPath } = loadSpaceConfig(configPath);
    // Update configPath to the actual resolved path
    configPath = actualConfigPath;
    const spaceName = config.space?.name || 'unnamed-space';
    const spaceId = config.space?.id || 'space-' + Date.now();

    console.log(`Space: ${spaceName} (${spaceId})`);

    // Ensure existing spaces use local workspaces when running inside the monorepo
    ensureLocalWorkspaceDependencies(spaceDir);

    // Check if space is already running
    const existingPids = loadPidFile(spaceDir);
    if (existingPids && existingPids.gateway && isProcessRunning(existingPids.gateway)) {
      console.error('Space is already running. Run "mew space down" first.');
      process.exit(1);
    }

    // Find available port if the requested one is in use
    let selectedPort = parseInt(options.port);
    const portAvailable = await isPortAvailable(selectedPort);
    if (!portAvailable) {
      console.log(`Port ${selectedPort} is already in use. Finding available port...`);
      selectedPort = await findAvailablePort(selectedPort);
      if (!selectedPort) {
        console.error('Could not find an available port. Please specify a different port with --port');
        process.exit(1);
      }
      console.log(`Using port ${selectedPort}`);
    }

    const pids = {
      spaceId,
      spaceName,
      spaceDir,
      port: selectedPort,
      gateway: null,
      agents: {},
      clients: {},
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

    // IMPORTANT: Load/generate tokens BEFORE starting gateway
    // This ensures both gateway and space.js use the same tokens
    console.log('Loading participant tokens...');
    const tokenMap = await loadParticipantTokens(spaceDir, config);
    console.log('✓ Tokens loaded/generated for all participants');

    // Start gateway using PM2 (it will load the same tokens from disk)
    console.log(`Starting gateway on port ${selectedPort}...`);
    const gatewayLogPath = path.join(logsDir, 'gateway.log');

    try {
      const gatewayApp = await startPM2Process({
        name: `${spaceId}-gateway`,
        script: path.join(__dirname, '../../bin/mew.js'),
        args: [
          'gateway',
          'start',
          '--port',
          selectedPort,
          '--log-level',
          options.logLevel,
          '--space-config',
          configPath,
          '--no-auto-start',
        ],
        cwd: spaceDir,
        autorestart: false,
        max_memory_restart: '500M',
        error_file: path.join(logsDir, 'gateway-error.log'),
        out_file: gatewayLogPath,
        merge_logs: true,
        time: true,
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
    const gatewayReady = await waitForGateway(selectedPort);
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
          '--gateway',
          `ws://localhost:${selectedPort}`,
          '--space',
          spaceId,
          '--participant-id',
          participantId,
          '--token',
          tokenMap.get(participantId),
          '--mcp-command',
          mcpServer.command,
        ];

        // Add MCP args if present
        if (mcpServer.args && mcpServer.args.length > 0) {
          bridgeArgs.push('--mcp-args', mcpServer.args.join(','));
        }

        // Add MCP env if present
        if (mcpServer.env) {
          const envPairs = Object.entries(mcpServer.env)
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
          bridgeArgs.push('--mcp-env', envPairs);
        }

        // Add MCP cwd if present (resolve relative paths)
        if (mcpServer.cwd) {
          // If the cwd is relative, resolve it relative to spaceDir
          const resolvedCwd = path.isAbsolute(mcpServer.cwd)
            ? mcpServer.cwd
            : path.resolve(spaceDir, mcpServer.cwd);
          bridgeArgs.push('--mcp-cwd', resolvedCwd);
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
            bridgeArgs.push(
              '--max-reconnects',
              participant.bridge_config.max_reconnects.toString(),
            );
          }
        }

        if (participant.capabilities && participant.capabilities.length > 0) {
          bridgeArgs.push('--capabilities', JSON.stringify(participant.capabilities));
        }

        try {
          // Find the bridge executable
          const bridgePath = path.resolve(
            __dirname,
            '..',
            '..',
            '..',
            'bridge',
            'bin',
            'mew-bridge.js',
          );

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
              NODE_ENV: process.env.NODE_ENV || 'production',
              ...resolveEnvVariables(participant.env || {})
            },
          });

          pids.agents[participantId] = bridgeApp.pid || bridgeApp.pm2_env?.pm_id || 'unknown';
          console.log(
            `✓ MCP bridge ${participantId} started via PM2 (PID: ${pids.agents[participantId]})`,
          );
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
        const processedArgs = agentArgs.map((arg) =>
          arg
            .replace('${PORT}', selectedPort)
            .replace('${SPACE}', spaceId)
            .replace('${TOKEN}', tokenMap.get(participantId)),
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
            env: {
              ...process.env,  // Inherit all environment variables from current shell
              ...resolveEnvVariables(participant.env || {}),  // Override with any specific env from config
              // Set token as environment variable for participants that read from env
              [`MEW_TOKEN_${participantId.toUpperCase().replace(/-/g, '_')}`]: tokenMap.get(participantId)
            },
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
          console.log(
            `✓ FIFO created: ${participantId}-in (output goes to ${participant.output_log})`,
          );
        }

        // If auto_connect is true, connect the participant
        if (participant.auto_connect === true) {
          console.log(`Connecting ${participantId}...`);

          const clientLogPath = path.join(logsDir, `${participantId}-client.log`);

          // Build client arguments
          const clientArgs = [
            'client',
            'connect',
            '--gateway',
            `ws://localhost:${selectedPort}`,
            '--space',
            spaceId,
            '--participant-id',
            participantId,
            '--token',
            tokenMap.get(participantId),
            '--fifo-in',
            inFifo,
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
              script: path.join(__dirname, '../../bin/mew.js'),
              args: clientArgs,
              cwd: spaceDir,
              autorestart: false,
              error_file: path.join(logsDir, `${participantId}-client-error.log`),
              out_file: clientLogPath,
              merge_logs: true,
              time: true,
            });

            pids.clients[participantId] = clientApp.pid || clientApp.pm2_env?.pm_id || 'unknown';
            console.log(
              `✓ ${participantId} connected via PM2 (PID: ${pids.clients[participantId]})`,
            );
          } catch (error) {
            console.error(`Failed to connect ${participantId}: ${error.message}`);
          }
        }
      }
    }

    // Save PID file
    const pidFile = savePidFile(spaceDir, pids);
    console.log(`\n✓ Space is up! (PID file: ${pidFile})`);
    console.log(`\nGateway: ws://localhost:${selectedPort}`);
    console.log(`Space ID: ${spaceId}`);
    console.log(`\nTo stop: mew down`);

    // Store running space info
    const runningSpaces = loadRunningSpaces();
    runningSpaces.set(spaceDir, pids);
    saveRunningSpaces(runningSpaces);

    // Disconnect from PM2 daemon (it continues running)
    disconnectPM2();

    // If interactive flag is set, connect interactively
    if (options.interactive) {
      console.log('\nConnecting interactively...\n');

      // Import required modules for interactive connection
      const WebSocket = require('ws');
      const {
        resolveParticipant,
        getInteractiveOverrides,
      } = require('../utils/participant-resolver');
      const { printBanner } = require('../utils/banner');

      // Determine UI mode
      const useDebugUI = options.debug || options.simple || options.noUi;
      
      // Import appropriate UI module
      const InteractiveUI = useDebugUI ? 
        require('../utils/interactive-ui') : 
        null;
      const { startAdvancedInteractiveUI } = useDebugUI ? 
        { startAdvancedInteractiveUI: null } : 
        require('../utils/advanced-interactive-ui');

      try {
        // Resolve participant
        const participant = await resolveParticipant({
          participantId: options.participant,
          spaceConfig: config,
          interactive: true,
        });

        console.log(`Connecting as participant: ${participant.id}`);

        // Get interactive overrides
        const participantConfig = getInteractiveOverrides(participant);

        // Get token for this participant
        const token = await ensureTokenExists(spaceDir, participant.id);

        // Connect to gateway
        const ws = new WebSocket(`ws://localhost:${selectedPort}`);

        ws.on('open', () => {
          // Send join message
          const joinMessage = {
            protocol: 'mew/v0.4',
            id: `join-${Date.now()}`,
            ts: new Date().toISOString(),
            kind: 'system/join',
            payload: {
              space: spaceId,
              participant: participant.id,
              token: token,
              capabilities: participantConfig.capabilities || [],
            },
          };

          ws.send(JSON.stringify(joinMessage));

          // Display banner before starting UI
          if (!useDebugUI) {
            printBanner({
              spaceName: spaceName,
              spaceId: spaceId,
              participantId: participant.id,
              gateway: `ws://localhost:${selectedPort}`,
              color: process.env.NO_COLOR !== '1'
            });
          }

          // Start interactive UI
          if (useDebugUI) {
            const ui = new InteractiveUI(ws, participant.id, spaceId);
            ui.start();
          } else {
            startAdvancedInteractiveUI(ws, participant.id, spaceId);
          }
        });

        ws.on('error', (err) => {
          console.error('Failed to connect:', err.message);
          process.exit(1);
        });
      } catch (error) {
        console.error('Failed to resolve participant:', error.message);
        process.exit(1);
      }
    }
}

// Command: mew space up
space
  .command('up')
  .description('Start a space with gateway and configured participants')
  .option('-c, --config <path>', 'Path to space.yaml (default: auto-detect)', './space.yaml')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .option('-p, --port <port>', 'Gateway port', '8080')
  .option('-l, --log-level <level>', 'Log level', 'info')
  .option('-i, --interactive', 'Connect interactively after starting space')
  .option('--detach', 'Run in background (default if not interactive)')
  .option('--participant <id>', 'Connect as this participant (with --interactive)')
  .option('--debug', 'Use simple debug interface instead of advanced UI')
  .option('--simple', 'Alias for --debug')
  .option('--no-ui', 'Disable UI enhancements, use plain interface')
  .action(spaceUpAction);

// Action handler for space down
async function spaceDownAction(options) {
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
    const pm2Dir = path.join(spaceDir, '.mew', 'pm2');
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
}

// Command: mew space down
space
  .command('down')
  .description('Stop a running space')
  .option('-d, --space-dir <path>', 'Space directory', '.')
  .action(spaceDownAction);

// Command: mew space status
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
        const spaceProcesses = processes.filter((p) => p.name && p.name.startsWith(spaceId));

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

// Command: mew space clean
space
  .command('clean')
  .description('Clean up space artifacts (logs, fifos, temporary files)')
  .option('--all', 'Clean everything including .mew directory')
  .option('--logs', 'Clean only log files')
  .option('--fifos', 'Clean only FIFO pipes')
  .option('--force', 'Skip confirmation prompts')
  .option('--dry-run', 'Show what would be cleaned without doing it')
  .action(async (options) => {
    const spaceDir = process.cwd();

    // Check for space configuration (.mew/space.yaml first, then space.yaml)
    let spaceConfigPath = path.join(spaceDir, '.mew/space.yaml');
    if (!fs.existsSync(spaceConfigPath)) {
      spaceConfigPath = path.join(spaceDir, 'space.yaml');
      if (!fs.existsSync(spaceConfigPath)) {
        console.error('Error: No space configuration found.');
        console.error('Checked: .mew/space.yaml and space.yaml');
        console.error('Run "mew init" to create a new space.');
        process.exit(1);
      }
    }

    // Check if space is running
    const pids = loadPidFile(spaceDir);
    const isRunning = pids && pids.gateway && isProcessRunning(pids.gateway);

    // Collect items to clean
    const itemsToClean = {
      logs: [],
      fifos: [],
      mew: false,
      pm2: false,
    };

    // Determine what to clean based on options
    const cleanLogs = options.logs || (!options.fifos && !options.all) || options.all;
    const cleanFifos = options.fifos || (!options.logs && !options.all) || options.all;
    const cleanMew = options.all;

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
              name: file,
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
              inUse,
            });
          }
        }
      }
    }

    // Check .mew directory
    if (cleanMew) {
      const mewDir = path.join(spaceDir, '.mew');
      if (fs.existsSync(mewDir)) {
        itemsToClean.mew = true;
        // Check for PM2 directory
        const pm2Dir = path.join(mewDir, 'pm2');
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
        const activeFifos = itemsToClean.fifos.filter((f) => f.inUse);
        const inactiveFifos = itemsToClean.fifos.filter((f) => !f.inUse);
        if (inactiveFifos.length > 0) {
          console.log(`  - ${inactiveFifos.length} FIFO pipes (inactive)`);
        }
        if (activeFifos.length > 0) {
          console.log(`  - ${activeFifos.length} FIFO pipes (ACTIVE - will be skipped)`);
        }
      }

      if (itemsToClean.mew) {
        console.log('  - .mew directory (including process state)');
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

      if (cleanMew) {
        console.error('Error: Cannot clean .mew directory while space is running.');
        console.error('Use "mew space down" first, or remove --all flag.');
        process.exit(1);
      }

      console.log('Warning: This will clean artifacts while space is active.');
      console.log('Use "mew space down" first, or use --force to proceed anyway.');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        rl.question('Continue? (y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    // Confirm destructive operations
    if (cleanMew && !options.force) {
      console.log('This will remove ALL space artifacts including configuration.');

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
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
      const inactiveFifos = itemsToClean.fifos.filter((f) => !f.inUse);
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

      const activeFifos = itemsToClean.fifos.filter((f) => f.inUse);
      if (activeFifos.length > 0) {
        console.log(`⚠ Skipped ${activeFifos.length} active FIFO pipes`);
      }
    }

    // Clean .mew directory
    if (itemsToClean.mew) {
      console.log('Cleaning .mew directory...');
      const mewDir = path.join(spaceDir, '.mew');

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
        fs.rmSync(mewDir, { recursive: true, force: true });
        console.log('✓ Cleaned .mew directory');
      } catch (error) {
        errors.push(`Failed to clean .mew directory: ${error.message}`);
      }
    }

    // Report results
    if (errors.length > 0) {
      console.log('\n⚠ Some items could not be cleaned:');
      for (const error of errors) {
        console.log(`  - ${error}`);
      }
    }

    if (cleanedCount > 0 || itemsToClean.mew) {
      console.log(
        `\n✓ Cleanup complete! ${totalSize > 0 ? `Freed ${formatBytes(totalSize)}` : ''}`,
      );
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

// Command: mew space connect
space
  .command('connect')
  .description('Connect interactively to a running space')
  .option('-c, --config <path>', 'Path to space.yaml (default: auto-detect)', './space.yaml')
  .option('-d, --space-dir <path>', 'Directory of space to connect to', '.')
  .option('--participant <id>', 'Connect as this participant')
  .option('--gateway <url>', 'Override gateway URL (default: from running space)')
  .option('--debug', 'Use simple debug interface instead of advanced UI')
  .option('--simple', 'Alias for --debug')
  .option('--no-ui', 'Disable UI enhancements, use plain interface')
  .action(async (options) => {
    const spaceDir = path.resolve(options.spaceDir);
    const configPath = path.join(spaceDir, path.basename(options.config));

    console.log(`Connecting to space in ${spaceDir}...`);

    // Check if space is running
    const pids = loadPidFile(spaceDir);
    if (!pids) {
      console.error('No running space found. Use "mew space up" first.');
      process.exit(1);
    }

    // Load space configuration
    const { config } = loadSpaceConfig(configPath);
    const spaceId = pids.spaceId;
    const gatewayUrl = options.gateway || `ws://localhost:${pids.port}`;

    console.log(`Space: ${pids.spaceName} (${spaceId})`);
    console.log(`Gateway: ${gatewayUrl}`);

    // Import required modules
    const WebSocket = require('ws');
    const {
      resolveParticipant,
      getInteractiveOverrides,
    } = require('../utils/participant-resolver');
    const { printBanner } = require('../utils/banner');

    // Determine UI mode
    const useDebugUI = options.debug || options.simple || options.noUi;
    
    // Import appropriate UI module
    const InteractiveUI = useDebugUI ? 
      require('../utils/interactive-ui') : 
      null;
    const { startAdvancedInteractiveUI } = useDebugUI ? 
      { startAdvancedInteractiveUI: null } : 
      require('../utils/advanced-interactive-ui');

    try {
      // Resolve participant
      const participant = await resolveParticipant({
        participantId: options.participant,
        spaceConfig: config,
        interactive: true,
      });

      console.log(`Connecting as participant: ${participant.id}\n`);

      // Get interactive overrides
      const participantConfig = getInteractiveOverrides(participant);

      // Get token for this participant
      const token = await ensureTokenExists(spaceDir, participant.id);

      // Connect to gateway
      const ws = new WebSocket(gatewayUrl);

      ws.on('open', () => {
        // Send join message
        const joinMessage = {
          protocol: 'mew/v0.4',
          id: `join-${Date.now()}`,
          ts: new Date().toISOString(),
          kind: 'system/join',
          payload: {
            space: spaceId,
            participant: participant.id,
            token: token,
            capabilities: participantConfig.capabilities || [],
          },
        };

        ws.send(JSON.stringify(joinMessage));

        // Display banner before starting UI
        if (!useDebugUI) {
          printBanner({
            spaceName: pids.spaceName,
            spaceId: spaceId,
            participantId: participant.id,
            gateway: gatewayUrl,
            color: process.env.NO_COLOR !== '1'
          });
        }

        // Start interactive UI
        if (useDebugUI) {
          const ui = new InteractiveUI(ws, participant.id, spaceId);
          ui.start();
        } else {
          startAdvancedInteractiveUI(ws, participant.id, spaceId);
        }
      });

      ws.on('error', (err) => {
        console.error('Failed to connect:', err.message);
        console.error('Make sure the space is running with "mew space up"');
        process.exit(1);
      });

      ws.on('close', () => {
        console.log('\nConnection closed');
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to resolve participant:', error.message);
      process.exit(1);
    }
  });

// Export both the command and the action handlers
module.exports = space;
module.exports.spaceUpAction = spaceUpAction;
module.exports.spaceDownAction = spaceDownAction;
