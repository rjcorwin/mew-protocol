#!/usr/bin/env node

/**
 * MCP Calculator Client Demo
 * Demonstrates how an AI host would interact with the calculator server
 */

const { spawn } = require('child_process');
const readline = require('readline');

class MCPCalculatorClient {
  constructor() {
    this.messageId = 0;
    this.pendingRequests = new Map();
    
    // Start the calculator server as a subprocess
    this.server = spawn('node', ['calculator-server.js'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });
    
    // Set up readline for server output
    this.rl = readline.createInterface({
      input: this.server.stdout,
      terminal: false
    });
    
    this.rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        this.handleResponse(message);
      } catch (error) {
        console.error('Failed to parse server response:', error);
      }
    });
    
    this.server.on('error', (error) => {
      console.error('Server error:', error);
    });
    
    this.server.on('close', (code) => {
      console.log(`Server exited with code ${code}`);
      process.exit(code);
    });
  }

  async sendRequest(method, params = {}) {
    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  handleResponse(message) {
    const { id, result, error } = message;
    
    if (id && this.pendingRequests.has(id)) {
      const { resolve, reject } = this.pendingRequests.get(id);
      this.pendingRequests.delete(id);
      
      if (error) {
        reject(new Error(error.message));
      } else {
        resolve(result);
      }
    }
  }

  async initialize() {
    console.log('🚀 Initializing MCP connection...');
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'demo-client',
        version: '1.0.0'
      }
    });
    console.log('✅ Server initialized:', result.serverInfo);
    return result;
  }

  async listTools() {
    console.log('\n📋 Listing available tools...');
    const result = await this.sendRequest('tools/list');
    console.log('Available tools:');
    result.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    return result.tools;
  }

  async callTool(name, args) {
    console.log(`\n🔧 Calling tool '${name}' with arguments:`, args);
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    return result;
  }

  async simulateConversation() {
    console.log('\n' + '='.repeat(60));
    console.log('SIMULATING AI CONVERSATION');
    console.log('='.repeat(60));
    
    // User asks a question
    console.log('\n👤 User: "What\'s 41 + 1?"');
    console.log('\n🤖 AI: Let me calculate that for you...');
    
    // AI uses the calculator tool
    const result = await this.callTool('calculate', {
      expression: '41 + 1'
    });
    
    const answer = result.content[0].text;
    console.log(`\n✨ Tool returned: ${answer}`);
    console.log(`\n🤖 AI: 41 + 1 equals ${answer}`);
    
    // Try a more complex calculation
    console.log('\n' + '-'.repeat(40));
    console.log('\n👤 User: "What\'s 2 to the power of 10?"');
    console.log('\n🤖 AI: I\'ll calculate that using the advanced calculator...');
    
    const powerResult = await this.callTool('calculate_advanced', {
      operation: 'power',
      operands: [2, 10]
    });
    
    const powerAnswer = powerResult.content[0].text;
    console.log(`\n✨ Tool returned: ${powerAnswer}`);
    console.log(`\n🤖 AI: 2 to the power of 10 is ${powerAnswer}`);
  }

  async run() {
    try {
      await this.initialize();
      await this.listTools();
      await this.simulateConversation();
      
      console.log('\n' + '='.repeat(60));
      console.log('Demo completed successfully!');
      console.log('='.repeat(60));
      
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  }
}

// Run the demo
const client = new MCPCalculatorClient();
client.run();