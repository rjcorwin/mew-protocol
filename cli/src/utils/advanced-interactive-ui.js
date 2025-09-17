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
const { v4: uuidv4 } = require('uuid');
const EnhancedInput = require('../ui/components/EnhancedInput');
const SimpleInput = require('../ui/components/SimpleInput'); // Temporary for debugging

/**
 * Main Advanced Interactive UI Component
 */
function AdvancedInteractiveUI({ ws, participantId, spaceId }) {
  const [messages, setMessages] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [pendingOperation, setPendingOperation] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [activeReasoning, setActiveReasoning] = useState(null); // Track active reasoning sessions
  const [grantedCapabilities, setGrantedCapabilities] = useState(new Map()); // Track granted capabilities by participant
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

  const addMessage = (message, sent = false) => {
    setMessages(prev => [...prev, {
      id: message.id || uuidv4(),
      message,
      sent,
      timestamp: new Date(),
    }]);
  };

  const handleIncomingMessage = (message) => {
    // Filter out echo messages - don't show messages from ourselves coming back
    // EXCEPT for errors and grant acknowledgments which we want to see
    if (message.from === participantId &&
        message.kind !== 'system/error' &&
        message.kind !== 'capability/grant-ack') {
      return;
    }

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

    // Handle capability grant acknowledgments
    if (message.kind === 'capability/grant-ack') {
      console.error('[DEBUG] Received grant acknowledgment:', JSON.stringify(message.payload));
      addMessage({
        kind: 'system/info',
        from: 'system',
        payload: { text: `✅ Capability grant acknowledged by ${message.from}` }
      }, false);
    }

    // Handle welcome message updates (after capability grants)
    if (message.kind === 'system/welcome' && message.to?.includes(participantId)) {
      // This could be an updated welcome after a grant
      const capabilities = message.payload?.you?.capabilities || [];
      console.error('[DEBUG] Received welcome with capabilities:', capabilities.length);

      // Check if this is an update (not the initial welcome)
      if (messages.length > 5) { // Heuristic: not the initial connection
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `📋 Your capabilities have been updated (${capabilities.length} total)` }
        }, false);
      }
    }

    // Handle errors (especially for capability violations)
    if (message.kind === 'system/error') {
      console.error('[DEBUG] Received error:', JSON.stringify(message.payload));
      if (message.payload?.error === 'capability_violation' &&
          message.payload?.attempted_kind === 'capability/grant') {
        addMessage({
          kind: 'system/error',
          from: 'system',
          payload: { text: `❌ Cannot grant capabilities: You lack the 'capability/grant' permission` }
        }, false);
      }
    }

    // Check if this is an MCP proposal requiring confirmation
    // In MEW v0.3, mcp/proposal contains operation details that need approval
    if (message.kind === 'mcp/proposal') {
      // Check if we've already granted this capability
      const proposerGrants = grantedCapabilities.get(message.from) || [];
      const method = message.payload?.method;
      const toolName = message.payload?.params?.name;

      // Check if we have a matching grant for this operation
      const hasGrant = proposerGrants.some(grant => {
        // Check if the granted capability matches this proposal
        if (grant.kind === 'mcp/request' || grant.kind === 'mcp/*') {
          // Check method match
          if (!grant.payload || !grant.payload.method) return true; // Broad grant
          if (grant.payload.method === method || grant.payload.method === '*') {
            // Check tool name match for tools/call
            if (method === 'tools/call' && grant.payload.params?.name) {
              return grant.payload.params.name === toolName ||
                     grant.payload.params.name === '*' ||
                     (grant.payload.params.name.endsWith('*') &&
                      toolName?.startsWith(grant.payload.params.name.slice(0, -1)));
            }
            return true;
          }
        }
        return false;
      });

      if (hasGrant) {
        // Auto-approve based on grant
        const fulfillmentMessage = {
          kind: 'mcp/request',
          correlation_id: [message.id],
          payload: {
            jsonrpc: '2.0',
            id: Date.now(),
            method: method,
            params: message.payload?.params
          }
        };

        if (message.to && message.to.length > 0) {
          fulfillmentMessage.to = message.to;
        }

        sendMessage(fulfillmentMessage);

        // Add a system message indicating auto-approval
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `Auto-approved ${method} from ${message.from} (capability granted)` }
        }, false);
      } else {
        // Show dialog for manual approval
        setPendingOperation({
          id: message.id,
          from: message.from,
          to: message.to,  // Capture the target participant(s)
          operation: message.payload,
          timestamp: new Date(),
          correlationId: message.correlation_id,
        });
      }
    }

    addMessage(message, false);
  };

  const sendMessage = (message) => {
    if (ws.readyState !== 1) {
      console.error('WebSocket is not connected');
      return;
    }

    const envelope = wrapEnvelope(message);

    // Debug log for capability/grant messages
    if (message.kind === 'capability/grant') {
      console.error('[DEBUG] Sending wrapped grant envelope:', JSON.stringify(envelope, null, 2));
    }

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
    // Allow empty input to clear the input field
    // but don't send empty messages
    if (!input || !input.trim()) {
      // Just return without sending anything
      // The input component already cleared itself
      return;
    }

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
    const [cmd] = command.split(' ');
    
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
      onGrant: () => {
        // Grant capability for this operation type
        const proposer = pendingOperation.from;
        const method = pendingOperation.operation?.method;
        const params = pendingOperation.operation?.params;
        const toolName = params?.name;

        // Create capability pattern for this specific operation
        const capabilityPattern = {
          kind: 'mcp/request',
          payload: {
            method: method
          }
        };

        // For tools/call, include the specific tool name pattern
        if (method === 'tools/call' && toolName) {
          capabilityPattern.payload.params = {
            name: toolName
          };
        }

        // Update local grant tracking
        setGrantedCapabilities(prev => {
          const existing = prev.get(proposer) || [];
          return new Map(prev).set(proposer, [...existing, capabilityPattern]);
        });

        // Send capability grant message
        const grantMessage = {
          kind: 'capability/grant',
          to: [proposer],
          payload: {
            recipient: proposer,
            capabilities: [capabilityPattern],
            reason: `Granted ${method}${toolName ? ` for tool '${toolName}'` : ''} for this session`
          }
        };

        // Debug: Log the grant message being sent
        console.error('[DEBUG] Sending capability grant:', JSON.stringify(grantMessage, null, 2));
        sendMessage(grantMessage);

        // Add a visible message to confirm grant was sent
        addMessage({
          kind: 'system/info',
          from: 'system',
          payload: { text: `Granted ${method}${toolName ? ` for tool '${toolName}'` : ''} to ${proposer} for this session` }
        }, true);

        // Also fulfill the current proposal
        if (pendingOperation.operation) {
          const { method, params } = pendingOperation.operation;
          const fulfillMessage = {
            kind: 'mcp/request',
            correlation_id: [pendingOperation.id],
            payload: {
              jsonrpc: '2.0',
              id: Date.now(),
              method: method,
              params: params
            }
          };

          if (pendingOperation.to && pendingOperation.to.length > 0) {
            fulfillMessage.to = pendingOperation.to;
          }

          sendMessage(fulfillMessage);
        }

        setPendingOperation(null);
      },
      onDeny: () => {
        // Send rejection according to MEW spec
        sendMessage({
          kind: 'mcp/reject',
          to: [pendingOperation.from], // Send rejection back to proposer
          correlation_id: [pendingOperation.id], // Must be an array
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
    
    // Enhanced Input Component (disabled when dialog is shown)
    React.createElement(EnhancedInput, {
      onSubmit: processInput,
      placeholder: 'Type a message or /help for commands...',
      multiline: false,  // Single-line for CLI
      disabled: pendingOperation !== null || showHelp,
      history: commandHistory,
      onHistoryChange: setCommandHistory,
      prompt: '> ',
      showCursor: true
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
      React.createElement(Text, { color: "blue" }, `${contextPrefix}└─ reasoning/thought`),
      React.createElement(Text, {
        color: "blackBright",
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

  // Special formatting for chat messages
  if (kind === 'chat') {
    return React.createElement(Text, {
      color: "white",
      wrap: "wrap"
    }, `${contextPrefix}└─ ${preview}`);
  }

  // Default single-line display for other message types
  return React.createElement(Text, {
    color: "blackBright"
  }, `${contextPrefix}└─ ${preview}`);
}

/**
 * Operation Confirmation Dialog - Simple Numbered List (Option 2 from ADR-009)
 *
 * Provides a minimal numbered list implementation for MCP operation approval.
 * Supports both number keys and arrow/enter navigation for better UX.
 * Phase 3: Includes capability grant option
 */
function OperationConfirmation({ operation, onApprove, onDeny, onGrant }) {
  // Focus management - ensure this component takes priority for input
  const { isFocused } = useFocus({ autoFocus: true });

  // Track selected option (0 = Yes once, 1 = Grant, 2 = No)
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    // Only handle input when focused
    if (!isFocused) return;

    // Number key shortcuts
    if (input === '1') {
      onApprove();
      return;
    }
    if (input === '2') {
      onGrant();
      return;
    }
    if (input === '3') {
      onDeny();
      return;
    }

    // Arrow key navigation
    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(2, selectedIndex + 1));
      return;
    }

    // Enter key to confirm selection
    if (key.return) {
      if (selectedIndex === 0) {
        onApprove();
      } else if (selectedIndex === 1) {
        onGrant();
      } else {
        onDeny();
      }
      return;
    }

    // Escape to cancel
    if (key.escape) {
      onDeny();
      return;
    }
  });

  // Format the arguments for display
  const formatArguments = (args) => {
    if (!args) return 'none';
    try {
      return JSON.stringify(args, null, 2);
    } catch {
      return String(args);
    }
  };

  // Extract operation details
  const method = operation.operation?.method || 'unknown';
  const params = operation.operation?.params || {};
  const target = operation.to?.[0] || 'unknown';

  // For tools/call, extract the tool name
  const toolName = params.name || null;

  return React.createElement(Box, {
      borderStyle: "round",
      borderColor: "yellow",
      paddingX: 2,
      paddingY: 1,
      marginY: 1,
      width: 60
    },
    React.createElement(Box, { flexDirection: "column" },
      // Header
      React.createElement(Text, { bold: true },
        `${operation.from} wants to execute operation`
      ),
      React.createElement(Box, { marginTop: 1 }),

      // Operation details
      React.createElement(Text, null, `Method: ${method}`),
      toolName && React.createElement(Text, null, `Tool: ${toolName}`),
      React.createElement(Text, null, `Target: ${target}`),

      React.createElement(Box, { marginTop: 1 }),

      // Arguments section
      React.createElement(Text, null, "Arguments:"),
      React.createElement(Box, {
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        marginTop: 0,
        marginBottom: 1
      },
        React.createElement(Text, { color: "cyan" },
          formatArguments(params.arguments || params)
        )
      ),

      // Options
      React.createElement(Text, null, "Do you want to allow this?"),
      React.createElement(Text, { color: selectedIndex === 0 ? "green" : "white" },
        `${selectedIndex === 0 ? '❯' : ' '} 1. Yes (this time only)`
      ),
      React.createElement(Text, { color: selectedIndex === 1 ? "cyan" : "white" },
        `${selectedIndex === 1 ? '❯' : ' '} 2. Yes, allow ${operation.from} to ${method === 'tools/call' && toolName ? `use '${toolName}'` : method} for this session`
      ),
      React.createElement(Text, { color: selectedIndex === 2 ? "red" : "white" },
        `${selectedIndex === 2 ? '❯' : ' '} 3. No`
      ),
      React.createElement(Box, { marginTop: 1 }),
      React.createElement(Text, { color: "gray", fontSize: 12 },
        "Use ↑↓ arrows + Enter, or press 1/2/3, or Esc to cancel"
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
// InputComposer replaced by EnhancedInput component

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
  if (kind.startsWith('system/')) return 'blackBright';
  if (kind.startsWith('mcp/')) return 'blackBright';
  if (kind.startsWith('reasoning/')) return 'blue';  // Reasoning headers in blue
  if (kind === 'chat') return 'white';  // Clean white for chat messages
  return 'blackBright';
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

// Risk assessment functions - kept for potential future use with more advanced approval dialogs
// function assessRisk(operation) {
//   const method = operation.method?.toLowerCase() || '';
//
//   if (method.includes('read') || method.includes('list') || method.includes('browse')) {
//     return 'SAFE';
//   }
//   if (method.includes('write') || method.includes('create') || method.includes('delete')) {
//     return 'CAUTION';
//   }
//   if (method.includes('execute') || method.includes('run') || method.includes('eval')) {
//     return 'DANGEROUS';
//   }
//
//   return 'CAUTION';
// }
//
// function getRiskColor(riskLevel) {
//   switch (riskLevel) {
//     case 'SAFE': return 'green';
//     case 'CAUTION': return 'yellow';
//     case 'DANGEROUS': return 'red';
//     default: return 'yellow';
//   }
// }

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