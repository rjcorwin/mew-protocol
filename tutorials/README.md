# MCPx Tutorials

Welcome to the MCPx tutorial series! These tutorials will guide you through understanding, using, and extending the MCPx protocol.

## 🎯 Learning Path

### [1. Getting Started](01-getting-started.md) ← Start Here!
**For:** Everyone new to MCPx  
**You'll Learn:**
- What MCPx is and how it extends MCP
- How to run the gateway and example agents
- Understanding the protocol through hands-on exploration
- How agents discover and use each other's tools

**Time:** ~15 minutes

---

### [2. Build Your First Agent](02-build-your-agent.md) 
**For:** Developers wanting to create MCPx-compatible agents  
**You'll Learn:**
- Agent architecture and lifecycle
- Implementing MCP tool exposure
- Handling chat messages and system events
- Best practices for agent development

**Time:** ~30 minutes

---

### [3. Extend the Gateway](03-extend-gateway.md)
**For:** Developers customizing the gateway for specific use cases  
**You'll Learn:**
- Gateway architecture and plugin system
- Adding authentication providers
- Implementing custom routing logic
- Persistence and scaling considerations

**Time:** ~45 minutes

---

### [4. Bridge Existing MCP Servers](04-bridge-mcp-servers.md)
**For:** Developers integrating existing MCP servers  
**You'll Learn:**
- Using the MCPx bridge package
- Stdio to WebSocket translation
- Configuration and deployment
- Troubleshooting common issues

**Time:** ~20 minutes

---

### [5. Production Deployment](05-production-deploy.md)
**For:** DevOps engineers and system administrators  
**You'll Learn:**
- Deployment architectures
- Security best practices
- Monitoring and observability
- Scaling strategies

**Time:** ~30 minutes

---

## 📚 Prerequisites

Before starting these tutorials, ensure you have:
- **Node.js 18+** installed
- **Git** for cloning the repository
- A **terminal** application
- Basic familiarity with **JavaScript/TypeScript**

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/mcpx-protocol.git
cd mcpx-protocol

# Install dependencies
npm install

# Build packages
npm run build

# Start with tutorial 1
cat tutorials/01-getting-started.md
```

## 📖 Additional Resources

- **[Protocol Specification](../protocol-spec/v0/SPEC.md)** - Detailed protocol documentation
- **[Implementation Patterns](../protocol-spec/v0/PATTERNS.md)** - Best practices and patterns
- **[SDK Architecture](../sdk-spec/README.md)** - SDK design documentation
- **[API Reference](../docs/api/)** - Complete API documentation
- **[Examples](../examples/)** - Example agents and implementations

## 💬 Getting Help

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/mcpx-protocol/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/yourusername/mcpx-protocol/discussions)
- **Discord**: Join our community (coming soon)

## 🤝 Contributing

We welcome contributions to these tutorials! If you find errors, have suggestions, or want to add new tutorials:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See our [Contributing Guide](../CONTRIBUTING.md) for more details.

---

Happy learning! 🎉 Start with [Tutorial 1: Getting Started](01-getting-started.md) to begin your MCPx journey.