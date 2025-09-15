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
 * @returns {string} The formatted banner
 */
function generateBanner(options = {}) {
  const tagline = getRandomTagline();
  const color = options.color !== false;

  // Colors using ANSI escape codes
  const cyan = color ? '\x1b[36m' : '';
  const yellow = color ? '\x1b[33m' : '';
  const green = color ? '\x1b[32m' : '';
  const reset = color ? '\x1b[0m' : '';
  const bold = color ? '\x1b[1m' : '';

  const banner = `
     ${yellow}/\\_/\\${reset}  ${bold}███╗   ███╗███████╗██╗    ██╗${reset}
    ${yellow}( ^.^ )${reset} ${bold}████╗ ████║██╔════╝██║    ██║${reset}
     ${yellow}> ^ <${reset}  ${bold}██╔████╔██║█████╗  ██║ █╗ ██║${reset}
    ${yellow}/     \\${reset} ${bold}██║╚██╔╝██║██╔══╝  ██║███╗██║${reset}
            ${bold}██║ ╚═╝ ██║███████╗╚███╔███╔╝${reset}
            ${bold}╚═╝     ╚═╝╚══════╝ ╚══╝╚══╝${reset}

    ${green}Multi-Entity Workspace Protocol v0.3${reset}
    ${cyan}"${tagline}"${reset}
`;

  // Add space info if provided
  if (options.spaceName || options.participantId) {
    const infoLines = [];
    if (options.spaceName) {
      infoLines.push(`${green}▸${reset} Space: ${bold}${options.spaceName}${reset}`);
    }
    if (options.participantId) {
      infoLines.push(`${green}▸${reset} You are: ${bold}${options.participantId}${reset}`);
    }
    if (options.gateway) {
      infoLines.push(`${green}▸${reset} Gateway: ${options.gateway}`);
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

module.exports = {
  generateBanner,
  printBanner,
  getRandomTagline,
  TAGLINES
};