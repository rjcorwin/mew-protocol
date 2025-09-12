#!/bin/bash

# Test script that properly fulfills proposals by sending to the correct participant

echo "Testing proper proposal fulfillment..."

# Connect as a human with full capabilities
cat > test-fulfillment.js << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080?space=coder-demo', {
  headers: {
    Authorization: 'Bearer human-token'
  }
});

let proposalToFulfill = null;

ws.on('open', () => {
  console.log('Connected as human');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  // Skip system messages
  if (msg.kind === 'system/welcome' || msg.kind === 'system/presence') {
    if (msg.kind === 'system/welcome') {
      // Send chat message after welcome
      setTimeout(() => {
        const chatMsg = {
          kind: 'chat',
          to: ['coder-agent'],
          payload: {
            text: 'Please list the files in the workspace directory'
          }
        };
        console.log('\nSending request to coder-agent:', chatMsg.payload.text);
        ws.send(JSON.stringify(chatMsg));
      }, 500);
    }
    return;
  }
  
  console.log(`\n[${new Date(msg.ts).toLocaleTimeString()}] ← ${msg.from} ${msg.kind}`);
  
  // Look for proposals from coder-agent
  if (msg.kind === 'mcp/proposal' && msg.from === 'coder-agent') {
    console.log('PROPOSAL RECEIVED:');
    console.log('  From:', msg.from);
    console.log('  To:', msg.to ? msg.to.join(', ') : '(broadcast)');
    console.log('  Method:', msg.payload?.method);
    console.log('  Tool:', msg.payload?.params?.name);
    
    proposalToFulfill = msg;
    
    // Automatically fulfill the proposal after a short delay
    setTimeout(() => {
      if (proposalToFulfill) {
        // Extract the target participant from the proposal's 'to' field
        const targetParticipant = proposalToFulfill.to?.[0] || 'mcp-fs-bridge';
        
        const fulfillmentMsg = {
          kind: 'mcp/request',
          to: [targetParticipant], // Send to the correct participant!
          correlation_id: [proposalToFulfill.id],
          payload: {
            jsonrpc: '2.0',
            id: Date.now(),
            method: proposalToFulfill.payload.method,
            params: proposalToFulfill.payload.params
          }
        };
        
        console.log(`\nFULFILLING PROPOSAL by sending to ${targetParticipant}:`);
        console.log('  Correlation ID:', proposalToFulfill.id);
        console.log('  Target:', targetParticipant);
        ws.send(JSON.stringify(fulfillmentMsg));
      }
    }, 1000);
  }
  
  // Show MCP responses
  if (msg.kind === 'mcp/response') {
    console.log('RESPONSE RECEIVED:');
    console.log('  From:', msg.from);
    console.log('  Correlation:', msg.correlation_id?.[0]);
    
    if (msg.payload.result) {
      const content = msg.payload.result.content;
      if (content && Array.isArray(content)) {
        console.log('  Result:', content.map(c => c.text).join('\n'));
      }
    } else if (msg.payload.error) {
      console.log('  Error:', msg.payload.error.message);
    }
  }
  
  // Show chat responses
  if (msg.kind === 'chat' && msg.from === 'coder-agent') {
    console.log('AGENT RESPONSE:', msg.payload.text);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

// Keep running for 10 seconds to see the full flow
setTimeout(() => {
  console.log('\n✓ Test complete');
  ws.close();
  process.exit(0);
}, 10000);
EOF

# Run the test
echo "Starting test..."
node test-fulfillment.js

# Cleanup
rm -f test-fulfillment.js

echo "Test complete"