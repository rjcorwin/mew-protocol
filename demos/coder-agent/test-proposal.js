const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080?space=coder-demo', {
  headers: {
    Authorization: 'Bearer human-token'
  }
});

let proposalSeen = false;

ws.on('open', () => {
  console.log('Connected as human');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  // Skip system messages
  if (msg.kind === 'system/welcome' || msg.kind === 'system/presence') {
    return;
  }
  
  // Look for proposals
  if (msg.kind === 'mcp/proposal') {
    console.log('\n===== PROPOSAL RECEIVED =====');
    console.log('From:', msg.from);
    console.log('To:', msg.to || '(NOT SPECIFIED - BROADCAST)');
    console.log('Method:', msg.payload?.method);
    console.log('Full proposal:', JSON.stringify(msg, null, 2));
    proposalSeen = true;
    
    // Check if 'to' field is present
    if (msg.to && msg.to.includes('mcp-fs-bridge')) {
      console.log('✓ Proposal correctly addressed to mcp-fs-bridge');
    } else {
      console.log('✗ Proposal missing correct addressing to mcp-fs-bridge');
    }
  }
  
  // Send chat message after welcome
  if (msg.kind === 'system/welcome') {
    setTimeout(() => {
      const chatMsg = {
        kind: 'chat',
        to: ['coder-agent'],
        payload: {
          text: 'Can you list the files in the workspace directory?'
        }
      };
      console.log('\nSending chat to coder-agent:', chatMsg.payload.text);
      ws.send(JSON.stringify(chatMsg));
      
      // Wait for responses
      setTimeout(() => {
        if (!proposalSeen) {
          console.log('\n✗ No proposal seen within timeout');
        }
        ws.close();
        process.exit(0);
      }, 5000);
    }, 500);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});
