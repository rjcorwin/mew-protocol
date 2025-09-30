import os from 'os';
import readline from 'readline';

export interface ParticipantConfig {
  id: string;
  command?: string;
  capabilities?: Array<string | { kind?: string }>;
  tokens?: string[];
  [key: string]: any;
}

export interface SpaceConfiguration {
  participants: Record<string, ParticipantConfig>;
  space?: {
    default_participant?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ResolveParticipantOptions {
  participantId?: string;
  spaceConfig: SpaceConfiguration;
  interactive?: boolean;
}

export async function resolveParticipant(options: ResolveParticipantOptions): Promise<ParticipantConfig> {
  const { participantId, spaceConfig, interactive = true } = options;

  if (!spaceConfig || !spaceConfig.participants) {
    throw new Error('No participants defined in space configuration');
  }

  const participants = spaceConfig.participants;

  if (participantId) {
    if (!participants[participantId]) {
      throw new Error(`Participant '${participantId}' not found in space configuration`);
    }
    const participantConfig = participants[participantId];
    return {
      ...participantConfig,
      id: participantConfig.id ?? participantId
    };
  }

  if (spaceConfig.space?.default_participant) {
    const defaultId = spaceConfig.space.default_participant;
    if (participants[defaultId]) {
      const participantConfig = participants[defaultId];
      return {
        ...participantConfig,
        id: participantConfig.id ?? defaultId
      };
    }
  }

  const humanParticipants: ParticipantConfig[] = Object.entries(participants)
    .filter(([, config]) => !config.command)
    .map(([id, config]) => ({
      ...config,
      id: config.id ?? id
    }));

  if (humanParticipants.length === 0) {
    throw new Error('No human participants found (all participants have command field)');
  }

  if (humanParticipants.length === 1) {
    return humanParticipants[0];
  }

  if (interactive) {
    const selected = await promptParticipantSelection(humanParticipants);
    if (selected) {
      return selected;
    }
  }

  const username = os.userInfo().username;
  const userMatch = humanParticipants.find((p) => p.id === username);
  if (userMatch) {
    return userMatch;
  }

  if (!interactive) {
    throw new Error('Could not determine participant. Use --participant flag to specify.');
  }

  throw new Error('No participant selected. Use --participant flag to specify.');
}

async function promptParticipantSelection(participants: ParticipantConfig[]): Promise<ParticipantConfig | null> {
  console.log('\nMultiple participants available. Please select:');
  participants.forEach((p, i) => {
    const caps = p.capabilities
      ? p.capabilities.map((c) => (typeof c === 'string' ? c : c.kind || '')).join(', ') || 'none'
      : 'none';
    console.log(`  ${i + 1}. ${p.id} (capabilities: ${caps})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\nEnter number (or press Enter to skip): ', (answer) => {
      rl.close();

      if (!answer.trim()) {
        resolve(null);
        return;
      }

      const index = Number.parseInt(answer, 10) - 1;
      if (index >= 0 && index < participants.length) {
        resolve(participants[index]);
      } else {
        console.log('Invalid selection');
        resolve(null);
      }
    });
  });
}

export function getInteractiveOverrides(participantConfig: ParticipantConfig): ParticipantConfig {
  const config: ParticipantConfig = { ...participantConfig };

  delete config.fifo;
  delete config.output_log;
  delete config.auto_connect;

  if (!config.tokens || config.tokens.length === 0) {
    config.tokens = [`${config.id}-token-${Date.now()}`];
  }

  return config;
}
