/**
 * Advanced Interactive UI using Ink
 *
 * Provides a modern terminal interface with native scrolling, MCP confirmations,
 * and rich formatting for MEW protocol interactions.
 * 
 * Based on Gemini CLI patterns and MEW Protocol v0.3 specification.
 */

const React = require('react');
const { render, Box, Text, Static, useInput, useApp, useFocus } = require('ink');
const { useState, useEffect, useRef } = React;
const chalk = require('chalk');
const { v4: uuidv4 } = require('uuid');

/**
 * Main Advanced Interactive UI Component
 */
function AdvancedInteractiveUI({ ws, participantId, spaceId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [pendingOperation, setPendingOperation] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const { exit } = useApp();

  // Environment configuration
  const showHeartbeat = process.env.MEW_INTERACTIVE_SHOW_HEARTBEAT === 'true';
  const showSystem = process.env.MEW_INTERACTIVE_SHOW_SYSTEM !== 'false';
  const useColor = process.env.MEW_INTERACTIVE_COLOR !== 'false';

  // Setup WebSocket handlers
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (data) => {
      try {
        const message = JSON.parse(data);
        handleIncomingMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    const handleClose = () => {
      exit();
    };

    const handleError = (err) => {
      console.error('WebSocket error:', err);
      exit();
    };

    ws.on('message', handleMessage);
    ws.on('close', handleClose);
    ws.on('error', handleError);

    return () => {
      ws.off('message', handleMessage);
      ws.off('close', handleClose);
      ws.off('error', handleError);
    };
  }, [ws, exit]);

  const handleIncomingMessage = (message) => {
    // Filter messages based on configuration
    if (!showHeartbeat && message.kind === 'system/heartbeat') {
      return;
    }

    if (
      !showSystem &&
      message.kind?.startsWith('system/') &&
      message.kind !== 'system/error'
    ) {
      return;
    }

    // Check if this is an MCP proposal requiring confirmation
    // In MEW v0.3, mcp/proposal contains operation details that need approval
    if (message.kind === 'mcp/proposal') {
      setPendingOperation({
        id: message.id,
        from: message.from,
        operation: message.payload,
        timestamp: new Date(),
        correlationId: message.correlation_id,
      });
    }

    setMessages(prev => [...prev, {
      id: message.id || uuidv4(),
      message,
      sent: false,
      timestamp: new Date(),
    }]);
  };

  const sendMessage = (message) => {
    if (ws.readyState !== 1) {
      console.error('WebSocket is not connected');
      return;
    }

    const envelope = wrapEnvelope(message);
    ws.send(JSON.stringify(envelope));
    
    setMessages(prev => [...prev, {
      id: envelope.id,
      message: envelope,
      sent: true,
      timestamp: new Date(),
    }]);
  };

  const sendChat = (text) => {
    sendMessage({
      kind: 'chat',
      payload: { text },
    });
  };

  const processInput = (input) => {
    if (!input.trim()) return;

    // Handle commands
    if (input.startsWith('/')) {
      handleCommand(input);
      return;
    }

    // Try JSON
    try {
      const json = JSON.parse(input);
      if (isValidEnvelope(json)) {
        sendMessage(json);
      } else if (json.kind) {
        sendMessage(json);
      } else {
        sendChat(JSON.stringify(json));
      }
    } catch {
      // Plain text - send as chat
      sendChat(input);
    }
  };

  const handleCommand = (command) => {
    const [cmd, ...args] = command.split(' ');
    
    switch (cmd) {
      case '/help':
        setShowHelp(true);
        break;
      case '/verbose':
        setVerbose(!verbose);
        break;
      case '/clear':
        setMessages([]);
        break;
      case '/exit':
        exit();
        break;
      default:
        // Add message about unknown command
        setMessages(prev => [...prev, {
          id: uuidv4(),
          message: { kind: 'system/info', payload: { text: `Unknown command: ${cmd}` } },
          sent: false,
          timestamp: new Date(),
        }]);
    }
  };

  const wrapEnvelope = (message) => {
    return {
      protocol: 'mew/v0.3',
      id: `msg-${uuidv4()}`,
      ts: new Date().toISOString(),
      from: participantId,
      kind: message.kind,
      payload: message.payload,
      ...message,
    };
  };

  const isValidEnvelope = (obj) => {
    return obj && obj.protocol === 'mew/v0.3' && obj.id && obj.ts && obj.kind;
  };

  return React.createElement(Box, { flexDirection: "column", height: "100%" },
    // Header
    React.createElement(Box, { borderStyle: "round", borderColor: "cyan", paddingX: 1 },
      React.createElement(Text, { color: "cyan" },
        `MEW Interactive - Space: ${spaceId} | Participant: ${participantId}`
      )
    ),
    
    // Message History with Native Scrolling
    React.createElement(Box, { flexGrow: 1, flexDirection: "column", marginY: 1 },
      React.createElement(Static, { items: messages }, (item) =>
        React.createElement(MessageDisplay, {
          key: item.id,
          item: item,
          verbose: verbose,
          useColor: useColor
        })
      )
    ),
    
    // MCP Operation Confirmation
    pendingOperation && React.createElement(OperationConfirmation, {
      operation: pendingOperation,
      onApprove: () => {
        // Send approval
        sendMessage({
          kind: 'mcp/approval',
          payload: { operationId: pendingOperation.id, approved: true }
        });
        setPendingOperation(null);
      },
      onDeny: () => {
        // Send denial
        sendMessage({
          kind: 'mcp/approval',
          payload: { operationId: pendingOperation.id, approved: false }
        });
        setPendingOperation(null);
      }
    }),
    
    // Help Modal
    showHelp && React.createElement(HelpModal, {
      onClose: () => setShowHelp(false)
    }),
    
    // Input Composer
    React.createElement(InputComposer, {
      value: inputValue,
      onChange: setInputValue,
      onSubmit: (value) => {
        processInput(value);
        setInputValue('');
      }
    }),
    
    // Status Bar
    React.createElement(StatusBar, {
      connected: ws?.readyState === 1,
      messageCount: messages.length,
      verbose: verbose,
      pendingOperation: !!pendingOperation
    })
  );
}

/**
 * Message Display Component
 */
function MessageDisplay({ item, verbose, useColor }) {
  const { message, sent, timestamp } = item;
  const time = timestamp.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const direction = sent ? '→' : '←';
  const participant = sent ? 'you' : message.from || 'system';
  const kind = message.kind || 'unknown';

  if (verbose) {
    return React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
      React.createElement(Text, { color: "gray" },
        `[${time}] ${direction} ${participant} ${kind}`
      ),
      React.createElement(Text, null, JSON.stringify(message, null, 2))
    );
  }

  let headerColor = useColor ? getColorForKind(kind) : 'white';
  
  return React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
    React.createElement(Text, { color: headerColor },
      `[${time}] ${direction} ${participant} ${kind}`
    ),
    message.payload && React.createElement(Text, null,
      `└─ ${getPayloadPreview(message.payload, kind)}`
    )
  );
}

