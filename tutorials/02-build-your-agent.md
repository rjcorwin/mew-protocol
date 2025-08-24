# Tutorial 2: Build Your First MCPx Agent

In this tutorial, you'll build a weather agent from scratch that:
- Exposes MCP tools for weather queries
- Responds to natural language weather requests in chat
- Collaborates with other agents to provide contextualized information

## Prerequisites

- Complete [Tutorial 1: Getting Started](01-getting-started.md)
- Basic TypeScript/JavaScript knowledge
- Node.js 18+ installed

## What You'll Build

A weather agent that provides:
- Current weather for any city
- Weather forecasts
- Temperature unit conversion
- Natural language interaction

## Step 1: Project Setup

Create a new directory for your agent:

```bash
mkdir weather-agent
cd weather-agent
npm init -y
```

Install the MCPx agent package:

```bash
npm install @mcpx-protocol/agent
npm install --save-dev typescript tsx @types/node
```

Create a TypeScript configuration:

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
EOF
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "build": "tsc",
    "dev": "tsx watch src/index.ts"
  }
}
```

## Step 2: Understanding the MCPxAgent Base Class

The `@mcpx-protocol/agent` package provides the `MCPxAgent` abstract base class. Your agent extends this class and implements:

- `onStart()` - Called when the agent starts
- `onStop()` - Called when the agent stops
- `listTools()` - Returns available MCP tools
- `executeTool()` - Executes a tool when called
- `onChatMessage()` - (Optional) Handles chat messages

## Step 3: Create the Weather Agent

Create `src/index.ts`:

```typescript
#!/usr/bin/env node
import { 
  MCPxAgent, 
  Tool, 
  ToolExecutionContext, 
  ToolExecutionResult 
} from '@mcpx-protocol/agent';

// Mock weather data (in production, use a real weather API)
const WEATHER_DATA: Record<string, any> = {
  'san francisco': { 
    temp: 65, 
    condition: 'foggy', 
    humidity: 75,
    forecast: ['fog', 'partly cloudy', 'sunny']
  },
  'new york': { 
    temp: 72, 
    condition: 'sunny', 
    humidity: 60,
    forecast: ['sunny', 'partly cloudy', 'rain']
  },
  'london': { 
    temp: 59, 
    condition: 'cloudy', 
    humidity: 80,
    forecast: ['rain', 'cloudy', 'partly cloudy']
  },
  'tokyo': { 
    temp: 78, 
    condition: 'clear', 
    humidity: 65,
    forecast: ['clear', 'sunny', 'partly cloudy']
  },
};

class WeatherAgent extends MCPxAgent {
  private requestCount = 0;

  constructor(options: { gateway: string; topic: string; token: string }) {
    super(
      {
        gateway: options.gateway,
        topic: options.topic,
        token: options.token,
        reconnect: true,
      },
      {
        name: 'weather-agent',
        description: 'Provides weather information and forecasts',
        version: '1.0.0',
      }
    );
  }

  /**
   * Called when the agent starts
   */
  async onStart(): Promise<void> {
    console.log('🌤️  Weather agent started!');
    
    // Announce our presence
    this.sendChat('Weather agent online! I can tell you about weather in major cities.');
    
    // Store startup time in context
    this.context.set('startTime', new Date());
  }

  /**
   * Called when the agent stops
   */
  async onStop(): Promise<void> {
    console.log('Weather agent stopping...');
    this.sendChat('Weather agent going offline.');
  }

  /**
   * Define available tools
   */
  async listTools(): Promise<Tool[]> {
    return [
      {
        name: 'get_weather',
        description: 'Get current weather for a city',
        inputSchema: {
          type: 'object',
          properties: {
            city: { 
              type: 'string', 
              description: 'City name (e.g., "San Francisco")'
            },
            unit: {
              type: 'string',
              enum: ['fahrenheit', 'celsius'],
              description: 'Temperature unit',
              default: 'fahrenheit'
            }
          },
          required: ['city'],
        },
      },
      {
        name: 'get_forecast',
        description: 'Get 3-day weather forecast for a city',
        inputSchema: {
          type: 'object',
          properties: {
            city: { 
              type: 'string', 
              description: 'City name'
            }
          },
          required: ['city'],
        },
      },
      {
        name: 'convert_temperature',
        description: 'Convert temperature between units',
        inputSchema: {
          type: 'object',
          properties: {
            value: { 
              type: 'number', 
              description: 'Temperature value'
            },
            from: {
              type: 'string',
              enum: ['fahrenheit', 'celsius'],
              description: 'Source unit'
            },
            to: {
              type: 'string',
              enum: ['fahrenheit', 'celsius'],
              description: 'Target unit'
            }
          },
          required: ['value', 'from', 'to'],
        },
      },
    ];
  }

