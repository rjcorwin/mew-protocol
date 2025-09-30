/**
 * Participant Resolution Logic
 *
 * Shared module for resolving which participant to connect as.
 * Used by both `mew space up --interactive` and `mew space connect`.
 */

import os from 'os';
import readline from 'readline';

/**
 * Resolves which participant to connect as based on priority rules
 *
 * Priority order:
 * 1. Explicit --participant flag
 * 2. Space config default_participant field
 * 3. Single human participant (no command field)
 * 4. Interactive selection from human participants
 * 5. System username match
 * 6. Error if none found
 *
 * @param {Object} options
 * @param {string} [options.participantId] - Explicit participant ID from CLI flag
 * @param {Object} options.spaceConfig - Parsed space.yaml configuration
 * @param {boolean} [options.interactive=true] - Whether to show interactive prompts
 * @returns {Promise<Object>} - Resolved participant config with id
 */
async function resolveParticipant(options) {
  const { participantId, spaceConfig, interactive = true } = options;

  if (!spaceConfig || !spaceConfig.participants) {
    throw new Error('No participants defined in space configuration');
  }

  const participants = spaceConfig.participants;

  // 1. Explicit --participant flag
  if (participantId) {
    if (!participants[participantId]) {
      throw new Error(`Participant '${participantId}' not found in space configuration`);
    }
    return {
      id: participantId,
      ...participants[participantId],
    };
  }

  // 2. Space config default_participant field
  if (spaceConfig.space?.default_participant) {
    const defaultId = spaceConfig.space.default_participant;
    if (participants[defaultId]) {
      return {
        id: defaultId,
        ...participants[defaultId],
      };
    }
  }

  // Get human participants (those without command field)
  const humanParticipants = Object.entries(participants)
    .filter(([_, config]) => !config.command)
    .map(([id, config]) => ({ id, ...config }));

  if (humanParticipants.length === 0) {
    throw new Error('No human participants found (all participants have command field)');
  }

  // 3. Single human participant - auto-select
  if (humanParticipants.length === 1) {
    return humanParticipants[0];
  }

  // 4. Interactive selection (if enabled)
  if (interactive) {
    const selected = await promptParticipantSelection(humanParticipants);
    if (selected) {
      return selected;
    }
  }

  // 5. System username match
  const username = os.userInfo().username;
  const userMatch = humanParticipants.find((p) => p.id === username);
  if (userMatch) {
    return userMatch;
  }

  // 6. Error if none found
  if (!interactive) {
    throw new Error('Could not determine participant. Use --participant flag to specify.');
  }

  throw new Error('No participant selected. Use --participant flag to specify.');
}

/**
 * Prompts user to select a participant interactively
 * @param {Array} participants - List of human participants
 * @returns {Promise<Object|null>} - Selected participant or null
 */
async function promptParticipantSelection(participants) {
  console.log('\nMultiple participants available. Please select:');
  participants.forEach((p, i) => {
    const caps = p.capabilities ? p.capabilities.map((c) => c.kind || c).join(', ') : 'none';
    console.log(`  ${i + 1}. ${p.id} (capabilities: ${caps})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nEnter number (or press Enter to skip): ', (answer) => {
      rl.close();

      if (!answer.trim()) {
        resolve(null);
        return;
      }

      const index = parseInt(answer) - 1;
      if (index >= 0 && index < participants.length) {
        resolve(participants[index]);
      } else {
        console.log('Invalid selection');
        resolve(null);
      }
    });
  });
}

/**
 * Gets interactive mode overrides for participant config
 *
 * When in interactive mode, certain configurations are overridden:
 * - fifo: ignored (use terminal instead)
 * - output_log: ignored (output to terminal)
 * - auto_connect: ignored (we're manually connecting)
 *
 * @param {Object} participantConfig - Original participant configuration
 * @returns {Object} - Modified configuration for interactive mode
 */
function getInteractiveOverrides(participantConfig) {
  const config = { ...participantConfig };

  // Remove automation-specific settings
  delete config.fifo;
  delete config.output_log;
  delete config.auto_connect;

  // Ensure we have tokens
  if (!config.tokens || config.tokens.length === 0) {
    // Generate a default token if none provided
    config.tokens = [`${config.id}-token-${Date.now()}`];
  }

  return config;
}

export { resolveParticipant, getInteractiveOverrides };
