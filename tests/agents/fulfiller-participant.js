#!/usr/bin/env node
/**
 * Fulfiller Agent - Auto-fulfills MCP proposals using MEWParticipant
 * For MEW v0.2 test scenarios
 */

const path = require('path');

// Import MEWParticipant from the SDK
const participantPath = path.resolve(__dirname, '../../sdk/typescript-sdk/participant/dist/index.js');
const { MEWParticipant } = require(participantPath);

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

class FulfillerAgent extends MEWParticipant {
  constructor(options) {
    super({
      gateway: options.gateway,
      space: options.space,
      token: options.token,
      participant_id: 'fulfiller-agent',
      capabilities: [
        { kind: 'mcp/request', payload: { method: 'tools/*' } },
        { kind: 'mcp/proposal' },
        { kind: 'chat' },
        { kind: 'system/*' }
      ],
      reconnect: true
    });

    console.log(`Fulfiller agent connecting to ${options.gateway}...`);
    
    // Register proposal handler using the MEWParticipant system
    this.onMCPProposal(async (envelope) => {
      await this.handleProposal(envelope);
    });
  }

  async onReady() {
    console.log('Fulfiller agent ready!');
    
    // Debug: Log all incoming messages
    this.onMessage((msg) => {
      console.log(`Fulfiller received message kind: ${msg.kind} from: ${msg.from}`);
      if (msg.kind === 'mcp/response') {
        console.log(`Fulfiller received MCP response:`, JSON.stringify(msg));
      }
    });
  }

  async handleProposal(envelope) {
    console.log(`Saw proposal from ${envelope.from}, auto-fulfilling...`);
    console.log(`Proposal details: ${JSON.stringify(envelope)}`);

    // In MEW v0.3, the proposal payload IS the MCP request payload
    const proposal = envelope.payload;
    if (!proposal || !proposal.method) {
      console.log('No valid MCP proposal data found in message');
      return;
    }

    // Extract tool call parameters from MCP payload
    let toolName, toolArgs;

    if (proposal.method === 'tools/call' && proposal.params) {
      toolName = proposal.params.name;
      toolArgs = proposal.params.arguments || {};
    } else {
      console.log(`Unsupported proposal method: ${proposal.method}`);
      return;
    }

    // Wait a moment to simulate review, then fulfill using promise-based request
    setTimeout(async () => {
      try {
        console.log(`Fulfilling proposal ${envelope.id} with tool ${toolName}`);
        console.log(`Sending MCP request to calculator-agent: tools/call with params:`, { name: toolName, arguments: toolArgs });
        
        // Use promise-based mcpRequest to call the tool
        const result = await this.mcpRequest(
          'calculator-agent',
          {
            method: 'tools/call',
            params: { name: toolName, arguments: toolArgs }
          },
          10000 // 10 second timeout
        );

        // Extract result text from MCP response
        let resultText = 'Error: Unknown result';
        if (result?.content?.[0]?.text) {
          resultText = result.content[0].text;
        } else if (typeof result === 'string' || typeof result === 'number') {
          resultText = String(result);
        }

        // Forward the result as a chat message to the original proposer
        await this.chat(resultText, envelope.from);

        console.log(`Forwarded result to ${envelope.from}: ${resultText}`);

      } catch (error) {
        console.error(`Failed to fulfill proposal ${envelope.id}:`, error);
        
        // Send error message to proposer
        await this.chat(`Error fulfilling proposal: ${error.message}`, envelope.from);
      }
    }, 500);
  }
}

// Create and start the fulfiller agent
const agent = new FulfillerAgent(options);

agent.connect().catch((error) => {
  console.error('Failed to connect:', error);
  process.exit(1);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down fulfiller agent...');
  agent.disconnect();
  process.exit(0);
});