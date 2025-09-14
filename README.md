# 🐱 MEW Protocol - Multi-Entity Workspace Protocol 🚀

MEW Protocol (pronounced like a cat's "mew" 🐾) addresses the challenge of "herding cats" - coordinating multiple autonomous AI agents and MCP Servers in a shared workspace while maintaining human control through capability-based permissions and progressive trust.

## The Evolution

```
MCP:  human ──► agent ════► mcp_server
                  ↑
            trust boundary
            (agent decides)

A2A:  human ──► agent₁ ════► agent₂
                  ↑
            trust boundary
            (agent₁ decides)

MEW:  human ──►┌─────────┐◄── agent
               │ GATEWAY │
 mcp_server ──►└─────────┘◄── agent₂
                    ↑
              trust boundary
            (gateway enforces)
```

**Legend:** ──► trusted flow, ════► potentially untrusted

In MEW Protocol, everyone joins as equal **participants** - humans, agents, and MCP servers all:
- 💬 Can send chat messages and MCP requests to any other participant
- 🎯 See every operation broadcast in the shared workspace
- 🛡️ Have capabilities enforced by the gateway, not by trust

## 🌟 Key Features

- **🟰 Universal participants**: Humans, agents, and MCP servers all join as peers
- **🔐 Proposal mechanism**: Limited participants propose operations, privileged ones fulfill or reject
- **🌉 Protocol bridging**: Humans, MCP servers, and agents work seamlessly in unified context
- **👁️ Complete transparency**: Every message visible, participants filter by their concerns

## 🎯 How It Works

1. 🪐 Participants join a workspace (or "space") with specific capabilities
2. 💭 Untrusted participants propose operations
3. ✅ Trusted participants (human or AI) approve and execute
4. 🎓 Over time, safe patterns earn direct execution rights
5. 🎮 Humans maintain ultimate control while automation grows

## 📦 Current Version

**v0.3** - Released 2025-01-09 🎉

MEW Protocol is in experimental phase (v0.x) with breaking changes allowed between versions. See [spec/v0.3/SPEC.md](/spec/v0.3/SPEC.md) for the current specification.

## 🚀 Quick Start

### Install

```bash
npm install -g mew-protocol
```

### Create & Launch a Workspace

```bash
# Create a new directory for your workspace
mkdir my-workspace
cd my-workspace

# Start MEW - it will guide you through setup
mew

# 🐱 MEW Protocol workspace starting...
# 🎯 Setting up your workspace...
# 🤖 Choose your AI agent (Claude, GPT-4, etc.)
# 📁 Select tools (filesystem, web search, etc.)
# 🔐 Configure capabilities (proposals vs direct execution)
#
# Type 'help' for commands or start chatting!
```

That's it! MEW guides you through setting up your workspace with:
- 🧑‍💻 You participating directly via terminal
- 🤖 AI agent(s) with configured capabilities
- 🛠️ Tools and MCP servers for extended functionality
- ✅ Proposal/approval flow for safe operations
- 🎓 Progressive trust as patterns prove safe

## 📚 Learn More

- 📋 [Current Specification (v0.3)](/spec/v0.3/SPEC.md)
- 📝 [Draft Specification (next version)](/spec/draft/SPEC.md)
- 🏗️ [Architecture Decision Records](/spec/v0.3/decisions/)
- 📜 [Changelog](/CHANGELOG.md)

## 🐈 Why "MEW"?

The name playfully evokes "herding cats" 🐈‍⬛🐈🐈‍⬛ - the quintessential challenge of coordinating multiple independent, autonomous agents. MEW Protocol provides the framework to bring order to this chaos, teaching the "cats" to work together effectively in a shared workspace. 🌠
