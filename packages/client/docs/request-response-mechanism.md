# Request-Response Mechanism

## Overview

The MCPx Client implements a correlation-based request-response mechanism that tracks pending requests, handles timeouts, and matches responses to their originating requests.

## How It Works

### 1. Request Initiation

When a request is made (e.g., through `request()` method at line 538), the client:
- Generates a unique envelope ID
- Creates a Promise that will be resolved when the response arrives
- Stores the pending request with its resolver/rejector functions

```typescript
// packages/client/src/MCPxClient.ts:587
this.pendingRequests.set(fullEnvelope.id, pending);
```

### 2. Pending Request Structure

Each pending request stores:
- `resolve`: Promise resolver function
- `reject`: Promise rejector function  
- `timeout`: Timer ID for timeout handling
- `timestamp`: When the request was initiated

### 3. Timeout Handling

A timeout is set for each request (default: 30 seconds, configurable via `requestTimeout`):

```typescript
// packages/client/src/MCPxClient.ts:575-585
pending.timeout = setTimeout(() => {
  this.pendingRequests.delete(fullEnvelope.id);
  
  // Send cancellation notification
  this.notify([to], 'notifications/cancelled', {
    requestId: jsonRpcId,
    reason: 'timeout',
  });
  
  reject(new Error(`Request timeout: ${method}`));
}, this.options.requestTimeout);
```

If the timeout triggers:
1. The pending request is removed from the map
2. A cancellation notification is sent to the recipient
3. The Promise is rejected with a timeout error

### 4. Response Handling

When a message arrives with a `correlation_id` (packages/client/src/MCPxClient.ts:496-507):

```typescript
if (envelope.correlation_id && this.pendingRequests.has(envelope.correlation_id)) {
  const pending = this.pendingRequests.get(envelope.correlation_id)!;
  this.pendingRequests.delete(envelope.correlation_id);
  
  if (pending.timeout) clearTimeout(pending.timeout);
  
  if ('error' in message && message.error) {
    pending.reject(new Error(message.error.message));
  } else if ('result' in message) {
    pending.resolve(message.result);
  }
}
```

The client:
1. Retrieves the pending request using the correlation ID
2. Removes it from the pending requests map
3. Clears the timeout timer
4. Resolves or rejects the Promise based on the response

### 5. Error Handling

If sending the request fails (packages/client/src/MCPxClient.ts:589-593):

```typescript
this.send(fullEnvelope).catch((error) => {
  this.pendingRequests.delete(fullEnvelope.id);
  if (pending.timeout) clearTimeout(pending.timeout);
  reject(error);
});
```

The client:
1. Removes the pending request
2. Clears the timeout
3. Rejects the Promise with the send error

### 6. Cleanup on Disconnect

When disconnecting (packages/client/src/MCPxClient.ts:326), all pending requests are cleaned up:

```typescript
this.pendingRequests.delete(reqId);
```

## Key Properties

- **Correlation-based**: Uses envelope IDs and correlation IDs to match requests with responses
- **Timeout protection**: Automatically cleans up requests that don't receive responses
- **Error propagation**: Properly propagates both network errors and protocol errors
- **Resource cleanup**: Ensures timers are cleared and memory is freed

## Configuration

The timeout duration can be configured when creating the client:

```typescript
const client = new MCPxClient({
  requestTimeout: 60000  // 60 seconds
});
```

## Usage Example

```typescript
// Making a request
const result = await client.request(
  participantId,
  'tools/call',
  { name: 'calculator', arguments: { operation: 'add', a: 5, b: 3 } }
);

// The Promise will:
// - Resolve with the result when a response arrives
// - Reject with a timeout error if no response within timeout period
// - Reject with an error if the response contains an error
// - Reject if sending fails
```