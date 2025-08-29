# ADR-003: Error Handling and Retry Strategy

## Status
Proposed

## Context
The bridge operates between two independent systems (MCP and MCPx) that can fail independently. Network issues, participant disconnections, protocol errors, and tool failures all need to be handled gracefully. The bridge must maintain reliability while providing clear error information to both sides of the connection.

## Decision Drivers
- Maintain bridge reliability
- Provide clear error visibility
- Avoid cascade failures
- Enable debugging and monitoring
- Balance retry aggressiveness with resource usage

## Considered Options

### Option 1: Fail Fast
Immediately propagate all errors to callers, no retries.

**Pros:**
- Simple implementation
- Clear failure semantics
- No hidden retry delays
- Predictable behavior

**Cons:**
- Poor user experience with transient failures
- No resilience to network blips
- Requires manual intervention for recovery
- Single failure breaks entire session

### Option 2: Infinite Retry with Exponential Backoff
Retry all failures indefinitely with increasing delays.

**Pros:**
- Maximum resilience
- Handles long outages
- No manual intervention needed
- Eventually recovers from any transient issue

**Cons:**
- Can hide persistent problems
- Resource consumption during retry loops
- Unclear when to give up
- Poor user experience during long retry sequences

### Option 3: Categorized Error Handling
Different strategies based on error type.

**Error Categories:**
- **Transient**: Network timeouts, temporary disconnections → Retry with backoff
- **Protocol**: Malformed messages, version mismatches → Fail immediately  
- **Tool**: Tool not found, tool execution errors → Fail with clear error
- **Fatal**: Authentication failures, topic not found → Fail and disconnect

**Pros:**
- Appropriate response per error type
- Good balance of resilience and clarity
- Predictable behavior
- Efficient resource usage

**Cons:**
- Complex implementation
- Requires error classification logic
- More testing scenarios
- Potential for miscategorization

### Option 4: Circuit Breaker Pattern
Track failure rates and temporarily stop trying after threshold.

**Pros:**
- Prevents cascade failures
- Reduces load during outages
- Self-healing behavior
- Good for high-volume scenarios

**Cons:**
- Complex state management
- Requires tuning thresholds
- May be overkill for single bridge instance
- Additional complexity for unclear benefit

### Option 5: Hybrid Approach
Combine categorized handling with limited retries and user-configurable behavior.

**Implementation:**
- Categorize errors as in Option 3
- Apply limited retries for transient errors
- Make retry behavior configurable
- Provide clear error reporting

**Pros:**
- Flexible and adaptable
- Good default behavior
- User control when needed
- Clear error visibility

**Cons:**
- Most complex implementation
- Configuration surface area
- Testing complexity

## Decision

Implement **Option 5 (Hybrid Approach)** with sensible defaults.

The implementation will:
1. Categorize errors into transient, protocol, tool, and fatal
2. Apply limited retries with exponential backoff for transient errors
3. Fail immediately for protocol and tool errors with clear messages
4. Disconnect on fatal errors
5. Make retry behavior configurable

## Implementation Details

```typescript
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

interface ErrorHandlingConfig {
  transientErrors: {
    retry: RetryConfig;
    patterns: string[];  // Error message patterns to treat as transient
  };
  fatalErrors: {
    patterns: string[];  // Error message patterns to treat as fatal
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    includeStackTraces: boolean;
  };
}

enum ErrorCategory {
  TRANSIENT = 'transient',   // Retry with backoff
  PROTOCOL = 'protocol',     // Fail immediately, log error
  TOOL = 'tool',            // Fail immediately, return error to caller
  FATAL = 'fatal'           // Disconnect, stop bridge
}

class ErrorHandler {
  categorize(error: Error): ErrorCategory {
    // Classification logic based on error type, message, code
  }
  
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    category: ErrorCategory
  ): Promise<T> {
    // Retry logic based on category and config
  }
}
```

Default configuration:
```json
{
  "transientErrors": {
    "retry": {
      "maxAttempts": 3,
      "initialDelayMs": 1000,
      "maxDelayMs": 30000,
      "backoffMultiplier": 2
    },
    "patterns": [
      "ECONNRESET",
      "ETIMEDOUT",
      "WebSocket.*close"
    ]
  },
  "fatalErrors": {
    "patterns": [
      "Authentication failed",
      "Topic not found",
      "Invalid protocol version"
    ]
  }
}
```

## Error Reporting

Errors will be reported through multiple channels:
1. **Return to caller**: Clear error messages in MCP error responses
2. **Logging**: Structured logs with error category, context, and stack traces
3. **Metrics**: Error counts by category (if metrics enabled)
4. **Events**: Error events emitted for monitoring tools

## Consequences

### Positive
- Resilient to transient failures
- Clear error semantics
- Configurable behavior
- Good observability
- Balanced resource usage

### Negative
- Implementation complexity
- Configuration surface area
- More test scenarios needed
- Potential for configuration errors

### Neutral
- Documentation needed for error categories
- Monitoring setup recommended for production use
- Learning curve for configuration options

## Monitoring Recommendations

Track these metrics:
- Error rate by category
- Retry success/failure rates  
- Time spent in retry loops
- Circuit breaker trips (if implemented later)
- Fatal error occurrences

## Future Enhancements

Consider adding:
- Circuit breaker for high-volume scenarios
- Dead letter queue for failed tool calls
- Error recovery callbacks for custom handling
- Automatic error report submission