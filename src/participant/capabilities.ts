import { Capability, Envelope } from '../types/index.js';
import { PatternMatcher } from '../capability-matcher/index.js';

// Create a global pattern matcher instance
const matcher = new PatternMatcher();

/**
 * Check if a message matches a capability pattern
 * Supports wildcards (*), negative patterns (!pattern), and nested object matching
 */
export function matchesCapability(capability: Capability, envelope: Partial<Envelope>): boolean {
  // Use the pattern matcher for full support of patterns including negative patterns
  return matcher.matchesCapability(capability as any, envelope as any);
}

/**
 * Check if a string matches a pattern with wildcards
 */
function matchesPattern(pattern?: string, value?: string): boolean {
  if (!pattern || pattern === '*') return true;
  if (!value) return false;
  
  // Convert wildcard pattern to regex
  const regexPattern = pattern
    .split('*')
    .map(part => escapeRegex(part))
    .join('.*');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(value);
}

/**
 * Deep match objects with support for wildcards and nested patterns
 */
function matchesObject(pattern: any, value: any): boolean {
  if (pattern === undefined || pattern === null) return true;
  if (value === undefined || value === null) return false;
  
  // Direct equality
  if (pattern === value) return true;
  
  // Wildcard
  if (pattern === '*') return true;
  
  // String pattern matching
  if (typeof pattern === 'string' && typeof value === 'string') {
    return matchesPattern(pattern, value);
  }
  
  // Array matching - pattern array must be subset of value array
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) return false;
    return pattern.every(p => value.some(v => matchesObject(p, v)));
  }
  
  // Object matching - all pattern properties must match
  if (typeof pattern === 'object' && typeof value === 'object') {
    for (const key in pattern) {
      if (!matchesObject(pattern[key], value?.[key])) {
        return false;
      }
    }
    return true;
  }
  
  return false;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a participant can send a specific kind of message
 */
export function canSend(capabilities: Capability[], kind: string, payload?: any): boolean {
  const envelope: Partial<Envelope> = { kind, payload };
  return capabilities.some(cap => matchesCapability(cap, envelope));
}

/**
 * Filter capabilities by kind pattern
 */
export function filterCapabilities(capabilities: Capability[], kindPattern: string): Capability[] {
  return capabilities.filter(cap => matchesPattern(kindPattern, cap.kind));
}