/**
 * Judge Classifier for MEW Protocol Agent Evaluations
 * 
 * Evaluates agent behavior by analyzing message envelopes against expected outcomes
 */

const fs = require('fs').promises;
const path = require('path');

class Judge {
  constructor(options = {}) {
    this.llmProvider = options.llmProvider || this.defaultLLMProvider;
    this.specPath = options.specPath || path.join(__dirname, '../../spec/v0.3/SPEC.md');
  }

  /**
   * Evaluate a scenario execution
   * @param {Object} scenario - The scenario definition
   * @param {Array} actualMessages - Array of MEW Protocol envelopes from execution
   * @param {Object} finalState - Final state of files/workspace
   * @returns {Object} Evaluation results
   */
  async evaluate(scenario, actualMessages, finalState) {
    const evaluation = {
      scenarioId: scenario.id,
      timestamp: new Date().toISOString(),
      scores: {},
      details: {},
      passed: false
    };

    // 1. Evaluate task completion
    evaluation.scores.taskCompletion = await this.evaluateTaskCompletion(
      scenario.expectedOutcome,
      finalState,
      actualMessages
    );

    // 2. Evaluate protocol compliance
    evaluation.scores.protocolCompliance = await this.evaluateProtocolCompliance(
      actualMessages,
      scenario.expectedPatterns
    );

    // 3. Evaluate file operations
    evaluation.scores.fileOperations = await this.evaluateFileOperations(
      scenario.expectedFileOps,
      actualMessages
    );

    // 4. Evaluate multi-step handling
    if (scenario.steps && scenario.steps.length > 1) {
      evaluation.scores.multiStepHandling = await this.evaluateMultiStepHandling(
        scenario.steps,
        actualMessages
      );
    }

    // 5. Evaluate code quality (if applicable)
    if (scenario.expectedOutcome.codeQuality) {
      evaluation.scores.codeQuality = await this.evaluateCodeQuality(
        finalState,
        scenario.expectedOutcome.codeQuality
      );
    }

    // Calculate overall score
    const scores = Object.values(evaluation.scores);
    evaluation.overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    evaluation.passed = evaluation.overallScore >= (scenario.passingScore || 0.7);

    // Generate detailed report
    evaluation.report = await this.generateReport(scenario, actualMessages, evaluation);

    return evaluation;
  }

  /**
   * Evaluate if the task was completed successfully
   */
  async evaluateTaskCompletion(expectedOutcome, finalState, messages) {
    const prompt = `
You are evaluating whether an AI agent successfully completed a coding task.

Expected Outcome:
${JSON.stringify(expectedOutcome, null, 2)}

Final State of Files:
${JSON.stringify(finalState, null, 2)}

Agent Messages (last 10):
${JSON.stringify(messages.slice(-10), null, 2)}

Evaluate the task completion on these criteria:
1. Were all required files created/modified?
2. Does the final code match the expected functionality?
3. Were the key requirements met?

Respond with a JSON object:
{
  "score": <0.0 to 1.0>,
  "completed": <boolean>,
  "missing": [<list of missing requirements>],
  "reasoning": "<explanation>"
}
`;

    const response = await this.llmProvider(prompt);
    try {
      const result = JSON.parse(response);
      return result.score;
    } catch (e) {
      console.error('Failed to parse task completion evaluation:', e);
      return 0;
    }
  }

  /**
   * Evaluate protocol compliance
   */
  async evaluateProtocolCompliance(messages, expectedPatterns) {
    const spec = await fs.readFile(this.specPath, 'utf-8').catch(() => '');
    
    const prompt = `
You are evaluating MEW Protocol compliance for an agent's messages.

Expected Message Patterns:
${JSON.stringify(expectedPatterns, null, 2)}

Actual Messages (first 20):
${JSON.stringify(messages.slice(0, 20), null, 2)}

Key Protocol Rules (from spec):
- Agents with !tools/call capability must use mcp/proposal
- Proposals must include proper 'to' field when targeting specific participants
- Responses must include correlation_id referencing the request
- Tool calls should use participant/tool notation

Evaluate compliance:
1. Did the agent follow capability restrictions?
2. Were proposals properly formatted?
3. Were correlation IDs properly used?
4. Was the message flow logical?

Respond with a JSON object:
{
  "score": <0.0 to 1.0>,
  "violations": [<list of violations>],
  "reasoning": "<explanation>"
}
`;

    const response = await this.llmProvider(prompt);
    try {
      const result = JSON.parse(response);
      return result.score;
    } catch (e) {
      console.error('Failed to parse protocol compliance evaluation:', e);
      return 0;
    }
  }

