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

import fs from 'fs';
import path from 'path';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text } from 'ink';

import TextBuffer from '../utils/text-buffer';
import { useKeypress } from '../hooks/useKeypress';
import { getCommand } from '../keyMatchers';
import { defaultKeyBindings, type KeyBindingMap } from '../../config/keyBindings';
const slashCommands = require('../utils/slashCommands') as {
  getSlashCommandSuggestions: (...args: any[]) => SlashCommandSuggestion[];
};
const { getSlashCommandSuggestions } = slashCommands;

export interface SlashCommandSuggestion {
  id?: string;
  label: string;
  description?: string | null;
  insertText?: string;
  replacement?: { start: number; end: number };
  nextCursorIndex?: number;
  [key: string]: unknown;
}

const debugLog = (message: string): void => {
  const logFile = path.join(process.cwd(), '.mew', 'debug.log');
  const mewDir = path.join(process.cwd(), '.mew');
  if (!fs.existsSync(mewDir)) {
    fs.mkdirSync(mewDir, { recursive: true });
  }
  fs.appendFileSync(logFile, message);
};

export interface EnhancedInputProps {
  onSubmit?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  history?: string[];
  onHistoryChange?: (history: string[]) => void;
  keyBindings?: KeyBindingMap;
  showCursor?: boolean;
  prompt?: string;
  slashContext?: any;
}

