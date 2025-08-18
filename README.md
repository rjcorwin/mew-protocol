# MCPx: Multi-agent MCP Over Topics (Project Overview)

Think: a group chat where every participant is an MCP server. Drop agents, tools, and humans into a room and they can call each other’s tools in real time over a transparent, shared stream.

Use it to quickly wire up multi‑agent orchestration, robot fleets (telemetry + control), and human‑in‑the‑loop operations—without changing MCP itself.

MCPx defines a minimal, topic‑based message envelope that lets multiple MCP servers (agents/humans/robots) collaborate in shared “rooms.” Messages are visible to everyone in a topic; addressing is metadata only. MCP (JSON‑RPC 2.0) requests/responses are encapsulated unchanged inside the envelope.

## What is MCPx

- A meta‑envelope (`protocol: "mcp-x/v0"`) for routing, addressing, and correlating messages on shared topics.
- Every participant behaves like an MCP server; peers can invoke each other's tools directly (1:1).
- Rapidly expose existing MCP servers as agents discoverable and callable by other agents and humans—no changes to MCP required.
- MCP itself is unchanged: JSON‑RPC messages (initialize/initialized, tools/list, tools/call, etc.) are embedded verbatim as the envelope payload.
- Presence tracking is supported; chat happens through MCP tools like any other functionality.
- A small realtime gateway (WebSockets recommended) provides join/auth/presence/history but never rewrites MCP payloads.

## Why this spec (goals)

- Enable multi‑party MCP: make many MCP servers interoperable in the same room without inventing a new RPC.
- Keep it minimal: one envelope, explicit addressing, and correlation; no private delivery at the topic layer.
- Reuse MCP unmodified: leverage existing tools/resources/prompts and the 2025‑06‑18 lifecycle/semantics.
- Be transparent and observable: everyone can see topic traffic; great for debugging and human‑in‑the‑loop.
- Transport‑friendly: recommend WebSockets with token auth, presence, and small history for practical apps.
- Progressive adoption: works as a thin shim around today’s MCP servers and clients.
- Clear security model: topics are not private—use separate topics or higher‑layer crypto for confidentiality.

## Start Here

- v0 spec: `v0/SPEC.md` (core envelope, addressing, gateway API)
- Patterns: `v0/PATTERNS.md` (discovery/handshake, fan‑out, coordination, reconnect)

## Repo Notes

- `v0/` — current iteration 

MCPx aims to be the USB‑C of multi‑agent/human collaboration: minimal, predictable, and easy to adopt.
