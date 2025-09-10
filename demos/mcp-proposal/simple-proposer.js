#!/usr/bin/env node
/**
 * Simple MCP Proposer Agent (without SDK)
 * 
 * Suggests MCP operations like reading files that require human approval.
 * Demonstrates the MEW v0.3 proposal/approval workflow.
 */

const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'proposal-demo',
  token: 'proposer-token'
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

const participantId = 'proposer-agent';

console.log(`Simple proposer agent connecting to ${options.gateway}...`);

// Connect to gateway
const ws = new WebSocket(options.gateway);

// Track state
let joined = false;
let proposalCount = 0;

// Create demo directory and files if they don't exist
function setupDemoFiles() {
  const demoDir = path.resolve(__dirname, 'demo-files');
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }
  
  // Create some demo files
  const files = {
    'secrets.txt': 'API_KEY=super-secret-key\nDB_PASSWORD=dont-share-this',
    'config.json': JSON.stringify({ 
      server: 'production.example.com', 
      port: 3000,
      debug: false 
    }, null, 2),
    'notes.md': '# Project Notes\n\n## TODO\n- Implement authentication\n- Add error handling\n- Write tests\n\n## Ideas\n- Use GraphQL API\n- Add real-time features'
  };

  for (const [filename, content] of Object.entries(files)) {
    const filepath = path.join(demoDir, filename);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, content);
    }
  }

  return demoDir;
}

// Generate MCP proposals for file operations
function generateProposal() {
  const demoDir = setupDemoFiles();
  const files = fs.readdirSync(demoDir);
  const randomFile = files[Math.floor(Math.random() * files.length)];
  const filepath = path.join(demoDir, randomFile);
  
  proposalCount++;
  
  // Create different types of proposals based on file
  let operation;
  if (randomFile === 'secrets.txt') {
    operation = {
      method: 'file/read',
      params: {
        path: filepath,
        reason: 'Check for exposed credentials'
      },
      risk_level: 'DANGEROUS'
    };
  } else if (randomFile === 'config.json') {
    operation = {
      method: 'file/read',  
      params: {
        path: filepath,
        reason: 'Validate configuration settings'
      },
      risk_level: 'CAUTION'
    };
  } else {
    operation = {
      method: 'file/read',
      params: {
        path: filepath,
        reason: 'Review project documentation'
      },
      risk_level: 'SAFE'
    };
  }

  return {
    kind: 'mcp/proposal',
    payload: {
      operation_id: `proposal-${proposalCount}`,
      method: operation.method,
      params: operation.params,
      risk_level: operation.risk_level,
      operation: operation,
      justification: `I'd like to ${operation.params.reason.toLowerCase()} by reading ${randomFile}`,
      auto_approve: operation.risk_level === 'SAFE'
    }
  };
}

// Send message
function sendMessage(message) {
  const envelope = {
    protocol: 'mew/v0.3',
    id: Math.random().toString(36).substr(2, 9),
    ts: Date.now(),
    from: participantId,
    to: 'broadcast',
    ...message
  };
  
  ws.send(JSON.stringify(envelope));
  console.log(`Sent: ${message.kind}`);
}

ws.on('open', () => {
  console.log('WebSocket connected');
  
  // Send join message
  sendMessage({
    kind: 'system/join',
    payload: {
      space: options.space,
      participant: {
        id: participantId,
        capabilities: [
          { kind: 'chat' },
          { kind: 'mcp/proposal' }
        ]
      },
      token: options.token
    }
  });
});

ws.on('message', (data) => {
  try {
    const envelope = JSON.parse(data.toString());
    console.log(`Received: ${envelope.kind} from ${envelope.from}`);
    
    if (envelope.kind === 'system/welcome') {
      joined = true;
      console.log('Joined space successfully');
      
      // Send a greeting
      setTimeout(() => {
        sendMessage({
          kind: 'chat',
          payload: {
            text: '🤖 Simple proposer agent ready! I can suggest file operations that need approval. Say "propose" to see a proposal!'
          }
        });
      }, 1000);
    }
    
    if (envelope.kind === 'chat' && envelope.from === 'human' && joined) {
      const text = envelope.payload.text?.toLowerCase();
      
      if (text?.includes('propose') || text?.includes('suggest')) {
        console.log('Generating proposal...');
        
        const proposal = generateProposal();
        
        // Send chat message first to explain what we're doing
        sendMessage({
          kind: 'chat',
          payload: {
            text: `💡 ${proposal.payload.justification} (Risk: ${proposal.payload.operation.risk_level})`
          }
        });
        
        // Send the actual proposal
        setTimeout(() => {
          sendMessage(proposal);
        }, 500);
      }
      
      if (text?.includes('help')) {
        sendMessage({
          kind: 'chat',
          payload: {
            text: 'I can propose file operations! Try saying "propose" to see a proposal that needs approval.'
          }
        });
      }
    }
    
    // Handle approval/rejection responses  
    if (envelope.kind === 'mcp/approval') {
      const approved = envelope.payload.approved;
      const operationId = envelope.payload.operationId;
      
      if (approved) {
        sendMessage({
          kind: 'chat',
          payload: {
            text: `✅ Thank you for approving ${operationId}! In a real system, I would now execute the file operation.`
          }
        });
      } else {
        sendMessage({
          kind: 'chat',
          payload: {
            text: `❌ Operation ${operationId} was denied. I understand the security concern.`
          }
        });
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

ws.on('close', () => {
  console.log('WebSocket disconnected');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
  process.exit(0);
});