import { Command } from 'commander';

const token = new Command('token').description('Token management');

token
  .command('create')
  .description('Create a test token')
  .requiredOption('-p, --participant-id <id>', 'Participant ID')
  .requiredOption('-c, --capabilities <json>', 'JSON array of capabilities')
  .action((options) => {
    // For now, just return a simple token (participant-id:capabilities)
    // In production, this would create a proper JWT

    let capabilities;
    try {
      capabilities = JSON.parse(options.capabilities);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Invalid capabilities JSON:', message);
      process.exit(1);
    }

    // Simple token format for testing
    const token = Buffer.from(
      JSON.stringify({
        participantId: options.participantId,
        capabilities: capabilities,
        createdAt: new Date().toISOString(),
      }),
    ).toString('base64');

    console.log(token);
  });

export default token;
