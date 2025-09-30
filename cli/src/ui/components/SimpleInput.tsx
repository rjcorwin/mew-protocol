// @ts-nocheck
/**
 * Simplified Input Component for debugging
 */

const React = require('react');
const { Box, Text, useInput } = require('ink');
const { useState } = React;

function SimpleInput({ onSubmit, disabled = false, prompt = '> ' }) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (disabled) return;

    if (key.return) {
      onSubmit(value);
      setValue('');
    } else if (key.backspace) {
      setValue(v => v.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setValue(v => v + input);
    }
  }, { isActive: !disabled });

  return React.createElement(Box, {
    borderStyle: 'single',
    paddingX: 1
  },
    React.createElement(Text, { color: 'green' }, prompt),
    React.createElement(Text, null, value || '_')
  );
}

module.exports = SimpleInput;