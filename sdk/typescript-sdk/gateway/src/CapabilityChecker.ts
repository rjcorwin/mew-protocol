import { Capability, Envelope, CapabilityCheckResult } from './types';
import { PatternMatcher } from '@mew-protocol/capability-matcher';

/**
 * Checks if operations are allowed based on capabilities
 */
export class CapabilityChecker {
  private matcher = new PatternMatcher();
  /**
   * Check if an envelope matches a capability
   */
  checkCapability(
    envelope: Envelope,
    capabilities: Capability[]
  ): CapabilityCheckResult {
    // System messages are always allowed from gateway
    if (envelope.from === 'system' || envelope.from?.startsWith('system:')) {
      return { allowed: true };
    }
    
    // System heartbeat messages are always allowed
    if (envelope.kind === 'system/heartbeat') {
      return { allowed: true };
    }

    // Check each capability
    for (const capability of capabilities) {
      if (this.matchesCapability(envelope, capability)) {
        return {
          allowed: true,
          matchedCapability: capability,
        };
      }
    }

    return {
      allowed: false,
      reason: `No capability matches kind: ${envelope.kind}`,
    };
  }

  /**
   * Check if envelope matches a specific capability
   */
  private matchesCapability(envelope: Envelope, capability: Capability): boolean {
    // Use the capability matcher for advanced pattern matching
    // Convert types to match the capability matcher interface
    const message = {
      kind: envelope.kind,
      payload: envelope.payload
    };
    
    const capabilityPattern = {
      kind: capability.kind,
      payload: capability.payload
    };
    
    // Use the matcher for the main capability check
    const matches = this.matcher.matchesCapability(capabilityPattern, message);
    
    // Additionally check target restrictions if specified
    if (matches && capability.to && envelope.to) {
      return this.matchesTargetPattern(envelope.to, capability.to);
    }
    
    return matches;
  }

  /**
   * Match kind pattern (supports wildcards)
   */
  private matchesKindPattern(kind: string, pattern: string): boolean {
    // Exact match
    if (pattern === kind) return true;
    
    // Wildcard match
    if (pattern === '*') return true;
    
    // Prefix wildcard (e.g., "mcp/*")
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return kind.startsWith(prefix + '/');
    }
    
    // Suffix wildcard (e.g., "*/request")
    if (pattern.startsWith('*/')) {
      const suffix = pattern.slice(2);
      return kind.endsWith('/' + suffix);
    }
    
    // Middle wildcard (e.g., "mcp/*/request")
    if (pattern.includes('/*/')) {
      const parts = pattern.split('/*/');
      if (parts.length === 2) {
        return kind.startsWith(parts[0] + '/') && kind.endsWith('/' + parts[1]);
      }
    }
    
    return false;
  }

  /**
   * Match target pattern
   */
  private matchesTargetPattern(
    targets: string[],
    pattern: string | string[]
  ): boolean {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    
    // Check if any target matches any pattern
    for (const target of targets) {
      for (const p of patterns) {
        if (p === '*' || p === target) {
          return true;
        }
        
        // Pattern matching for participant IDs
        if (p.includes('*')) {
          const regex = new RegExp('^' + p.replace(/\*/g, '.*') + '$');
          if (regex.test(target)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Match payload pattern (deep comparison)
   */
  private matchesPayloadPattern(payload: any, pattern: any): boolean {
    // If pattern is a function, use it to test
    if (typeof pattern === 'function') {
      return pattern(payload);
    }
    
    // If pattern is null/undefined, it matches anything
    if (pattern == null) return true;
    
    // If types don't match, fail
    if (typeof payload !== typeof pattern) return false;
    
    // For primitives, check equality
    if (typeof pattern !== 'object') {
      return payload === pattern;
    }
    
    // For arrays, check each element
    if (Array.isArray(pattern)) {
      if (!Array.isArray(payload)) return false;
      if (pattern.length === 0) return true; // Empty pattern matches any array
      
      // If pattern has one element with *, it matches any array
      if (pattern.length === 1 && pattern[0] === '*') return true;
      
      // Otherwise check each element
      return pattern.every((p, i) => this.matchesPayloadPattern(payload[i], p));
    }
    
    // For objects, check each property
    for (const key in pattern) {
      if (!(key in payload)) return false;
      
      const patternValue = pattern[key];
      const payloadValue = payload[key];
      
      // Special case for wildcard
      if (patternValue === '*') continue;
      
      // Recursive check
      if (!this.matchesPayloadPattern(payloadValue, patternValue)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check if participant has admin capability
   */
  isAdmin(capabilities: Capability[]): boolean {
    return capabilities.some(c => 
      c.id === 'admin' || 
      c.kind === '*' ||
      c.kind === 'admin/*'
    );
  }

  /**
   * Check if participant can execute proposals
   */
  canExecuteProposals(capabilities: Capability[]): boolean {
    return capabilities.some(c => 
      c.kind === '*' ||
      c.kind === 'mew/proposal/accept' ||
      this.matchesKindPattern('mew/proposal/accept', c.kind)
    );
  }

  /**
   * Filter capabilities by kind pattern
   */
  filterCapabilities(capabilities: Capability[], kindPattern: string): Capability[] {
    return capabilities.filter(c => this.matchesKindPattern(kindPattern, c.kind));
  }

  /**
   * Merge capabilities (removing duplicates)
   */
  mergeCapabilities(caps1: Capability[], caps2: Capability[]): Capability[] {
    const merged = [...caps1];
    const existingIds = new Set(caps1.map(c => c.id));
    
    for (const cap of caps2) {
      if (!existingIds.has(cap.id)) {
        merged.push(cap);
      }
    }
    
    return merged;
  }

  /**
   * Create a default set of capabilities for a role
   */
  static createDefaultCapabilities(role: 'admin' | 'trusted' | 'untrusted'): Capability[] {
    switch (role) {
      case 'admin':
        return [
          { id: 'admin', kind: '*' },
        ];
        
      case 'trusted':
        return [
          { id: 'mcp-all', kind: 'mcp/*' },
          { id: 'mew-proposals', kind: 'mew/proposal/*' },
          { id: 'mew-capabilities', kind: 'mew/capability/*' },
          { id: 'chat', kind: 'chat' },
        ];
        
      case 'untrusted':
        return [
          { id: 'chat', kind: 'chat' },
          { id: 'propose', kind: 'mew/proposal' },
          { id: 'mcp-read', kind: 'mcp/request', payload: { method: 'resources/read' } },
        ];
    }
  }
}