  /**
   * Execute a tool
   */
  async executeTool(
    name: string, 
    params: any, 
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // Track usage
    this.requestCount++;
    console.log(`[TOOL] ${context.from} called ${name} (#${this.requestCount})`);

    try {
      switch (name) {
        case 'get_weather':
          return this.getWeather(params);
        
        case 'get_forecast':
          return this.getForecast(params);
        
        case 'convert_temperature':
          return this.convertTemperature(params);
        
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      // Also announce errors in chat
      this.sendChat(`❌ Error with ${name}: ${error.message}`);
      
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle chat messages (optional)
   */
  async onChatMessage(text: string, from: string): Promise<void> {
    // Ignore our own messages
    if (from === this.config.name) return;

    // Simple keyword detection
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('weather') || lowerText.includes('temperature')) {
      // Extract city name (simple approach)
      const cities = Object.keys(WEATHER_DATA);
      const mentionedCity = cities.find(city => 
        lowerText.includes(city.toLowerCase())
      );

      if (mentionedCity) {
        // Proactively provide weather info
        const weather = WEATHER_DATA[mentionedCity];
        this.sendChat(
          `🌡️ Current weather in ${mentionedCity}: ` +
          `${weather.temp}°F, ${weather.condition}`
        );
      } else if (lowerText.includes('?')) {
        // It's a question but no city mentioned
        this.sendChat(
          '💡 Try asking about weather in: ' + 
          cities.join(', ')
        );
      }
    }
  }

  // Tool implementation methods

  private getWeather(params: any): ToolExecutionResult {
    const city = params.city.toLowerCase();
    const unit = params.unit || 'fahrenheit';
    
    const weather = WEATHER_DATA[city];
    if (!weather) {
      throw new Error(`No weather data for ${params.city}`);
    }

    let temp = weather.temp;
    if (unit === 'celsius') {
      temp = Math.round((temp - 32) * 5/9);
    }

    const text = `Weather in ${params.city}:\n` +
      `🌡️ Temperature: ${temp}°${unit === 'celsius' ? 'C' : 'F'}\n` +
      `☁️ Condition: ${weather.condition}\n` +
      `💧 Humidity: ${weather.humidity}%`;

    // Also send to chat for visibility
    this.sendChat(`📍 ${params.city}: ${temp}° ${weather.condition}`);

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      isError: false,
    };
  }

  private getForecast(params: any): ToolExecutionResult {
    const city = params.city.toLowerCase();
    
    const weather = WEATHER_DATA[city];
    if (!weather) {
      throw new Error(`No forecast data for ${params.city}`);
    }

    const forecast = weather.forecast
      .map((condition: string, index: number) => {
        const day = ['Today', 'Tomorrow', 'Day 3'][index];
        return `${day}: ${condition}`;
      })
      .join('\n');

    const text = `3-Day Forecast for ${params.city}:\n${forecast}`;

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      isError: false,
    };
  }

  private convertTemperature(params: any): ToolExecutionResult {
    const { value, from, to } = params;
    
    if (from === to) {
      return {
        content: [
          { type: 'text', text: `${value}° ${from} = ${value}° ${to}` },
        ],
        isError: false,
      };
    }

    let result: number;
    if (from === 'fahrenheit' && to === 'celsius') {
      result = Math.round((value - 32) * 5/9);
    } else {
      result = Math.round(value * 9/5 + 32);
    }

    const text = `${value}° ${from} = ${result}° ${to}`;

    return {
      content: [
        { type: 'text', text },
      ],
      isError: false,
    };
  }
}