export function EnhancedInput({
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
}: EnhancedInputProps): JSX.Element {
  const bufferRef = useRef(new TextBuffer());
  const buffer = bufferRef.current;
  const [updateCounter, setUpdateCounter] = useState(0);
  const suppressSuggestionsRef = useRef(false);

  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  const [isAutocompleting, setIsAutocompleting] = useState(false);
  const [suggestions, setSuggestions] = useState<SlashCommandSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  useEffect(() => {
    if (suppressSuggestionsRef.current) {
      suppressSuggestionsRef.current = false;
      return;
    }

    const text = buffer.getText();
    if (text.trim().startsWith('/')) {
      const cursorIndex = typeof buffer.getCursorIndex === 'function' ? buffer.getCursorIndex() : text.length;
      const matches = getSlashCommandSuggestions({
        text,
        cursorIndex,
        context: slashContext || undefined,
      }) as SlashCommandSuggestion[];
      setSuggestions(matches);
      setIsAutocompleting(matches.length > 0);
      setSelectedSuggestion(0);
    } else {
      setIsAutocompleting(false);
      setSuggestions([]);
      setSelectedSuggestion(0);
    }
  }, [buffer, updateCounter, slashContext]);

  const update = useCallback(() => {
    setUpdateCounter((count) => count + 1);
  }, []);

  const handleAutocompleteAccept = useCallback(() => {
    if (suggestions.length === 0) return;

    const suggestion = suggestions[selectedSuggestion];
    const currentText = buffer.getText();
    const replacement = (suggestion.replacement || { start: 0, end: currentText.length }) as {
      start: number;
      end: number;
    };
    const start = Math.max(0, Math.min(replacement.start, currentText.length));
    const end = Math.max(start, Math.min(replacement.end, currentText.length));
    const insertText = typeof suggestion.insertText === 'string' ? suggestion.insertText : '';
    const nextCursorIndex = typeof suggestion.nextCursorIndex === 'number' ? suggestion.nextCursorIndex : start + insertText.length;

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

  const handleSubmit = useCallback(() => {
    debugLog(`\n>>> handleSubmit() FUNCTION CALLED <<<\n`);
    const text = buffer.getText();
    debugLog(`>>> Text to submit: "${text}"\n`);

    if (process.env.DEBUG_INPUT) {
      console.error('handleSubmit called with text:', text);
    }

    if (text.trim()) {
      if (history[history.length - 1] !== text) {
        onHistoryChange([...history, text]);
      }
    }

    onSubmit(text);

    buffer.clear();
    setHistoryIndex(-1);
    setTempInput('');
    setIsAutocompleting(false);
    setSuggestions([]);
    update();
  }, [buffer, history, onHistoryChange, onSubmit, update]);

  const handleCommand = useCallback(
    (command: string | null) => {
      if (disabled || !command) return;

      switch (command) {
        case 'DELETE_BACKWARD':
          buffer.deleteBackward();
          update();
          break;
        case 'DELETE_FORWARD':
          buffer.deleteForward();
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
        case 'MOVE_UP':
          if (isAutocompleting && suggestions.length > 0) {
            setSelectedSuggestion((prev) => Math.max(prev - 1, 0));
            break;
          }
          if (multiline && buffer.lines.length > 1) {
            const cursorPos = buffer.getCursorPosition();
            if (cursorPos.line === 0) {
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
          } else if (history.length > 0) {
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
        case 'MOVE_DOWN':
          if (isAutocompleting && suggestions.length > 0) {
            setSelectedSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
            break;
          }
          if (multiline && buffer.lines.length > 1) {
            const cursorPos = buffer.getCursorPosition();
            if (cursorPos.line === buffer.lines.length - 1) {
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
          } else if (historyIndex !== -1) {
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
        case 'INSERT_NEWLINE':
          if (multiline) {
            buffer.insertNewline();
            update();
          }
          break;
        case 'SUBMIT':
          if (!multiline || !buffer.getText().includes('\n')) {
            handleSubmit();
          } else {
            handleSubmit();
          }
          break;
        case 'CANCEL':
          buffer.clear();
          setHistoryIndex(-1);
          setTempInput('');
          update();
          break;
        case 'HISTORY_PREV':
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
        case 'AUTOCOMPLETE':
        case 'AUTOCOMPLETE_ACCEPT':
          if (suggestions.length > 0) {
            handleAutocompleteAccept();
          }
          break;
        case 'AUTOCOMPLETE_PREV':
          if (isAutocompleting && suggestions.length > 0) {
            setSelectedSuggestion((prev) => Math.max(prev - 1, 0));
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
          break;
      }
    },
    [
      disabled,
      buffer,
      multiline,
      update,
      handleSubmit,
      suggestions,
      history,
      historyIndex,
      tempInput,
      handleAutocompleteAccept,
      isAutocompleting,
    ],
  );

  useKeypress((key) => {
    if (disabled) return;

    const command = getCommand(key as any, keyBindings);

    if ((key.return || key.enter) && key.shift && multiline) {
      handleCommand('INSERT_NEWLINE');
      return;
    }

    if ((key.return || key.enter) && (key.alt || key.meta) && multiline && !command) {
      handleCommand('INSERT_NEWLINE');
      return;
    }

    if ((key.return || key.enter) && !command) {
      handleCommand('SUBMIT');
      return;
    }

    if (command && command !== 'INSERT_CHAR') {
      handleCommand(command);
    } else if (key.input && !key.ctrl && !key.alt && !key.meta) {
      if (key.input !== '\r' && key.input !== '\n') {
        buffer.insert(key.input);
        update();
      }

      if (process.env.DEBUG_INPUT) {
        console.error('Buffer after insert:', buffer.getText());
      }
    }
  });

  const renderLineWithCursor = useCallback(
    (line: string, cursorPos: number, isFirstLine: boolean): React.ReactNode => {
      const displayText = line || '';

      if (!showCursor || cursorPos < 0) {
        if (isFirstLine && buffer.getText().length === 0) {
          return placeholder;
        }
        return displayText;
      }

      if (displayText.length === 0) {
        return <Text inverse>{' '}</Text>;
      }

      const before = displayText.slice(0, cursorPos);
      const at = displayText[cursorPos] || ' ';
      const after = displayText.slice(cursorPos + 1);

      return (
        <>
          {before}
          <Text inverse>{at}</Text>
          {after}
        </>
      );
    },
    [buffer, placeholder, showCursor],
  );

  const renderInput = useCallback((): React.ReactNode => {
    const cursor = buffer.getCursorPosition();
    const lines = buffer.lines;

    if (multiline) {
      return (
        <Box flexDirection="column">
          {lines.map((line, lineIndex) => (
            <Box key={`${lineIndex}-${line}`}>
              {lineIndex === 0 ? <Text color="green">{prompt}</Text> : <Text>{'  '}</Text>}
              <Text>{renderLineWithCursor(line, lineIndex === cursor.line ? cursor.column : -1, lineIndex === 0)}</Text>
            </Box>
          ))}
        </Box>
      );
    }

    const line = lines[0] || '';
    return (
      <Box>
        <Text color="green">{prompt}</Text>
        <Text>{renderLineWithCursor(line, cursor.column, true)}</Text>
      </Box>
    );
  }, [buffer, multiline, prompt, renderLineWithCursor]);

  const renderSuggestions = useCallback((): React.ReactNode => {
    if (!isAutocompleting || suggestions.length === 0) return null;

    return (
      <Box flexDirection="column" marginTop={1}>
        {suggestions.slice(0, 8).map((suggestion, index) => (
          <Box key={suggestion.id || `${suggestion.label}-${index}`}>
            <Text color={index === selectedSuggestion ? 'cyan' : 'gray'}>
              {`${index === selectedSuggestion ? '→' : ' '} ${suggestion.label}`}
            </Text>
            {suggestion.description ? <Text color="gray"> {`— ${suggestion.description}`}</Text> : null}
          </Box>
        ))}
      </Box>
    );
  }, [isAutocompleting, suggestions, selectedSuggestion]);

  return (
    <Box flexDirection="column">
      <Box
        borderStyle={multiline ? 'round' : 'single'}
        borderColor={disabled ? 'gray' : 'white'}
        paddingX={1}
        flexDirection="column"
        minHeight={multiline ? 5 : 1}
      >
        {renderInput()}
      </Box>
      {renderSuggestions()}
    </Box>
  );
}

export default EnhancedInput;
