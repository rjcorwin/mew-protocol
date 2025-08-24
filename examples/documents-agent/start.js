#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'bridge-config.json');
const CONFIG_EXAMPLE_FILE = path.join(__dirname, 'bridge-config.example.json');
const BRIDGE_PATH = path.join(__dirname, '../../packages/bridge');

async function generateToken() {
  console.log('Generating authentication token...');
  
  // If config doesn't exist, create from example
  if (!fs.existsSync(CONFIG_FILE)) {
    if (!fs.existsSync(CONFIG_EXAMPLE_FILE)) {
      console.error('bridge-config.example.json not found!');
      process.exit(1);
    }
    console.log('Creating bridge-config.json from example...');
    fs.copyFileSync(CONFIG_EXAMPLE_FILE, CONFIG_FILE);
  }
  
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  
  try {
    const response = await fetch(`${config.mcpx.server.replace('ws:', 'http:')}/v0/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participantId: config.participant.id,
        topic: config.mcpx.topic
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate token: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Update config with token
    config.mcpx.token = data.token;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    
    console.log('✓ Token generated successfully');
    return true;
  } catch (error) {
    console.error('Failed to generate token:', error.message);
    console.error('Make sure the MCPx gateway is running (npm run dev:gateway)');
    return false;
  }
}

async function startBridge() {
  console.log('Starting Documents Agent Bridge...');
  console.log('Documents folder: ./documents');
  console.log('');
  
  // Generate fresh token
  if (!await generateToken()) {
    process.exit(1);
  }
  
  // Start the bridge
  const bridge = spawn('node', [path.join(BRIDGE_PATH, 'dist/cli.js'), 'start', '--config', CONFIG_FILE], {
    cwd: BRIDGE_PATH,
    stdio: 'inherit',
    shell: true
  });
  
  bridge.on('error', (error) => {
    console.error('Failed to start bridge:', error);
    process.exit(1);
  });
  
  bridge.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Bridge exited with code ${code}`);
    }
    process.exit(code);
  });
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    bridge.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    bridge.kill('SIGTERM');
  });
}

// Check if filesystem MCP server is installed
try {
  require.resolve('@modelcontextprotocol/server-filesystem');
} catch (e) {
  console.error('Installing @modelcontextprotocol/server-filesystem...');
  const { execSync } = require('child_process');
  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
}

startBridge();