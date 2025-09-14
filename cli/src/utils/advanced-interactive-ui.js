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
  const [activeReasoning, setActiveReasoning] = useState(null); // Track active reasoning sessions
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

    // Handle reasoning messages
    if (message.kind === 'reasoning/start') {
      setActiveReasoning({
        id: message.id,
        from: message.from,
        message: message.payload?.message || 'Thinking...',
        startTime: new Date(),
        thoughtCount: 0
      });
    } else if (message.kind === 'reasoning/thought') {
      setActiveReasoning(prev => prev ? {
        ...prev,
        message: message.payload?.message || prev.message,
        thoughtCount: prev.thoughtCount + 1
      } : null);
    } else if (message.kind === 'reasoning/conclusion') {
      setActiveReasoning(null);
    }

    // Check if this is an MCP proposal requiring confirmation
    // In MEW v0.3, mcp/proposal contains operation details that need approval
    if (message.kind === 'mcp/proposal') {
      setPendingOperation({
        id: message.id,
        from: message.from,
        to: message.to,  // Capture the target participant(s)
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
    // Message History with Native Scrolling (no header box)
    React.createElement(Box, { flexGrow: 1, flexDirection: "column", marginTop: 1 },
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
        // Fulfill the proposal by sending the actual MCP request
        // According to MEW spec, approval is done by fulfillment with correlation_id
        if (pendingOperation.operation) {
          // Extract the method and params from the proposal payload
          const { method, params } = pendingOperation.operation;
          
          // Send the MCP request with correlation_id pointing to the proposal
          // IMPORTANT: Send to the participant specified in the proposal's 'to' field
          const message = {
            kind: 'mcp/request',
            correlation_id: [pendingOperation.id],
            payload: {
              jsonrpc: '2.0',
              id: Date.now(), // Generate a unique request ID
              method: method,
              params: params
            }
          };
          
          // If the proposal specified a target participant, send to them
          if (pendingOperation.to && pendingOperation.to.length > 0) {
            message.to = pendingOperation.to;
          }
          
          sendMessage(message);
        }
        setPendingOperation(null);
      },
      onDeny: () => {
        // Send rejection according to MEW spec
        sendMessage({
          kind: 'mcp/reject',
          correlation_id: pendingOperation.id,
          payload: {
            reason: 'disagree'
          }
        });
        setPendingOperation(null);
      }
    }),
    
    // Help Modal
    showHelp && React.createElement(HelpModal, {
      onClose: () => setShowHelp(false)
    }),
    
    // Reasoning Status
    activeReasoning && React.createElement(ReasoningStatus, {
      reasoning: activeReasoning
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
      pendingOperation: !!pendingOperation,
      spaceId: spaceId,
      participantId: participantId
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

  // Add context indicator
  const contextPrefix = message.context ? '  └─ ' : '';
  const contextIndicator = message.context ? '┌─ ' : '';

  if (verbose) {
    return React.createElement(Box, { flexDirection: "column", marginBottom: 1 },
      React.createElement(Text, { color: "gray" },
        `${contextPrefix}[${time}] ${direction} ${participant} ${kind}`
      ),
      React.createElement(Text, null, JSON.stringify(message, null, 2))
    );
  }

  let headerColor = useColor ? getColorForKind(kind) : 'white';

  return React.createElement(Box, { flexDirection: "column", marginBottom: kind === 'reasoning/thought' ? 2 : 1 },
    React.createElement(Text, { color: headerColor },
      `${contextPrefix}[${time}] ${direction} ${participant} ${kind}`
    ),
    message.payload && React.createElement(ReasoningDisplay, {
      payload: message.payload,
      kind: kind,
      contextPrefix: contextPrefix
    })
  );
}

/**
 * Reasoning Display Component - Shows payload with better formatting for reasoning
 */
function ReasoningDisplay({ payload, kind, contextPrefix }) {
  const preview = getPayloadPreview(payload, kind);

  // Special formatting for reasoning/thought messages
  if (kind === 'reasoning/thought' && payload.reasoning) {
    return React.createElement(Box, { flexDirection: "column" },
      React.createElement(Text, null, `${contextPrefix}└─ reasoning/thought`),
      React.createElement(Text, {
        color: "blueBright",
        marginLeft: 6,
        marginTop: 1,
        wrap: "wrap"
      }, payload.reasoning),
      payload.action && React.createElement(Text, {
        color: "gray",
        marginLeft: 6,
        marginTop: 1
      }, `→ action: ${payload.action}`)
    );
  }

  // Default single-line display for other message types
  return React.createElement(Text, null, `${contextPrefix}└─ ${preview}`);
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
 * Reasoning Status Component
 */
function ReasoningStatus({ reasoning }) {
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  // Animate the thinking indicator with a rotating spinner
  useEffect(() => {
    const interval = setInterval(() => {
      setSpinnerIndex(prev => (prev + 1) % spinnerChars.length);
    }, 100);
    return () => clearInterval(interval);
  }, []);
  
  const elapsedTime = Math.floor((Date.now() - reasoning.startTime) / 1000);
  
  return React.createElement(Box, { 
    borderStyle: "round",
    borderColor: "cyan",
    paddingX: 1,
    marginBottom: 1
  },
    React.createElement(Box, { justifyContent: "space-between", width: "100%" },
      React.createElement(Box, null,
        React.createElement(Text, { color: "cyan", bold: true }, spinnerChars[spinnerIndex] + " "),
        React.createElement(Text, { color: "cyan" }, `${reasoning.from} is thinking`)
      ),
      React.createElement(Box, null,
        React.createElement(Text, { color: "gray" }, 
          `${elapsedTime}s | ${reasoning.thoughtCount} thoughts`
        )
      )
    ),
    reasoning.message && React.createElement(Box, { marginTop: 0 },
      React.createElement(Text, { color: "gray", italic: true, wrap: "wrap" }, 
        `"${reasoning.message.slice(0, 300)}${reasoning.message.length > 300 ? '...' : ''}"`
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
function StatusBar({ connected, messageCount, verbose, pendingOperation, spaceId, participantId }) {
  const status = connected ? 'Connected' : 'Disconnected';
  const statusColor = connected ? 'green' : 'red';

  return React.createElement(Box, { justifyContent: "space-between", paddingX: 1 },
    React.createElement(Text, null,
      "🐱 | ",
      React.createElement(Text, { color: statusColor }, status),
      " | ",
      React.createElement(Text, { color: "cyan" }, spaceId),
      " | ",
      React.createElement(Text, { color: "blue" }, participantId),
      " | ",
      React.createElement(Text, null, `${messageCount} msgs`),
      verbose && " | Verbose",
      pendingOperation && React.createElement(Text, { color: "yellow" }, " | Pending Op")
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

  if (kind === 'mcp/response') {
    if (payload.result) {
      if (payload.result.content && Array.isArray(payload.result.content)) {
        // Show first content item if it's text
        const firstContent = payload.result.content[0];
        if (firstContent?.type === 'text') {
          const text = firstContent.text;
          return `result: "${text.length > 150 ? text.substring(0, 150) + '...' : text}"`;
        }
        return `result: ${payload.result.content.length} content items`;
      }
      if (typeof payload.result === 'object') {
        const keys = Object.keys(payload.result);
        return `result: {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
      }
      // For string results (like file operations), show more of the path
      const resultStr = String(payload.result);
      return `result: ${resultStr.length > 200 ? '...' + resultStr.substring(resultStr.length - 200) : resultStr}`;
    }
    if (payload.error) {
      return `error: ${payload.error.message || payload.error}`;
    }
    return 'response';
  }

  if (kind === 'mcp/proposal' && payload.method) {
    let preview = `proposing: "${payload.method}"`;
    if (payload.params?.name) {
      preview += `, name: "${payload.params.name}"`;
    }
    return preview;
  }

  if (kind === 'reasoning/thought') {
    // Try to show both reasoning and action if available
    let parts = [];
    if (payload.reasoning && payload.reasoning !== payload.action) {
      parts.push(`reasoning: "${payload.reasoning}"`);
    }
    if (payload.action) {
      parts.push(`action: "${payload.action}"`);
    }
    if (payload.actionInput && typeof payload.actionInput === 'object') {
      const input = JSON.stringify(payload.actionInput);
      parts.push(`input: ${input.length > 80 ? input.substring(0, 80) + '...' : input}`);
    }
    if (payload.message) {
      parts.push(`"${payload.message}"`);
    }

    let combined = parts.join(' | ');
    return combined.length > 1000 ? combined.substring(0, 1000) + '...' : combined;
  }

  if (kind === 'reasoning/start') {
    if (payload.message) {
      const message = payload.message;
      return `🧠 Starting: "${message.length > 120 ? message.substring(0, 120) + '...' : message}"`;
    }
    return '🧠 Started reasoning session';
  }

  if (kind === 'reasoning/conclusion') {
    if (payload.message) {
      const message = payload.message;
      return `✅ Concluded: "${message.length > 120 ? message.substring(0, 120) + '...' : message}"`;
    }
    return '✅ Reasoning session complete';
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