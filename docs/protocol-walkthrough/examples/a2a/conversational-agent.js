#!/usr/bin/env node

/**
 * A2A Conversational Agent (Client)
 * Demonstrates an agent that delegates calculations to the Calculator Agent
 */

const http = require('http');
const readline = require('readline');

class ConversationalAgent {
  constructor() {
    this.calculatorAgentUrl = 'http://localhost:8080/a2a/v1';
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async discoverAgent() {
    console.log('🔍 Discovering Calculator Agent...');
    
    try {
      const agentCard = await this.fetchAgentCard();
      console.log('✅ Found Calculator Agent:');
      console.log(`   Name: ${agentCard.name}`);
      console.log(`   Description: ${agentCard.description}`);
      console.log(`   Skills:`);
      agentCard.skills.forEach(skill => {
        console.log(`     - ${skill.name}: ${skill.description}`);
      });
      return agentCard;
    } catch (error) {
      console.error('❌ Failed to discover agent:', error.message);
      throw error;
    }
  }

  async fetchAgentCard() {
    return new Promise((resolve, reject) => {
      http.get('http://localhost:8080/.well-known/agent-card.json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  async sendMessage(text, taskId = null) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'message/send',
      params: {
        message: {
          role: 'user',
          parts: [{
            kind: 'text',
            text: text
          }],
          messageId: this.generateId()
        }
      }
    };

    if (taskId) {
      request.params.taskId = taskId;
    }

    return this.makeRequest(request);
  }

  async getTask(taskId) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tasks/get',
      params: { id: taskId }
    };

    return this.makeRequest(request);
  }

  async makeRequest(request) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/a2a/v1',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(request));
      req.end();
    });
  }

  async simulateConversation() {
    console.log('\n' + '='.repeat(60));
    console.log('SIMULATING AGENT-TO-AGENT CONVERSATION');
    console.log('='.repeat(60));
    
    // First calculation
    console.log('\n👤 User: "What\'s 41 + 1?"');
    console.log('\n🤖 Conversational Agent: Let me delegate that to my calculator colleague...');
    
    try {
      const task1 = await this.sendMessage('Calculate: 41 + 1');
      console.log(`\n📋 Task created: ${task1.id}`);
      console.log(`   Status: ${task1.status.state}`);
      
      if (task1.artifacts && task1.artifacts.length > 0) {
        const result = task1.artifacts[0].parts.find(p => p.kind === 'text').text;
        console.log(`\n🧮 Calculator Agent: ${result}`);
        console.log('\n🤖 Conversational Agent: According to my calculations, 41 + 1 equals 42');
      }
    } catch (error) {
      console.error('Error:', error.message);
    }

    // Second calculation
    console.log('\n' + '-'.repeat(40));
    console.log('\n👤 User: "What\'s 2 to the power of 10?"');
    console.log('\n🤖 Conversational Agent: I\'ll ask the calculator agent to compute that...');
    
    try {
      const task2 = await this.sendMessage('What is 2^10?');
      console.log(`\n📋 Task created: ${task2.id}`);
      console.log(`   Status: ${task2.status.state}`);
      
      if (task2.artifacts && task2.artifacts.length > 0) {
        const result = task2.artifacts[0].parts.find(p => p.kind === 'text').text;
        const data = task2.artifacts[0].parts.find(p => p.kind === 'data')?.data;
        
        console.log(`\n🧮 Calculator Agent: ${result}`);
        if (data) {
          console.log(`   (Expression: ${data.expression} = ${data.result})`);
        }
        console.log('\n🤖 Conversational Agent: 2 to the power of 10 is 1024');
      }
    } catch (error) {
      console.error('Error:', error.message);
    }

    // Demonstrate task status checking
    console.log('\n' + '-'.repeat(40));
    console.log('\n📊 Demonstrating task status checking...');
    
    try {
      const task3 = await this.sendMessage('Calculate: 100 / 4');
      console.log(`\nTask ${task3.id} initial status: ${task3.status.state}`);
      
      // Check task status again (already completed in this case)
      const taskStatus = await this.getTask(task3.id);
      console.log(`Task ${taskStatus.id} current status: ${taskStatus.status.state}`);
      
      if (taskStatus.artifacts && taskStatus.artifacts.length > 0) {
        const result = taskStatus.artifacts[0].parts.find(p => p.kind === 'text').text;
        console.log(`Result: ${result}`);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  async interactiveMode() {
    console.log('\n' + '='.repeat(60));
    console.log('INTERACTIVE MODE');
    console.log('Type mathematical questions or "quit" to exit');
    console.log('='.repeat(60));

    const askQuestion = () => {
      this.rl.question('\n👤 You: ', async (input) => {
        if (input.toLowerCase() === 'quit') {
          console.log('Goodbye!');
          this.rl.close();
          process.exit(0);
        }

        console.log('\n🤖 Conversational Agent: Let me ask the calculator agent...');
        
        try {
          const task = await this.sendMessage(input);
          
          if (task.status.state === 'failed') {
            const errorMessage = task.status.message?.parts[0]?.text || 'Unknown error';
            console.log(`\n❌ Calculator Agent: ${errorMessage}`);
          } else if (task.artifacts && task.artifacts.length > 0) {
            const result = task.artifacts[0].parts.find(p => p.kind === 'text').text;
            console.log(`\n🧮 Calculator Agent: ${result}`);
            
            // Extract just the number from "The result is X"
            const match = result.match(/The result is (.+)/);
            if (match) {
              console.log(`\n🤖 Conversational Agent: The answer is ${match[1]}`);
            }
          }
        } catch (error) {
          console.error(`\n❌ Error: ${error.message}`);
        }

        askQuestion();
      });
    };

    askQuestion();
  }

  generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async run() {
    try {
      // Discover the calculator agent
      await this.discoverAgent();
      
      // Run simulation
      await this.simulateConversation();
      
      // Enter interactive mode
      await this.interactiveMode();
    } catch (error) {
      console.error('Failed to start:', error.message);
      console.error('Make sure the Calculator Agent is running on port 8080');
      process.exit(1);
    }
  }
}

// Start the conversational agent
const agent = new ConversationalAgent();
agent.run();