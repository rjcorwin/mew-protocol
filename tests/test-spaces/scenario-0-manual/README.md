# Scenario 0: Manual Debug/Development Setup

This scenario provides a manual approach to starting MEUP components for debugging and development purposes. Unlike the automated `meup space up/down` commands used in other scenarios, this gives you direct control over each component.

## When to Use Manual Setup

Use this manual approach when you need to:
- Debug individual components in isolation
- Test specific failure scenarios
- Experiment with different configurations
- Understand the underlying mechanics of MEUP
- Troubleshoot issues with the automated space commands
- Run components with custom debugging flags

## Components

- **Gateway**: The MEUP gateway server that routes messages
- **Echo Agent**: A simple agent that echoes back chat messages
- **Test Client**: A client connected via FIFOs for sending/receiving messages

## Running the Manual Setup

```bash
# Make scripts executable
chmod +x test.sh cleanup.sh

# Run the manual setup
./test.sh
```

The script will:
1. Start the gateway on a random port
2. Start the echo agent
3. Create FIFOs for test client communication
4. Connect the test client
5. Run a basic test to verify everything works
6. Wait for Ctrl+C to cleanup

## Manual Testing

Once the setup is running, you can send messages manually:

```bash
# Send a chat message
echo '{"kind":"chat","payload":{"text":"Hello, echo!"}}' > ./fifos/test-client-in

# Watch responses
tail -f ./logs/responses.txt

# Monitor gateway logs
tail -f ./logs/gateway.log

# Monitor echo agent logs
tail -f ./logs/echo.log
```

## Debugging Tips

### Component Not Starting?
Check the specific log file:
```bash
tail -50 ./logs/gateway.log
tail -50 ./logs/echo.log
tail -50 ./logs/test-client.log
```

### Messages Not Flowing?
1. Verify all components are running:
```bash
ps aux | grep meup
ps aux | grep echo.js
```

2. Check FIFOs exist:
```bash
ls -la ./fifos/
```

3. Test FIFO connectivity:
```bash
# In one terminal
cat ./fifos/test-client-out

# In another terminal
echo '{"kind":"chat","payload":{"text":"test"}}' > ./fifos/test-client-in
```

### Port Already in Use?
The script uses a random port, but if you get a port conflict, you can specify a different port:
```bash
PORT=9999 ./test.sh
```

## Manual Component Control

You can also start components individually:

### 1. Gateway Only
```bash
../../../cli/bin/meup.js gateway start \
  --port 8080 \
  --log-level debug \
  --space-config ./space.yaml
```

### 2. Echo Agent Only
```bash
node ./agents/echo.js \
  --gateway ws://localhost:8080 \
  --space manual-debug-space \
  --token echo-token
```

### 3. Test Client Only
```bash
# Create FIFOs first
mkfifo ./fifos/test-client-in ./fifos/test-client-out

# Connect client
../../../cli/bin/meup.js client connect \
  --gateway ws://localhost:8080 \
  --space manual-debug-space \
  --participant-id test-client \
  --token test-token \
  --fifo-in ./fifos/test-client-in \
  --fifo-out ./fifos/test-client-out
```

## Cleanup

The script will cleanup automatically when you press Ctrl+C. You can also cleanup manually:

```bash
./cleanup.sh
```

To completely reset (including logs):
```bash
./cleanup.sh
rm -rf ./logs/*
```

## Comparison with Automated Setup

| Aspect | Manual Setup | Automated (`meup space up`) |
|--------|-------------|------------------------------|
| Control | Full control over each component | Automated orchestration |
| Debugging | Easier to debug individual parts | Harder to isolate issues |
| Setup Time | Slower, step-by-step | Fast, single command |
| Use Case | Development, debugging | Testing, production |
| PID Management | Manual tracking | Automatic via `.meup/` |
| FIFO Creation | Manual `mkfifo` | Automatic based on config |
| Cleanup | Manual or script | `meup space down` |

## Files

- `space.yaml` - Space configuration
- `test.sh` - Manual setup script with debugging output
- `cleanup.sh` - Cleanup script
- `agents/echo.js` - Echo agent implementation
- `logs/` - Directory for component logs
- `fifos/` - Directory for named pipes