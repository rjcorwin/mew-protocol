# Echo Bot Example

An MCPx agent that echoes back any chat message it receives. This demonstrates message handling and chat interactions.

## Features
- Connects to MCPx gateway
- Echoes all chat messages from other participants
- Adds echo counter to track number of messages echoed
- Ignores its own messages

## Running

Start the gateway:
```bash
npm run dev:gateway
```

In another terminal, run the bot:
```bash
npm start
```

## Environment Variables
- `MCPX_GATEWAY` - Gateway URL (default: ws://localhost:3000)
- `MCPX_TOPIC` - Topic to join (default: test-room)  
- `MCPX_PARTICIPANT_ID` - Bot's ID (default: echo-bot)

## Testing
Use the CLI chat client to interact with the bot:
```bash
npx @mcpx-protocol/cli
```

Send any message and the bot will echo it back with a counter.