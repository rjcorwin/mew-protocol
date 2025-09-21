/**
 * Schema-driven envelope form definitions for the interactive editor.
 *
 * Each entry describes the base message structure and field prompts
 * for a supported MEW envelope kind.
 */

const envelopeForms = {
  'message/propose': {
    label: 'message/propose',
    description: 'Propose a message or decision for review by human participants.',
    base: {
      kind: 'message/propose',
      to: [],
      payload: {
        summary: '',
        body: '',
        tags: []
      }
    },
    fields: [
      {
        path: 'to',
        label: 'Recipients',
        type: 'list',
        description: 'Comma-separated participant IDs that should receive the proposal (optional).',
        defaultValue: []
      },
      {
        path: 'payload.summary',
        label: 'Summary',
        type: 'string',
        description: 'Short headline that will be displayed in inboxes and notifications.',
        required: true,
        defaultValue: ''
      },
      {
        path: 'payload.body',
        label: 'Body',
        type: 'string',
        description: 'Full proposal body. Markdown is supported by most clients.',
        multiline: true,
        defaultValue: ''
      },
      {
        path: 'payload.tags',
        label: 'Tags',
        type: 'list',
        description: 'Optional tags to help downstream automation filter proposals.',
        defaultValue: []
      }
    ]
  },
  'tool/request': {
    label: 'tool/request',
    description: 'Request that a tool be executed on behalf of the participant.',
    base: {
      kind: 'tool/request',
      to: [],
      payload: {
        name: '',
        arguments: {},
        context: ''
      }
    },
    fields: [
      {
        path: 'to',
        label: 'Target Participants',
        type: 'list',
        description: 'Comma-separated participant IDs to route the tool request to (optional).',
        defaultValue: []
      },
      {
        path: 'payload.name',
        label: 'Tool Name',
        type: 'string',
        description: 'Identifier of the tool capability to invoke (e.g., `mcp://fs/read`).',
        required: true,
        defaultValue: ''
      },
      {
        path: 'payload.arguments',
        label: 'Arguments (JSON)',
        type: 'json',
        description: 'JSON object containing the call arguments for the tool.',
        defaultValue: {}
      },
      {
        path: 'payload.context',
        label: 'Context',
        type: 'string',
        description: 'Optional human-readable context or justification for the tool run.',
        defaultValue: ''
      }
    ]
  },
  'stream/open': {
    label: 'stream/open',
    description: 'Open a new event stream for structured, high-frequency updates.',
    base: {
      kind: 'stream/open',
      to: [],
      payload: {
        stream: {
          name: '',
          kind: 'custom',
          channel: '',
          metadata: {}
        }
      }
    },
    fields: [
      {
        path: 'to',
        label: 'Recipients',
        type: 'list',
        description: 'Comma-separated participant IDs that should receive the stream notifications.',
        defaultValue: []
      },
      {
        path: 'payload.stream.name',
        label: 'Stream Name',
        type: 'string',
        description: 'Human-readable name for the stream (e.g., `movement-tracking`).',
        required: true,
        defaultValue: ''
      },
      {
        path: 'payload.stream.kind',
        label: 'Stream Kind',
        type: 'string',
        description: 'Stream type (e.g., `position`, `chat`, or custom taxonomy).',
        defaultValue: 'custom'
      },
      {
        path: 'payload.stream.channel',
        label: 'Channel',
        type: 'string',
        description: 'Optional routing key for multiplexed stream consumers.',
        defaultValue: ''
      },
      {
        path: 'payload.stream.metadata',
        label: 'Metadata (JSON)',
        type: 'json',
        description: 'JSON object with implementation-specific metadata for downstream services.',
        defaultValue: {}
      }
    ]
  }
};

module.exports = envelopeForms;
