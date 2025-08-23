# Chat Agent Example

A simple MCPx agent that only sends and receives chat messages. This demonstrates the most basic agent functionality.

## Features
- Connects to MCPx gateway
- Sends greeting on connect
- Sends periodic messages
- Responds to greetings from other participants

## Running

Start the gateway:
```bash
npm run dev:gateway
```

In another terminal, run the agent:
```bash
npm start
```

## Environment Variables
- `MCPX_GATEWAY` - Gateway URL (default: ws://localhost:3000)
- `MCPX_TOPIC` - Topic to join (default: test-room)  
- `MCPX_PARTICIPANT_ID` - Agent's ID (default: chat-agent)

## Testing
Use the CLI chat client to interact with the agent:
```bash
npx @mcpx-protocol/cli
```