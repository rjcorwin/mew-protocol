#!/usr/bin/env node

/**
 * Demo of Enhanced Input Component
 *
 * Run with: node tests/enhanced-input-demo.js
 *
 * Demonstrates the enhanced input with:
 * - Multi-line editing
 * - History navigation
 * - Word navigation
 * - All keyboard shortcuts
 */

const React = require('react');
const { render, Box, Text } = require('ink');
const EnhancedInputModule = require('../dist/ui/components/EnhancedInput');
const EnhancedInput = EnhancedInputModule.default || EnhancedInputModule;
const { getHelpText } = require('../dist/config/keyBindings');

/**
 * Demo Application Component
 */
function EnhancedInputDemo() {
  const [messages, setMessages] = React.useState([]);
  const [history, setHistory] = React.useState([
    'Previous command 1',
    'Previous command 2',
    'Previous command 3'
  ]);
  const [multiline, setMultiline] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);

  const handleSubmit = React.useCallback((input) => {
    // Handle special commands
    if (input === '/help') {
      setShowHelp(!showHelp);
      return;
    }
    if (input === '/multiline') {
      setMultiline(!multiline);
      setMessages(prev => [...prev, `Multiline mode: ${!multiline ? 'ON' : 'OFF'}`]);
      return;
    }
    if (input === '/clear') {
      setMessages([]);
      return;
    }
    if (input === '/exit' || input === '/quit') {
      process.exit(0);
    }

    // Add to messages
    setMessages(prev => [...prev, `You typed: ${input}`]);
  }, [multiline, showHelp]);

  const handleHistoryChange = React.useCallback((newHistory) => {
    setHistory(newHistory);
  }, []);

  return React.createElement(Box, {
    flexDirection: 'column',
    height: '100%'
  },
    // Header
    React.createElement(Box, {
      borderStyle: 'double',
      borderColor: 'cyan',
      paddingX: 1,
      marginBottom: 1
    },
      React.createElement(Text, { bold: true },
        '🚀 Enhanced Input Demo - MEW CLI'
      )
    ),

    // Help text
    showHelp && React.createElement(Box, {
      flexDirection: 'column',
      borderStyle: 'single',
      borderColor: 'yellow',
      paddingX: 1,
      marginBottom: 1
    },
      React.createElement(Text, { color: 'yellow', bold: true }, 'Keyboard Shortcuts:'),
      ...getHelpText().map((line, i) =>
        React.createElement(Text, { key: i }, line)
      ),
      React.createElement(Text, { color: 'gray' },
        '\nCommands: /help, /multiline, /clear, /exit'
      )
    ),

    // Messages area
    React.createElement(Box, {
      flexDirection: 'column',
      flexGrow: 1,
      borderStyle: 'single',
      borderColor: 'gray',
      paddingX: 1
    },
      messages.length === 0
        ? React.createElement(Text, { color: 'gray' },
            'Type something and press Enter. Use /help for shortcuts.')
        : messages.map((msg, i) =>
            React.createElement(Text, { key: i }, msg)
          )
    ),

    // Status line
    React.createElement(Box, {
      paddingX: 1,
      marginY: 1
    },
      React.createElement(Text, { color: 'gray' },
        `Mode: ${multiline ? 'Multi-line' : 'Single-line'} | ` +
        `History: ${history.length} items | ` +
        `Press Ctrl+C to exit`
      )
    ),

    // Input area
    React.createElement(Box, {
      flexDirection: 'column'
    },
      React.createElement(EnhancedInput, {
        onSubmit: handleSubmit,
        placeholder: 'Type here...',
        multiline: multiline,
        history: history,
        onHistoryChange: handleHistoryChange,
        prompt: '❯ '
      })
    )
  );
}

// Run the demo
const app = render(React.createElement(EnhancedInputDemo));

// Handle exit
process.on('SIGINT', () => {
  app.unmount();
  console.log('\nGoodbye! 👋');
  process.exit(0);
});