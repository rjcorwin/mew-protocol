# ADR-mqr: Message Queueing During Reasoning Loops

**Status:** Proposed
**Date:** 2025-01-03
**Incorporation:** Not Incorporated

## Context

Currently, when a MEWAgent is processing a message in its ReAct reasoning loop, any new incoming messages trigger separate, concurrent reasoning loops. This creates a "forking" behavior where the agent attempts to process multiple conversations simultaneously, leading to:

1. **Resource Waste**: Multiple concurrent LLM calls and reasoning chains
2. **Context Loss**: Each fork lacks awareness of the other reasoning processes
3. **Confusing Responses**: Users may receive out-of-order or conflicting responses
4. **Race Conditions**: Concurrent modifications to conversation history and state
5. **Missed Context**: Later messages might contain clarifications or corrections that the first reasoning loop never sees

### Current Behavior

The message flow currently works as follows:
```
Message 1 arrives → Start reasoning loop 1
Message 2 arrives → Start reasoning loop 2 (concurrent)
Message 3 arrives → Start reasoning loop 3 (concurrent)
Each loop completes independently
```

This happens because `setupAgentBehavior()` immediately calls `handleChat()` for every incoming message, which starts a new `processWithReAct()` loop.

### Additional Context

The MEWAgent currently supports two reasoning formats: "native" (OpenAI's standard message format) and "scratchpad" (text-based context). As part of this change, we are deprecating the scratchpad format and standardizing on the native format only, which simplifies the implementation and provides better LLM compatibility.

### Desired Behavior

Messages arriving during reasoning should be queued and incorporated into the current reasoning context:
```
Message 1 arrives → Start reasoning loop
Message 2 arrives → Queue message
During next iteration → Include Message 2 in context
Message 3 arrives → Queue message
During next iteration → Include Message 3 in context
Single coherent response addressing all messages
```

## Options Considered

### Option 1: Simple Message Queue with End-of-Loop Processing

Queue messages and process them after the current reasoning loop completes.

**Implementation:**
```typescript
class MEWAgent {
  private isProcessing = false;
  private messageQueue: Envelope[] = [];

  private async handleChat(envelope: Envelope) {
    if (this.isProcessing) {
      this.messageQueue.push(envelope);
      return;
    }

    this.isProcessing = true;
    try {
      await this.processWithReAct(envelope.payload.text);

      // Process queued messages
      while (this.messageQueue.length > 0) {
        const nextMessage = this.messageQueue.shift()!;
        await this.processWithReAct(nextMessage.payload.text);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
```

**Pros:**
- Simple to implement
- Each message gets full processing
- No modifications to reasoning loop
- Clear sequential handling

**Cons:**
- Messages processed serially, not as a batch
- User waits longer for responses
- Doesn't leverage context from multiple messages together
- Can't interrupt or modify current reasoning

### Option 2: Direct Message Injection into LLM Context

Inject queued messages directly into the message array sent to the LLM during reasoning iterations.

**Implementation:**
```typescript
class MEWAgent {
  private messageQueue: Envelope[] = [];
  private isProcessing = false;

  private async handleChat(envelope: Envelope) {
    if (this.isProcessing) {
      this.messageQueue.push(envelope);
      this.log('debug', `Message queued from ${envelope.from}, queue size: ${this.messageQueue.length}`);
      return;
    }

    this.isProcessing = true;
    try {
      await this.processWithReAct(envelope.payload.text);
    } finally {
      this.isProcessing = false;
      // Process any final queued messages
      if (this.messageQueue.length > 0) {
        const nextMessage = this.messageQueue.shift()!;
        await this.handleChat(nextMessage);
      }
    }
  }

  private buildNativeFormatMessages(input: string, previousThoughts: Thought[]): any[] {
    const messages: any[] = [
      {
        role: 'system',
        content: this.config.systemPrompt || 'You are a helpful assistant...'
      }
    ];

    // Add the original user request
    messages.push({ role: 'user', content: input });

    // Add previous thoughts as proper assistant/tool messages
    for (const thought of previousThoughts) {
      // ... existing thought processing ...
    }

    // INJECT QUEUED MESSAGES HERE
    if (this.messageQueue.length > 0) {
      // Add queued messages as additional user messages
      const queuedMessages = [...this.messageQueue];
      this.messageQueue = []; // Clear queue after consuming

      for (const queued of queuedMessages) {
        messages.push({
          role: 'user',
          content: queued.payload.text,
          name: queued.from // Track sender
        });

        // Also add to conversation history for persistence
        this.conversationHistory.push({
          role: 'user',
          content: queued.payload.text,
          name: queued.from
        });
      }

      // Add a system message to help LLM understand context
      if (queuedMessages.length > 0) {
        messages.push({
          role: 'system',
          content: `${queuedMessages.length} additional message(s) were received while you were processing. Please consider them in your response.`
        });
      }
    }

    return messages;
  }

  // Note: Scratchpad format is being deprecated in favor of native format only
}
```

**Pros:**
- Very simple implementation
- Leverages existing message building infrastructure
- Natural conversation flow (multiple user messages)
- LLM sees messages in proper chronological order
- Maintains proper role structure
- Easy to test and debug

**Cons:**
- Only works during reasoning iterations (not during tool execution)
- Messages might wait until next iteration
- No priority handling
- Can't interrupt current processing

### Option 3: Queue with Intelligent Interruption

Queue messages but allow certain types to interrupt the current reasoning.

**Implementation:**
```typescript
class MEWAgent {
  private reasoningController?: AbortController;
  private messageQueue: PriorityQueue<QueuedMessage>;

  private async handleChat(envelope: Envelope) {
    const priority = this.assessPriority(envelope);

    if (this.isProcessing) {
      if (priority === Priority.CRITICAL) {
        // Interrupt current reasoning
        this.reasoningController?.abort();
        // Restart with new context
      } else {
        this.messageQueue.enqueue({ envelope, priority });
      }
      return;
    }
    // ...
  }

  private assessPriority(envelope: Envelope): Priority {
    const text = envelope.payload.text.toLowerCase();
    if (text.includes('stop') || text.includes('cancel')) {
      return Priority.CRITICAL;
    }
    if (envelope.to?.includes(this.options.participant_id)) {
      return Priority.HIGH;
    }
    return Priority.NORMAL;
  }
}
```

**Pros:**
- Handles urgent messages immediately
- Respects user's ability to interrupt
- Priority-based processing
- More natural interaction flow

**Cons:**
- Complex interruption logic
- Potential for lost work
- Difficult abort handling
- Priority assessment may be wrong

### Option 4: Conversation Threading with Queue Merge

Treat the reasoning loop as a conversation thread that accumulates messages until ready to process them as a batch.

**Implementation:**
```typescript
interface ReasoningThread {
  id: string;
  startedAt: Date;
  originalEnvelope: Envelope;
  queuedEnvelopes: Envelope[];
  thoughts: Thought[];
  state: 'reasoning' | 'responding' | 'complete';
}

class MEWAgent {
  private activeThread?: ReasoningThread;
  private threadLock = new AsyncLock();

  private async handleChat(envelope: Envelope) {
    await this.threadLock.acquire();
    try {
      if (this.activeThread && this.activeThread.state === 'reasoning') {
        // Add to current thread
        this.activeThread.queuedEnvelopes.push(envelope);
        this.emit('message-queued', {
          threadId: this.activeThread.id,
          queueLength: this.activeThread.queuedEnvelopes.length
        });
        return;
      }

      // Start new thread
      this.activeThread = {
        id: uuidv4(),
        startedAt: new Date(),
        originalEnvelope: envelope,
        queuedEnvelopes: [],
        thoughts: [],
        state: 'reasoning'
      };

      await this.processThread(this.activeThread);
    } finally {
      this.threadLock.release();
    }
  }

  private async processThread(thread: ReasoningThread) {
    let input = thread.originalEnvelope.payload.text;

    while (thread.thoughts.length < this.config.maxIterations) {
      // Check for queued messages before each iteration
      if (thread.queuedEnvelopes.length > 0) {
        const newMessages = thread.queuedEnvelopes.splice(0, thread.queuedEnvelopes.length);

        // Add to conversation history
        for (const msg of newMessages) {
          this.conversationHistory.push({
            role: 'user',
            content: msg.payload.text,
            name: msg.from
          });
        }

        // Update input context for next reasoning
        const additionalInput = newMessages.map(m => `[${m.from}]: ${m.payload.text}`).join('\n');
        input = `${input}\n\nAdditional messages:\n${additionalInput}`;
      }

      // Reason with potentially updated input
      const thought = await this.reason(input, thread.thoughts);
      thread.thoughts.push(thought);

      if (thought.action === 'respond') {
        thread.state = 'responding';
        await this.sendResponse(thought.actionInput, thread.originalEnvelope.from);

        // Also notify queued message senders if different
        const uniqueSenders = new Set(thread.queuedEnvelopes.map(e => e.from));
        uniqueSenders.delete(thread.originalEnvelope.from);
        for (const sender of uniqueSenders) {
          await this.sendResponse(thought.actionInput, sender);
        }

        thread.state = 'complete';
        break;
      }

      // Continue with tool execution...
      // ...
    }

    this.activeThread = undefined;
  }
}
```

**Pros:**
- Clean thread-based model
- Messages naturally accumulate
- Single coherent response
- Proper state management
- Can emit events for monitoring
- Handles multiple senders correctly

**Cons:**
- More complex implementation
- Requires thread management
- Lock contention possible
- Memory overhead for thread state

## Decision

**Selected Option: Option 2 - Direct Message Injection into LLM Context**

After careful consideration, Option 2 provides the best balance of simplicity, effectiveness, and maintainability. It leverages the existing message building infrastructure to naturally incorporate queued messages into the LLM's context, treating them as additional user messages in the conversation.

### Implementation Details

1. **Simple Queue**: A single `messageQueue: Envelope[]` array to hold incoming messages while `isProcessing = true`.

2. **Injection Point**: Messages are injected in `buildNativeFormatMessages()` method, right after adding previous thoughts but before sending to LLM. (Note: Scratchpad format is being deprecated)

3. **Message Format**: Queued messages are added as standard `user` role messages with the sender's name attached, maintaining the natural conversation flow.

4. **Queue Clearing**: The queue is consumed and cleared each time messages are built for the LLM, ensuring messages are processed exactly once.

5. **Response Strategy**: The final response goes to the original sender. For queued messages from different senders, we track them and can optionally send responses to all unique participants.

6. **Edge Cases Handled**:
   - Multiple messages from same sender: All appear as separate user messages
   - Messages from different senders: Tracked via `name` field
   - Messages during tool execution: Wait for next reasoning iteration
   - Messages during final response: Start new processing cycle
   - Queue overflow: Configurable max queue size with oldest message dropping

### Configuration Options

```typescript
interface MessageQueueConfig {
  enableQueueing: boolean;          // Enable message queueing (default: true)
  maxQueueSize: number;             // Maximum messages to queue (default: 5)
  dropStrategy: 'oldest' | 'newest' | 'none';  // What to do when queue is full (default: 'oldest')
  notifyQueueing: boolean;          // Emit events when messages are queued (default: true)
  includeQueuedSenderNotification: boolean;  // Add system message about additional senders (default: true)
}
```

### Migration Path

1. **Phase 1**: Add `messageQueue` and `isProcessing` flag to MEWAgent
2. **Phase 2**: Modify `handleChat()` to queue messages when processing
3. **Phase 3**: Update `buildNativeFormatMessages()` to inject queued messages
4. **Phase 4**: Remove scratchpad format support entirely
5. **Phase 5**: Add configuration options and make it default behavior
6. **Phase 6**: Add monitoring and events for queue status

## Consequences

### Positive

- **Simplicity**: Minimal code changes required, reuses existing infrastructure
- **Better User Experience**: Users get coherent responses that address all their messages
- **Resource Efficiency**: Single reasoning loop instead of multiple concurrent ones
- **Context Preservation**: Follow-up messages and corrections are naturally included
- **Natural Flow**: LLM sees multiple user messages as a normal conversation
- **Easy Debugging**: Queue state is simple to inspect and understand

### Negative

- **Iteration Delay**: Messages wait until next reasoning iteration to be processed
- **No Interruption**: Can't stop current processing for urgent messages
- **Limited During Tools**: Messages during tool execution must wait
- **No Priority**: All messages treated equally
- **Potential Confusion**: LLM might be confused by sudden appearance of new messages mid-reasoning

### Mitigation Strategies

1. **Acknowledgment**: Emit a "message-queued" event that UIs can show to users
2. **System Message**: Add a system message telling LLM about the additional messages
3. **Queue Limits**: Cap queue size to prevent memory issues
4. **Clear Context**: The system message helps LLM understand why new messages appeared
5. **Documentation**: Clear documentation of the queueing behavior

## Implementation Notes

### Key Files to Modify

1. `MEWAgent.ts`:
   - Add `messageQueue: Envelope[]` and `isProcessing: boolean` properties
   - Modify `handleChat()` to check and set processing flag
   - Update `buildNativeFormatMessages()` to inject queued messages
   - Remove scratchpad format support (deprecated)
2. `AgentConfig` interface: Add message queue configuration options

### Test Scenarios

1. Single message - normal flow unchanged
2. Two messages in quick succession - second queued and injected in next iteration
3. Multiple messages from same sender - all appear as separate user messages
4. Messages from different senders - tracked with name field
5. Messages during tool execution - wait for next reasoning iteration
6. Messages after "respond" decision - processed in new cycle
7. Queue overflow (>5 messages) - oldest messages dropped
8. Error during reasoning with queued messages - queue preserved for retry

### Observability

Emit events for:
- `message-queued`: Message added to queue with sender and queue size
- `queue-injected`: Queued messages injected into LLM context
- `queue-overflow`: Message dropped due to queue size limit
- `processing-started`: ReAct loop begins
- `processing-completed`: ReAct loop ends

## References

- Current implementation: `sdk/typescript-sdk/agent/src/MEWAgent.ts`
- ReAct pattern specification: `sdk/spec/draft/SPEC.md` (Section: ReAct Loop)
- Message handling: `setupAgentBehavior()` and `handleChat()` methods
- Related: Conversation history management in MEWAgent