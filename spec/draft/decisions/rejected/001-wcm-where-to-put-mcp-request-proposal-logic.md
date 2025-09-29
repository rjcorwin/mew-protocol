# ADR-WCM: Where to Put MCP Request/Proposal Auto-Conversion Logic

**Status:** Rejected  
**Date:** 2025-01-10  
**Incorporation:** Not Incorporated  
**Rejection Date:** 2025-09-26  
**Rejection Rationale:** v0.4 scope keeps current MEWParticipant auto-conversion behavior; larger refactor will be reconsidered alongside future SDK updates.

## Context

The MEW Protocol supports two ways for participants to execute MCP operations:
1. **Direct MCP requests** (`mcp/request`) - For trusted participants with appropriate capabilities
2. **MCP proposals** (`mcp/proposal`) - For untrusted participants requiring approval

Agents and other participants need a seamless way to make MCP requests that automatically fall back to proposals when they lack direct request capabilities. This automatic conversion is crucial for:
- **Agent development**: Agents should work regardless of trust level
- **Progressive trust**: Participants can gain capabilities over time
- **Security**: Untrusted participants can still function with approval workflows

Currently, the `MEWParticipant.request()` method in the SDK already implements this logic, but we need to determine:
1. Is this the right architectural location?
2. Should we enhance it with the advanced capability-matcher?
3. How should this integrate with the new TypeScript mew-agent?

## Options Considered

### Option 1: Keep Enhanced Logic in MEWParticipant (Current Location)

Keep and enhance the existing implementation in `packages/mew/src/participant/MEWParticipant.ts`.

**Current Implementation:**
- Already has basic auto-conversion logic
- Uses simple capability checking
- Returns promises that resolve with responses

**Proposed Enhancements:**
- Integrate advanced capability-matcher for sophisticated pattern matching
- Add better error messages explaining why proposals were used
- Add optional logging/monitoring of capability decisions

**Pros:**
- ✅ Logic already exists and works
- ✅ Right architectural layer (participant abstraction)
- ✅ All participants automatically benefit
- ✅ Minimal breaking changes
- ✅ Single source of truth for request routing

**Cons:**
- ❌ Couples participant package to capability-matcher package
- ❌ May add complexity to a currently simple implementation
- ❌ Could increase bundle size for all participants

### Option 2: Create New Request Manager in Client Package

Move the logic down to the MEWClient level and create a dedicated RequestManager class.

**Structure:**
```typescript
// packages/mew/src/client/RequestManager.ts
class RequestManager {
  constructor(client: MEWClient, capabilities: Capability[])
  async smartRequest(target, method, params): Promise<any>
}
```

**Pros:**
- ✅ Separation of concerns
- ✅ Could be reused by non-participant clients
- ✅ More testable as isolated component

**Cons:**
- ❌ Breaking change - MEWClient doesn't currently know about capabilities
- ❌ Wrong architectural layer - client should be protocol-agnostic
- ❌ Would require significant refactoring
- ❌ Duplicates existing working logic

### Option 3: Create Separate Utility Package

Create a new package `@mew-protocol/smart-request` that provides the enhanced logic.

**Structure:**
```typescript
// packages/mew/src/smart-request/
import { SmartRequestManager } from '@mew-protocol/smart-request';

class MEWParticipant {
  private requestManager: SmartRequestManager;
  
  async request(...) {
    return this.requestManager.execute(...);
  }
}
```

**Pros:**
- ✅ Clean separation of concerns
- ✅ Optional dependency (can use basic or smart)
- ✅ Highly testable
- ✅ Could support different strategies

**Cons:**
- ❌ Over-engineering for current needs
- ❌ Another package to maintain
- ❌ Adds complexity to SDK
- ❌ Splits logic that naturally belongs together

### Option 4: Enhanced Capability Checking Only

Keep request logic in MEWParticipant but enhance only the capability checking to use the advanced matcher.

**Implementation:**
```typescript
// In MEWParticipant
import { hasCapability } from '@mew-protocol/mew/capability-matcher';

canSend(kind: string, payload?: any): boolean {
  // Use advanced matcher if available, fall back to simple
  if (hasCapability) {
    return hasCapability(this.participantInfo, { kind, payload });
  }
  return simpleCanSend(this.participantInfo.capabilities, kind, payload);
}
```

