#!/usr/bin/env node

/**
 * Debug script to test EnhancedInput rendering
 */

const React = require('react');
const { render, Box, Text } = require('ink');
const EnhancedInput = require('../src/ui/components/EnhancedInput');

function DebugUI() {
  const [messages, setMessages] = React.useState([]);
  const [history, setHistory] = React.useState(['test1', 'test2']);

  const handleSubmit = React.useCallback((input) => {
    setMessages(prev => [...prev, `Submitted: "${input}"`]);
  }, []);

  const handleHistoryChange = React.useCallback((newHistory) => {
    setHistory(newHistory);
    setMessages(prev => [...prev, `History updated: ${newHistory.length} items`]);
  }, []);

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: 'cyan' }, '=== Debug Enhanced Input ==='),
    React.createElement(Box, { minHeight: 5, flexDirection: 'column' },
      messages.map((msg, i) =>
        React.createElement(Text, { key: i }, msg)
      )
    ),
    React.createElement(Text, { color: 'gray' }, 'Type below and press Enter:'),
    React.createElement(EnhancedInput, {
      onSubmit: handleSubmit,
      placeholder: 'Type here...',
      multiline: false,
      disabled: false,
      history: history,
      onHistoryChange: handleHistoryChange,
      prompt: '> ',
      showCursor: true
    })
  );
}

// Check if we're in TTY mode
if (!process.stdin.isTTY) {
  console.log('This script requires a TTY terminal');
  process.exit(1);
}

const app = render(React.createElement(DebugUI));

setTimeout(() => {
  app.unmount();
  console.log('Debug complete');
  process.exit(0);
}, 30000);

process.on('SIGINT', () => {
  app.unmount();
  process.exit(0);
});