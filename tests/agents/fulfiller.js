#!/usr/bin/env node
/**
 * Fulfiller Agent - Auto-fulfills MCP proposals
 * For MEUP v0.2 test scenarios
 */

const path = require('path');

// Import MEUPClient from the SDK
const clientPath = path.resolve(__dirname, '../../sdk/typescript-sdk/client/dist/index.js');
const { MEUPClient } = require(clientPath);

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

// Track pending fulfillments to correlate responses
const pendingFulfillments = new Map(); // request_id -> original_proposal_from

// Create MEUP client
const client = new MEUPClient({
  gateway: options.gateway,
  space: options.space,
  token: options.token,
  participant_id: participantId,
  capabilities: [],
  reconnect: true
});

console.log(`Fulfiller agent connecting to ${options.gateway}...`);

// Track if we've sent the initial join message
let joined = false;

// Handle connection events
client.onConnected(() => {
  console.log('Fulfiller agent connected to gateway');
  
  // For compatibility with the gateway, send a join message
  if (!joined) {
    client.send({
      type: 'join',
      participantId: participantId,
      space: options.space,
      token: options.token
    });
    joined = true;
  }
});

// Connect to gateway
client.connect()
  .catch((error) => {
    console.error('Failed to connect:', error);
    process.exit(1);
  });

// Handle incoming messages
client.onMessage((message) => {
  try {
    
    // Auto-fulfill any MCP proposal we see
    if (message.kind === 'mcp/proposal' && message.from !== participantId) {
      console.log(`Saw proposal from ${message.from}, auto-fulfilling...`);
      console.log(`Proposal details: ${JSON.stringify(message)}`);
      
      // Extract the proposal details from the nested structure
      const proposal = message.payload?.proposal;
      if (!proposal) {
        console.log('No proposal data found in message');
        return;
      }
      
      // Convert proposal to MCP request based on proposal type
      let method, params;
      
      if (proposal.type === 'calculation') {
        // Map calculation operations to calculator tool names
        const toolName = proposal.operation; // 'add', 'multiply', etc.
        method = 'tools/call';
        params = {
          name: toolName,
          arguments: proposal.arguments || {}
        };
      } else {
        // For other proposal types, try to use them directly
        method = proposal.method || 'tools/call';
        params = proposal.params || proposal.arguments || {};
      }
      
      // Create fulfillment request with correlation to the proposal
      // If the proposal has no target, send to calculator-agent
      const target = message.to || ['calculator-agent'];
      const fulfillmentRequest = {
        id: `fulfill-${Date.now()}`,
        kind: 'mcp/request',
        to: target,
        correlation_id: [message.id], // Reference the proposal
        payload: {
          jsonrpc: '2.0',
          id: Date.now(),
          method: method,
          params: params
        }
      };
      
      // Wait a moment to simulate review, then fulfill
      setTimeout(() => {
        // Track who requested this so we can forward the response
        pendingFulfillments.set(fulfillmentRequest.payload.id, message.from);
        
        client.send(fulfillmentRequest);
        console.log(`Fulfilled proposal ${message.id} with method ${method}`);
      }, 500);
    } else if (message.kind === 'mcp/proposal') {
      console.log(`Ignoring own proposal: ${message.id}`);
    }
    
    // Handle MCP responses and forward results to original proposer
    if (message.kind === 'mcp/response' && message.from === 'calculator-agent') {
      const responsePayload = message.payload;
      const requestId = responsePayload?.id;
      
      // Check if this is a response to one of our fulfillments
      if (requestId && pendingFulfillments.has(requestId)) {
        const originalProposer = pendingFulfillments.get(requestId);
        pendingFulfillments.delete(requestId);
        
        // Extract the actual result text from the MCP response
        let resultText = 'Error: Unknown result';
        if (responsePayload.result?.content?.[0]?.text) {
          resultText = responsePayload.result.content[0].text;
        } else if (responsePayload.error) {
          resultText = `Error: ${responsePayload.error.message || 'Unknown error'}`;
        }
        
        // Forward the result as a chat message to the original proposer
        const resultMessage = {
          kind: 'chat',
          to: [originalProposer],
          payload: {
            text: resultText,
            format: 'plain'
          }
        };
        
        client.send(resultMessage);
        console.log(`Forwarded result to ${originalProposer}: ${JSON.stringify(responsePayload.result)}`);
      }
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

client.onError((error) => {
  console.error('Client error:', error);
});

client.onDisconnected(() => {
  console.log('Fulfiller agent disconnected from gateway');
  process.exit(0);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down fulfiller agent...');
  client.disconnect();
  process.exit(0);
});