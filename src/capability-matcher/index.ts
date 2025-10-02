import { PatternMatcher } from './matcher.js';
import { Participant, Message, CapabilityPattern, MatchOptions } from './types.js';

export * from './types.js';
export { PatternMatcher } from './matcher.js';

// Global matcher instance with caching
const globalMatcher = new PatternMatcher();

/**
 * Check if a participant has capability to send a message
 */
export function hasCapability(
  participant: Participant,
  message: Message,
  options: MatchOptions = {}
): boolean {
  const matcher = options.cache === false ? new PatternMatcher() : globalMatcher;
  
  // Check each capability
  for (const capability of participant.capabilities) {
    if (matcher.matchesCapability(capability, message)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find which capabilities match a message
 */
export function findMatchingCapabilities(
  capabilities: CapabilityPattern[],
  message: Message,
  options: MatchOptions = {}
): CapabilityPattern[] {
  const matcher = options.cache === false ? new PatternMatcher() : globalMatcher;
  
  return capabilities.filter(capability => 
    matcher.matchesCapability(capability, message)
  );
}

/**
 * Clear the global cache
 */
export function clearCache(): void {
  globalMatcher.clearCache();
}