/**
 * Operation Confirmation Dialog
 */
function OperationConfirmation({ operation, onApprove, onDeny }) {
  useInput((input, key) => {
    if (input === 'a') onApprove();
    if (input === 'd') onDeny();
    if (key.escape) onDeny();
  });

  const riskLevel = assessRisk(operation.operation);

  return React.createElement(Box, {
      borderStyle: "round",
      borderColor: "yellow",
      paddingX: 1,
      paddingY: 1,
      marginY: 1
    },
    React.createElement(Box, { flexDirection: "column" },
      React.createElement(Text, { color: "yellow", bold: true },
        "MCP Operation Approval Required"
      ),
      React.createElement(Text, null,
        `${operation.from} wants to execute: ${operation.operation.method}`
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, null, "Risk Level: "),
        React.createElement(Text, { color: getRiskColor(riskLevel), bold: true },
          riskLevel
        )
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, null, "[a] Approve  [d] Deny  [Esc] Cancel")
      )
    )
  );
}

/**
 * Help Modal
 */
function HelpModal({ onClose }) {
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose();
    }
  });

  return React.createElement(Box, {
      borderStyle: "round",
      borderColor: "blue", 
      paddingX: 2,
      paddingY: 1,
      position: "absolute",
      top: 2,
      left: 2,
      width: "50%"
    },
    React.createElement(Box, { flexDirection: "column" },
      React.createElement(Text, { color: "blue", bold: true }, "Available Commands"),
      React.createElement(Text, null, "/help              Show this help"),
      React.createElement(Text, null, "/verbose           Toggle verbose output"),
      React.createElement(Text, null, "/clear             Clear screen"),
      React.createElement(Text, null, "/exit              Exit application"),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: "gray" }, "Press Esc or 'q' to close")
      )
    )
  );
}

