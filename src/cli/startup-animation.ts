// Hyper Light Drifter inspired startup animation
// Uses ANSI colors for neon aesthetic

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[96m',
  magenta: '\x1b[95m',
  pink: '\x1b[38;5;213m',
  purple: '\x1b[38;5;141m',
  blue: '\x1b[38;5;117m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
};

// Frame data for animation
const frames = [
  // Frame 1: Crystal forming
  `
                    ${colors.dim}        ▄▄${colors.reset}
                    ${colors.dim}       ▄██${colors.reset}
                    ${colors.cyan}      ▄███${colors.reset}
                    ${colors.cyan}     ▄████${colors.reset}
                    ${colors.bright}${colors.cyan}    ▄█████${colors.reset}
`,
  // Frame 2: Crystal glowing
  `
                    ${colors.magenta}        ◢◣${colors.reset}
                    ${colors.magenta}       ◢███◣${colors.reset}
                    ${colors.pink}      ◢█████◣${colors.reset}
                    ${colors.cyan}     ◢███████◣${colors.reset}
                    ${colors.bright}${colors.cyan}    ◢█████████◣${colors.reset}
`,
  // Frame 3: Full crystal with energy
  `
                    ${colors.bright}${colors.magenta}        ◢◣${colors.reset}
                    ${colors.bright}${colors.magenta}       ◢███◣${colors.reset}
                    ${colors.bright}${colors.pink}      ◢█████◣${colors.reset}
                    ${colors.bright}${colors.cyan}     ◢███${colors.purple}◆${colors.cyan}███◣${colors.reset}
                    ${colors.bright}${colors.blue}    ◢█████████◣${colors.reset}
`,
  // Frame 4: Energy burst
  `
                    ${colors.bright}${colors.magenta}    ◇   ◢◣   ◇${colors.reset}
                    ${colors.bright}${colors.pink}       ◢███◣${colors.reset}
                    ${colors.bright}${colors.cyan}  ◇   ◢█████◣   ◇${colors.reset}
                    ${colors.bright}${colors.cyan}     ◢███${colors.purple}◆${colors.cyan}███◣${colors.reset}
                    ${colors.bright}${colors.blue}    ◢█████████◣${colors.reset}
`,
  // Frame 5: Settled with cat
  `
                    ${colors.dim}        ◢◣${colors.reset}
                    ${colors.magenta}       ◢███◣${colors.reset}
                    ${colors.pink}      ◢█████◣${colors.reset}
                    ${colors.cyan}     ◢███${colors.purple}◆${colors.cyan}███◣${colors.reset}
                    ${colors.bright}${colors.blue}    ◢█████████◣${colors.reset}
                    ${colors.cyan}      /ᐠ｡ꞈ｡ᐟ\\${colors.reset}
`,
];

// Text to display after animation
const welcomeText = `
          ${colors.bright}${colors.cyan}╔═══════════════════════════════════════╗${colors.reset}
          ${colors.bright}${colors.cyan}║${colors.reset} ${colors.bright}${colors.magenta}MEW${colors.reset} ${colors.cyan}Protocol${colors.reset} ${colors.dim}- Multi-Entity Workspace${colors.reset} ${colors.bright}${colors.cyan}║${colors.reset}
          ${colors.bright}${colors.cyan}╚═══════════════════════════════════════╝${colors.reset}
`;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

function moveCursorUp(lines: number) {
  process.stdout.write(`\x1b[${lines}A`);
}

export async function playStartupAnimation(): Promise<void> {
  // Check if we should skip animation (CI, non-TTY, or env var)
  if (!process.stdout.isTTY || process.env.MEW_NO_ANIMATION) {
    console.log('Welcome to MEW Protocol!');
    return;
  }

  try {
    // Clear screen and start animation
    clearScreen();

    // Play animation frames
    for (let i = 0; i < frames.length; i++) {
      process.stdout.write(frames[i]);

      if (i < frames.length - 1) {
        await sleep(200); // Frame duration
        // Move cursor up to overwrite
        const lineCount = frames[i].split('\n').length - 1;
        moveCursorUp(lineCount);
      }
    }

    // Hold final frame briefly
    await sleep(300);

    // Display welcome text
    process.stdout.write(welcomeText);
    process.stdout.write('\n');

  } catch (error) {
    // If animation fails, just show simple text
    console.log('Welcome to MEW Protocol!');
  }
}

export function showQuickBanner(): void {
  // Quick banner for commands that start immediately
  console.log(`${colors.magenta}◆${colors.reset} ${colors.cyan}MEW Protocol${colors.reset}`);
}
