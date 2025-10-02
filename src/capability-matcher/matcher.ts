import micromatch from 'micromatch';
import { JSONPath } from 'jsonpath-plus';
import { CapabilityPattern, Message, PayloadPattern, PayloadValue } from './types.js';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isString = (value: unknown): value is string => typeof value === 'string';

const isRegExp = (value: unknown): value is RegExp => value instanceof RegExp;

export class PatternMatcher {
  private cache = new Map<string, boolean>();

  /**
   * Check if a value matches a pattern
   */
  private matchesValue(pattern: PayloadValue | unknown, value: unknown): boolean {
    // Exact match
    if (pattern === value) {
      return true;
    }

    // Null/undefined handling
    if (pattern == null || value == null) {
      return pattern === value;
    }

    if (isRegExp(pattern) && isString(value)) {
      return pattern.test(value);
    }

    // Array of options (OR)
    if (Array.isArray(pattern)) {
      return pattern.some(candidate => this.matchesValue(candidate, value));
    }

    // String patterns
    if (isString(pattern) && isString(value)) {
      // Regex pattern /regex/
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regexStr = pattern.slice(1, -1);
        const regex = new RegExp(regexStr);
        return regex.test(value);
      }

      // Negative pattern !pattern
      if (pattern.startsWith('!')) {
        const positivePattern = pattern.slice(1);
        return !micromatch.isMatch(value, positivePattern);
      }

      // Glob pattern with * or **
      if (pattern.includes('*') || pattern.includes('?')) {
        return micromatch.isMatch(value, pattern);
      }
    }

    // Object patterns (recursive)
    if (isPlainObject(pattern) && isPlainObject(value)) {
      return this.matchesPayload(
        pattern as PayloadPattern,
        value as Record<string, unknown>
      );
    }

    return false;
  }

  /**
   * Check if a payload matches a pattern
   */
  private matchesPayload(pattern: PayloadPattern, payload: Record<string, unknown>): boolean {
    // If pattern is empty, it matches any payload
    if (Object.keys(pattern).length === 0) {
      return true;
    }

    // Check each pattern key
    for (const [key, patternValue] of Object.entries(pattern)) {
      // Handle JSONPath expressions
      if (key.startsWith('$')) {
        const results = JSONPath({ path: key, json: payload });
        if (results.length === 0) {
          return false;
        }
        // Check if any result matches the pattern
        if (!results.some((result: unknown) => this.matchesValue(patternValue, result))) {
          return false;
        }
        continue;
      }

      // Handle deep wildcard **
      if (key === '**') {
        // Deep match - pattern value should exist somewhere in payload
        const found = this.findDeepMatch(patternValue, payload);
        if (!found) {
          return false;
        }
        continue;
      }

      // Handle regular key with potential wildcards
      const matchingKeys = this.findMatchingKeys(key, payload);
      if (matchingKeys.length === 0) {
        return false;
      }

      // Check if any matching key's value matches the pattern
      const anyMatch = matchingKeys.some(matchKey => 
        this.matchesValue(patternValue, payload[matchKey])
      );
      
      if (!anyMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find keys in object that match a pattern
   */
  private findMatchingKeys(pattern: string, obj: Record<string, unknown>): string[] {
    const keys = Object.keys(obj);
    
    // Exact match
    if (!pattern.includes('*') && !pattern.includes('?')) {
      return keys.includes(pattern) ? [pattern] : [];
    }

    // Glob match
    return keys.filter(key => micromatch.isMatch(key, pattern));
  }

  /**
   * Find if pattern exists deep in object
   */
  private findDeepMatch(pattern: PayloadValue | unknown, obj: unknown): boolean {
    if (this.matchesValue(pattern, obj)) {
      return true;
    }

    if (isPlainObject(obj)) {
      return Object.values(obj as Record<string, unknown>).some(value =>
        this.findDeepMatch(pattern, value)
      );
    }

    if (Array.isArray(obj)) {
      return (obj as unknown[]).some(item => this.findDeepMatch(pattern, item));
    }

    return false;
  }

  /**
   * Check if a message matches a capability pattern
   */
  public matchesCapability(capability: CapabilityPattern, message: Message): boolean {
    // Generate cache key
    const cacheKey = JSON.stringify({ capability, message });
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check kind match
    const kindMatches = this.matchesValue(capability.kind, message.kind);
    if (!kindMatches) {
      this.cache.set(cacheKey, false);
      return false;
    }

    // If no payload pattern, capability matches
    if (!capability.payload) {
      this.cache.set(cacheKey, true);
      return true;
    }

    // Check payload pattern match
    const payloadSource: Record<string, unknown> = isPlainObject(message.payload)
      ? (message.payload as Record<string, unknown>)
      : {};
    const payloadMatches = this.matchesPayload(capability.payload, payloadSource);
    
    this.cache.set(cacheKey, payloadMatches);
    return payloadMatches;
  }

  /**
   * Clear the cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}