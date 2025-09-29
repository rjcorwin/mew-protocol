import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PatternMatcher } from './matcher';
import type { CapabilityPattern, Message } from './types';

test('matches wildcard kind capabilities', () => {
  const matcher = new PatternMatcher();
  const capability: CapabilityPattern = { kind: '*' };
  const message: Message = { kind: 'chat', payload: { text: 'hello' } };

  assert.equal(matcher.matchesCapability(capability, message), true);
});

test('matches namespaced kinds and payload globs', () => {
  const matcher = new PatternMatcher();
  const capability: CapabilityPattern = {
    kind: 'mcp/request',
    payload: {
      method: 'tools/call',
      params: {
        name: 'read_*',
      },
    },
  };

  const allowed: Message = {
    kind: 'mcp/request',
    payload: {
      method: 'tools/call',
      params: {
        name: 'read_file',
      },
    },
  };

  const denied: Message = {
    kind: 'mcp/request',
    payload: {
      method: 'tools/call',
      params: {
        name: 'write_file',
      },
    },
  };

  assert.equal(matcher.matchesCapability(capability, allowed), true);
  assert.equal(matcher.matchesCapability(capability, denied), false);
});

test('supports JSONPath selectors', () => {
  const matcher = new PatternMatcher();
  const capability: CapabilityPattern = {
    kind: 'stream/request',
    payload: {
      '$.operations[*].type': ['upload', 'download'],
    },
  };

  const message: Message = {
    kind: 'stream/request',
    payload: {
      operations: [
        { type: 'upload', path: '/tmp/file.txt' },
        { type: 'close' },
      ],
    },
  };

  assert.equal(matcher.matchesCapability(capability, message), true);
});

test('matches deep wildcard payload entries and caches results', () => {
  const matcher = new PatternMatcher();
  const capability: CapabilityPattern = {
    kind: 'mcp/proposal',
    payload: {
      '**': '/dangerous/',
    },
  };

  const safeMessage: Message = {
    kind: 'mcp/proposal',
    payload: {
      changes: [{ file: 'README.md', diff: '---' }],
    },
  };

  const riskyMessage: Message = {
    kind: 'mcp/proposal',
    payload: {
      changes: [{ file: 'rm -rf /', diff: 'dangerous' }],
      audit: {
        notes: 'potential /dangerous/ command',
      },
    },
  };

  assert.equal(matcher.matchesCapability(capability, safeMessage), false);
  assert.equal(matcher.matchesCapability(capability, riskyMessage), true);

  // Cached evaluation should return the same result
  assert.equal(matcher.matchesCapability(capability, riskyMessage), true);
});
