const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
let messageCount = 0;

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    protocol: 'mew/v0.3',
    kind: 'system/join',
    token: 'human-token',
    space: 'coder-demo',
    participant_id: 'test-human-2'
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  messageCount++;
  
  if (msg.kind === 'system/welcome') {
    console.log('Joined space, sending test message...');
    setTimeout(() => {
      ws.send(JSON.stringify({
        protocol: 'mew/v0.3',
        id: 'test-1',
        from: 'test-human-2',
        ts: new Date().toISOString(),
        kind: 'chat',
        payload: { text: 'Hello agent! Are you there?' }
      }));
    }, 1000);
  } else if (msg.kind === 'chat' && msg.from === 'coder-agent') {
    console.log('Agent responded:', msg.payload.text);
    ws.close();
    process.exit(0);
  } else if (msg.kind === 'reasoning/start') {
    console.log('Agent is thinking...');
  } else if (msg.kind === 'mcp/proposal') {
    console.log('Agent created proposal');
  }
});

setTimeout(() => {
  console.log(`Timeout - received ${messageCount} messages but no chat response from agent`);
  ws.close();
  process.exit(1);
}, 8000);
