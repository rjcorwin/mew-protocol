/**
 * Enhanced Input Component for MEW CLI
 *
 * Provides advanced text input with multi-line editing, history,
 * word navigation, and autocomplete support.
 *
 * Adapted from Gemini CLI InputPrompt for MEW Protocol CLI.
 *
 * @license MIT
 */

const React = require('react');
const { Box, Text } = require('ink');
const { useState, useEffect, useCallback, useRef } = React;
const TextBuffer = require('../utils/text-buffer');
const { useKeypress } = require('../hooks/useKeypress');
const { getCommand } = require('../keyMatchers');
const { defaultKeyBindings } = require('../../config/keyBindings');
const fs = require('fs');
const path = require('path');

// Helper function for debug logging
const debugLog = (message) => {
  const logFile = path.join(process.cwd(), '.mew', 'debug.log');
  const mewDir = path.join(process.cwd(), '.mew');
  if (!fs.existsSync(mewDir)) {
    fs.mkdirSync(mewDir, { recursive: true });
  }
  fs.appendFileSync(logFile, message);
};

/**
 * Enhanced Input Component
 * @param {Object} props - Component props
 * @param {Function} props.onSubmit - Callback when input is submitted
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.multiline - Enable multi-line input
 * @param {boolean} props.disabled - Disable input
 * @param {Array} props.history - Command history array
 * @param {Function} props.onHistoryChange - Callback when history changes
 * @param {Object} props.keyBindings - Custom key bindings
 * @param {boolean} props.showCursor - Show cursor
 * @param {string} props.prompt - Prompt character(s)
 * @returns {React.Element}
 */
