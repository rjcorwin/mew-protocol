# @meup/capability-matcher

Pattern matching library for MEUP capability definitions. Implements the JSON Pattern Matching approach from ADR-q8f.

## Installation

```bash
npm install @meup/capability-matcher
```

## Features

- ✅ Glob patterns (`*`, `**`, `?`)
- ✅ Negative patterns (`!pattern`)
- ✅ Regex patterns (`/regex/`)
- ✅ Array patterns (one-of)
- ✅ Deep matching with `**`
- ✅ JSONPath expressions
- ✅ Nested object patterns
- ✅ Built-in caching for performance

## Usage

### Basic Example

```typescript
import { hasCapability, Participant, Message } from '@meup/capability-matcher';

const participant: Participant = {
  participantId: 'agent-1',
  capabilities: [
    {
      kind: 'mcp.request',
      payload: {
        method: 'tools/*'
      }
    },
    {
      kind: 'chat'
    }
  ]
};

const message: Message = {
  kind: 'mcp.request',
  payload: {
    method: 'tools/call',
    params: { name: 'read_file' }
  }
};

if (hasCapability(participant, message)) {
  console.log('Permission granted');
} else {
  console.log('Permission denied');
}
```

### Pattern Types

#### Wildcard Patterns
```typescript
{
  kind: 'mcp.*',                    // Matches any mcp.* kind
  payload: {
    method: 'tools/*',              // Matches tools/call, tools/list, etc.
    params: {
      name: 'read_*',               // Matches read_file, read_config, etc.
      uri: '/public/**'             // Matches /public/ and all subdirectories
    }
  }
}
```

#### Negative Patterns
```typescript
{
  kind: 'mcp.request',
  payload: {
    method: 'tools/call',
    params: {
      name: '!delete_*'             // Matches anything EXCEPT delete_*
    }
  }
}
```

#### Regex Patterns
```typescript
{
  kind: 'mcp.request',
  payload: {
    method: 'tools/call',
    params: {
      arguments: {
        query: '/^SELECT .* FROM public\\..*$/'  // SQL query pattern
      }
    }
  }
}
```

#### Array Patterns (One-of)
```typescript
{
  kind: ['mcp.request', 'mcp.proposal'],      // Matches either kind
  payload: {
    method: ['tools/call', 'tools/list'],     // Matches either method
    params: {
      name: ['read_file', 'list_files']       // Matches either tool
    }
  }
}
```

#### Deep Matching
```typescript
{
  kind: 'mcp.request',
  payload: {
    '**': 'sensitive_data'     // Matches if 'sensitive_data' exists anywhere deep in payload
  }
}
```

#### JSONPath Expressions
```typescript
{
  kind: 'mcp.request',
  payload: {
    '$.params.name': 'read_*',                             // JSONPath to specific field
    '$.params[?(@.restricted == true)]': { restricted: true }  // JSONPath with filter
  }
}
```

### Advanced Usage

#### Find Matching Capabilities
```typescript
import { findMatchingCapabilities } from '@meup/capability-matcher';

const capabilities = [
  { kind: 'mcp.request' },
  { kind: 'mcp.request', payload: { method: 'tools/*' } },
  { kind: 'chat' }
];

const message = {
  kind: 'mcp.request',
  payload: { method: 'tools/call' }
};

const matches = findMatchingCapabilities(capabilities, message);
// Returns the first two capabilities that match
```

#### Disable Caching
```typescript
// By default, results are cached for performance
// Disable caching if capabilities change frequently
const result = hasCapability(participant, message, { cache: false });
```

#### Clear Cache
```typescript
import { clearCache } from '@meup/capability-matcher';

// Clear the global cache when capabilities change
clearCache();
```

### Real-World Examples

#### Read-Only File Access
```typescript
const readOnlyCapability = {
  kind: 'mcp.request',
  payload: {
    method: 'resources/read',
    params: {
      uri: '*'  // Can read any file
    }
  }
};
```

#### Public Directory Access
```typescript
const publicAccessCapability = {
  kind: 'mcp.request',
  payload: {
    method: 'resources/*',  // Any resource operation
    params: {
      uri: '/public/**'      // But only in /public directory
    }
  }
};
```

#### Database Query Restrictions
```typescript
const dbQueryCapability = {
  kind: 'mcp.request',
  payload: {
    method: 'tools/call',
    params: {
      name: 'database_query',
      arguments: {
        query: '/^SELECT .* FROM public\\..*$/',  // Only SELECT from public schema
        database: ['production', 'staging']       // Only these databases
      }
    }
  }
};
```

#### Tool Access Control
```typescript
const safeToolsCapability = {
  kind: 'mcp.request',
  payload: {
    method: 'tools/call',
    params: {
      name: '!delete_*'  // Any tool except delete_* tools
    }
  }
};
```

## Performance

The library includes built-in caching to optimize repeated capability checks:

- Pattern compilation is cached
- Permission decisions are cached by message signature
- Cache can be disabled or cleared when needed

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  Message,
  CapabilityPattern,
  PayloadPattern,
  Participant,
  MatchOptions
} from '@meup/capability-matcher';
```

## Testing

```bash
npm test
```

## License

MIT