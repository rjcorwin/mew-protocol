#!/usr/bin/env node
/**
 * Example: Async Calculator Client using promise-based requests
 * Demonstrates promise-based MCP tool calling with MEUPParticipant
 */

const path = require('path');

// Import the participant SDK (after building)
const participantPath = path.resolve(__dirname, '../dist/index.js');
const { MEUPParticipant } = require(participantPath);

class CalculatorClient extends MEUPParticipant {
  constructor(options) {
    super(options);
  }
  
  async onReady() {
    console.log('Calculator client ready!');
    console.log('Capabilities:', this.participantInfo?.capabilities);
    
    // Start demonstration after a short delay
    setTimeout(() => this.runDemo(), 1000);
  }
  
  async runDemo() {
    console.log('\n=== Promise-based MCP Tool Calling Demo ===\n');
    
    try {
      // Test 1: Simple addition
      console.log('Test 1: Adding 5 + 3...');
      const result1 = await this.request('calculator-agent', 'tools/call', {
        name: 'add',
        arguments: { a: 5, b: 3 }
      });
      console.log('Result:', this.extractResult(result1)); // Should be 8
      
      // Test 2: Multiplication
      console.log('\nTest 2: Multiplying 7 × 9...');
      const result2 = await this.request('calculator-agent', 'tools/call', {
        name: 'multiply', 
        arguments: { a: 7, b: 9 }
      });
      console.log('Result:', this.extractResult(result2)); // Should be 63
      
      // Test 3: Expression evaluation
      console.log('\nTest 3: Evaluating (10 + 5) / 3...');
      const result3 = await this.request('calculator-agent', 'tools/call', {
        name: 'evaluate',
        arguments: { expression: '(10 + 5) / 3' }
      });
      console.log('Result:', this.extractResult(result3)); // Should be 5
      
      // Test 4: Multiple parallel requests
      console.log('\nTest 4: Running 3 calculations in parallel...');
      const [r1, r2, r3] = await Promise.all([
        this.request('calculator-agent', 'tools/call', {
          name: 'add',
          arguments: { a: 1, b: 1 }
        }),
        this.request('calculator-agent', 'tools/call', {
          name: 'multiply',
          arguments: { a: 2, b: 3 }
        }),
        this.request('calculator-agent', 'tools/call', {
          name: 'evaluate',
          arguments: { expression: '100 / 10' }
        })
      ]);
      
      console.log('Parallel results:');
      console.log('  1 + 1 =', this.extractResult(r1));
      console.log('  2 × 3 =', this.extractResult(r2)); 
      console.log('  100 ÷ 10 =', this.extractResult(r3));
      
      // Test 5: Error handling
      console.log('\nTest 5: Testing error handling...');
      try {
        await this.request('calculator-agent', 'tools/call', {
          name: 'nonexistent-tool',
          arguments: {}
        });
      } catch (error) {
        console.log('Caught expected error:', error.message);
      }
      
      console.log('\n=== Demo completed successfully! ===');
      
    } catch (error) {
      console.error('Demo failed:', error);
    }
  }
  
  // Helper to extract result text from MCP content format
  extractResult(mcpResult) {
    if (mcpResult.content && mcpResult.content[0]?.text) {
      return mcpResult.content[0].text;
    }
    return mcpResult;
  }
  
  async onShutdown() {
    console.log('Calculator client shutting down...');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  token: 'client-token',
  participant_id: 'calculator-client'
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
    options.participant_id = args[i + 1];
    i++;
  }
}

// Create and start the client
const client = new CalculatorClient(options);

console.log(`Starting calculator client...`);
console.log(`Gateway: ${options.gateway}`);
console.log(`Space: ${options.space}`);

client.connect()
  .then(() => {
    console.log('Calculator client connected successfully');
  })
  .catch(error => {
    console.error('Failed to connect:', error);
    process.exit(1);
  });

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  client.disconnect();
  process.exit(0);
});