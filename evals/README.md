# MEW Protocol Agent Evaluations

This directory contains evaluation scenarios for testing MEW Protocol agents, particularly focusing on the coder agent's ability to handle multi-step coding tasks.

## Structure

- `scenarios/` - Individual test scenarios
- `lib/` - Shared utilities and judge classifiers
- `results/` - Evaluation results and logs
- `run-eval.js` - Main evaluation runner

## Scenarios

Each scenario tests the agent's ability to:
1. Understand requirements
2. Read existing files
3. Make appropriate changes
4. Handle multi-step workflows
5. Respond to feedback

## Running Evaluations

```bash
# Run a specific scenario
node run-eval.js --scenario todo-app-create

# Run all scenarios
node run-eval.js --all

# Run with specific model
node run-eval.js --scenario todo-app-create --model gpt-4
```

## Evaluation Criteria

The judge classifier evaluates:
- **Task Completion**: Did the agent complete the requested task?
- **File Operations**: Were the correct files read/written?
- **Code Quality**: Is the generated code functional?
- **Protocol Compliance**: Did the agent follow MEW Protocol correctly?
- **Multi-step Handling**: Can the agent handle sequences of changes?