function EnhancedInput({
  onSubmit = () => {},
  placeholder = '',
  multiline = false,
  disabled = false,
  history = [],
  onHistoryChange = () => {},
  keyBindings = defaultKeyBindings,
  showCursor = true,
  prompt = '> '
}) {
  // Text buffer for managing input
  const bufferRef = useRef(new TextBuffer());
  const buffer = bufferRef.current;
  const [updateCounter, setUpdateCounter] = useState(0);

  // History navigation
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  // Autocomplete state
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  // Force re-render when buffer changes
  const update = useCallback(() => {
    setUpdateCounter(c => c + 1);
  }, []);

  // Handle input submission (defined before handleCommand which uses it)
  const handleSubmit = useCallback(() => {
    debugLog(`\n>>> handleSubmit() FUNCTION CALLED <<<\n`);
    const text = buffer.getText();
    debugLog(`>>> Text to submit: "${text}"\n`);

    if (process.env.DEBUG_INPUT) {
      console.error('handleSubmit called with text:', text);
    }

    // Submit even empty text (let the parent component decide what to do)
    if (text.trim()) {
      // Add to history if not duplicate and not empty
      if (history[history.length - 1] !== text) {
        onHistoryChange([...history, text]);
      }
    }

    // Always call onSubmit, even with empty text
    onSubmit(text);

    // Clear buffer and reset state
    buffer.clear();
    setHistoryIndex(-1);
    setTempInput('');
    setIsAutocompleting(false);
    setSuggestions([]);
    update();
  }, [buffer, history, onHistoryChange, onSubmit, update]);

  // Handle key commands
  const handleCommand = useCallback((command) => {
    if (disabled) return;

    switch (command) {
      // Text input
      case 'INSERT_CHAR':
        // Handled separately in keypress handler
        break;

      // Deletion
      case 'DELETE_BACKWARD':
        buffer.deleteBackward();
        update();
        break;

      case 'DELETE_FORWARD':
        debugLog(`Before delete forward: "${buffer.getText()}" cursor: ${JSON.stringify(buffer.getCursorPosition())}\n`);
        buffer.deleteForward();
        debugLog(`After delete forward: "${buffer.getText()}" cursor: ${JSON.stringify(buffer.getCursorPosition())}\n`);
        update();
        break;

      case 'DELETE_WORD':
        buffer.deleteWord();
        update();
        break;

      case 'DELETE_TO_LINE_END':
        buffer.deleteToLineEnd();
        update();
        break;

      case 'DELETE_TO_LINE_START':
        buffer.deleteToLineStart();
        update();
        break;

      // Cursor movement
      case 'MOVE_LEFT':
        buffer.move('left');
        update();
        break;

      case 'MOVE_RIGHT':
        buffer.move('right');
        update();
        break;

      case 'MOVE_WORD_LEFT':
        buffer.move('wordLeft');
        update();
        break;

      case 'MOVE_WORD_RIGHT':
        buffer.move('wordRight');
        update();
        break;

      case 'MOVE_LINE_START':
        buffer.move('lineStart');
        update();
        break;

      case 'MOVE_LINE_END':
        buffer.move('lineEnd');
        update();
        break;

      // Multi-line navigation
      case 'MOVE_UP':
        if (multiline && buffer.lines.length > 1) {
          buffer.move('up');
          update();
        } else {
          // Handle history prev
          if (history.length > 0) {
            if (historyIndex === -1) {
              setTempInput(buffer.getText());
            }
            const newIndex = Math.min(historyIndex + 1, history.length - 1);
            setHistoryIndex(newIndex);
            buffer.setText(history[history.length - 1 - newIndex]);
            buffer.move('bufferEnd');
            update();
          }
        }
        break;

      case 'MOVE_DOWN':
        if (multiline && buffer.lines.length > 1) {
          buffer.move('down');
          update();
        } else {
          // Handle history next
          if (historyIndex !== -1) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            if (newIndex === -1) {
              buffer.setText(tempInput);
            } else {
              buffer.setText(history[history.length - 1 - newIndex]);
            }
            buffer.move('bufferEnd');
            update();
          }
        }
        break;

      // Multi-line input
      case 'INSERT_NEWLINE':
        if (multiline) {
          buffer.insertNewline();
          update();
        }
        break;

      // Submission
      case 'SUBMIT':
        debugLog(`\n>>> SUBMIT CASE REACHED <<<\n`);
        debugLog(`>>> Buffer text: "${buffer.getText()}"\n`);
        if (!multiline || !buffer.getText().includes('\n')) {
          debugLog(`>>> CALLING handleSubmit() <<<\n`);
          handleSubmit();
        } else if (multiline) {
          // In multiline mode, check if we should submit
          // (e.g., empty line or special key combination)
          debugLog(`>>> CALLING handleSubmit() (multiline) <<<\n`);
          handleSubmit();
        }
        break;

      case 'CANCEL':
        buffer.clear();
        setHistoryIndex(-1);
        setTempInput('');
        update();
        break;

      // History
      case 'HISTORY_PREV':
        // Inline history prev logic
        if (history.length > 0) {
          if (historyIndex === -1) {
            setTempInput(buffer.getText());
          }
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          buffer.setText(history[history.length - 1 - newIndex]);
          buffer.move('bufferEnd');
          update();
        }
        break;

      case 'HISTORY_NEXT':
        // Inline history next logic
        if (historyIndex !== -1) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          if (newIndex === -1) {
            buffer.setText(tempInput);
          } else {
            buffer.setText(history[history.length - 1 - newIndex]);
          }
          buffer.move('bufferEnd');
          update();
        }
        break;

      // Autocomplete
      case 'AUTOCOMPLETE':
        if (suggestions.length > 0) {
          handleAutocompleteCycle();
        }
        break;

      case 'AUTOCOMPLETE_ACCEPT':
        if (isAutocompleting && suggestions.length > 0) {
          handleAutocompleteAccept();
        }
        break;

      case 'AUTOCOMPLETE_CANCEL':
        if (isAutocompleting) {
          setIsAutocompleting(false);
          setSuggestions([]);
        }
        break;

      default:
        // Unknown command
        break;
    }
  }, [disabled, buffer, multiline, update, handleSubmit, suggestions, history, historyIndex, tempInput, setHistoryIndex, setTempInput]);

  // Handle history navigation
  const handleHistoryPrev = useCallback(() => {
    if (history.length === 0) return;

    if (historyIndex === -1) {
      // Save current input
      setTempInput(buffer.getText());
    }

    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);
    buffer.setText(history[history.length - 1 - newIndex]);
    buffer.move('bufferEnd');
    update();
  }, [history, historyIndex, buffer, update]);

  const handleHistoryNext = useCallback(() => {
    if (historyIndex === -1) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);

    if (newIndex === -1) {
      // Restore temp input
      buffer.setText(tempInput);
    } else {
      buffer.setText(history[history.length - 1 - newIndex]);
    }

    buffer.move('bufferEnd');
    update();
  }, [history, historyIndex, tempInput, buffer, update]);

  // Handle autocomplete
  const handleAutocompleteCycle = useCallback(() => {
    if (suggestions.length === 0) return;

    const newIndex = (selectedSuggestion + 1) % suggestions.length;
    setSelectedSuggestion(newIndex);
  }, [suggestions, selectedSuggestion]);

  const handleAutocompleteAccept = useCallback(() => {
    if (suggestions.length === 0) return;

    const suggestion = suggestions[selectedSuggestion];
    // Implementation depends on autocomplete type
    // For now, just append the suggestion
    buffer.insert(suggestion);
    setIsAutocompleting(false);
    setSuggestions([]);
    update();
  }, [suggestions, selectedSuggestion, buffer, update]);

  // Keyboard input handler
  useKeypress((key) => {

    // More comprehensive logging for debugging
    const keyLog = {
      input: key.input,
      name: key.name,
      return: key.return,
      enter: key.enter,
      delete: key.delete,
      backspace: key.backspace,
      raw: key.raw
    };

    // Check if this might be a delete key
    if (!key.input && !key.name) {
      keyLog.fullKey = key;  // Log the entire key object
      keyLog.note = "Empty key - might be delete";
    }

    debugLog(`\nKEY PRESSED: ${JSON.stringify(keyLog)}\n`);

    if (disabled) {
      debugLog(`>>> INPUT DISABLED, RETURNING <<<\n`);
      return;
    }

    // Debug logging
    if (process.env.DEBUG_INPUT) {
      console.error('Key received:', {
        input: key.input,
        name: key.name,
        ctrl: key.ctrl,
        alt: key.alt,
        meta: key.meta,
        return: key.return,
        enter: key.enter
      });
    }

    // Get command from key binding first
    let command = getCommand(key, keyBindings);

    // Special case: empty key object might be forward delete on Mac
    // Note: On Mac, the "delete" key often acts like backspace
    if (!key.input && !key.name && !command) {
      debugLog(`Detected empty key - treating as DELETE_BACKWARD (Mac delete key)\n`);
      command = 'DELETE_BACKWARD';  // Changed to backward for Mac compatibility
    }

    debugLog(`Command matched: ${command || 'NONE'}\n`);

    if (process.env.DEBUG_INPUT) {
      console.error('Command matched:', command);
      // Special debug for Enter key
      if (key.return || key.enter) {
        console.error('Enter key detected! key.return:', key.return, 'key.enter:', key.enter);
        console.error('SUBMIT binding:', keyBindings.SUBMIT);
      }
    }

    // Special handling for Enter key if not matched as SUBMIT
    if ((key.return || key.enter) && !command) {
      debugLog(`\n>>> ENTER KEY FALLBACK - Forcing SUBMIT <<<\n`);
      debugLog(`key.return: ${key.return}, key.enter: ${key.enter}\n`);
      handleCommand('SUBMIT');
      return;
    }

    if (command && command !== 'INSERT_CHAR') {
      // Handle non-character commands
      handleCommand(command);
    } else if (key.input && !key.ctrl && !key.alt && !key.meta) {
      // Regular character input (including when command is INSERT_CHAR)
      // Don't insert return/newline characters as text
      if (key.input !== '\r' && key.input !== '\n') {
        buffer.insert(key.input);
        update();
      }

      // Debug logging
      if (process.env.DEBUG_INPUT) {
        console.error('Buffer after insert:', buffer.getText());
      }
    }
  }, { isActive: !disabled });

  // Render the input component
  const renderInput = () => {
    const text = buffer.getText();
    const cursor = buffer.getCursorPosition();
    const lines = buffer.lines;

    if (multiline) {
      // Multi-line rendering
      return React.createElement(Box, { flexDirection: 'column' },
        lines.map((line, lineIndex) =>
          React.createElement(Box, { key: lineIndex },
            lineIndex === 0 && React.createElement(Text, { color: 'green' }, prompt),
            lineIndex > 0 && React.createElement(Text, null, '  '),
            React.createElement(Text, null,
              renderLineWithCursor(line, lineIndex === cursor.line ? cursor.column : -1)
            )
          )
        )
      );
    } else {
      // Single-line rendering
      const line = lines[0] || '';
      return React.createElement(Box, null,
        React.createElement(Text, { color: 'green' }, prompt),
        React.createElement(Text, null,
          renderLineWithCursor(line, cursor.column)
        )
      );
    }
  };

  // Render line with cursor
  const renderLineWithCursor = (line, cursorPos) => {
    const displayText = line || '';

    if (!showCursor || cursorPos < 0) {
      return displayText || placeholder;
    }

    // Handle empty line
    if (displayText.length === 0) {
      return React.createElement(Text, { inverse: true }, ' ');
    }

    const before = displayText.slice(0, cursorPos);
    const at = displayText[cursorPos] || ' ';
    const after = displayText.slice(cursorPos + 1);

    return React.createElement(React.Fragment, null,
      before,
      React.createElement(Text, { inverse: true }, at),
      after
    );
  };

  // Render autocomplete suggestions
  const renderSuggestions = () => {
    if (!isAutocompleting || suggestions.length === 0) return null;

    return React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      suggestions.slice(0, 5).map((suggestion, index) =>
        React.createElement(Text, {
          key: index,
          color: index === selectedSuggestion ? 'blue' : 'gray'
        },
          index === selectedSuggestion ? '→ ' : '  ',
          suggestion
        )
      )
    );
  };

  return React.createElement(Box, {
    flexDirection: 'column',
    opacity: disabled ? 0.5 : 1
  },
    React.createElement(Box, {
      borderStyle: multiline ? 'round' : 'single',
      borderColor: disabled ? 'gray' : 'white',
      paddingX: 1,
      flexDirection: 'column',
      minHeight: multiline ? 5 : 1  // Show at least 5 lines in multiline mode
    },
      renderInput()
    ),
    renderSuggestions()
  );
}

module.exports = EnhancedInput;