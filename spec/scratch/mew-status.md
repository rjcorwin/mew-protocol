# MEW Agent Status Response Investigation

## Question
When I request status from the MEW Agent, I don't get a response. Is it built to respond?

## Investigation Results

### 1. MEWAgent Class Structure
The MEWAgent extends MEWParticipant, which extends MEWClient.

### 2. Status Request Handling in MEWParticipant

The MEWParticipant class **does** have built-in support for handling status requests:

#### Incoming Status Request Handler
```typescript
private handleParticipantRequestStatusMessage(envelope: Envelope): void {
  const request = (envelope.payload || {}) as ParticipantRequestStatusPayload;
  const payload = this.buildStatusPayload();

  let filtered: ParticipantStatusPayload = { ...payload };
  if (request.fields && request.fields.length > 0) {
    // Filter fields based on request
    filtered = { messages_in_context: payload.messages_in_context } as ParticipantStatusPayload;
    for (const field of request.fields) {
      if (field in payload) {
        (filtered as any)[field] = (payload as any)[field];
      }
    }
    filtered.status = payload.status;
    if (!request.fields.includes('messages_in_context')) {
      filtered.messages_in_context = payload.messages_in_context;
    }
  }

  if (!this.canSend({ kind: 'participant/status', payload: filtered })) {
    return;
  }

  this.send({
    kind: 'participant/status',
    to: [envelope.from],
    correlation_id: [envelope.id],
    payload: filtered
  });
}
```

#### Status Payload Builder
```typescript
protected buildStatusPayload(status?: string): ParticipantStatusPayload {
  const payload: ParticipantStatusPayload = {
    tokens: Math.round(this.contextTokens),
    max_tokens: this.contextMaxTokens,
    messages_in_context: Math.round(this.contextMessages)
  };

  const activeStatus = status || (this.isPauseActive() ? 'paused' : 'active');
  if (activeStatus) {
    payload.status = activeStatus;
  }

  return payload;
}
```

### 3. Message Routing

The status request handler is wired up in the `setupLifecycle()` method:

```typescript
if (this.isAddressedToSelf(envelope)) {
  // ... other handlers ...
  if (envelope.kind === 'participant/request-status') {
    this.handleParticipantRequestStatusMessage(envelope);
  }
  // ... more handlers ...
}
```

### 4. Capability Check

The handler checks if it can send status responses before responding:

```typescript
if (!this.canSend({ kind: 'participant/status', payload: filtered })) {
  return;
}
```

This means the agent will only respond if it has the `participant/status` capability.

### 5. What Status Information is Provided

The MEWAgent (through MEWParticipant) provides:

- **tokens**: Current token usage in context
- **max_tokens**: Maximum token limit
- **messages_in_context**: Number of messages in context
- **status**: Current status ('active', 'paused', 'compacting', etc.)

### 6. MEWAgent-Specific Status

MEWAgent adds additional context tracking:
- Conversation history length
- Tool discovery status
- Message queue state
- Reasoning state

## Conclusion

**YES, the MEW Agent is built to respond to status requests.**

If you're not getting a response, possible reasons are:

1. **Missing Capability**: The agent doesn't have the `participant/status` capability granted
2. **Not Addressed Correctly**: The request isn't being routed to the agent (check `to` field)
3. **Capability Check Failing**: The agent thinks it can't send status responses
4. **Message Not Received**: The request message isn't reaching the agent at all

### Debugging Steps

1. Check if the agent has the `participant/status` capability in its welcome message
2. Verify the status request is addressed to the agent (includes agent ID in `to` field)
3. Look for debug logs showing the request was received
4. Check if there are any capability-related warnings in the logs

### Example Status Request

```json
{
  "protocol": "mew/v0.4",
  "id": "status-req-123",
  "ts": "2024-01-01T00:00:00.000Z",
  "from": "requester-id",
  "to": ["mew-agent-id"],
  "kind": "participant/request-status",
  "payload": {
    "fields": ["tokens", "status", "messages_in_context"]
  }
}
```

### Expected Response

```json
{
  "protocol": "mew/v0.4",
  "id": "status-resp-456",
  "ts": "2024-01-01T00:00:00.000Z",
  "from": "mew-agent-id",
  "to": ["requester-id"],
  "correlation_id": ["status-req-123"],
  "kind": "participant/status",
  "payload": {
    "tokens": 1500,
    "max_tokens": 20000,
    "messages_in_context": 5,
    "status": "active"
  }
}
```