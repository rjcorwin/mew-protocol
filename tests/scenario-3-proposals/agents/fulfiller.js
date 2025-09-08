#!/usr/bin/env node
/**
 * Fulfiller Agent - Auto-fulfills MCP proposals
 * For MEUP v0.2 test scenarios
 */

const WebSocket = require('ws');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'test-space',
  token: 'fulfiller-token'
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
  }
}

const participantId = 'fulfiller-agent';

console.log(`Fulfiller agent connecting to ${options.gateway}...`);

const ws = new WebSocket(options.gateway);

ws.on('open', () => {
  console.log('Fulfiller agent connected to gateway');
  
  // Send join message (gateway-specific)
  ws.send(JSON.stringify({
    type: 'join',
    participantId: participantId,
    space: options.space,
    token: options.token
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    // Auto-fulfill any MCP proposal we see
    if (message.kind === 'mcp/proposal' && message.from !== participantId) {
      console.log(`Saw proposal from ${message.from}, auto-fulfilling...`);
      console.log(`Proposal details: ${JSON.stringify(message)}`);
      
      // Extract the proposal details
      const proposal = message.payload?.proposal || {};
      
      // Handle calculation proposals
      if (proposal.type === 'calculation') {
        const operation = proposal.operation;
        const args = proposal.arguments || {};
        
        // Map operation to calculator tool name
        let toolName = operation; // add, multiply, etc.
        
        // Create fulfillment request to calculator
        const fulfillmentRequest = {
          id: `fulfill-${Date.now()}`,
          kind: 'mcp/request',
          to: ['calculator-agent'],
          correlation_id: [message.id], // Reference the proposal
          payload: {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args
            }
          }
        };
        
        // Wait a moment to simulate review, then fulfill
        setTimeout(() => {
          ws.send(JSON.stringify(fulfillmentRequest));
          console.log(`Fulfilled proposal ${message.id} with tool ${toolName}`);
        }, 500);
      } else {
        // Unknown proposal type
        const errorResponse = {
          id: `error-${Date.now()}`,
          kind: 'mcp/proposal',
          to: [message.from],
          correlation_id: [message.id],
          payload: {
            error: 'Unknown proposal type: ' + proposal.type
          }
        };
        ws.send(JSON.stringify(errorResponse));
        console.log(`Rejected unknown proposal type: ${proposal.type}`);
      }
    } else if (message.kind === 'mcp/proposal') {
      console.log(`Ignoring own proposal: ${message.id}`);
    } else if (message.kind === 'mcp/response' && message.correlation_id) {
      // Forward calculator responses back to proposer
      console.log(`Received response from calculator, forwarding to proposer`);
      const proposalResponse = {
        id: `response-${Date.now()}`,
        kind: 'mcp/proposal',
        to: ['proposer'],
        correlation_id: message.correlation_id,
        payload: {
          type: 'fulfillment',
          result: message.payload?.result
        }
      };
      ws.send(JSON.stringify(proposalResponse));
      console.log(`Forwarded response to proposer`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Fulfiller agent disconnected from gateway');
  process.exit(0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down fulfiller agent...');
  ws.close();
  process.exit(0);
});