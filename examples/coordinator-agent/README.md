# Coordinator Agent Example

An MCPx agent that orchestrates other agents by calling their tools. This demonstrates how to create an MCP client that discovers and uses tools from other agents.

## Features
- Discovers available agents and their tools
- Calls tools on other agents (especially calculator-agent)
- Queues and processes tasks sequentially
- Responds to chat commands for calculations
- Demonstrates tool coordination

## How It Works

1. On startup, the coordinator discovers available peers
2. If it finds a calculator agent, it lists its available tools
3. It demonstrates calling various calculator tools
4. It responds to chat messages requesting calculations

## Chat Commands

- `calculate 10 + 5` - Performs addition
- `calculate 20 - 8` - Performs subtraction  
- `calculate 7 * 9` - Performs multiplication
- `calculate 100 / 4` - Performs division
- `sqrt 64` - Calculates square root
- `help` - Shows available commands

## Running

First, start the gateway:
```bash
npm run dev:gateway
```

Start the calculator agent (required for full functionality):
```bash
cd examples/calculator-agent
npm start
```

Then start the coordinator:
```bash
cd examples/coordinator-agent
npm start
```

## Testing

Use the CLI to interact:
```bash
npx @mcpx-protocol/cli
```

Send messages like:
```
calculate 15 + 27
sqrt 100
```

## Environment Variables
- `MCPX_GATEWAY` - Gateway URL (default: ws://localhost:3000)
- `MCPX_TOPIC` - Topic to join (default: test-room)  
- `MCPX_PARTICIPANT_ID` - Agent's ID (default: coordinator-agent)

## Dependencies

This example works best when the calculator-agent is also running, as it provides the tools that the coordinator calls.