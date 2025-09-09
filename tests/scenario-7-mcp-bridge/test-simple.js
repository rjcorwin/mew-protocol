const WebSocket = require('ws');
const port = process.argv[2];
const ws = new WebSocket(\`ws://localhost:\${port}\`);

ws.on('open', () => {
  console.log('Connected, sending join...');
  ws.send(JSON.stringify({
    protocol: 'meup/v0.2',
    kind: 'system/join',
    payload: {
      space: 'scenario-7',
      participantId: 'test-client',
      token: 'test-token'
    },
    ts: new Date().toISOString()
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log(\`Received: \${msg.kind}\`);
  
  if (msg.kind === 'system/welcome') {
    console.log('Authenticated! Sending MCP request...');
    
    // Send MCP request after a short delay
    setTimeout(() => {
      const request = {
        protocol: 'meup/v0.2',
        kind: 'mcp/request',
        id: \`req-\${Date.now()}\`,
        from: 'test-client',
        to: ['filesystem'],
        payload: {
          method: 'tools/list',
          params: {}
        },
        ts: new Date().toISOString()
      };
      console.log('Sending:', JSON.stringify(request, null, 2));
      ws.send(JSON.stringify(request));
    }, 2000);
  }
  
  if (msg.kind === 'mcp/response') {
    console.log('SUCCESS! Got MCP response:', JSON.stringify(msg.payload, null, 2));
    process.exit(0);
  }
});

setTimeout(() => {
  console.log('TIMEOUT - No response received');
  process.exit(1);
}, 10000);
