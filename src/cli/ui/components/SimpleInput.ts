// @ts-nocheck
/**
 * Simplified Input Component for debugging
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

function SimpleInput({ onSubmit, disabled = false, prompt = '> ', theme = null }): React.ReactElement {
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

  const borderColor = theme?.colors?.border || 'magenta';
  const promptColor = theme?.colors?.promptText || 'magenta';
  const inputColor = theme?.colors?.inputText || 'white';

  return React.createElement(Box, {
    borderStyle: 'round',
    borderColor: borderColor,
    paddingX: 1
  },
    React.createElement(Text, { color: promptColor, bold: true }, prompt),
    React.createElement(Text, { color: inputColor }, value || '_')
  );
}

export default SimpleInput;