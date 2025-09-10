#!/usr/bin/env node
/**
 * MCP Proposer Agent
 * 
 * Suggests MCP operations like reading files that require human approval.
 * Demonstrates the MEW v0.3 proposal/approval workflow.
 */

// Import the MEW SDK client
const path = require('path');
const fs = require('fs');
const clientPath = path.resolve(__dirname, '../../sdk/typescript-sdk/client/dist/index.js');
const { MEWClient, ClientEvents } = require(clientPath);

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  gateway: 'ws://localhost:8080',
  space: 'playground',
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

console.log(`Proposer agent connecting to ${options.gateway}...`);

// Create MEW client instance
const client = new MEWClient({
  gateway: options.gateway,
  space: options.space,
  token: options.token,
  participant_id: participantId,
  capabilities: [
    { kind: 'chat' },
    { kind: 'mcp/proposal' }
  ],
  reconnect: true
});

// Track state
let joined = false;
let proposalCount = 0;

// Demo files that exist in the workspace
const demoFiles = [
  'README.md',
  'package.json',
  'playground-space.yaml',
  'TODO.md'
];

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
      operation: operation,
      justification: `I'd like to ${operation.params.reason.toLowerCase()} by reading ${randomFile}`,
      auto_approve: operation.risk_level === 'SAFE'
    }
  };
}

// Handle incoming messages
client.on(ClientEvents.MESSAGE, (envelope) => {
  console.log(`Received: ${envelope.kind} from ${envelope.from}`);
  
  if (envelope.kind === 'system/welcome') {
    console.log('Connected to space:', envelope.payload);
    
    // Send a greeting
    setTimeout(() => {
      client.sendMessage({
        kind: 'chat',
        payload: {
          text: '🤖 Proposer agent ready! I can suggest file operations that need approval. Say "propose" to see a proposal!'
        }
      });
    }, 1000);
  }
  
  if (envelope.kind === 'chat' && envelope.from !== participantId) {
    const text = envelope.payload.text?.toLowerCase();
    
    if (text?.includes('propose') || text?.includes('suggest')) {
      console.log('Generating proposal...');
      
      const proposal = generateProposal();
      
      // Send chat message first to explain what we're doing
      client.sendMessage({
        kind: 'chat',
        payload: {
          text: `💡 ${proposal.payload.justification} (Risk: ${proposal.payload.operation.risk_level})`
        }
      });
      
      // Send the actual proposal
      setTimeout(() => {
        client.sendMessage(proposal);
        console.log('Sent proposal:', proposal.payload.operation_id);
      }, 500);
    }
    
    if (text?.includes('help')) {
      client.sendMessage({
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
      client.sendMessage({
        kind: 'chat',
        payload: {
          text: `✅ Thank you for approving ${operationId}! In a real system, I would now execute the file operation.`
        }
      });
    } else {
      client.sendMessage({
        kind: 'chat',
        payload: {
          text: `❌ Operation ${operationId} was denied. I understand the security concern.`
        }
      });
    }
  }
});

// Handle connection events
client.on(ClientEvents.CONNECTED, () => {
  console.log('WebSocket connected');
});

client.on(ClientEvents.DISCONNECTED, () => {
  console.log('WebSocket disconnected');
});

client.on(ClientEvents.ERROR, (error) => {
  console.error('Client error:', error);
});

// Connect to the gateway
client.connect();