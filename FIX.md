# Capability Grant Bug - Step 7 Failure Analysis

## Problem Summary

Step 7 of TESTING-CODER-AGENT.md fails: After sending `capability/grant` to give the MEW agent write_file permission, the agent continues to create proposals instead of using direct `mcp/request` calls.

## Root Cause: Participant ID Mismatch

### What Happens

1. **Space Configuration** defines logical participant ID as `"mew"` in `.mew/space.yaml`
2. **WebSocket Connection** generates random client ID: `"client-1759310701273-q9i1e5jkg"`
3. **capability/grant Message** uses logical name:
   - `to: ["mew"]`
   - `payload.recipient: "mew"`
4. **Gateway Broadcasts** the grant successfully (all participants receive it)
5. **Gateway Tries to Send Updated Welcome**:
   - Line 1069: `const recipientWs = space?.participants.get(recipient);`
   - Looks for `"mew"` in participants map
   - **FAILS** because map uses `"client-..."` keys
6. **No Updated Welcome Sent** → Agent never learns about new capabilities

### Evidence

```bash
# Capability grant was delivered
$ grep capability/grant .mew/logs/envelope-history.jsonl
2025-10-01T10:28:43.543Z - event:received - participant:human
2025-10-01T10:28:43.544Z - event:delivered - participant:client-1759310701273-q9i1e5jkg
2025-10-01T10:28:43.544Z - event:delivered - participant:mcp-fs-bridge

# But NO system/welcome after that timestamp
$ grep system/welcome .mew/logs/envelope-history.jsonl | grep -A1 "10:28:43"
# (no results)

# Agent still creates proposals for write_file
$ grep mcp/proposal .mew/logs/envelope-history.jsonl | tail -1
2025-10-01T10:29:28.064Z - kind:mcp/proposal - write_file - baz.txt
```

## Current Implementation Analysis

### MEWParticipant Capability Update Mechanism ✅

**File**: `/Users/rj/Git/rjcorwin/mew-protocol/packages/mew/src/participant/MEWParticipant.ts`

MEWParticipant **correctly handles** capability updates via `system/welcome`:

```typescript
this.onWelcome(async (data: any) => {
  const previousCapabilities = this.participantInfo?.capabilities?.length || 0;
  this.participantInfo = {
    id: data.you.id,
    capabilities: data.you.capabilities  // ✅ Updates capabilities
  };

  // Logs when capabilities change
  if (previousCapabilities > 0 && newCapabilities !== previousCapabilities) {
    console.log(`[MEWParticipant] Capabilities updated: ${previousCapabilities} -> ${newCapabilities}`);
  }
});
```

### Gateway Capability Grant Handler ❌

**File**: `/Users/rj/Git/rjcorwin/mew-protocol/packages/mew/src/cli/commands/gateway.ts:1045-1070`

Gateway **attempts** to send updated welcome but fails:

```typescript
const recipient = message.payload?.recipient;  // "mew"
const grantCapabilities = message.payload?.capabilities || [];
const grantId = message.id || `grant-${Date.now()}`;

if (recipient && grantCapabilities.length > 0) {
  // Stores capabilities correctly
  if (!runtimeCapabilities.has(recipient)) {
    runtimeCapabilities.set(recipient, new Map());
  }
  const recipientCaps = runtimeCapabilities.get(recipient);
  recipientCaps.set(grantId, grantCapabilities);

  // Tries to send updated welcome
  const space = spaces.get(spaceId);
  const recipientWs = space?.participants.get(recipient);  // ❌ FAILS HERE
  if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
    // ... send updated welcome (NEVER REACHED)
  }
}
```

**Problem**: `space.participants` map uses client IDs, not logical participant names.

### No Logical Name → Client ID Mapping

The gateway has:
- `tokenMap`: logical ID → token
- `space.participants`: client ID → WebSocket
- **MISSING**: logical ID → client ID mapping

When participant joins:
```typescript
participantId = message.participantId ||  // "client-..." (random)
                message.payload?.participantId ||
                `participant-${Date.now()}`;
space.participants.set(participantId, ws);  // Uses client ID as key
```

But space.yaml defines `"mew"`, and no reverse mapping is stored.

## MEW Protocol v0.4 Spec Analysis

### Current Spec Says (Section 3.6.1):

```
- Gateway SHOULD add granted capabilities to recipient's capability set
- Multiple grants are cumulative
```

### Spec is Ambiguous On:

1. **Who updates participant capabilities?**
   - Gateway sends updated `system/welcome`? (implicit from implementation)
   - Participant handles `capability/grant` directly? (not specified)

2. **How to resolve participant IDs?**
   - Spec examples use same ID for logical name and participant ID
   - No guidance on logical name vs client ID mismatch

3. **When is `capability/grant-ack` sent?**
   - After receiving grant message?
   - After receiving updated welcome?
   - Spec shows ack but doesn't specify timing

## Fixes Required

### 1. Fix Gateway - Track Logical ID → Client ID Mapping

**File**: `packages/mew/src/cli/commands/gateway.ts`

**Option A - Store Reverse Mapping at Join:**

```typescript
// At join time (around line 807)
const participantMetadata = new Map(); // Track logical → client mapping

if (message.kind === 'system/join' || message.type === 'join') {
  const token = message.token || message.payload?.token;
  const logicalId = Array.from(tokenMap.entries())
    .find(([_, t]) => t === token)?.[0];

  participantId = message.participantId ||
                  message.payload?.participantId ||
                  `participant-${Date.now()}`;

  // Store mapping
  if (logicalId) {
    participantMetadata.set(logicalId, {
      clientId: participantId,
      logicalId: logicalId,
      token: token
    });
  }

  space.participants.set(participantId, ws);
}
```

