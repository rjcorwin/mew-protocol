import { hasCapability, Participant, Message } from '../index.js';

/**
 * Example Gateway implementation using capability-matcher
 */
class Gateway {
  private participants = new Map<string, Participant>();

  /**
   * Register a participant with their capabilities
   */
  registerParticipant(participant: Participant): void {
    this.participants.set(participant.participantId, participant);
    console.log(`Registered ${participant.participantId} with ${participant.capabilities.length} capabilities`);
  }

  /**
   * Check if a participant can send a message
   */
  authorize(participantId: string, message: Message): boolean {
    const participant = this.participants.get(participantId);
    if (!participant) {
      console.log(`Unknown participant: ${participantId}`);
      return false;
    }

    const authorized = hasCapability(participant, message);
    
    console.log(
      `${participantId} ${authorized ? 'ALLOWED' : 'DENIED'} to send:`,
      JSON.stringify(message, null, 2)
    );
    
    return authorized;
  }

  /**
   * Route a message if authorized
   */
  routeMessage(fromParticipantId: string, message: Message): void {
    if (!this.authorize(fromParticipantId, message)) {
      throw new Error(`Permission denied for ${fromParticipantId}`);
    }
    
    // Message routing logic here
    console.log(`Routing message from ${fromParticipantId}...`);
  }
}

// Example usage
function main() {
  const gateway = new Gateway();

  // Register a human user with broad capabilities
  gateway.registerParticipant({
    participantId: 'human-user',
    capabilities: [
      { kind: '*' } // Can send any message
    ]
  });

  // Register an AI agent with limited capabilities
  gateway.registerParticipant({
    participantId: 'ai-agent',
    capabilities: [
      // Can respond to requests
      { kind: 'mcp.response' },
      
      // Can make proposals
      { kind: 'mcp.proposal' },
      
      // Can call read-only tools
      {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'read_*'
          }
        }
      },
      
      // Can read from public resources
      {
        kind: 'mcp.request',
        payload: {
          method: 'resources/read',
          params: {
            uri: '/public/**'
          }
        }
      },
      
      // Can send chat messages
      { kind: 'chat' }
    ]
  });

  // Register a restricted tool with minimal capabilities
  gateway.registerParticipant({
    participantId: 'calculator-tool',
    capabilities: [
      // Can only respond to calculator requests
      {
        kind: 'mcp.response',
        payload: {
          result: {
            type: 'calculation'
          }
        }
      }
    ]
  });

  console.log('\n=== Testing Authorization ===\n');

  // Test various messages
  const testMessages: Array<[string, Message]> = [
    // AI agent tries to read a file (ALLOWED)
    ['ai-agent', {
      kind: 'mcp.request',
      payload: {
        method: 'tools/call',
        params: { name: 'read_file', arguments: { path: '/tmp/data.txt' } }
      }
    }],
    
    // AI agent tries to delete a file (DENIED)
    ['ai-agent', {
      kind: 'mcp.request',
      payload: {
        method: 'tools/call',
        params: { name: 'delete_file', arguments: { path: '/tmp/data.txt' } }
      }
    }],
    
    // AI agent reads public resource (ALLOWED)
    ['ai-agent', {
      kind: 'mcp.request',
      payload: {
        method: 'resources/read',
        params: { uri: '/public/docs/readme.md' }
      }
    }],
    
    // AI agent reads private resource (DENIED)
    ['ai-agent', {
      kind: 'mcp.request',
      payload: {
        method: 'resources/read',
        params: { uri: '/private/secrets.txt' }
      }
    }],
    
    // Human can do anything (ALLOWED)
    ['human-user', {
      kind: 'mcp.request',
      payload: {
        method: 'admin/shutdown',
        params: { force: true }
      }
    }],
    
    // Calculator tries to make a request (DENIED)
    ['calculator-tool', {
      kind: 'mcp.request',
      payload: {
        method: 'tools/call',
        params: { name: 'read_file' }
      }
    }]
  ];

  for (const [participantId, message] of testMessages) {
    try {
      gateway.routeMessage(participantId, message);
    } catch (error) {
      console.log(`Error: ${(error as Error).message}`);
    }
    console.log('---');
  }
}

main();