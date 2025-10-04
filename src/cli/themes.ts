/**
 * MEW Protocol CLI Themes
 *
 * Defines color schemes for the interactive UI.
 */

export interface Theme {
  name: string;
  description: string;
  colors: {
    // Input components
    promptText: string;
    inputText: string;
    border: string;
    inputBorder: string;
    multilineIndicator: string;

    // Autocomplete
    suggestionSelected: string;
    suggestionUnselected: string;
    suggestionDescription: string;
    suggestionDivider: string;

    // Status bar
    statusBarAccent: string;
    statusBarSeparator: string;
    statusBarSpace: string;
    statusBarParticipant: string;
    statusBarHint: string;

    // Message display
    chatSeparator: string;
    chatHeader: string;
    chatContent: string;
    systemMessage: string;
    errorMessage: string;
    mcpMessage: string;
    reasoningMessage: string;
    genericPayload: string;

    // Reasoning display
    reasoningSpinner: string;
    reasoningTitle: string;
    reasoningTimer: string;
    reasoningTokens: string;
    reasoningAction: string;
    reasoningThoughts: string;
    reasoningTokenSummary: string;
    reasoningTokenDelta: string;
    reasoningCancel: string;

    // Special characters
    diamondFilled: string; // ◆
    diamondHollow: string; // ◇
  };
  // ANSI color codes for non-Ink components (banner, animation)
  ansi: {
    reset: string;
    cyan: string;
    magenta: string;
    pink: string;
    purple: string;
    blue: string;
    green: string;
    yellow: string;
    white: string;
    dim: string;
    bright: string;
  };
}

/**
 * Neon Pulse Theme
 * Vibrant magenta/cyan/pink pixel aesthetic
 */
