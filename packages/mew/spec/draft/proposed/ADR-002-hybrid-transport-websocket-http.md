# ADR-002: Hybrid WebSocket + HTTP Transport for Message Delivery

## Status
Proposed

## Context

The MEW Protocol specification defines a WebSocket-based gateway for real-time message exchange between participants. However, the current implementation includes an additional HTTP API for message injection that is not mentioned in the specification.

The implementation reveals several transport requirements:
1. **Real-time bidirectional communication** for interactive participants
2. **Non-blocking message injection** for automated testing and CI/CD
3. **Fire-and-forget messaging** for participants that don't need responses
4. **Integration with external systems** that can't maintain WebSocket connections

Current implementation provides:
- WebSocket endpoint: `ws://localhost:8080` (spec-compliant)
- HTTP POST endpoint: `POST /participants/{id}/messages` (implementation extension)
- Health endpoint: `GET /health` (operational requirement)

## Decision

We will implement a **hybrid transport approach** that combines WebSocket (primary) with HTTP (auxiliary) for different use cases.

### Transport Matrix:

| Use Case | Transport | Rationale |
|----------|-----------|-----------|
| Interactive clients | WebSocket | Bidirectional, real-time |
| Autonomous agents | WebSocket | Full protocol support |
| Test automation | HTTP | Non-blocking, simple |
| CI/CD integration | HTTP | Stateless, reliable |
| External webhooks | HTTP | Industry standard |
| Monitoring/health | HTTP | RESTful conventions |

### HTTP API Design:

```
POST /participants/{participantId}/messages
Authorization: Bearer {token}
Content-Type: application/json

{
  "kind": "chat",
  "payload": { "text": "Hello from HTTP" }
}
```

The gateway adds protocol envelope fields:
- `protocol: "mew/v0.4"`
- `id: "http-${timestamp}-${random}"`
- `ts: "${iso8601_timestamp}"`
- `from: "${participantId}"`

## Rationale

### WebSocket Benefits:
- **Real-time**: Immediate message delivery
- **Bidirectional**: Full request/response patterns
- **Efficient**: Low overhead for frequent messages
- **Stateful**: Connection represents participant presence

### HTTP Benefits:
- **Stateless**: No connection management required
- **Simple**: Standard REST conventions
- **Reliable**: Built-in retry mechanisms
- **Tooling**: Easy to test with curl, Postman, etc.
- **Integration**: Works with any HTTP client

### Hybrid Approach Advantages:
1. **Flexibility**: Choose transport based on use case
2. **Testing**: HTTP simplifies automated testing
3. **Integration**: External systems can inject messages
4. **Reliability**: HTTP for critical but infrequent messages
5. **Performance**: WebSocket for high-frequency interactions

## Implementation Details

### HTTP Message Injection:
```javascript
app.post('/participants/:participantId/messages', (req, res) => {
  const { participantId } = req.params;
  const token = extractBearerToken(req.headers.authorization);
  
  // Verify participant authentication
  if (!isValidToken(participantId, token)) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  
  // Build complete envelope
  const envelope = {
    protocol: 'mew/v0.4',
    id: `http-${Date.now()}-${randomId()}`,
    ts: new Date().toISOString(),
    from: participantId,
    ...req.body  // Merge in kind, payload, to, etc.
  };
  
  // Broadcast to WebSocket participants
  broadcastToSpace(envelope);
  
  res.json({ 
    id: envelope.id, 
    status: 'accepted',
    timestamp: envelope.ts 
  });
});
```

### Capability Enforcement:
Both transports use the same capability checking:
```javascript
// HTTP messages go through same capability validation
if (!(await hasCapabilityForMessage(participantId, envelope))) {
  return res.status(403).json({ 
    error: 'capability_violation',
    attempted_kind: envelope.kind 
  });
}
```

### Authentication:
- **WebSocket**: Token in join message payload
- **HTTP**: Standard `Authorization: Bearer {token}` header

### Space Resolution:
```javascript
// Use configured space ID as default
const spaceName = req.query.space || spaceConfig?.space?.id || 'default';
```

## Protocol Compliance

### MEW Protocol Alignment:
- HTTP-injected messages become standard MEW envelopes
- All messages broadcast to WebSocket participants
- Same capability enforcement applies
- Correlation tracking works across transports

### Message Flow:
```
HTTP Client -> HTTP API -> Gateway -> WebSocket Participants
                   ↓
              MEW Envelope Generation
```

## Consequences

### Positive:
- **Test Simplification**: HTTP makes testing easier than WebSocket mocking
- **Integration Flexibility**: External systems can participate via HTTP
- **Operational Benefits**: Health checks, metrics endpoints
- **Development Speed**: Rapid prototyping with curl/Postman

### Negative:
- **Complexity**: Two transport mechanisms to maintain
- **Specification Drift**: HTTP API not in MEW protocol spec
- **Security Surface**: Additional authentication/authorization logic
- **Consistency Risk**: Different behavior between transports

### Risks:
- **Protocol Fragmentation**: HTTP-specific features might emerge
- **Testing Assumptions**: Tests might not cover WebSocket edge cases
- **Authentication Confusion**: Different auth patterns per transport
- **Performance Implications**: HTTP overhead for high-frequency messages

## Security Considerations

### Authentication:
- HTTP uses Bearer tokens (standard)
- WebSocket uses tokens in join payload (MEW-specific)
- Same token validation for both transports

### Authorization:
- Same capability checking applies to both transports
- HTTP messages undergo capability validation before broadcast

### Rate Limiting:
- Consider rate limits on HTTP endpoint
- WebSocket has natural backpressure through connection

## Operational Impact

### Monitoring:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    spaces: spaces.size,
    websocket_clients: countWebSocketClients(),
    http_requests: httpRequestCounter,
    uptime: process.uptime()
  });
});
```

### Testing:
```bash
# Simple HTTP testing
curl -X POST http://localhost:8080/participants/test-agent/messages \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"kind": "chat", "payload": {"text": "Hello"}}'
```

### CI/CD Integration:
HTTP transport enables:
- Simple test message injection
- Status verification via health endpoint
- Stateless integration testing

## Future Considerations

### Additional Transports:
- **Server-Sent Events (SSE)**: For one-way streaming
- **gRPC**: For high-performance binary communication
- **MQTT**: For IoT integration scenarios

### Protocol Evolution:
- Keep HTTP API minimal to avoid protocol drift
- Consider HTTP-specific MEW protocol extension specification
- Maintain transport-agnostic message semantics

## Migration Path

This decision affects:
1. **Testing**: Update tests to use HTTP where appropriate
2. **Documentation**: Document HTTP API alongside WebSocket
3. **Client Libraries**: Consider HTTP client wrappers
4. **Monitoring**: Add HTTP-specific metrics

## Status Tracking

- [ ] Document HTTP API in specification
- [ ] Add HTTP transport tests
- [ ] Create HTTP client examples
- [ ] Add transport-specific monitoring metrics