#!/usr/bin/env node

/**
 * CLI Bridge - Enables file-based interaction with interactive CLI tools
 * 
 * This bridge allows AI assistants and automated tests to interact with
 * interactive CLI applications through file-based I/O.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

class CLIBridge {
  constructor(options = {}) {
    this.inputFile = options.inputFile || path.join(__dirname, 'cli-input.txt');
    this.outputFile = options.outputFile || path.join(__dirname, 'cli-output.txt');
    this.stateFile = options.stateFile || path.join(__dirname, 'cli-state.txt');
    this.command = options.command || 'npm';
    this.args = options.args || ['run', 'cli'];
    this.cwd = options.cwd || __dirname;
    this.pollInterval = options.pollInterval || 100;
    
    this.process = null;
    this.outputBuffer = [];
    this.isRunning = false;
    this.inputWatcher = null;
    this.lastCommand = '';
    this.commandQueue = [];
  }

  async start() {
    console.log('Starting CLI Bridge...');
    console.log(`Input file: ${this.inputFile}`);
    console.log(`Output file: ${this.outputFile}`);
    console.log(`State file: ${this.stateFile}`);
    
    // Clean up files
    this.cleanupFiles();
    
    // Create empty input file
    fs.writeFileSync(this.inputFile, '');
    fs.writeFileSync(this.outputFile, '');
    fs.writeFileSync(this.stateFile, 'starting');
    
    // Start the CLI process
    this.process = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...process.env, FORCE_COLOR: '0' }, // Disable color for cleaner output
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.isRunning = true;
    fs.writeFileSync(this.stateFile, 'running');
    
    // Set up output handling
    const rl = readline.createInterface({
      input: this.process.stdout,
      terminal: false
    });
    
    rl.on('line', (line) => {
      this.handleOutput(line);
    });
    
    // Handle stderr
    this.process.stderr.on('data', (data) => {
      const line = data.toString();
      this.handleOutput(`[STDERR] ${line}`);
    });
    
    // Handle process exit
    this.process.on('exit', (code) => {
      console.log(`CLI process exited with code ${code}`);
      this.isRunning = false;
      fs.writeFileSync(this.stateFile, `exited:${code}`);
      this.cleanup();
    });
    
    // Start watching for input
    this.watchInput();
    
    console.log('CLI Bridge started successfully');
    
    // Keep the bridge running
    process.on('SIGINT', () => {
      console.log('\nShutting down CLI Bridge...');
      this.stop();
    });
  }
  
  handleOutput(line) {
    // Append to output file
    fs.appendFileSync(this.outputFile, line + '\n');
    
    // Also log to console for debugging
    console.log(`[CLI] ${line}`);
    
    // Store in buffer
    this.outputBuffer.push(line);
    if (this.outputBuffer.length > 1000) {
      this.outputBuffer.shift(); // Keep buffer size manageable
    }
  }
  
  watchInput() {
    // Poll the input file for changes
    this.inputWatcher = setInterval(() => {
      try {
        const input = fs.readFileSync(this.inputFile, 'utf8').trim();
        
        if (input && input !== this.lastCommand) {
          console.log(`[BRIDGE] Sending command: ${input}`);
          
          // Send to CLI process
          this.process.stdin.write(input + '\n');
          
          // Clear the input file
          fs.writeFileSync(this.inputFile, '');
          
          // Update last command
          this.lastCommand = input;
          
          // Log command to output
          this.handleOutput(`[COMMAND] ${input}`);
        }
      } catch (error) {
        // File might not exist or be temporarily locked
        // Ignore and try again next poll
      }
    }, this.pollInterval);
  }
  
  stop() {
    if (this.inputWatcher) {
      clearInterval(this.inputWatcher);
      this.inputWatcher = null;
    }
    
    if (this.process && this.isRunning) {
      this.process.kill();
    }
    
    this.cleanup();
  }
  
  cleanup() {
    fs.writeFileSync(this.stateFile, 'stopped');
    console.log('CLI Bridge stopped');
  }
  
  cleanupFiles() {
    // Clean up existing files
    [this.inputFile, this.outputFile, this.stateFile].forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        console.warn(`Could not delete ${file}: ${error.message}`);
      }
    });
  }
}

// Helper functions for external use
function sendCommand(command, inputFile = './cli-input.txt') {
  fs.writeFileSync(inputFile, command);
  console.log(`Command sent: ${command}`);
}

function getOutput(outputFile = './cli-output.txt') {
  try {
    return fs.readFileSync(outputFile, 'utf8');
  } catch (error) {
    return '';
  }
}

function clearOutput(outputFile = './cli-output.txt') {
  fs.writeFileSync(outputFile, '');
}

function getState(stateFile = './cli-state.txt') {
  try {
    return fs.readFileSync(stateFile, 'utf8').trim();
  } catch (error) {
    return 'unknown';
  }
}

// Main execution
if (require.main === module) {
  const bridge = new CLIBridge();
  bridge.start().catch(error => {
    console.error('Failed to start CLI Bridge:', error);
    process.exit(1);
  });
}

module.exports = {
  CLIBridge,
  sendCommand,
  getOutput,
  clearOutput,
  getState
};