export const neonPulseTheme: Theme = {
  name: 'neon-pulse',
  description: 'Neon pulse - vibrant magenta/cyan pixel aesthetic',
  colors: {
    promptText: 'magenta',
    inputText: 'white',
    border: 'magenta',
    inputBorder: 'cyan',
    multilineIndicator: 'magenta',

    suggestionSelected: 'magenta',
    suggestionUnselected: 'cyan',
    suggestionDescription: 'cyan',
    suggestionDivider: 'magenta',

    statusBarAccent: 'magenta',
    statusBarSeparator: 'magenta',
    statusBarSpace: 'cyan',
    statusBarParticipant: 'magenta',
    statusBarHint: 'cyan',

    chatSeparator: 'magenta',
    chatHeader: 'cyan',
    chatContent: 'white',
    systemMessage: 'gray',
    errorMessage: 'red',
    mcpMessage: 'magenta',
    reasoningMessage: 'cyan',
    genericPayload: 'gray',

    reasoningSpinner: 'magenta',
    reasoningTitle: 'cyan',
    reasoningTimer: 'magenta',
    reasoningTokens: 'cyan',
    reasoningAction: 'magenta',
    reasoningThoughts: 'cyan',
    reasoningTokenSummary: 'cyan',
    reasoningTokenDelta: 'magenta',
    reasoningCancel: 'magenta',

    diamondFilled: 'magenta',
    diamondHollow: 'cyan',
  },
  ansi: {
    reset: '\x1b[0m',
    cyan: '\x1b[96m',
    magenta: '\x1b[95m',
    pink: '\x1b[38;5;213m',
    purple: '\x1b[38;5;141m',
    blue: '\x1b[38;5;117m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    white: '\x1b[97m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
  }
};

/**
 * Retro Terminal Theme
 * Classic monochrome green terminal aesthetic
 */
export const retroTermTheme: Theme = {
  name: 'retro-term',
  description: 'Retro terminal - classic monochrome green',
  colors: {
    promptText: 'green',
    inputText: 'green',
    border: 'green',
    inputBorder: 'greenBright',
    multilineIndicator: 'green',

    suggestionSelected: 'greenBright',
    suggestionUnselected: 'green',
    suggestionDescription: 'green',
    suggestionDivider: 'green',

    statusBarAccent: 'greenBright',
    statusBarSeparator: 'green',
    statusBarSpace: 'green',
    statusBarParticipant: 'greenBright',
    statusBarHint: 'green',

    chatSeparator: 'green',
    chatHeader: 'greenBright',
    chatContent: 'green',
    systemMessage: 'green',
    errorMessage: 'red',
    mcpMessage: 'green',
    reasoningMessage: 'green',
    genericPayload: 'green',

    reasoningSpinner: 'greenBright',
    reasoningTitle: 'greenBright',
    reasoningTimer: 'green',
    reasoningTokens: 'green',
    reasoningAction: 'green',
    reasoningThoughts: 'green',
    reasoningTokenSummary: 'green',
    reasoningTokenDelta: 'greenBright',
    reasoningCancel: 'green',

    diamondFilled: 'green',
    diamondHollow: 'green',
  },
  ansi: {
    reset: '\x1b[0m',
    cyan: '\x1b[92m',
    magenta: '\x1b[92m',
    pink: '\x1b[92m',
    purple: '\x1b[92m',
    blue: '\x1b[92m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    white: '\x1b[97m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
  }
};

/**
 * Deep Space Theme
 * Blue/yellow/orange/red space-inspired palette
 * Palette colors: blue #1f3f78, red #d2152a, yellow #e1b350, orange #e75824
 */
export const deepSpaceTheme: Theme = {
  name: 'deep-space',
  description: 'Deep space - blue and amber space-inspired palette',
  colors: {
    promptText: 'blue',
    inputText: 'white',
    border: 'blue',
    inputBorder: 'yellow',
    multilineIndicator: 'blue',

    suggestionSelected: 'yellow',
    suggestionUnselected: 'blue',
    suggestionDescription: 'yellow',
    suggestionDivider: 'blue',

    statusBarAccent: 'yellow',
    statusBarSeparator: 'blue',
    statusBarSpace: 'yellow',
    statusBarParticipant: 'yellow',
    statusBarHint: 'blue',

    chatSeparator: 'blue',
    chatHeader: 'yellow',
    chatContent: 'white',
    systemMessage: 'blue',
    errorMessage: 'red',
    mcpMessage: 'blue',
    reasoningMessage: 'yellow',
    genericPayload: 'blue',

    reasoningSpinner: 'yellow',
    reasoningTitle: 'yellow',
    reasoningTimer: 'blue',
    reasoningTokens: 'yellow',
    reasoningAction: 'yellow',
    reasoningThoughts: 'yellow',
    reasoningTokenSummary: 'yellow',
    reasoningTokenDelta: 'yellow',
    reasoningCancel: 'blue',

    diamondFilled: 'yellow',
    diamondHollow: 'blue',
  },
  ansi: {
    reset: '\x1b[0m',
    cyan: '\x1b[38;2;225;179;80m',    // yellow #e1b350
    magenta: '\x1b[38;2;231;88;36m',  // orange #e75824
    pink: '\x1b[38;2;231;88;36m',     // orange #e75824
    purple: '\x1b[38;2;31;63;120m',   // blue #1f3f78
    blue: '\x1b[38;2;31;63;120m',     // blue #1f3f78
    green: '\x1b[92m',
    yellow: '\x1b[38;2;225;179;80m',  // yellow #e1b350
    white: '\x1b[97m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
  }
};

/**
 * Neon City Theme
 * Blue/yellow neon aesthetic
 */
export const neonCityTheme: Theme = {
  name: 'neon-city',
  description: 'Neon city - blue and yellow neon',
  colors: {
    promptText: 'blue',
    inputText: 'white',
    border: 'blue',
    inputBorder: 'yellow',
    multilineIndicator: 'blue',

    suggestionSelected: 'yellow',
    suggestionUnselected: 'blue',
    suggestionDescription: 'cyan',
    suggestionDivider: 'blue',

    statusBarAccent: 'yellow',
    statusBarSeparator: 'blue',
    statusBarSpace: 'cyan',
    statusBarParticipant: 'yellow',
    statusBarHint: 'cyan',

    chatSeparator: 'blue',
    chatHeader: 'yellow',
    chatContent: 'white',
    systemMessage: 'gray',
    errorMessage: 'red',
    mcpMessage: 'blue',
    reasoningMessage: 'cyan',
    genericPayload: 'gray',

    reasoningSpinner: 'yellow',
    reasoningTitle: 'cyan',
    reasoningTimer: 'blue',
    reasoningTokens: 'cyan',
    reasoningAction: 'yellow',
    reasoningThoughts: 'cyan',
    reasoningTokenSummary: 'cyan',
    reasoningTokenDelta: 'yellow',
    reasoningCancel: 'blue',

    diamondFilled: 'yellow',
    diamondHollow: 'blue',
  },
  ansi: {
    reset: '\x1b[0m',
    cyan: '\x1b[96m',
    magenta: '\x1b[94m',
    pink: '\x1b[93m',
    purple: '\x1b[94m',
    blue: '\x1b[94m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    white: '\x1b[97m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
  }
};

export const themes: Record<string, Theme> = {
  'neon-pulse': neonPulseTheme,
  'retro-term': retroTermTheme,
  'deep-space': deepSpaceTheme,
  'neon-city': neonCityTheme,
};

export const defaultTheme = neonPulseTheme;

/**
 * Get theme by name, falling back to default
 */
export function getTheme(name?: string): Theme {
  if (!name) return defaultTheme;
  return themes[name] || defaultTheme;
}
