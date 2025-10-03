// @ts-nocheck
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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text } from 'ink';
import TextBuffer from '../utils/text-buffer.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { getCommand } from '../keyMatchers.js';
import { defaultKeyBindings } from '../../config/keyBindings.js';
import { getSlashCommandSuggestions } from '../utils/slashCommands.js';
import fs from 'fs';
import path from 'path';
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
  prompt = '> ',
  slashContext = null,
  theme = null
}) {
  // Text buffer for managing input
  const bufferRef = useRef(new TextBuffer());
  const buffer = bufferRef.current;
  const [updateCounter, setUpdateCounter] = useState(0);
  const suppressSuggestionsRef = useRef(false);

  // History navigation
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  // Autocomplete state
  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  // Update slash command suggestions whenever the buffer changes
  useEffect(() => {
    if (suppressSuggestionsRef.current) {
      suppressSuggestionsRef.current = false;
      return;
    }

    const text = buffer.getText();
    if (text.trim().startsWith('/')) {
      const cursorIndex = typeof buffer.getCursorIndex === 'function'
        ? buffer.getCursorIndex()
        : text.length;
      const matches = getSlashCommandSuggestions({
        text,
        cursorIndex,
        context: slashContext || undefined
      });
      setSuggestions(matches);
      setIsAutocompleting(matches.length > 0);
      setSelectedSuggestion(0);
    } else {
      setIsAutocompleting(false);
      setSuggestions([]);
      setSelectedSuggestion(0);
    }
  }, [buffer, updateCounter, slashContext]);

  // Force re-render when buffer changes
  const update = useCallback(() => {
    setUpdateCounter(c => c + 1);
  }, []);

  // Handle autocomplete (defined early so other hooks can depend on it)
  const handleAutocompleteAccept = useCallback(() => {
    if (suggestions.length === 0) return;

    const suggestion = suggestions[selectedSuggestion];
    const currentText = buffer.getText();
    const replacement = suggestion.replacement || { start: 0, end: currentText.length };
    const start = Math.max(0, Math.min(replacement.start, currentText.length));
    const end = Math.max(start, Math.min(replacement.end, currentText.length));
    const insertText = typeof suggestion.insertText === 'string' ? suggestion.insertText : '';
    const nextCursorIndex = typeof suggestion.nextCursorIndex === 'number'
      ? suggestion.nextCursorIndex
      : start + insertText.length;

    const newText = `${currentText.slice(0, start)}${insertText}${currentText.slice(end)}`;

    buffer.setText(newText);
    if (typeof buffer.setCursorIndex === 'function') {
      buffer.setCursorIndex(nextCursorIndex);
    } else {
      buffer.move('bufferEnd');
    }
    setIsAutocompleting(false);
    setSuggestions([]);
    setSelectedSuggestion(0);
    update();
  }, [suggestions, selectedSuggestion, buffer, update]);

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
        if (isAutocompleting && suggestions.length > 0) {
          setSelectedSuggestion(prev => Math.max(prev - 1, 0));
          break;
        }
        if (multiline && buffer.lines.length > 1) {
          const cursorPos = buffer.getCursorPosition();
          // If at the first line, navigate to previous history instead
          if (cursorPos.line === 0) {
            // Handle history prev
            if (history.length > 0) {
              if (historyIndex === -1) {
                setTempInput(buffer.getText());
              }
              const newIndex = Math.min(historyIndex + 1, history.length - 1);
              setHistoryIndex(newIndex);
              suppressSuggestionsRef.current = true;
              buffer.setText(history[history.length - 1 - newIndex]);
              buffer.move('bufferEnd');
              update();
            }
          } else {
            buffer.move('up');
            update();
          }
        } else {
          // Handle history prev
          if (history.length > 0) {
            if (historyIndex === -1) {
              setTempInput(buffer.getText());
            }
            const newIndex = Math.min(historyIndex + 1, history.length - 1);
            setHistoryIndex(newIndex);
            suppressSuggestionsRef.current = true;
            buffer.setText(history[history.length - 1 - newIndex]);
            buffer.move('bufferEnd');
            update();
          }
        }
        break;

      case 'MOVE_DOWN':
        if (isAutocompleting && suggestions.length > 0) {
          setSelectedSuggestion(prev => Math.min(prev + 1, suggestions.length - 1));
          break;
        }
        if (multiline && buffer.lines.length > 1) {
          const cursorPos = buffer.getCursorPosition();
          // If at the last line, navigate to next history instead
          if (cursorPos.line === buffer.lines.length - 1) {
            // Handle history next
            if (historyIndex !== -1) {
              const newIndex = historyIndex - 1;
              setHistoryIndex(newIndex);
              suppressSuggestionsRef.current = true;
              if (newIndex === -1) {
                buffer.setText(tempInput);
              } else {
                buffer.setText(history[history.length - 1 - newIndex]);
              }
              buffer.move('bufferEnd');
              update();
            }
          } else {
            buffer.move('down');
            update();
          }
        } else {
          // Handle history next
          if (historyIndex !== -1) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            suppressSuggestionsRef.current = true;
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
        debugLog(`>>> INSERT_NEWLINE triggered, multiline: ${multiline}\n`);
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
          suppressSuggestionsRef.current = true;
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
          suppressSuggestionsRef.current = true;
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
          handleAutocompleteAccept();
        }
        break;

      case 'AUTOCOMPLETE_PREV':
        if (isAutocompleting && suggestions.length > 0) {
          setSelectedSuggestion(prev => Math.max(prev - 1, 0));
        }
        break;

      case 'AUTOCOMPLETE_ACCEPT':
        if (suggestions.length > 0) {
          handleAutocompleteAccept();
        }
        break;

      case 'AUTOCOMPLETE_CANCEL':
        if (isAutocompleting) {
          setIsAutocompleting(false);
          setSuggestions([]);
          setSelectedSuggestion(0);
        }
        break;

      default:
        // Unknown command
        break;
    }
  }, [disabled, buffer, multiline, update, handleSubmit, suggestions, history, historyIndex, tempInput, setHistoryIndex, setTempInput, handleAutocompleteAccept]);

  // Handle history navigation
  const handleHistoryPrev = useCallback(() => {
    if (history.length === 0) return;

    if (historyIndex === -1) {
      // Save current input
      setTempInput(buffer.getText());
    }

    const newIndex = Math.min(historyIndex + 1, history.length - 1);
    setHistoryIndex(newIndex);
    suppressSuggestionsRef.current = true;
    buffer.setText(history[history.length - 1 - newIndex]);
    buffer.move('bufferEnd');
    update();
  }, [history, historyIndex, buffer, update]);

  const handleHistoryNext = useCallback(() => {
    if (historyIndex === -1) return;

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);

    suppressSuggestionsRef.current = true;
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

    // Special case: empty key object might be forward delete on Mac or Tab without a name
    if (!key.input && !key.name && !command) {
      if (key.tab) {
        debugLog(`Detected nameless key with tab flag - treating as AUTOCOMPLETE\n`);
        command = 'AUTOCOMPLETE';
      } else {
        debugLog(`Detected empty key - treating as DELETE_BACKWARD (Mac delete key)\n`);
        command = 'DELETE_BACKWARD';  // Changed to backward for Mac compatibility
      }
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

    // Special handling for Shift+Enter (detected via escape sequence or shiftEnter flag)
    if (key.shiftEnter || (key.input === '[27;2;13~') || (key.input === '\x1b[27;2;13~')) {
      debugLog(`\n>>> SHIFT+ENTER detected - Inserting newline <<<\n`);
      if (multiline) {
        handleCommand('INSERT_NEWLINE');
        return;
      }
    }

    // Special handling for Alt+Enter or Option+Enter for multiline
    if ((key.return || key.enter) && (key.alt || key.meta) && multiline && !command) {
      debugLog(`\n>>> ALT/OPTION+ENTER detected - Inserting newline <<<\n`);
      handleCommand('INSERT_NEWLINE');
      return;
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

    const promptColor = theme?.colors?.promptText || 'magenta';
    const inputColor = theme?.colors?.inputText || 'white';
    const multilineColor = theme?.colors?.multilineIndicator || 'magenta';

    if (multiline) {
      // Multi-line rendering
      return React.createElement(Box, { flexDirection: 'column' },
        lines.map((line, lineIndex) =>
          React.createElement(Box, { key: lineIndex },
            lineIndex === 0 && React.createElement(Text, { color: promptColor, bold: true }, prompt),
            lineIndex > 0 && React.createElement(Text, { color: multilineColor, dimColor: true }, '◆ '),
            React.createElement(Text, { color: inputColor },
              renderLineWithCursor(line, lineIndex === cursor.line ? cursor.column : -1, lineIndex === 0)
            )
          )
        )
      );
    } else {
      // Single-line rendering
      const line = lines[0] || '';
      return React.createElement(Box, null,
        React.createElement(Text, { color: promptColor, bold: true }, prompt),
        React.createElement(Text, { color: inputColor },
          renderLineWithCursor(line, cursor.column, true)
        )
      );
    }
  };

  // Render line with cursor
  const renderLineWithCursor = (line, cursorPos, isFirstLine = false) => {
    const displayText = line || '';

    if (!showCursor || cursorPos < 0) {
      // Only show placeholder on the first line when completely empty
      if (isFirstLine && buffer.getText().length === 0) {
        return placeholder;
      }
      return displayText;
    }

    // Handle empty line with cursor
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

    const dividerColor = theme?.colors?.suggestionDivider || 'magenta';
    const selectedColor = theme?.colors?.suggestionSelected || 'magenta';
    const unselectedColor = theme?.colors?.suggestionUnselected || 'cyan';
    const descColor = theme?.colors?.suggestionDescription || 'cyan';

    return React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { color: dividerColor, dimColor: true }, '    ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔'),
      suggestions.slice(0, 8).map((suggestion, index) =>
        React.createElement(Box, { key: suggestion.id || `${suggestion.label}-${index}` },
          React.createElement(Text, {
            color: index === selectedSuggestion ? selectedColor : unselectedColor,
            bold: index === selectedSuggestion
          },
            `    ${index === selectedSuggestion ? '◆' : '◇'} ${suggestion.label}`
          ),
          suggestion.description && React.createElement(Text, { color: descColor, dimColor: true }, ` — ${suggestion.description}`)
        )
      )
    );
  };

  const borderColor = theme?.colors?.border || 'magenta';

  return React.createElement(Box, {
    flexDirection: 'column',
    opacity: disabled ? 0.5 : 1
  },
    React.createElement(Box, {
      paddingX: 1,
      flexDirection: 'column',
      minHeight: multiline ? 5 : 1  // Show at least 5 lines in multiline mode
    },
      renderInput()
    ),
    renderSuggestions()
  );
}

export default EnhancedInput;
