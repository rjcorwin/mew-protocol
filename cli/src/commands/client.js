const { Command } = require('commander');
const WebSocket = require('ws');
const fs = require('fs');
const readline = require('readline');

const client = new Command('client')
  .description('Client connection management');

client
  .command('connect')
  .description('Connect to a MEUP gateway')
  .requiredOption('-g, --gateway <url>', 'WebSocket URL')
  .requiredOption('-s, --space <space>', 'Space to join')
  .option('-t, --token <token>', 'Authentication token')
  .option('-p, --participant-id <id>', 'Participant ID')
  .option('--fifo-in <path>', 'Input FIFO for receiving commands')
  .option('--fifo-out <path>', 'Output FIFO for sending messages')
  .action(async (options) => {
    const participantId = options.participantId || `client-${Date.now()}`;
    console.log(`Connecting to ${options.gateway} as ${participantId}...`);
    
    // Create write stream for FIFO if specified
    let fifoStream = null;
    if (options.fifoOut) {
      fifoStream = fs.createWriteStream(options.fifoOut, { flags: 'a' });
    }
    
    // Connect to gateway
    const ws = new WebSocket(options.gateway);
    
    ws.on('open', () => {
      console.log('Connected to gateway');
      
      // Send join message (gateway-specific, not MEUP protocol)
      ws.send(JSON.stringify({
        type: 'join',
        participantId,
        space: options.space,
        token: options.token
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('Client received:', JSON.stringify(message).substring(0, 100));
      
      if (fifoStream) {
        // Write to output FIFO using stream
        fifoStream.write(JSON.stringify(message) + '\n', (err) => {
          if (err) {
            console.error('Failed to write to FIFO:', err.message);
          } else {
            console.log('Wrote to FIFO');
          }
        });
      } else {
        // Print to console
        console.log('Received:', JSON.stringify(message, null, 2));
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    ws.on('close', () => {
      console.log('Disconnected from gateway');
      process.exit(0);
    });
    
    // Set up input handling
    if (options.fifoIn) {
      // Read from FIFO directly using createReadStream
      console.log(`Reading from FIFO: ${options.fifoIn}`);
      
      // Helper function to set up FIFO reading
      const setupFifoReader = () => {
        // Open the FIFO in read mode with no buffering
        const fifoStream = fs.createReadStream(options.fifoIn, { 
          encoding: 'utf8',
          // Disable internal buffering for immediate data availability
          highWaterMark: 1
        });
        
        // Use readline to process line by line
        const rl = readline.createInterface({
          input: fifoStream,
          crlfDelay: Infinity
        });
        
        rl.on('line', (line) => {
          try {
            console.log(`FIFO received: ${line}`);
            const message = JSON.parse(line);
            ws.send(JSON.stringify(message));
            console.log(`Sent to gateway: ${JSON.stringify(message)}`);
          } catch (error) {
            console.error('Error parsing input:', error);
          }
        });
        
        // When FIFO closes (writer disconnects), reopen it
        fifoStream.on('end', () => {
          console.log('FIFO writer disconnected, reopening...');
          // Small delay before reopening to prevent tight loop
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              setupFifoReader();
            }
          }, 100);
        });
        
        fifoStream.on('error', (error) => {
          console.error(`FIFO read error: ${error.message}`);
          // Try to reopen on error
          if (ws.readyState === WebSocket.OPEN) {
            setTimeout(setupFifoReader, 1000);
          }
        });
      };
      
      // Start reading from FIFO
      setupFifoReader();
    } else {
      // Interactive mode
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '> '
      });
      
      console.log('Interactive mode. Type JSON messages or "quit" to exit.');
      rl.prompt();
      
      rl.on('line', (line) => {
        if (line.trim() === 'quit') {
          ws.close();
          rl.close();
          return;
        }
        
        try {
          const message = JSON.parse(line);
          ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('Invalid JSON:', error.message);
        }
        
        rl.prompt();
      });
    }
    
    // If no interactive and no FIFO input, just wait
    if (options.noInteractive && !options.fifoIn) {
      console.log('Running in non-interactive mode without FIFO input');
    }
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nDisconnecting...');
      ws.close();
      process.exit(0);
    });
  });

module.exports = client;