#!/usr/bin/env node

/**
 * Bridge Helper - Simple CLI for interacting with the CLI bridge
 */

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'cli-input.txt');
const outputFile = path.join(__dirname, 'cli-output.txt');
const stateFile = path.join(__dirname, 'cli-state.txt');

const command = process.argv[2];
const args = process.argv.slice(3);

function sendCommand(cmd) {
  fs.writeFileSync(inputFile, cmd);
  console.log(`Sent: ${cmd}`);
}

function getOutput() {
  try {
    return fs.readFileSync(outputFile, 'utf8');
  } catch (error) {
    return '';
  }
}

function tailOutput(lines = 20) {
  const output = getOutput();
  const outputLines = output.split('\n');
  return outputLines.slice(-lines).join('\n');
}

function clearOutput() {
  fs.writeFileSync(outputFile, '');
  console.log('Output cleared');
}

function getState() {
  try {
    return fs.readFileSync(stateFile, 'utf8').trim();
  } catch (error) {
    return 'unknown';
  }
}

// Command handling
switch(command) {
  case 'send':
    sendCommand(args.join(' '));
    break;
    
  case 'output':
    console.log(getOutput());
    break;
    
  case 'tail':
    const numLines = parseInt(args[0]) || 20;
    console.log(tailOutput(numLines));
    break;
    
  case 'clear':
    clearOutput();
    break;
    
  case 'state':
    console.log(`State: ${getState()}`);
    break;
    
  case 'watch':
    // Watch output file for changes
    console.log('Watching output... (Ctrl+C to stop)');
    let lastSize = 0;
    setInterval(() => {
      try {
        const stats = fs.statSync(outputFile);
        if (stats.size > lastSize) {
          const output = getOutput();
          const newContent = output.substring(lastSize);
          process.stdout.write(newContent);
          lastSize = stats.size;
        }
      } catch (error) {
        // File might not exist yet
      }
    }, 100);
    break;
    
  default:
    console.log('CLI Bridge Helper');
    console.log('Usage:');
    console.log('  node bridge-helper.js send <command>  - Send a command to the CLI');
    console.log('  node bridge-helper.js output          - Show all output');
    console.log('  node bridge-helper.js tail [n]        - Show last n lines (default 20)');
    console.log('  node bridge-helper.js clear           - Clear output file');
    console.log('  node bridge-helper.js state           - Show bridge state');
    console.log('  node bridge-helper.js watch           - Watch output in real-time');
}