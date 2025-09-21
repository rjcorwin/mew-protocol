const React = require('react');
const { Box, Text, useInput } = require('ink');
const envelopeForms = require('../../config/envelopeForms');

const { useState, useMemo, useEffect } = React;

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function setValueAtPath(target, path, value) {
  if (!path) {
    return;
  }
  const segments = path.split('.');
  let current = target;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (i === segments.length - 1) {
      current[segment] = value;
      return;
    }
    if (current[segment] === undefined || current[segment] === null || typeof current[segment] !== 'object') {
      current[segment] = {};
    }
    current = current[segment];
  }
}

function getValueAtPath(target, path) {
  if (!path) {
    return undefined;
  }
  const segments = path.split('.');
  let current = target;
  for (const segment of segments) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function valueToString(value, field) {
  if (value === undefined || value === null) {
    if (field && field.defaultValue !== undefined) {
      return field.type === 'json'
        ? JSON.stringify(field.defaultValue, null, 2)
        : Array.isArray(field.defaultValue)
          ? field.defaultValue.join(', ')
          : String(field.defaultValue ?? '');
    }
    return '';
  }

  if (field && field.type === 'json') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return String(value);
    }
  }

  if (field && field.type === 'list') {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return String(value ?? '');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return String(value);
    }
  }

  return String(value ?? '');
}

function parseFieldValue(field, rawValue) {
  const trimmed = rawValue.trim();

  if (field.required && trimmed.length === 0) {
    return { error: `${field.label} is required.` };
  }

  if (field.type === 'list') {
    if (trimmed.length === 0) {
      return { value: [] };
    }
    const list = rawValue
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
    return { value: list };
  }

  if (field.type === 'json') {
    if (trimmed.length === 0) {
      if (field.defaultValue !== undefined) {
        return { value: deepClone(field.defaultValue) };
      }
      return { value: {} };
    }
    try {
      return { value: JSON.parse(rawValue) };
    } catch (err) {
      return { error: `Invalid JSON: ${err.message}` };
    }
  }

  if (field.type === 'boolean') {
    if (trimmed.length === 0 && field.required) {
      return { error: `${field.label} is required.` };
    }
    const normalized = trimmed.toLowerCase();
    if (['true', 't', 'yes', 'y', '1'].includes(normalized)) {
      return { value: true };
    }
    if (['false', 'f', 'no', 'n', '0'].includes(normalized)) {
      return { value: false };
    }
    if (trimmed.length === 0) {
      return { value: false };
    }
    return { error: `Invalid boolean. Enter yes/no or true/false.` };
  }

  // Default to returning the raw string (including whitespace)
  return { value: rawValue };
}

