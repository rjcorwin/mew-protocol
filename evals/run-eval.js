#!/usr/bin/env node

/**
 * MEW Protocol Agent Evaluation Runner
 * 
 * Runs evaluation scenarios against the coder agent and judges the results
 */

const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const Judge = require('./lib/judge');
const { v4: uuidv4 } = require('uuid');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  scenario: null,
  all: false,
  model: process.env.EVAL_MODEL || 'gpt-4',
  gateway: process.env.MEW_GATEWAY || 'ws://localhost:8080',
  space: process.env.MEW_SPACE || 'coder-demo',
  timeout: parseInt(process.env.EVAL_TIMEOUT || '60000'),
  verbose: args.includes('--verbose') || args.includes('-v')
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--scenario' && i + 1 < args.length) {
    options.scenario = args[i + 1];
    i++;
  } else if (args[i] === '--all') {
    options.all = true;
  } else if (args[i] === '--model' && i + 1 < args.length) {
    options.model = args[i + 1];
    i++;
  } else if (args[i] === '--gateway' && i + 1 < args.length) {
    options.gateway = args[i + 1];
    i++;
  } else if (args[i] === '--timeout' && i + 1 < args.length) {
    options.timeout = parseInt(args[i + 1]);
    i++;
  }
}

class EvaluationRunner {
  constructor(options) {
    this.options = options;
    this.judge = new Judge({
      llmProvider: this.createLLMProvider(options.model)
    });
    this.messages = [];
    this.workspace = {};
  }

  /**
   * Create an LLM provider for the judge
   */
  createLLMProvider(model) {
    return async (prompt) => {
      // This is where you'd integrate with your LLM API
      // For now, using a mock that would be replaced with actual API calls
      
      if (model === 'openai') {
        // OpenAI API integration
        const { Configuration, OpenAIApi } = require('openai');
        const configuration = new Configuration({
          apiKey: process.env.OPENAI_API_KEY,
        });
        const openai = new OpenAIApi(configuration);
        
        try {
          const response = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: 'You are an evaluation judge for AI agent behavior.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1000
          });
          
          return response.data.choices[0].message.content;
        } catch (error) {
          console.error('OpenAI API error:', error);
          throw error;
        }
      }
      