  /**
   * Evaluate file operations
   */
  async evaluateFileOperations(expectedOps, messages) {
    const fileOps = messages.filter(m => 
      m.kind === 'mcp/proposal' || m.kind === 'mcp/request'
    ).filter(m => 
      m.payload?.params?.name?.includes('file') ||
      m.payload?.params?.name?.includes('write') ||
      m.payload?.params?.name?.includes('read') ||
      m.payload?.params?.name?.includes('edit')
    );

    const prompt = `
You are evaluating file operations performed by an agent.

Expected Operations:
${JSON.stringify(expectedOps, null, 2)}

Actual File Operations:
${JSON.stringify(fileOps, null, 2)}

Evaluate:
1. Were all expected files read before modification?
2. Were files written/edited as expected?
3. Was the sequence of operations logical?
4. Were unnecessary operations avoided?

Respond with a JSON object:
{
  "score": <0.0 to 1.0>,
  "correctOps": <count>,
  "unnecessaryOps": <count>,
  "missingOps": [<list>],
  "reasoning": "<explanation>"
}
`;

    const response = await this.llmProvider(prompt);
    try {
      const result = JSON.parse(response);
      return result.score;
    } catch (e) {
      console.error('Failed to parse file operations evaluation:', e);
      return 0;
    }
  }

  /**
   * Evaluate multi-step handling
   */
  async evaluateMultiStepHandling(steps, messages) {
    const prompt = `
You are evaluating an agent's ability to handle multi-step tasks.

Expected Steps:
${JSON.stringify(steps, null, 2)}

Agent Messages:
${JSON.stringify(messages, null, 2)}

Evaluate:
1. Did the agent complete steps in a logical order?
2. Did the agent maintain context between steps?
3. Were dependencies between steps handled correctly?
4. Did the agent handle feedback and iterate appropriately?

Respond with a JSON object:
{
  "score": <0.0 to 1.0>,
  "stepsCompleted": <count>,
  "stepsTotal": ${steps.length},
  "contextMaintained": <boolean>,
  "reasoning": "<explanation>"
}
`;

    const response = await this.llmProvider(prompt);
    try {
      const result = JSON.parse(response);
      return result.score;
    } catch (e) {
      console.error('Failed to parse multi-step evaluation:', e);
      return 0;
    }
  }

  /**
   * Evaluate code quality
   */
  async evaluateCodeQuality(finalState, qualityCriteria) {
    const prompt = `
You are evaluating the quality of code generated by an AI agent.

Quality Criteria:
${JSON.stringify(qualityCriteria, null, 2)}

Generated Code:
${JSON.stringify(finalState, null, 2)}

Evaluate:
1. Is the code syntactically correct?
2. Does it follow best practices?
3. Is it maintainable and readable?
4. Does it handle edge cases?
5. Is it efficient?

Respond with a JSON object:
{
  "score": <0.0 to 1.0>,
  "syntaxCorrect": <boolean>,
  "bestPractices": <boolean>,
  "maintainable": <boolean>,
  "reasoning": "<explanation>"
}
`;

    const response = await this.llmProvider(prompt);
    try {
      const result = JSON.parse(response);
      return result.score;
    } catch (e) {
      console.error('Failed to parse code quality evaluation:', e);
      return 0;
    }
  }

  /**
   * Generate a detailed evaluation report
   */
  async generateReport(scenario, messages, evaluation) {
    const prompt = `
Generate a concise evaluation report for this agent test:

Scenario: ${scenario.name}
Description: ${scenario.description}

Scores:
${JSON.stringify(evaluation.scores, null, 2)}

Overall Score: ${evaluation.overallScore.toFixed(2)}
Passed: ${evaluation.passed}

Provide a human-readable summary including:
1. What the agent did well
2. What could be improved
3. Any critical issues
4. Recommendations

Keep it concise but informative.
`;

    return await this.llmProvider(prompt);
  }

  /**
   * Default LLM provider (can be overridden)
   */
  async defaultLLMProvider(prompt) {
    // This would be replaced with actual LLM API call
    console.log('LLM Prompt:', prompt.substring(0, 200) + '...');
    
    // Mock response for testing
    return JSON.stringify({
      score: 0.8,
      completed: true,
      reasoning: "Mock evaluation response"
    });
  }
}

module.exports = Judge;