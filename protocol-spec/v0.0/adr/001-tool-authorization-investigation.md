# ADR-001: Tool Authorization Investigation

## Investigation: MCP Approach to Tool Authorization

### Current MCP Approach

Based on examination of the MCP specification (draft version), MCP handles tool authorization through the following mechanisms:

#### 1. Trust & Safety Guidelines (Non-Protocol Level)

The MCP specification provides **guidelines** rather than protocol-level enforcement for tool authorization:

From `modelcontextprotocol/docs/specification/draft/server/tools.mdx`:

> For trust & safety and security, there **SHOULD** always be a human in the loop with the ability to deny tool invocations.
>
> Applications **SHOULD**:
> - Provide UI that makes clear which tools are being exposed to the AI model
> - Insert clear visual indicators when tools are invoked
> - Present confirmation prompts to the user for operations, to ensure a human is in the loop

#### 2. Client-Side Implementation Responsibility

Tool authorization is delegated to the **client implementation** rather than being part of the protocol:

> Clients **SHOULD**:
> - Prompt for user confirmation on sensitive operations
> - Show tool inputs to the user before calling the server, to avoid malicious or accidental data exfiltration
> - Validate tool results before passing to LLM
> - Implement timeouts for tool calls
> - Log tool usage for audit purposes

#### 3. Transport-Level Authorization

MCP includes OAuth 2.1-based authorization at the **transport level** (for HTTP-based transports) in `modelcontextprotocol/docs/specification/draft/basic/authorization.mdx`, but this is for:
- Authenticating clients to servers
- Protecting access to MCP server resources
- NOT for authorizing individual tool calls

#### 4. Elicitation Pattern

MCP introduces an "elicitation" pattern (`modelcontextprotocol/docs/specification/draft/client/elicitation.mdx`) that allows servers to request user input during interactions. While not specifically for tool authorization, it demonstrates a pattern for user interaction:
- Servers can request structured data from users
- Clients control the presentation and validation
- Users can accept, decline, or cancel requests

### Key Findings

1. **No Protocol-Level Tool Authorization**: MCP does not define protocol messages for tool authorization. It's considered an implementation concern.

2. **Client Implementation Freedom**: Clients are free to implement any authorization UI/UX they choose, from automatic approval to detailed confirmation dialogs.

3. **Trust Model**: MCP assumes clients are trusted to make authorization decisions on behalf of users.

4. **Security Through Transparency**: Emphasis is on making tool invocations visible and clear to users rather than enforcing authorization at the protocol level.

### Implications for MCPx

For MCPx, which involves multiple agents potentially calling each other's tools in a distributed environment, we need to consider:

1. **Multi-Party Authorization**: In MCPx, tool calls may cross agent boundaries, requiring authorization from the tool owner rather than just the caller's user.

2. **Delegation Patterns**: Agents may need to delegate authorization decisions to human operators or other agents.

3. **Audit Requirements**: Multi-agent scenarios require clear audit trails of who authorized what.

4. **Protocol-Level Support**: Unlike MCP's client-centric model, MCPx may benefit from protocol-level authorization messages to ensure interoperability.

### Recommendation

MCPx should extend beyond MCP's approach by:
1. Defining protocol-level authorization request/response messages
2. Supporting both synchronous (blocking) and asynchronous (non-blocking) authorization flows
3. Enabling authorization delegation patterns
4. Maintaining audit trails of authorization decisions

This would ensure consistent authorization behavior across different MCPx implementations while supporting the complex multi-agent scenarios that MCPx enables.