// Main entry point
async function main() {
  // Get configuration from environment or defaults
  const gateway = process.env.MCPX_GATEWAY || 'ws://localhost:3000';
  const topic = process.env.MCPX_TOPIC || 'test-room';
  
  // Get auth token (in production, implement proper auth)
  const tokenResponse = await fetch(`${gateway.replace('ws://', 'http://')}/v0/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantId: 'weather-agent' }),
  });
  const { token } = await tokenResponse.json();

  console.log('Starting weather agent...');
  console.log(`Gateway: ${gateway}`);
  console.log(`Topic: ${topic}`);

  // Create and start the agent
  const agent = new WeatherAgent({ gateway, topic, token });
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await agent.stop();
    process.exit(0);
  });

  // Start the agent
  await agent.start();
  console.log('Weather agent running. Press Ctrl+C to stop.');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { WeatherAgent };
```

## Step 4: Test Your Agent

### Start the MCPx ecosystem:

```bash
# Terminal 1: Gateway
npm run dev:gateway

# Terminal 2: Your weather agent
cd weather-agent
npm start

# Terminal 3: CLI
npm run cli:test
```

### Test the tools:

In the CLI:

```bash
# List available tools
/tools weather-agent

# Get current weather
/call weather-agent get_weather {"city": "San Francisco"}

# Get with Celsius
/call weather-agent get_weather {"city": "London", "unit": "celsius"}

# Get forecast
/call weather-agent get_forecast {"city": "Tokyo"}

# Convert temperature
/call weather-agent convert_temperature {"value": 72, "from": "fahrenheit", "to": "celsius"}
```

### Test natural language:

```bash
# The agent responds to weather keywords
What's the weather in New York?
Tell me about the temperature in London
```

## Step 5: Advanced Features

### Adding State Management

Track conversation context and provide smarter responses:

```typescript
class WeatherAgent extends MCPxAgent {
  private lastQueriedCity: string | null = null;
  private queryHistory: Array<{city: string, time: Date}> = [];

  private getWeather(params: any): ToolExecutionResult {
    // Track query history
    this.lastQueriedCity = params.city;
    this.queryHistory.push({
      city: params.city,
      time: new Date()
    });
    
    // ... rest of implementation
  }

  async onChatMessage(text: string, from: string): Promise<void> {
    // Use context for follow-up questions
    if (text.toLowerCase().includes('forecast') && this.lastQueriedCity) {
      this.sendChat(
        `I'll get the forecast for ${this.lastQueriedCity}...`
      );
      // Could trigger forecast tool programmatically
    }
  }
}
```

### Calling Other Agents' Tools

Your agent can discover and use tools from other agents:

```typescript
async onStart(): Promise<void> {
  // Wait a moment for other agents to connect
  setTimeout(async () => {
    // Get list of peers
    const peers = await this.client.getPeers();
    
    // Find calculator agent
    const calculator = peers.find(p => p.id === 'calculator-agent');
    if (calculator) {
      // Use calculator for temperature math
      const result = await this.client.request(
        'calculator-agent',
        'tools/call',
        {
          name: 'multiply',
          arguments: { a: 9/5, b: 25 }
        }
      );
      console.log('Calculator result:', result);
    }
  }, 2000);
}
```

### Progress Notifications

For long-running operations:

```typescript
async executeTool(
  name: string, 
  params: any, 
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  // Send progress notification
  await this.sendProgress(context.from, {
    operation: name,
    progress: 0,
    message: 'Starting weather lookup...'
  });

  // Simulate API call with progress
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await this.sendProgress(context.from, {
    operation: name,
    progress: 50,
    message: 'Fetching data...'
  });

  // ... rest of implementation
}
```

## Step 6: Best Practices

### 1. Tool Design

- **Clear naming**: Use descriptive, action-oriented names (`get_weather`, not `weather`)
- **Comprehensive schemas**: Include descriptions, defaults, and enums
- **Validation**: Validate inputs before processing
- **Error handling**: Return clear, actionable error messages

### 2. Chat Interaction

- **Be helpful**: Provide guidance when users seem stuck
- **Avoid spam**: Don't respond to every message
- **Use emojis sparingly**: They help with readability but can be overused
- **Announce capabilities**: Let users know what you can do when joining

### 3. Resource Management

```typescript
class WeatherAgent extends MCPxAgent {
  private cache = new Map<string, {data: any, time: number}>();
  private readonly CACHE_TTL = 60000; // 1 minute

