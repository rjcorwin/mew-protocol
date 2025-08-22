import chalk from 'chalk';
import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';

export async function interactiveChat(options: any): Promise<void> {
  // Import the chat client from mcpx-chat package
  const chatPath = path.join(__dirname, '..', '..', '..', 'mcpx-chat');
  if (!await fs.pathExists(chatPath)) {
    console.error(chalk.red('MCPx chat package not found. Please ensure mcpx-chat is installed.'));
    process.exit(1);
  }

  const { MCPxChatClient } = await import(path.join(chatPath, 'dist', 'MCPxChatClient'));
  
  const participantId = `cli-user-${Date.now()}`;
  const participantName = process.env.USER || 'CLI User';
  
  const client = new MCPxChatClient({
    serverUrl: options.server,
    topic: options.topic,
    participantId,
    participantName
  });

  console.log(chalk.blue(`Connecting to ${options.server}...`));
  
  await client.connect();
  console.log(chalk.green(`✓ Connected to topic: ${options.topic}`));
  console.log(chalk.gray('Type your messages. Commands: /tools, /help, /exit'));
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> ')
  });

  // Handle incoming messages if the client has an event emitter
  if (client.eventEmitter) {
    client.eventEmitter.on('message', (message: any) => {
      if (message.data?.participantId !== participantId) {
        const sender = message.data?.participantName || message.data?.participantId || 'Unknown';
        const text = message.data?.text || JSON.stringify(message.data);
        console.log(`\n${chalk.yellow(sender)}: ${text}`);
        rl.prompt();
      }
    });

    client.eventEmitter.on('tools_discovered', (tools: any[]) => {
      console.log(chalk.green(`\n✓ Discovered ${tools.length} tools`));
      rl.prompt();
    });
  }

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }

    switch (input) {
      case '/exit':
      case '/quit':
        await client.disconnect();
        rl.close();
        process.exit(0);
        break;
        
      case '/help':
        console.log(chalk.gray('\nCommands:'));
        console.log(chalk.gray('  /tools    - List available tools'));
        console.log(chalk.gray('  /help     - Show this help'));
        console.log(chalk.gray('  /exit     - Exit chat'));
        console.log();
        break;
        
      case '/tools':
        const tools = await client.listTools();
        if (tools.length === 0) {
          console.log(chalk.yellow('No tools available'));
        } else {
          console.log(chalk.bold('\nAvailable tools:'));
          tools.forEach((tool: any) => {
            console.log(`  ${chalk.cyan(tool.name)} - ${tool.description}`);
          });
          console.log();
        }
        break;
        
      default:
        await client.sendMessage(input);
        break;
    }
    
    rl.prompt();
  });

  rl.on('SIGINT', async () => {
    console.log('\nDisconnecting...');
    await client.disconnect();
    rl.close();
    process.exit(0);
  });

  rl.prompt();
}

export async function sendMessage(message: string, options: any): Promise<void> {
  // Import the chat client from mcpx-chat package
  const chatPath = path.join(__dirname, '..', '..', '..', 'mcpx-chat');
  if (!await fs.pathExists(chatPath)) {
    console.error(chalk.red('MCPx chat package not found. Please ensure mcpx-chat is installed.'));
    process.exit(1);
  }

  const { MCPxChatClient } = await import(path.join(chatPath, 'dist', 'MCPxChatClient'));
  
  const participantId = `cli-user-${Date.now()}`;
  const participantName = process.env.USER || 'CLI User';
  
  const client = new MCPxChatClient({
    serverUrl: options.server,
    topic: options.topic,
    participantId,
    participantName
  });

  // Set up message handler before connecting if we need to wait
  if (parseInt(options.wait) > 0) {
    const waitTime = parseInt(options.wait);
    console.log(chalk.gray(`Waiting ${waitTime}ms for responses...`));
    
    const messageHandler = (msg: any) => {
      if (msg.data?.participantId !== participantId) {
        const sender = msg.data?.participantName || msg.data?.participantId || 'Unknown';
        const text = msg.data?.text || JSON.stringify(msg.data);
        console.log(`${chalk.yellow(sender)}: ${text}`);
      }
    };
    
    // Register the handler on the internal event emitter if available
    if (client.eventEmitter) {
      client.eventEmitter.on('message', messageHandler);
    }
    
    await client.connect();
    await client.sendMessage(message);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    await client.connect();
    await client.sendMessage(message);
  }
  
  await client.disconnect();
  process.exit(0);
}