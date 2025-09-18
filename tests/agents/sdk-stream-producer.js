#!/usr/bin/env node
const { MEWParticipant } = require('@mew-protocol/participant');

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[sdk-producer] Missing environment variable ${name}`);
    process.exit(1);
  }
  return value;
}

const gateway = requiredEnv('MEW_GATEWAY');
const space = requiredEnv('MEW_SPACE');
const token = requiredEnv('MEW_TOKEN');
const participantId = requiredEnv('MEW_PARTICIPANT');

(async () => {
  const participant = new MEWParticipant({
    gateway,
    space,
    token,
    participant_id: participantId,
  });

  participant.onError((error) => {
    console.error('[sdk-producer] participant error', error);
  });

  try {
    await participant.connect();

    const handle = await participant.announceStream({
      intent: 'llm/tokens',
      desiredId: 'sdk-stream',
      formats: [
        {
          id: 'llm/tokens',
          description: 'Tokens emitted from SDK producer',
          mime_type: 'application/json',
        },
      ],
    });

    console.log(`[sdk-producer] stream ready ${handle.streamId} (${handle.namespace})`);

    participant.startStream(handle.streamId);

    participant.sendStreamData(handle.streamId, { token: 'alpha', index: 1 }, {
      formatId: 'llm/tokens',
    });
    participant.sendStreamData(handle.streamId, { token: 'beta', index: 2 }, {
      formatId: 'llm/tokens',
    });

    setTimeout(() => {
      participant.completeStream(handle.streamId, { reason: 'sdk-test-complete' });
      setTimeout(() => {
        participant.disconnect();
        process.exit(0);
      }, 200);
    }, 300);
  } catch (error) {
    console.error('[sdk-producer] fatal error', error);
    try {
      participant.disconnect();
    } catch (disconnectError) {
      // ignore
    }
    process.exit(1);
  }
})();