**Then at capability/grant (line 1069):**

```typescript
const recipient = message.payload?.recipient;
const metadata = participantMetadata.get(recipient);
const actualClientId = metadata?.clientId || recipient;

const recipientWs = space?.participants.get(actualClientId);  // ✅ Now works
if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
  // Send updated welcome...
}
```

**Option B - Iterate All Participants:**

```typescript
// Find recipient by checking all participants
const recipient = message.payload?.recipient;
let recipientWs = null;
let recipientClientId = null;

for (const [pid, ws] of space.participants) {
  // Check if this participant's token matches the recipient
  const pToken = participantTokens.get(pid);
  const recipientToken = tokenMap.get(recipient);
  if (pToken === recipientToken) {
    recipientWs = ws;
    recipientClientId = pid;
    break;
  }
}

if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
  // Send updated welcome using recipientClientId...
}
```

### 2. Optional: MEWParticipant Handle capability/grant Directly

**File**: `packages/mew/src/participant/MEWParticipant.ts:1069`

Add to `onMessage` handler:

```typescript
if (envelope.kind === 'capability/grant') {
  if (this.isAddressedToSelf(envelope)) {
    const grantedCaps = envelope.payload?.capabilities || [];
    if (grantedCaps.length > 0) {
      // Update capabilities directly
      this.participantInfo.capabilities = [
        ...this.participantInfo.capabilities,
        ...grantedCaps
      ];

      console.log(`[MEWParticipant] Granted ${grantedCaps.length} new capabilities`);

      // Send acknowledgment
      await this.send({
        protocol: PROTOCOL_VERSION,
        id: `ack-${Date.now()}`,
        ts: new Date().toISOString(),
        from: this.options.participant_id!,
        correlation_id: [envelope.id],
        kind: 'capability/grant-ack',
        payload: { status: 'accepted' }
      });
    }
  }
}
```

**Note**: This is redundant if gateway sends updated welcome, but provides defense-in-depth.

### 3. Clarify MEW Protocol v0.4 Spec

**File**: `mew-protocol-spec/v0.4/SPEC.md:549-640`

**Add to Section 3.6.1 after line 581:**

```markdown
#### Capability Update Flow

When the gateway processes a `capability/grant`:

1. **Validate**: Check sender has `capability/grant` permission
2. **Store**: Add granted capabilities to recipient's runtime capability set
3. **Notify**: Send updated `system/welcome` to recipient with combined static + runtime capabilities
4. **Acknowledge**: Recipient sends `capability/grant-ack` after updating capabilities

**Important**: The gateway MUST resolve logical participant names to actual participant IDs when sending the updated welcome. If the recipient's participant ID differs from their logical name (e.g., "mew" vs "client-123"), the gateway must maintain a mapping.

**Example Flow**:

```
1. Human → Gateway: capability/grant (to: ["mew"])
2. Gateway: Validates, stores capabilities for "mew"
3. Gateway → Agent: system/welcome (to: ["client-123"], with new capabilities)
4. Agent: Updates participantInfo.capabilities
5. Agent → Gateway: capability/grant-ack (correlation_id: ["grant-789"])
```
```

**Add new subsection 3.6.4:**

```markdown
#### 3.6.4 Participant ID Resolution

Gateways MUST maintain a mapping between logical participant names (from configuration) and runtime participant IDs (from WebSocket connections):

- Logical names are defined in space configuration (e.g., "mew", "orchestrator")
- Runtime IDs are assigned during connection (e.g., "client-1234567-abc")
- Messages addressed to logical names must be resolved to runtime IDs for delivery

When processing `capability/grant`, `capability/revoke`, or other messages that reference participants by name, the gateway MUST:
1. Resolve the logical name to the actual runtime participant ID
2. Use the runtime ID to locate the participant's WebSocket connection
3. Deliver messages using the runtime ID
```

### 4. Test the Fix

**Update Step 7 to use actual participant ID:**

Instead of:
```json
{
  "payload": {
    "recipient": "mew",  // ❌ Logical name
    ...
  }
}
```

Use the actual client ID from system/welcome:
```bash
# Get actual participant ID
AGENT_ID=$(grep '"kind":"system/welcome"' .mew/logs/envelope-history.jsonl | \
  jq -r 'select(.envelope.to[0] | contains("client")) | .envelope.payload.you.id' | \
  tail -1)

# Send grant with actual ID
curl -X POST 'http://localhost:8080/participants/human/messages?space=coder' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \
  -d "{
    \"protocol\": \"mew/v0.4\",
    \"id\": \"grant-write-capability\",
    \"from\": \"human\",
    \"to\": [\"$AGENT_ID\"],
    \"kind\": \"capability/grant\",
    \"payload\": {
      \"recipient\": \"$AGENT_ID\",
      \"capabilities\": [{
        \"kind\": \"mcp/request\",
        \"payload\": {
          \"method\": \"tools/call\",
          \"params\": {\"name\": \"write_file\"}
        }
      }],
      \"reason\": \"Agent has demonstrated safe file handling\"
    }
  }"
```

## Summary

**Immediate Fix**: Implement Option A (store logical → client mapping in gateway)

**Spec Clarification**: Add participant ID resolution requirements to v0.4 spec

**Long-term**: Consider whether logical names should be preserved as the canonical participant ID instead of generating random client IDs