/**
 * Input Composer Component
 */
function InputComposer({ value, onChange, onSubmit }) {
  useInput((input, key) => {
    if (key.return) {
      onSubmit(value);
    } else if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  return React.createElement(Box, { borderStyle: "single", paddingX: 1 },
    React.createElement(Text, { color: "green" }, "> "),
    React.createElement(Text, null, value),
    React.createElement(Text, { color: "gray" }, "_")
  );
}

/**
 * Status Bar Component
 */
function StatusBar({ connected, messageCount, verbose, pendingOperation }) {
  const status = connected ? 'Connected' : 'Disconnected';
  const statusColor = connected ? 'green' : 'red';

  return React.createElement(Box, { justifyContent: "space-between", paddingX: 1 },
    React.createElement(Text, null,
      React.createElement(Text, { color: statusColor }, status),
      " | ",
      React.createElement(Text, null, `${messageCount} messages`),
      verbose && " | Verbose",
      pendingOperation && React.createElement(Text, { color: "yellow" }, " | Pending Operation")
    ),
    React.createElement(Text, { color: "gray" }, "Ctrl+C to exit")
  );
}

// Helper functions
function getColorForKind(kind) {
  if (kind.startsWith('system/error')) return 'red';
  if (kind.startsWith('system/')) return 'gray';
  if (kind.startsWith('mcp/')) return 'yellow';
  if (kind === 'chat') return 'white';
  return 'cyan';
}

function getPayloadPreview(payload, kind) {
  if (kind === 'chat' && payload.text) {
    return `"${payload.text}"`;
  }

  if (kind === 'mcp/request' && payload.method) {
    let preview = `method: "${payload.method}"`;
    if (payload.params?.name) {
      preview += `, name: "${payload.params.name}"`;
    }
    return preview;
  }

  if (typeof payload === 'string') {
    return `"${payload}"`;
  }
  if (Array.isArray(payload)) {
    return `[${payload.length} items]`;
  }
  if (typeof payload === 'object') {
    const keys = Object.keys(payload);
    return `{${keys.slice(0, 2).join(', ')}${keys.length > 2 ? '...' : ''}}`;
  }
  return String(payload);
}

function assessRisk(operation) {
  const method = operation.method?.toLowerCase() || '';
  
  if (method.includes('read') || method.includes('list') || method.includes('browse')) {
    return 'SAFE';
  }
  if (method.includes('write') || method.includes('create') || method.includes('delete')) {
    return 'CAUTION';
  }
  if (method.includes('execute') || method.includes('run') || method.includes('eval')) {
    return 'DANGEROUS';
  }
  
  return 'CAUTION';
}

function getRiskColor(riskLevel) {
  switch (riskLevel) {
    case 'SAFE': return 'green';
    case 'CAUTION': return 'yellow';
    case 'DANGEROUS': return 'red';
    default: return 'yellow';
  }
}

/**
 * Starts the advanced interactive UI
 */
function startAdvancedInteractiveUI(ws, participantId, spaceId) {
  const { rerender, unmount } = render(
    React.createElement(AdvancedInteractiveUI, { ws, participantId, spaceId })
  );

  // Handle cleanup
  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });

  return { rerender, unmount };
}

module.exports = {
  startAdvancedInteractiveUI,
  AdvancedInteractiveUI,
};