  private getWeather(params: any): ToolExecutionResult {
    const cacheKey = `weather:${params.city}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.time < this.CACHE_TTL) {
      console.log(`Using cached data for ${params.city}`);
      return cached.data;
    }

    // Fetch fresh data
    const result = this.fetchWeatherData(params);
    this.cache.set(cacheKey, {data: result, time: Date.now()});
    
    return result;
  }

  async onStop(): Promise<void> {
    // Clean up resources
    this.cache.clear();
  }
}
```

### 4. Logging and Debugging

```typescript
class WeatherAgent extends MCPxAgent {
  private log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, data || '');
  }

  async executeTool(
    name: string, 
    params: any, 
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    this.log('INFO', `Tool called: ${name}`, {
      from: context.from,
      params,
      requestCount: this.requestCount
    });

    try {
      const result = await this.processToolCall(name, params);
      this.log('INFO', `Tool completed: ${name}`);
      return result;
    } catch (error) {
      this.log('ERROR', `Tool failed: ${name}`, error);
      throw error;
    }
  }
}
```

## Step 7: Testing Your Agent

### Unit Testing

Create `test/weather-agent.test.ts`:

```typescript
import { WeatherAgent } from '../src/index';

describe('WeatherAgent', () => {
  let agent: WeatherAgent;

  beforeEach(() => {
    agent = new WeatherAgent({
      gateway: 'ws://localhost:3000',
      topic: 'test',
      token: 'test-token'
    });
  });

  test('lists correct tools', async () => {
    const tools = await agent.listTools();
    expect(tools).toHaveLength(3);
    expect(tools[0].name).toBe('get_weather');
  });

  test('executes get_weather tool', async () => {
    const result = await agent.executeTool(
      'get_weather',
      { city: 'San Francisco' },
      { from: 'test-user', topic: 'test' }
    );
    
    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('San Francisco');
  });
});
```

### Integration Testing

Test with other agents:

```bash
# Start everything
npm run dev:gateway & 
npm run example:calculator &
cd weather-agent && npm start &

# Run test script
node test-integration.js
```

## Step 8: Packaging and Distribution

### Add to Root Project

Update the root `package.json`:

```json
{
  "scripts": {
    "example:weather": "cd examples/weather-agent && npm start"
  }
}
```

### Docker Support

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

### Environment Configuration

Use `.env` for configuration:

```bash
MCPX_GATEWAY=ws://gateway:3000
MCPX_TOPIC=production
WEATHER_API_KEY=your-api-key
LOG_LEVEL=info
```

## Common Patterns from Examples

### Pattern 1: Tool-First Design (Calculator Agent)

The calculator agent focuses entirely on exposing tools:

```typescript
// From examples/calculator-agent
class CalculatorAgent extends MCPxAgent {
  async listTools(): Promise<Tool[]> {
    // Comprehensive tool definitions
  }
  
  async executeTool(...): Promise<ToolExecutionResult> {
    // Clean execution with clear results
  }
  
  // Minimal chat interaction
}
```

### Pattern 2: Orchestration (Coordinator Agent)

The coordinator agent discovers and uses other agents' tools:

```typescript
// From examples/coordinator-agent
class CoordinatorAgent extends MCPxAgent {
  async onStart(): Promise<void> {
    // Discover available agents
    const peers = await this.client.getPeers();
    
    // List their tools
    for (const peer of peers) {
      if (peer.mcp) {
        const tools = await this.client.request(peer.id, 'tools/list', {});
        console.log(`${peer.id} tools:`, tools);
      }
    }
  }
  
  async onChatMessage(text: string, from: string): Promise<void> {
    // Parse intent and delegate to appropriate agent
    if (text.includes('calculate')) {
      const result = await this.client.request(
        'calculator-agent',
        'tools/call',
        { name: 'add', arguments: {...} }
      );
    }
  }
}
```

### Pattern 3: Bridge Pattern (Documents Agent)

Bridge external services into MCPx:

```typescript
// From examples/documents-agent pattern
class BridgedAgent extends MCPxAgent {
  private externalService: ExternalAPI;
  
  async onStart(): Promise<void> {
    // Connect to external service
    this.externalService = new ExternalAPI();
    await this.externalService.connect();
  }
  
  async executeTool(...): Promise<ToolExecutionResult> {
    // Translate MCPx calls to external API
    const externalResult = await this.externalService.call(...);
    
    // Transform response to MCPx format
    return {
      content: [{ type: 'text', text: externalResult }],
      isError: false,
    };
  }
}
```

## Troubleshooting

### Agent Won't Connect

```typescript
// Add connection debugging
const agent = new WeatherAgent({...});

agent.client.on('connected', () => {
  console.log('✅ Connected to gateway');
});

agent.client.on('error', (error) => {
  console.error('❌ Connection error:', error);
});
```

### Tools Not Appearing

- Ensure `listTools()` returns valid tool definitions
- Check that your agent has `mcp: true` in its participant info
- Verify the MCP handshake completes (check debug logs)

### Chat Messages Not Received

```typescript
async onChatMessage(text: string, from: string): Promise<void> {
  console.log(`[CHAT] from=${from}, text="${text}"`);
  
  // Don't forget to check if it's your own message
  if (from === this.config.name) {
    console.log('Ignoring own message');
    return;
  }
}
```

## Next Steps

Now that you've built your first agent:

1. **Add real APIs**: Replace mock data with actual weather APIs
2. **Implement caching**: Reduce API calls and improve performance
3. **Add more tools**: Historical weather, alerts, radar images
4. **Enhance NLP**: Better natural language understanding
5. **Create agent networks**: Build agents that work together

## Resources

- [MCPxAgent API Reference](../packages/agent/README.md)
- [Example Agents](../examples/)
- [Protocol Specification](../protocol-spec/v0/SPEC.md)
- [Tutorial 3: Extend the Gateway](03-extend-gateway.md)

---

Congratulations! You've built your first MCPx agent. 🎉

[← Back to Tutorials](README.md) | [Next: Extend the Gateway →](03-extend-gateway.md)