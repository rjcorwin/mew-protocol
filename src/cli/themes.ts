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
 * Hyper Light Drifter Theme
 * Neon magenta/cyan/pink pixel art aesthetic
 */
export const hldTheme: Theme = {
  name: 'hld',
  description: 'Hyper Light Drifter - Neon pixel art',
  colors: {
    promptText: 'magenta',
    inputText: 'white',
    border: 'magenta',
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
 * Fallout Theme
 * Classic retro green terminal aesthetic
 */
export const falloutTheme: Theme = {
  name: 'fallout',
  description: 'Fallout - Classic green terminal',
  colors: {
    promptText: 'green',
    inputText: 'green',
    border: 'green',
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
    cyan: '\x1b[92m',      // Use green
    magenta: '\x1b[92m',   // Use green
    pink: '\x1b[92m',      // Use green
    purple: '\x1b[92m',    // Use green
    blue: '\x1b[92m',      // Use green
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    white: '\x1b[97m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
  }
};

/**
 * Starfield Theme
 * Blue/yellow/orange/red space aesthetic
 * Official Starfield colors: blue #1f3f78, red #d2152a, yellow #e1b350, orange #e75824
 */
export const starfieldTheme: Theme = {
  name: 'starfield',
  description: 'Starfield - Blue/yellow/orange space',
  colors: {
    promptText: 'blue',
    inputText: 'white',
    border: 'blue',
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
 * Cyberpunk Theme
 * Blue/yellow neon aesthetic
 */
export const cyberpunkTheme: Theme = {
  name: 'cyberpunk',
  description: 'Cyberpunk - Blue and yellow neon',
  colors: {
    promptText: 'blue',
    inputText: 'white',
    border: 'blue',
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
    magenta: '\x1b[94m',    // Use blue
    pink: '\x1b[93m',       // Use yellow
    purple: '\x1b[94m',     // Use blue
    blue: '\x1b[94m',
    green: '\x1b[92m',
    yellow: '\x1b[93m',
    white: '\x1b[97m',
    dim: '\x1b[2m',
    bright: '\x1b[1m',
  }
};

export const themes: Record<string, Theme> = {
  hld: hldTheme,
  fallout: falloutTheme,
  starfield: starfieldTheme,
  cyberpunk: cyberpunkTheme,
};

export const defaultTheme = hldTheme;

/**
 * Get theme by name, falling back to default
 */
export function getTheme(name?: string): Theme {
  if (!name) return defaultTheme;
  return themes[name] || defaultTheme;
}
