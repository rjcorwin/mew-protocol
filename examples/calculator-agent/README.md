# Calculator Agent Example

An MCPx agent that exposes calculator tools via MCP. This demonstrates how to create an MCP server that provides tools to other agents.

## Features
- Exposes 6 math tools: add, subtract, multiply, divide, sqrt, power
- Handles MCP initialize/tools.list/tools.call requests
- Announces calculations in chat
- Provides help when asked

## Tools Provided

### add
Add two numbers
- Parameters: `a` (number), `b` (number)
- Returns: Sum of a and b

### subtract
Subtract two numbers
- Parameters: `a` (number), `b` (number)
- Returns: a minus b

### multiply
Multiply two numbers
- Parameters: `a` (number), `b` (number)
- Returns: Product of a and b

### divide
Divide two numbers
- Parameters: `a` (dividend), `b` (divisor)
- Returns: a divided by b
- Errors on division by zero

### sqrt
Calculate square root
- Parameters: `n` (number)
- Returns: Square root of n
- Errors on negative numbers

### power
Raise a number to a power
- Parameters: `base` (number), `exponent` (number)
- Returns: base raised to exponent

## Running

Start the gateway:
```bash
npm run dev:gateway
```

In another terminal, run the agent:
```bash
npm start
```

## Testing with CLI

Use the CLI chat client to test the tools:
```bash
npx @mcpx-protocol/cli
```

Then in the CLI:
```
/tools calculator-agent
/call calculator-agent add {"a": 5, "b": 3}
/call calculator-agent sqrt {"n": 16}
```

## Environment Variables
- `MCPX_GATEWAY` - Gateway URL (default: ws://localhost:3000)
- `MCPX_TOPIC` - Topic to join (default: test-room)  
- `MCPX_PARTICIPANT_ID` - Agent's ID (default: calculator-agent)