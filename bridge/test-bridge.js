#!/usr/bin/env node
/**
 * Test script for MCP Bridge with MEUPClient and MEUPParticipant
 */

const { MCPBridge } = require('./src/index');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  participantId: 'mcp-bridge-test',
  token: 'bridge-token',
  mcpServer: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    env: process.env
  }
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gateway' || args[i] === '-g') {
    options.gateway = args[i + 1];
    i++;
  } else if (args[i] === '--space' || args[i] === '-s') {
    options.space = args[i + 1];
    i++;
  } else if (args[i] === '--token' || args[i] === '-t') {
    options.token = args[i + 1];
    i++;
  } else if (args[i] === '--id') {
    options.participantId = args[i + 1];
    i++;
  } else if (args[i] === '--mcp-command') {
    options.mcpServer.command = args[i + 1];
    i++;
  } else if (args[i] === '--mcp-args') {
    // Parse comma-separated args
    options.mcpServer.args = args[i + 1].split(',');
    i++;
  }
}

async function testBridge() {
  console.log('Testing MCP Bridge implementation...');
  console.log('Options:', options);
  
  try {
    console.log('Creating MCP Bridge (MEUPParticipant-based)...');
    const bridge = new MCPBridge(options);
    
    // Start the bridge
    console.log('Starting bridge...');
    await bridge.start();
    
    console.log('Bridge started successfully!');
    console.log('Press Ctrl+C to stop...');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down bridge...');
      await bridge.shutdown();
      process.exit(0);
    });
    
    // Keep process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('Failed to start bridge:', error);
    process.exit(1);
  }
}

// Run the test
testBridge();