**Pros:**
- ✅ Minimal changes to existing code
- ✅ Optional enhancement (graceful degradation)
- ✅ Leverages existing advanced matcher
- ✅ No breaking changes

**Cons:**
- ❌ Doesn't address other enhancement needs (logging, monitoring)
- ❌ Still couples packages together
- ❌ May confuse with two capability checking systems

## Decision

**Selected Option: Option 1 - Keep Enhanced Logic in MEWParticipant**

We will keep the MCP request/proposal auto-conversion logic in its current location (`MEWParticipant.request()`) and enhance it with:

1. **Optional advanced capability matching** - Use the capability-matcher package when sophisticated patterns are needed
2. **Better debugging** - Add optional debug logging for capability decisions
3. **Improved error messages** - Explain why proposals were used instead of direct requests
4. **Configuration options** - Allow participants to configure fallback behavior

### Implementation Details

The enhanced `MEWParticipant.request()` method will:

```typescript
interface RequestOptions {
  timeout?: number;
  preferProposal?: boolean;  // Force proposal even if direct is available
  debug?: boolean;           // Log capability decisions
}

async request(
  target: string | string[], 
  method: string, 
  params?: any, 
  options?: RequestOptions
): Promise<any> {
  const debug = options?.debug || this.options.debug;
  
  // Enhanced capability checking
  const canDirectRequest = this.canSendEnhanced('mcp/request', { method, params });
  const canPropose = this.canSendEnhanced('mcp/proposal', { proposal: { method, params } });
  
  if (debug) {
    this.logger.debug('MCP request capability decision:', {
      method,
      canDirectRequest,
      canPropose,
      preferProposal: options?.preferProposal
    });
  }
  
  // Use proposal if forced or no direct capability
  if (options?.preferProposal || !canDirectRequest) {
    if (!canPropose) {
      throw new Error(
        `Cannot execute ${method}: No capability for mcp/request or mcp/proposal. ` +
        `Available capabilities: ${this.describeCapabilities()}`
      );
    }
    return this.sendProposal(target, method, params, options);
  }
  
  return this.sendRequest(target, method, params, options);
}

private canSendEnhanced(kind: string, payload?: any): boolean {
  // Try advanced matcher first if available
  if (this.options.useAdvancedMatcher && hasCapability) {
    return hasCapability(
      { capabilities: this.participantInfo.capabilities },
      { kind, payload },
      { cache: true }
    );
  }
  
  // Fall back to simple matcher
  return canSend(this.participantInfo.capabilities, kind, payload);
}
```

## Consequences

### Positive
- ✅ **Minimal disruption** - Enhances existing working code
- ✅ **Backward compatible** - No breaking changes
- ✅ **Progressive enhancement** - Advanced features are optional
- ✅ **Better debugging** - Developers can understand capability decisions
- ✅ **Flexibility** - Supports different use cases (force proposal, debug mode)
- ✅ **Right location** - Logic stays in the appropriate architectural layer

### Negative
- ❌ **Package coupling** - Participant package may depend on capability-matcher
- ❌ **Increased complexity** - More options and code paths
- ❌ **Bundle size** - May increase size if advanced matcher is included

### Mitigation Strategies

1. **Make capability-matcher optional** - Use dynamic imports or peer dependencies
2. **Provide build variants** - Offer basic and enhanced builds
3. **Clear documentation** - Explain when to use which options
4. **Performance monitoring** - Ensure enhanced checking doesn't slow down requests

## Future Considerations

1. **Caching Strategy** - Could cache capability decisions for performance
2. **Proposal Tracking** - Could add proposal status tracking
3. **Batch Requests** - Could support batching multiple requests
4. **Request Middleware** - Could add plugin system for request processing
5. **Metrics Collection** - Could add capability usage metrics

## References

- [MEW Protocol v0.3 Specification](../../spec/v0.3/SPEC.md)
- [Current MEWParticipant Implementation](../../packages/mew/src/participant/MEWParticipant.ts)
- [Capability Matcher Package](../../packages/mew/src/capability-matcher/)
- [MEW Agent Specification](../../mew-agent/spec/draft/SPEC.md)