function initializeForm(form) {
  if (!form) {
    return {};
  }

  const base = deepClone(form.base || {});

  if (Array.isArray(form.fields)) {
    for (const field of form.fields) {
      if (!field.path) continue;
      const existing = getValueAtPath(base, field.path);
      if (existing === undefined) {
        if (field.defaultValue !== undefined) {
          setValueAtPath(base, field.path, deepClone(field.defaultValue));
        } else if (field.type === 'list') {
          setValueAtPath(base, field.path, []);
        } else if (field.type === 'json') {
          setValueAtPath(base, field.path, {});
        } else {
          setValueAtPath(base, field.path, '');
        }
      }
    }
  }

  return base;
}

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function EnvelopeEditor({
  initialType = null,
  onClose = () => {},
  onSubmit = () => {},
  onSaveDraft,
  wrapEnvelope,
}) {
  const formList = useMemo(
    () => Object.entries(envelopeForms).map(([type, definition]) => ({ type, ...definition })),
    []
  );

  const initialIndex = useMemo(() => {
    if (initialType) {
      const match = formList.findIndex(form => form.type === initialType);
      if (match >= 0) {
        return match;
      }
    }
    return 0;
  }, [formList, initialType]);

  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [step, setStep] = useState(initialType ? 'fields' : 'type');
  const [values, setValues] = useState(() => initializeForm(formList[initialIndex]));
  const [fieldIndex, setFieldIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const activeForm = formList[selectedIndex] || null;
  const fields = activeForm?.fields || [];

  useEffect(() => {
    const form = formList[selectedIndex];
    const freshValues = initializeForm(form);
    setValues(freshValues);
    setFieldIndex(0);
    if (form && form.fields && form.fields.length > 0) {
      const firstField = form.fields[0];
      setInputValue(valueToString(getValueAtPath(freshValues, firstField.path), firstField));
    } else {
      setInputValue('');
    }
    setError(null);
    setStatus(null);
  }, [selectedIndex, formList]);

  useEffect(() => {
    if (step === 'fields') {
      if (!fields.length) {
        setStep('preview');
        return;
      }
      const field = fields[fieldIndex];
      if (!field) {
        setStep('preview');
        return;
      }
      setInputValue(valueToString(getValueAtPath(values, field.path), field));
    }
  }, [step, fieldIndex, fields, values]);

  useEffect(() => {
    if (step !== 'preview') {
      setStatus(null);
    }
    setError(null);
  }, [step]);

  const handleSubmitField = () => {
    const field = fields[fieldIndex];
    if (!field) {
      setStep('preview');
      return;
    }

    const { value, error: parseError } = parseFieldValue(field, inputValue);
    if (parseError) {
      setError(parseError);
      return;
    }

    setValues(prev => {
      const next = deepClone(prev);
      setValueAtPath(next, field.path, value);
      return next;
    });

    setError(null);

    if (fieldIndex >= fields.length - 1) {
      setStep('preview');
    } else {
      setFieldIndex(fieldIndex + 1);
    }
  };

  const handleSaveDraft = () => {
    if (!onSaveDraft) {
      return;
    }
    try {
      const result = onSaveDraft(values);
      if (result && typeof result.then === 'function') {
        setStatus('Saving draft...');
        result
          .then(path => {
            setStatus(path ? `Draft saved to ${path}` : 'Draft saved.');
          })
          .catch(err => {
            setStatus(`Failed to save draft: ${err.message}`);
          });
      } else if (typeof result === 'string') {
        setStatus(`Draft saved to ${result}`);
      } else if (result && typeof result === 'object') {
        const displayPath = result.relativePath || result.path;
        setStatus(displayPath ? `Draft saved to ${displayPath}` : 'Draft saved.');
      } else {
        setStatus('Draft saved.');
      }
    } catch (err) {
      setStatus(`Failed to save draft: ${err.message}`);
    }
  };

  const closeEditor = () => {
    onClose();
  };

  const sendEnvelope = () => {
    onSubmit(values);
    onClose();
  };

  useInput((input, key) => {
    if (step === 'type') {
      if (key.escape) {
        closeEditor();
        return;
      }
      if (key.upArrow) {
        setSelectedIndex(prev => (prev - 1 + formList.length) % formList.length);
        return;
      }
      if (key.downArrow) {
        setSelectedIndex(prev => (prev + 1) % formList.length);
        return;
      }
      if (key.number !== undefined && formList[key.number - 1]) {
        setSelectedIndex(key.number - 1);
        return;
      }
      if (key.return) {
        if (fields.length === 0) {
          setStep('preview');
        } else {
          setStep('fields');
        }
      }
      return;
    }

    if (step === 'fields') {
      const field = fields[fieldIndex];
      if (key.escape) {
        closeEditor();
        return;
      }
      if (!field) {
        setStep('preview');
        return;
      }
      if (field.multiline && key.shift && key.return) {
        setInputValue(prev => `${prev}\n`);
        return;
      }
      if (key.return) {
        handleSubmitField();
        return;
      }
      if (key.backspace) {
        setInputValue(prev => prev.slice(0, -1));
        return;
      }
      if (key.leftArrow && inputValue.length > 0 && !field.multiline) {
        return;
      }
      if (!key.ctrl && !key.meta && input) {
        setInputValue(prev => prev + input);
      }
      return;
    }

    if (step === 'preview') {
      if (key.escape) {
        closeEditor();
        return;
      }
      if (key.return) {
        sendEnvelope();
        return;
      }
      if (input && input.toLowerCase() === 'e') {
        setStep('fields');
        setFieldIndex(0);
        return;
      }
      if (input && ['s', 'd'].includes(input.toLowerCase())) {
        handleSaveDraft();
      }
    }
  });

  const previewEnvelope = wrapEnvelope ? wrapEnvelope(values) : values;
  const previewJson = safeStringify(previewEnvelope);

  return (
    React.createElement(Box, {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'magenta',
      paddingX: 2,
      paddingY: 1,
      width: '90%',
      marginLeft: 'auto',
      marginRight: 'auto'
    },
      React.createElement(Text, { color: 'magenta', bold: true }, 'Interactive Envelope Editor'),
      activeForm && React.createElement(Text, { color: 'gray' }, `${activeForm.type} — ${activeForm.description}`),

      step === 'type' && React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
        React.createElement(Text, null, 'Select envelope kind to author:'),
        formList.map((form, index) => (
          React.createElement(Text, {
            key: form.type,
            color: index === selectedIndex ? 'green' : 'white'
          }, `${index === selectedIndex ? '❯' : ' '} ${form.type} — ${form.description}`)
        )),
        React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { color: 'gray' }, 'Use ↑/↓ to choose, numbers 1-9 to jump, Enter to continue, Esc to cancel')
        )
      ),

      step === 'fields' && fields[fieldIndex] && React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
        React.createElement(Text, { color: 'cyan' }, `Field ${fieldIndex + 1} of ${fields.length}: ${fields[fieldIndex].label}`),
        fields[fieldIndex].description && React.createElement(Text, { color: 'gray' }, fields[fieldIndex].description),
        React.createElement(Box, {
          borderStyle: 'single',
          paddingX: 1,
          paddingY: fields[fieldIndex].multiline ? 1 : 0,
          marginTop: 1
        },
          React.createElement(Text, { wrap: 'wrap' }, inputValue || (fields[fieldIndex].required ? '<required>' : '<optional>'))
        ),
        React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { color: 'gray' }, fields[fieldIndex].multiline
            ? 'Shift+Enter for newline, Enter to confirm, Esc to cancel'
            : 'Type to edit, Enter to confirm, Esc to cancel')
        ),
        error && React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { color: 'red' }, error)
        )
      ),

      step === 'preview' && React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
        React.createElement(Text, { color: 'cyan' }, 'Preview Envelope'),
        React.createElement(Box, {
          borderStyle: 'single',
          paddingX: 1,
          paddingY: 1,
          marginTop: 1,
          maxHeight: 20
        },
          React.createElement(Text, { wrap: 'wrap' }, previewJson)
        ),
        React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { color: 'gray' }, 'Enter to send • s/d to save draft • e to edit fields • Esc to cancel')
        )
      ),

      status && React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: 'yellow' }, status)
      )
    )
  );
}

module.exports = EnvelopeEditor;
