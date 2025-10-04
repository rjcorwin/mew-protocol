// @ts-nocheck
/**
 * MEW Protocol Banner
 *
 * Displays a happy cat ASCII banner with random taglines
 * when starting interactive mode.
 */

const TAGLINES = [
  "Herding cats, elegantly",
  "Professional cat herding since 2025",
  "Your digital cat herder",
  "Cat herding as a service",
  "Enterprise-grade cat herding",
  "The art of cat herding",
  "Cat herding, simplified",
  "Making cat herding possible",
  "Cat herder protocol",
  "Chief cat herding officer",
  "Certified cat herder",
  "Cat herding headquarters",
  "Where cats get herded",
  "Cat herding central",
  "The cat herding platform",
  "Herding digital cats since v0.1",
  "Because herding cats wasn't hard enough",
  "Turning cat herding into a science",
  "Cat herding: Achievement unlocked",
  "Expert cat wrangling technology",
  "Like herding cats, but it works",
  "Solving the cat herding problem",
  "Cat coordination headquarters",
  "Finally, a cat herding solution",
  "We herd cats so you don't have to",
  "Cat traffic control",
  "Feline coordination protocol",
  "The impossible made possible: cat herding",
  "Distributed cat herding",
  "Collaborative cat herding",
  "Where autonomous agents unite",
  "Coordinating chaos, purr-fectly",
  "Many agents, one conversation",
  "Teaching AI agents to play nice",
  "Multiplayer mode for AI agents",
  "Because agents need friends too",
  "Making agents work together",
  "Bringing order to autonomous chaos"
];

/**
 * Get a random tagline
 */
function getRandomTagline() {
  return TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
}

/**
 * Generate the MEW banner with space info
 * @param {Object} options - Banner configuration
 * @param {string} options.spaceId - Space identifier
 * @param {string} options.spaceName - Space name
 * @param {string} options.participantId - Current participant ID
 * @param {string} options.gateway - Gateway URL
 * @param {boolean} options.color - Whether to use colors
 * @param {Object} options.theme - Theme object with ansi colors
 * @returns {string} The formatted banner
 */
function generateBanner(options = {}) {
  const tagline = getRandomTagline();
  const color = options.color !== false;

  // Use theme colors if provided, otherwise fall back to HLD colors
  const theme = options.theme;
  const cyan = color ? (theme?.ansi?.cyan || '\x1b[96m') : '';
  const magenta = color ? (theme?.ansi?.magenta || '\x1b[95m') : '';
  const pink = color ? (theme?.ansi?.pink || '\x1b[38;5;213m') : '';
  const purple = color ? (theme?.ansi?.purple || '\x1b[38;5;141m') : '';
  const blue = color ? (theme?.ansi?.blue || '\x1b[38;5;117m') : '';
  const reset = color ? (theme?.ansi?.reset || '\x1b[0m') : '';
  const bold = color ? (theme?.ansi?.bright || '\x1b[1m') : '';
  const dim = color ? (theme?.ansi?.dim || '\x1b[2m') : '';

  const banner = `
    ${dim}▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄${reset}
        ${bold}${magenta}◢◣${reset}        ${bold}${cyan}███╗   ███╗███████╗██╗    ██╗${reset}
       ${bold}${pink}◢███◣${reset}      ${bold}${cyan}████╗ ████║██╔════╝██║    ██║${reset}
      ${bold}${cyan}◢█████◣${reset}     ${bold}${cyan}██╔████╔██║█████╗  ██║ █╗ ██║${reset}
     ${bold}${cyan}◢███${purple}◆${cyan}███◣${reset}    ${bold}${cyan}██║╚██╔╝██║██╔══╝  ██║███╗██║${reset}
    ${bold}${blue}◢█████████◣${reset}   ${bold}${cyan}██║ ╚═╝ ██║███████╗╚███╔███╔╝${reset}
      ${cyan}/ᐠ｡ꞈ｡ᐟ\\${reset}     ${bold}${cyan}╚═╝     ╚═╝╚══════╝ ╚══╝╚══╝${reset}
    ${dim}▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀${reset}

    ${bold}${magenta}◆${reset} ${cyan}Multi-Entity Workspace Protocol${reset} ${dim}v0.4${reset} ${bold}${magenta}◆${reset}
    ${dim}${cyan}"${tagline}"${reset}
`;

  // Add space info if provided
  if (options.spaceName || options.participantId) {
    const infoLines = [];
    if (options.spaceName) {
      infoLines.push(`    ${magenta}◆${reset} Space: ${bold}${cyan}${options.spaceName}${reset}`);
    }
    if (options.participantId) {
      infoLines.push(`    ${magenta}◆${reset} You are: ${bold}${pink}${options.participantId}${reset}`);
    }
    if (options.gateway) {
      infoLines.push(`    ${magenta}◆${reset} Gateway: ${dim}${options.gateway}${reset}`);
    }

    if (infoLines.length > 0) {
      return banner + '\n' + infoLines.join('\n') + '\n';
    }
  }

  return banner;
}

/**
 * Print the banner to stdout
 * @param {Object} options - Banner configuration
 */
function printBanner(options = {}) {
  console.log(generateBanner(options));
}

export { generateBanner, printBanner, getRandomTagline, TAGLINES };
