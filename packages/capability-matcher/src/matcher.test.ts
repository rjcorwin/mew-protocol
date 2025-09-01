import { PatternMatcher } from './matcher';
import { hasCapability, findMatchingCapabilities } from './index';
import { Participant, Message, CapabilityPattern } from './types';

describe('PatternMatcher', () => {
  let matcher: PatternMatcher;

  beforeEach(() => {
    matcher = new PatternMatcher();
  });

  describe('Simple pattern matching', () => {
    it('should match exact kind', () => {
      const capability: CapabilityPattern = { kind: 'mcp.request' };
      const message: Message = { kind: 'mcp.request' };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });

    it('should not match different kind', () => {
      const capability: CapabilityPattern = { kind: 'mcp.request' };
      const message: Message = { kind: 'mcp.response' };
      
      expect(matcher.matchesCapability(capability, message)).toBe(false);
    });

    it('should match kind from array', () => {
      const capability: CapabilityPattern = { 
        kind: ['mcp.request', 'mcp.proposal'] 
      };
      const message: Message = { kind: 'mcp.proposal' };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });
  });

  describe('Wildcard patterns', () => {
    it('should match wildcard in kind', () => {
      const capability: CapabilityPattern = { kind: 'mcp.*' };
      const message: Message = { kind: 'mcp.request' };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });

    it('should match wildcard in payload', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/*'
        }
      };
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call'
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });

    it('should match nested wildcard', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'read_*'
          }
        }
      };
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'read_file'
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });

    it('should match double wildcard for deep paths', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: 'resources/read',
          params: {
            uri: '/public/**'
          }
        }
      };
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'resources/read',
          params: {
            uri: '/public/docs/readme.md'
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });
  });

  describe('Negative patterns', () => {
    it('should match negative pattern', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: '!delete_*'
          }
        }
      };
      
      const allowedMessage: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: { name: 'read_file' }
        }
      };
      
      const blockedMessage: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: { name: 'delete_file' }
        }
      };
      
      expect(matcher.matchesCapability(capability, allowedMessage)).toBe(true);
      expect(matcher.matchesCapability(capability, blockedMessage)).toBe(false);
    });
  });

  describe('Regex patterns', () => {
    it('should match regex pattern', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'database_query',
            arguments: {
              query: '/^SELECT .* FROM public\\..*$/'
            }
          }
        }
      };
      
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'database_query',
            arguments: {
              query: 'SELECT id, name FROM public.users'
            }
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });

    it('should not match invalid regex pattern', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            arguments: {
              query: '/^SELECT .* FROM public\\..*$/'
            }
          }
        }
      };
      
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            arguments: {
              query: 'DELETE FROM users'
            }
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(false);
    });
  });

  describe('Array patterns (one-of)', () => {
    it('should match array values', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          method: ['tools/call', 'tools/list'],
          params: {
            name: ['read_file', 'list_files']
          }
        }
      };
      
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'read_file'
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });
  });

  describe('Deep matching with **', () => {
    it('should match deep pattern', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          '**': 'sensitive_data'
        }
      };
      
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            nested: {
              deeply: {
                value: 'sensitive_data'
              }
            }
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });
  });

  describe('JSONPath expressions', () => {
    it('should match JSONPath expression', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          '$.params.name': 'read_*'
        }
      };
      
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: {
            name: 'read_file'
          }
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });

    it('should match array JSONPath', () => {
      const capability: CapabilityPattern = {
        kind: 'mcp.request',
        payload: {
          '$.params[*].name': 'file_*'
        }
      };
      
      const message: Message = {
        kind: 'mcp.request',
        payload: {
          method: 'tools/call',
          params: [
            { name: 'file_read', path: '/tmp/test.txt' },
            { name: 'file_write', path: '/tmp/out.txt' }
          ]
        }
      };
      
      expect(matcher.matchesCapability(capability, message)).toBe(true);
    });
  });
});

describe('hasCapability function', () => {
  it('should check participant capabilities', () => {
    const participant: Participant = {
      participantId: 'agent-1',
      capabilities: [
        {
          kind: 'mcp.proposal'
        },
        {
          kind: 'mcp.request',
          payload: {
            method: 'resources/read'
          }
        },
        {
          kind: 'chat'
        }
      ]
    };

    const allowedMessage: Message = {
      kind: 'mcp.request',
      payload: {
        method: 'resources/read',
        params: { uri: '/file.txt' }
      }
    };

    const blockedMessage: Message = {
      kind: 'mcp.request',
      payload: {
        method: 'resources/write',
        params: { uri: '/file.txt' }
      }
    };

    expect(hasCapability(participant, allowedMessage)).toBe(true);
    expect(hasCapability(participant, blockedMessage)).toBe(false);
  });

  it('should work with complex patterns', () => {
    const participant: Participant = {
      participantId: 'agent-2',
      capabilities: [
        {
          kind: 'mcp.request',
          payload: {
            method: 'tools/call',
            params: {
              name: 'read_*'
            }
          }
        },
        {
          kind: 'mcp.request',
          payload: {
            method: 'resources/*',
            params: {
              uri: '/public/**'
            }
          }
        }
      ]
    };

    const readTool: Message = {
      kind: 'mcp.request',
      payload: {
        method: 'tools/call',
        params: { name: 'read_file' }
      }
    };

    const writeTool: Message = {
      kind: 'mcp.request',
      payload: {
        method: 'tools/call',
        params: { name: 'write_file' }
      }
    };

    const publicResource: Message = {
      kind: 'mcp.request',
      payload: {
        method: 'resources/read',
        params: { uri: '/public/docs/readme.md' }
      }
    };

    const privateResource: Message = {
      kind: 'mcp.request',
      payload: {
        method: 'resources/read',
        params: { uri: '/private/secrets.txt' }
      }
    };

    expect(hasCapability(participant, readTool)).toBe(true);
    expect(hasCapability(participant, writeTool)).toBe(false);
    expect(hasCapability(participant, publicResource)).toBe(true);
    expect(hasCapability(participant, privateResource)).toBe(false);
  });
});

describe('findMatchingCapabilities', () => {
  it('should find all matching capabilities', () => {
    const capabilities: CapabilityPattern[] = [
      { kind: 'mcp.request' },
      { kind: 'mcp.request', payload: { method: 'tools/*' } },
      { kind: 'mcp.request', payload: { method: 'tools/call' } },
      { kind: 'chat' }
    ];

    const message: Message = {
      kind: 'mcp.request',
      payload: { method: 'tools/call' }
    };

    const matches = findMatchingCapabilities(capabilities, message);
    
    expect(matches).toHaveLength(3);
    expect(matches).toContain(capabilities[0]);
    expect(matches).toContain(capabilities[1]);
    expect(matches).toContain(capabilities[2]);
    expect(matches).not.toContain(capabilities[3]);
  });
});