      // Default mock provider for testing
      console.log('Using mock LLM provider');
      return JSON.stringify({
        score: Math.random() * 0.3 + 0.7, // Random score between 0.7-1.0
        completed: true,
        reasoning: "Mock evaluation - replace with actual LLM"
      });
    };
  }

  /**
   * Run a single scenario
   */
  async runScenario(scenarioPath) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running scenario: ${path.basename(scenarioPath, '.js')}`);
    console.log('='.repeat(60));
    
    // Load scenario
    const scenario = require(scenarioPath);
    console.log(`📋 ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    // Initialize workspace with scenario's initial state
    this.workspace = { ...scenario.initialState.files };
    this.messages = [];
    
    // Start evaluation space
    console.log('\n🚀 Starting evaluation space...');
    await this.startSpace();
    
    // Connect to space and capture messages
    console.log('🔌 Connecting to space...');
    const ws = await this.connectToSpace();
    
    // Send the request to the agent
    console.log('📨 Sending request to agent...');
    await this.sendRequest(ws, scenario.request);
    
    // Wait for agent to complete (with timeout)
    console.log('⏳ Waiting for agent completion...');
    await this.waitForCompletion(ws, scenario);
    
    // Close connection
    ws.close();
    
    // Stop the space
    await this.stopSpace();
    
    // Evaluate the results
    console.log('\n⚖️  Evaluating results...');
    const evaluation = await this.judge.evaluate(
      scenario,
      this.messages,
      { files: this.workspace }
    );
    
    // Print results
    this.printResults(scenario, evaluation);
    
    // Save results
    await this.saveResults(scenario, evaluation);
    
    return evaluation;
  }

  /**
   * Start the evaluation space
   */
  async startSpace() {
    // This would start the MEW space with the coder agent
    // For now, assuming space is already running
    console.log('   (Using existing space on port 8080)');
  }

  /**
   * Stop the evaluation space
   */
  async stopSpace() {
    // This would stop the MEW space
    console.log('   Space cleanup complete');
  }

  /**
   * Connect to the MEW space as evaluator
   */
  async connectToSpace() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.options.gateway}?space=${this.options.space}`, {
        headers: {
          Authorization: 'Bearer evaluator-token'
        }
      });
      
      ws.on('open', () => {
        if (this.options.verbose) console.log('   Connected to gateway');
        
        // Send join message to properly join the space
        const joinMessage = {
          type: 'join',
          space: this.options.space,
          token: 'evaluator-token',
          participantId: 'evaluator',
          capabilities: []
        };
        ws.send(JSON.stringify(joinMessage));
        
        // Resolve after a brief delay to ensure join is processed
        setTimeout(() => resolve(ws), 500);
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });
      
      ws.on('error', reject);
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    // Skip system messages
    if (message.kind === 'system/welcome' || message.kind === 'system/presence') {
      return;
    }
    
    // Store message for evaluation
    this.messages.push(message);
    
    if (this.options.verbose) {
      console.log(`   [${message.from}] ${message.kind}`);
    }
    
    // Handle proposals that need approval
    if (message.kind === 'mcp/proposal' && message.from === 'coder-agent') {
      this.handleProposal(message);
    }
    
    // Handle file operation responses
    if (message.kind === 'mcp/response') {
      this.handleResponse(message);
    }
  }

  /**
   * Handle MCP proposals (auto-approve for evaluation)
   */
  async handleProposal(proposal) {
    // Auto-approve proposals for evaluation
    // Note: In a real implementation, this would send the fulfillment
    // For now, we just simulate the file operation
    
    if (this.options.verbose) {
      console.log(`   ✅ Auto-approving proposal: ${proposal.payload.params?.name}`);
    }
    
    // Simulate file operations for testing
    this.simulateFileOperation(proposal.payload.params);
  }

  /**
   * Simulate file operations for testing
   */
  simulateFileOperation(params) {
    if (!params || !params.name) return;
    
    switch (params.name) {
      case 'write_file':
        if (params.arguments?.path && params.arguments?.content) {
          this.workspace[params.arguments.path] = params.arguments.content;
          if (this.options.verbose) {
            console.log(`   📝 Wrote file: ${params.arguments.path}`);
          }
        }
        break;
        
      case 'edit_file':
        if (params.arguments?.path && params.arguments?.edits) {
          let content = this.workspace[params.arguments.path] || '';
          for (const edit of params.arguments.edits) {
            content = content.replace(edit.oldText, edit.newText);
          }
          this.workspace[params.arguments.path] = content;
          if (this.options.verbose) {
            console.log(`   ✏️  Edited file: ${params.arguments.path}`);
          }
        }
        break;
        
      case 'read_file':
      case 'read_text_file':
        if (this.options.verbose && params.arguments?.path) {
          console.log(`   👁️  Read file: ${params.arguments.path}`);
        }
        break;
    }
  }

  /**
   * Handle MCP responses
   */
  handleResponse(response) {
    // Track responses for evaluation
    if (this.options.verbose && response.payload?.result) {
      console.log(`   📩 Response received`);
    }
  }

  /**
   * Send request to agent
   */
  async sendRequest(ws, request) {
    const message = {
      protocol: 'mew/v0.3',
      id: uuidv4(),
      ts: new Date().toISOString(),
      from: 'evaluator',
      to: ['coder-agent'],
      ...request
    };
    
    ws.send(JSON.stringify(message));
  }

  /**
   * Wait for agent to complete processing
   */
  async waitForCompletion(_ws, scenario) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkCompletion = setInterval(() => {
        // Check for timeout
        if (Date.now() - startTime > this.options.timeout) {
          console.log('   ⏱️  Timeout reached');
          clearInterval(checkCompletion);
          resolve();
          return;
        }
        
        // Check if scenario validation passes
        if (scenario.validate && scenario.validate({ files: this.workspace })) {
          console.log('   ✓ Scenario validation passed');
          clearInterval(checkCompletion);
          resolve();
          return;
        }
        
        // Check for completion signals in messages
        const recentMessages = this.messages.slice(-5);
        const hasConclusion = recentMessages.some(m => m.kind === 'reasoning/conclusion');
        const hasFinalChat = recentMessages.some(m => 
          m.kind === 'chat' && 
          m.from === 'coder-agent' &&
          (m.payload?.text?.includes('complete') || 
           m.payload?.text?.includes('done') ||
           m.payload?.text?.includes('created'))
        );
        
        if (hasConclusion || hasFinalChat) {
          console.log('   ✓ Agent completed task');
          clearInterval(checkCompletion);
          setTimeout(resolve, 1000); // Wait a bit for any final messages
        }
      }, 1000);
    });
  }

  /**
   * Print evaluation results
   */
  printResults(_scenario, evaluation) {
    console.log('\n' + '='.repeat(60));
    console.log('EVALUATION RESULTS');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Scores:`);
    for (const [key, value] of Object.entries(evaluation.scores)) {
      const percentage = (value * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(value * 20)) + '░'.repeat(20 - Math.floor(value * 20));
      console.log(`   ${key.padEnd(25)} ${bar} ${percentage}%`);
    }
    
    console.log(`\n🎯 Overall Score: ${(evaluation.overallScore * 100).toFixed(1)}%`);
    console.log(`📋 Status: ${evaluation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (evaluation.report) {
      console.log(`\n📝 Report:`);
      console.log(evaluation.report);
    }
  }

  /**
   * Save evaluation results
   */
  async saveResults(scenario, evaluation) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `${scenario.id}_${timestamp}.json`;
    const filepath = path.join(__dirname, 'results', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify({
      scenario: {
        id: scenario.id,
        name: scenario.name
      },
      evaluation,
      messages: this.messages,
      workspace: this.workspace,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${filename}`);
  }

  /**
   * Run all scenarios
   */
  async runAll() {
    const scenariosDir = path.join(__dirname, 'scenarios');
    const files = await fs.readdir(scenariosDir);
    const scenarios = files.filter(f => f.endsWith('.js'));
    
    console.log(`\n🎯 Running ${scenarios.length} evaluation scenarios`);
    
    const results = [];
    for (const scenario of scenarios) {
      const scenarioPath = path.join(scenariosDir, scenario);
      const result = await this.runScenario(scenarioPath);
      results.push(result);
    }
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('EVALUATION SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = (passed / total * 100).toFixed(1);
    
    console.log(`\n📊 Overall: ${passed}/${total} scenarios passed (${percentage}%)`);
    
    for (const result of results) {
      const status = result.passed ? '✅' : '❌';
      const score = (result.overallScore * 100).toFixed(1);
      console.log(`   ${status} ${result.scenarioId.padEnd(25)} ${score}%`);
    }
  }
}

// Main execution
async function main() {
  if (!options.scenario && !options.all) {
    console.log('Usage: node run-eval.js --scenario <name> | --all [options]');
    console.log('\nOptions:');
    console.log('  --scenario <name>    Run a specific scenario');
    console.log('  --all               Run all scenarios');
    console.log('  --model <model>     LLM model to use for judging (default: gpt-4)');
    console.log('  --gateway <url>     MEW gateway URL (default: ws://localhost:8080)');
    console.log('  --timeout <ms>      Timeout in milliseconds (default: 60000)');
    console.log('  --verbose, -v       Verbose output');
    process.exit(1);
  }
  
  const runner = new EvaluationRunner(options);
  
  try {
    if (options.all) {
      await runner.runAll();
    } else {
      const scenarioPath = path.join(__dirname, 'scenarios', `${options.scenario}.js`);
      await runner.runScenario(scenarioPath);
    }
  } catch (error) {
    console.error('Evaluation failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);