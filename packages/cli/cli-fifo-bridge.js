#!/usr/bin/env node

/**
 * CLI FIFO Bridge - Unix named pipe based interaction with interactive CLI tools
 * 
 * This bridge uses FIFOs (named pipes) for more reliable IPC without race conditions.
 * No polling needed - blocking I/O handles synchronization naturally.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class CLIFifoBridge {
  constructor(options = {}) {
    this.basePath = options.basePath || path.join(__dirname, '.cli-fifos');
    this.inputFifo = path.join(this.basePath, 'input.fifo');
    this.outputFile = path.join(this.basePath, 'output.log');
    this.stateFile = path.join(this.basePath, 'state.txt');
    this.command = options.command || 'npm';
    this.args = options.args || ['run', 'cli:simple'];
    this.cwd = options.cwd || __dirname;
    
    this.process = null;
    this.isRunning = false;
    this.outputStream = null;
  }

  async start() {
    console.log('Starting CLI FIFO Bridge...');
    console.log(`Base path: ${this.basePath}`);
    console.log(`Input FIFO: ${this.inputFifo}`);
    console.log(`Output log: ${this.outputFile}`);
    
    // Create directory if needed
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    
    // Clean up any existing FIFOs
    this.cleanup();
    
    // Create the FIFO
    try {
      execSync(`mkfifo "${this.inputFifo}"`);
      console.log('Created input FIFO');
    } catch (error) {
      console.error('Failed to create FIFO:', error.message);
      throw error;
    }
    
    // Create/clear output file
    fs.writeFileSync(this.outputFile, '');
    fs.writeFileSync(this.stateFile, 'starting');
    
    // Start the CLI process with input from FIFO
    this.process = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.isRunning = true;
    fs.writeFileSync(this.stateFile, 'running');
    
    // Keep the FIFO open for continuous reading
    // Using 'tail -f' on a FIFO to keep it open
    const fifoReader = spawn('sh', ['-c', `while true; do cat "${this.inputFifo}"; done`]);
    fifoReader.stdout.pipe(this.process.stdin);
    
    // Store reference for cleanup
    this.fifoReader = fifoReader;
    
    // Create output stream
    this.outputStream = fs.createWriteStream(this.outputFile, { flags: 'a' });
    
    // Handle output
    this.process.stdout.on('data', (data) => {
      const text = data.toString();
      this.outputStream.write(text);
      console.log(`[CLI] ${text.trimEnd()}`);
    });
    
    this.process.stderr.on('data', (data) => {
      const text = `[STDERR] ${data.toString()}`;
      this.outputStream.write(text);
      console.log(text.trimEnd());
    });
    
    // Handle process exit
    this.process.on('exit', (code) => {
      console.log(`CLI process exited with code ${code}`);
      this.isRunning = false;
      fs.writeFileSync(this.stateFile, `exited:${code}`);
      if (this.fifoReader) {
        this.fifoReader.kill();
      }
      this.cleanup();
    });
    
    // Handle FIFO reader exit
    fifoReader.on('exit', () => {
      console.log('FIFO reader exited');
    });
    
    console.log('CLI FIFO Bridge started successfully');
    console.log('Send commands with: ./fifo-send.sh "command"');
    console.log('Or directly: echo "command" > ' + this.inputFifo);
    
    // Keep the bridge running
    process.on('SIGINT', () => {
      console.log('\nShutting down CLI FIFO Bridge...');
      this.stop();
    });
  }
  
  stop() {
    if (this.fifoReader) {
      this.fifoReader.kill();
    }
    
    if (this.process && this.isRunning) {
      this.process.kill();
    }
    
    if (this.outputStream) {
      this.outputStream.end();
    }
    
    this.cleanup();
  }
  
  cleanup() {
    // Remove FIFO if it exists
    try {
      if (fs.existsSync(this.inputFifo)) {
        fs.unlinkSync(this.inputFifo);
        console.log('Removed input FIFO');
      }
    } catch (error) {
      console.warn(`Could not remove FIFO: ${error.message}`);
    }
    
    fs.writeFileSync(this.stateFile, 'stopped');
  }
}

// Main execution
if (require.main === module) {
  const bridge = new CLIFifoBridge();
  
  bridge.start().catch(error => {
    console.error('Failed to start CLI FIFO Bridge:', error);
    process.exit(1);
  });
}

module.exports = { CLIFifoBridge };