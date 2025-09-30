// @ts-nocheck

/**
 * Slash command schema and autocomplete engine for the MEW CLI.
 *
 * Phase 1 implements schema-based traversal for existing static commands
 * while laying the groundwork for dynamic resolvers (participants, tools, etc.).
 */

export const NODE_TYPES = {
  LITERAL: 'literal',
  CHOICE: 'choice',
  PARAMETER: 'parameter'
};

const DEFAULT_ARGUMENT_TEMPLATE_OPTIONS = [
  {
    value: '{}',
    insertValue: '{}',
    displayValue: '{}',
    description: 'Empty object arguments'
  },
  {
    value: '{"property": ""}',
    insertValue: '{"property": ""}',
    displayValue: '{"property": ""}',
    description: 'Single string argument template'
  }
];

const MAX_SCHEMA_TEMPLATE_DEPTH = 3;
const MAX_SCHEMA_TEMPLATE_KEYS = 5;

function normalizeSchemaCandidate(schema) {
  if (!schema) {
    return null;
  }

  if (Array.isArray(schema)) {
    for (const entry of schema) {
      const normalized = normalizeSchemaCandidate(entry);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  if (typeof schema !== 'object') {
    return null;
  }

  if (schema.anyOf) {
    return normalizeSchemaCandidate(schema.anyOf);
  }

  if (schema.oneOf) {
    return normalizeSchemaCandidate(schema.oneOf);
  }

  if (schema.allOf) {
    return normalizeSchemaCandidate(schema.allOf);
  }

  return schema;
}

function buildObjectTemplateFromSchema(schema, depth = 0) {
  if (!schema || depth >= MAX_SCHEMA_TEMPLATE_DEPTH) {
    return {};
  }

  const normalized = normalizeSchemaCandidate(schema);
  if (!normalized || typeof normalized !== 'object') {
    return {};
  }

  const properties = normalized.properties && typeof normalized.properties === 'object'
    ? normalized.properties
    : {};
  const required = Array.isArray(normalized.required)
    ? normalized.required.filter(key => properties[key])
    : [];

  let keys = required;
  if (!keys || keys.length === 0) {
    keys = Object.keys(properties);
  }

  if (!keys || keys.length === 0) {
    return {};
  }

  const limitedKeys = keys.slice(0, MAX_SCHEMA_TEMPLATE_KEYS);
  const template = {};

  for (const key of limitedKeys) {
    template[key] = inferEmptyValueFromSchema(properties[key], depth + 1);
  }

  return template;
}

function inferEmptyValueFromSchema(schema, depth = 0) {
  const normalized = normalizeSchemaCandidate(schema);
  if (!normalized) {
    return '';
  }

  let type = normalized.type;
  if (Array.isArray(type)) {
    type = type[0];
  }

  if (!type) {
    if (Array.isArray(normalized.enum) && normalized.enum.length > 0) {
      return normalized.enum[0];
    }
    if (normalized.const !== undefined) {
      return normalized.const;
    }
    if (normalized.default !== undefined) {
      return normalized.default;
    }
    if (normalized.properties) {
      return buildObjectTemplateFromSchema(normalized, depth + 1);
    }
    return '';
  }

  switch (type) {
    case 'string':
      if (normalized.enum && Array.isArray(normalized.enum) && normalized.enum.length > 0) {
        return normalized.enum[0];
      }
      return normalized.default !== undefined ? normalized.default : '';
    case 'number':
    case 'integer':
      if (normalized.default !== undefined) {
        return normalized.default;
      }
      if (typeof normalized.minimum === 'number') {
        return normalized.minimum;
      }
      return 0;
    case 'boolean':
      if (normalized.default !== undefined) {
        return Boolean(normalized.default);
      }
      return false;
    case 'array': {
      if (depth >= MAX_SCHEMA_TEMPLATE_DEPTH) {
        return [];
      }
      const itemTemplate = inferEmptyValueFromSchema(normalized.items, depth + 1);
      if (itemTemplate === '' || itemTemplate === undefined) {
        return [];
      }
      return [itemTemplate];
    }
    case 'object':
      return buildObjectTemplateFromSchema(normalized, depth + 1);
    default:
      return '';
  }
}

function buildTemplatesFromSchema(schema) {
  const normalized = normalizeSchemaCandidate(schema);
  if (!normalized || (normalized.type && normalized.type !== 'object' && normalized.type !== 'array' && normalized.type !== 'any')) {
    if (normalized && !normalized.type && normalized.properties) {
      // Treat as object schema without explicit type
      const template = buildObjectTemplateFromSchema(normalized);
      if (template && Object.keys(template).length > 0) {
        return [JSON.stringify(template)];
      }
    }
    return [];
  }

  const template = normalized.type === 'array'
    ? inferEmptyValueFromSchema(normalized)
    : buildObjectTemplateFromSchema(normalized);

  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    return [];
  }

  if (Object.keys(template).length === 0) {
    return [];
  }

  return [JSON.stringify(template)];
}

function findToolDefinition(state, participantId, toolName) {
  if (!state || !toolName) {
    return null;
  }

  const toolsByParticipant = state.toolsByParticipant || {};
  const normalizedName = toolName.toLowerCase();

  const candidateLists = [];

  if (participantId && Array.isArray(toolsByParticipant[participantId])) {
    candidateLists.push(toolsByParticipant[participantId]);
  }

  for (const value of Object.values(toolsByParticipant)) {
    if (Array.isArray(value)) {
      candidateLists.push(value);
    }
  }

  for (const list of candidateLists) {
    const match = list.find(tool => tool && typeof tool.name === 'string' && tool.name.toLowerCase() === normalizedName);
    if (match) {
      return match;
    }
  }

  return null;
}

function createTemplateOption(value, description) {
  return {
    value,
    displayValue: value,
    insertValue: value,
    description: description || null
  };
}

export function literal(value, meta = {}) {
  return {
    type: NODE_TYPES.LITERAL,
    value,
    description: meta.description || null,
    optional: Boolean(meta.optional),
    insertValue: meta.insertValue || value,
    displayValue: meta.displayValue || value,
    appendSpace: typeof meta.appendSpace === 'boolean' ? meta.appendSpace : undefined,
    aliases: Array.isArray(meta.aliases) ? meta.aliases.slice() : null
  };
}

export function choice(name, options, meta = {}) {
  return {
    type: NODE_TYPES.CHOICE,
    name,
    options: Array.isArray(options)
      ? options.map((option, index) => normalizeOption(option, index))
      : [],
    optional: Boolean(meta.optional),
    description: meta.description || null,
    placeholder: meta.placeholder || `<${name}>`,
    appendSpace: typeof meta.appendSpace === 'boolean' ? meta.appendSpace : undefined
  };
}

export function parameter(name, options = {}) {
  const normalizedOptions = Array.isArray(options.options)
    ? options.options.map((option, index) => normalizeOption(option, index))
    : null;

  return {
    type: NODE_TYPES.PARAMETER,
    name,
    optional: Boolean(options.optional),
    description: options.description || null,
    placeholder: options.placeholder || `<${name}>`,
    resolver: typeof options.resolver === 'function' ? options.resolver : null,
    resolverKey: options.resolverKey || null,
    collectAs: options.collectAs || name,
    allowUnknown: options.allowUnknown !== false,
    variadic: Boolean(options.variadic),
    appendSpace: typeof options.appendSpace === 'boolean' ? options.appendSpace : undefined,
    options: normalizedOptions
  };
}

const resolverRegistry = {
  participants(context = {}) {
    const state = context.state || {};
    const participants = Array.isArray(state.participants) ? state.participants : [];
    const details = state.participantDetails || {};

    return participants
      .filter(id => typeof id === 'string' && id.length > 0)
      .map(id => {
        const info = details[id] || {};
        const descriptionCandidate = [info.summary, info.status, info.description]
          .find(value => typeof value === 'string' && value.trim().length > 0) || null;

        return {
          value: id,
          displayValue: id,
          insertValue: id,
          description: descriptionCandidate
        };
      });
  },

  toolsForParticipant(context = {}) {
    const state = context.state || {};
    const parameters = context.parameters || {};
    const toolsByParticipant = state.toolsByParticipant || {};
    const targetParticipant = parameters.targetParticipant || parameters.participant || parameters.to || null;

    let toolEntries = [];

    if (targetParticipant && Array.isArray(toolsByParticipant[targetParticipant])) {
      toolEntries = toolsByParticipant[targetParticipant];
    } else {
      for (const key of Object.keys(toolsByParticipant)) {
        const list = toolsByParticipant[key];
        if (Array.isArray(list)) {
          toolEntries = toolEntries.concat(list);
        }
      }
    }

    if (!Array.isArray(toolEntries) || toolEntries.length === 0) {
      return [];
    }

    const seen = new Set();

    return toolEntries
      .map(tool => {
        if (!tool) {
          return null;
        }

        if (typeof tool === 'string') {
          return {
            value: tool,
            displayValue: tool,
            insertValue: tool,
            description: null
          };
        }

        if (typeof tool === 'object') {
          const name = tool.name || tool.value || tool.id;
          if (!name) {
            return null;
          }

          const display = tool.displayName || tool.display_name || null;
          const description = typeof tool.description === 'string' ? tool.description : null;

          return {
            value: name,
            displayValue: display || name,
            insertValue: name,
            description
          };
        }

        return null;
      })
      .filter(option => {
        if (!option || !option.value) {
          return false;
        }

        const key = option.value.toLowerCase();
        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  },

  argumentTemplatesForTool(context = {}) {
    const parameters = context.parameters || {};
    const state = context.state || {};

    const participantId = parameters.targetParticipant || parameters.participant || parameters.to || null;
    const toolName = parameters.toolName || parameters.tool || parameters.name || null;

    const tool = findToolDefinition(state, participantId, toolName);
    const options = [];

    if (tool) {
      const schema = tool.inputSchema || tool.schema || tool.parameters || null;
      const schemaTemplates = buildTemplatesFromSchema(schema);

      schemaTemplates.forEach(template => {
        options.push(createTemplateOption(
          template,
          tool.name ? `Template from ${tool.name} schema` : 'Template from tool schema'
        ));
      });
    }

    DEFAULT_ARGUMENT_TEMPLATE_OPTIONS.forEach(defaultOption => {
      options.push({ ...defaultOption });
    });

    const seen = new Set();
    return options.filter(option => {
      if (!option || typeof option.value !== 'string') {
        return false;
      }
      const trimmed = option.value.trim();
      if (!trimmed) {
        return false;
      }
      if (seen.has(trimmed)) {
        return false;
      }
      seen.add(trimmed);
      return true;
    });
  }
};

function normalizeOption(option, index) {
  if (typeof option === 'string') {
    return {
      value: option,
      displayValue: option,
      description: null,
      index
    };
  }

  if (option && typeof option === 'object') {
    return {
      value: option.value,
      displayValue: option.displayValue || option.value,
      insertValue: option.insertValue || option.value,
      description: option.description || null,
      index
    };
  }

  return {
    value: String(option),
    displayValue: String(option),
    description: null,
    index
  };
}

function createCommand(config) {
  const sequence = Array.isArray(config.sequence) ? config.sequence : [];
  const usage = config.usage || buildUsageFromSequence(sequence);

  return {
    id: config.id,
    description: config.description || '',
    category: config.category || 'General',
    usage,
    sequence,
    order: typeof config.order === 'number' ? config.order : 0,
    primary: config.primary || computePrimaryAlias(sequence),
    summary: config.summary || config.description || '',
    keywords: Array.isArray(config.keywords) ? config.keywords.slice() : []
  };
}

function buildUsageFromSequence(sequence) {
  return sequence
    .map((node) => {
      if (node.type === NODE_TYPES.LITERAL) {
        return node.displayValue || node.value;
      }
      if (node.type === NODE_TYPES.CHOICE) {
        const choiceValues = node.options.map(opt => opt.displayValue || opt.value).join('|');
        return `[${choiceValues}]`;
      }
      if (node.type === NODE_TYPES.PARAMETER) {
        return node.optional ? `[${node.placeholder}]` : `<${node.placeholder || node.name}>`;
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

function computePrimaryAlias(sequence) {
  const parts = [];
  for (const node of sequence) {
    if (node.type !== NODE_TYPES.LITERAL) {
      break;
    }
    parts.push(node.displayValue || node.value);
  }
  return parts.join(' ');
}

const commandDefinitions = [
  createCommand({
    id: 'help',
    description: 'Show this help message',
    category: 'General',
    usage: '/help',
    sequence: [literal('/help')]
  }),
  createCommand({
    id: 'verbose',
    description: 'Toggle verbose output',
    category: 'General',
    usage: '/verbose',
    sequence: [literal('/verbose')]
  }),
  createCommand({
    id: 'streams-toggle',
    description: 'Toggle stream data display',
    category: 'General',
    usage: '/streams',
    sequence: [literal('/streams')]
  }),
  createCommand({
    id: 'ui-board-control',
    description: 'Control Signal Board visibility',
    category: 'General',
    usage: '/ui board [open|close|auto]',
    sequence: [
      literal('/ui'),
      literal('board'),
      choice('mode', [
        { value: 'open', description: 'Keep the Signal Board open' },
        { value: 'close', description: 'Hide the Signal Board' },
        { value: 'auto', description: 'Automatically toggle based on activity' }
      ], { optional: true, description: 'Board visibility mode' })
    ]
  }),
  createCommand({
    id: 'ui-clear',
    description: 'Clear local UI buffers',
    category: 'General',
    usage: '/ui-clear',
    sequence: [literal('/ui-clear')]
  }),
  createCommand({
    id: 'ui-board-toggle',
    description: 'Toggle Signal Board visibility',
    category: 'General',
    usage: '/ui-board',
    sequence: [literal('/ui-board')]
  }),
  createCommand({
    id: 'exit',
    description: 'Exit the application',
    category: 'General',
    usage: '/exit',
    sequence: [literal('/exit')]
  }),
  createCommand({
    id: 'ack',
    description: 'Acknowledge chat messages',
    category: 'Chat Queue',
    usage: '/ack [selector] [status]',
    sequence: [
      literal('/ack'),
      parameter('selector', { optional: true, description: 'Message selector', placeholder: 'selector' }),
      parameter('status', { optional: true, description: 'Status', placeholder: 'status' })
    ]
  }),
  createCommand({
    id: 'cancel',
    description: 'Cancel reasoning or pending chats',
    category: 'Chat Queue',
    usage: '/cancel [selector] [reason]',
    sequence: [
      literal('/cancel'),
      parameter('selector', { optional: true, description: 'Message selector', placeholder: 'selector' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'status',
    description: 'Request participant status',
    category: 'Participant Controls',
    usage: '/status <participant> [fields...]',
    sequence: [
      literal('/status'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('fields', { optional: true, description: 'Fields to request', placeholder: 'fields...', variadic: true })
    ]
  }),
  createCommand({
    id: 'pause',
    description: 'Pause a participant',
    category: 'Participant Controls',
    usage: '/pause <participant> [timeout] [reason]',
    sequence: [
      literal('/pause'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('timeout', { optional: true, description: 'Timeout', placeholder: 'timeout' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'resume',
    description: 'Resume a participant',
    category: 'Participant Controls',
    usage: '/resume <participant> [reason]',
    sequence: [
      literal('/resume'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'forget',
    description: 'Forget participant history',
    category: 'Participant Controls',
    usage: '/forget <participant> [oldest|newest] [count]',
    sequence: [
      literal('/forget'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      choice('order', [
        { value: 'oldest', description: 'Remove oldest memories first' },
        { value: 'newest', description: 'Remove newest memories first' }
      ], { optional: true, description: 'History order' }),
      parameter('count', { optional: true, description: 'Number of memories to forget', placeholder: 'count' })
    ]
  }),
  createCommand({
    id: 'clear',
    description: 'Clear a participant queue',
    category: 'Participant Controls',
    usage: '/clear <participant> [reason]',
    sequence: [
      literal('/clear'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'restart',
    description: 'Restart a participant',
    category: 'Participant Controls',
    usage: '/restart <participant> [mode] [reason]',
    sequence: [
      literal('/restart'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('mode', { optional: true, description: 'Restart mode', placeholder: 'mode' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'shutdown',
    description: 'Shut down a participant',
    category: 'Participant Controls',
    usage: '/shutdown <participant> [reason]',
    sequence: [
      literal('/shutdown'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'stream-request',
    description: 'Request a new stream',
    category: 'Streams',
    usage: '/stream request <participant> <direction> [description] [size=bytes]',
    sequence: [
      literal('/stream'),
      literal('request'),
      parameter('participant', { description: 'Participant ID', placeholder: 'participant' }),
      parameter('direction', { description: 'Stream direction', placeholder: 'direction' }),
      parameter('description', { optional: true, description: 'Description', placeholder: 'description', variadic: true }),
      parameter('size', { optional: true, description: 'Maximum size (bytes)', placeholder: 'size=bytes' })
    ]
  }),
  createCommand({
    id: 'stream-close',
    description: 'Close an existing stream',
    category: 'Streams',
    usage: '/stream close <streamId> [reason]',
    sequence: [
      literal('/stream'),
      literal('close'),
      parameter('streamId', { description: 'Stream identifier', placeholder: 'streamId' }),
      parameter('reason', { optional: true, description: 'Reason', placeholder: 'reason', variadic: true })
    ]
  }),
  createCommand({
    id: 'envelope-mcp-tool-call',
    description: 'Send an MCP tool call request envelope',
    category: 'Envelopes',
    usage: '/envelope mcp/request tool/call <participant> <tool> [jsonArguments]',
    sequence: [
      literal('/envelope'),
      literal('mcp/request'),
      literal('tool/call'),
      parameter('participant', {
        description: 'Participant to target',
        placeholder: 'participant',
        resolverKey: 'participants',
        collectAs: 'targetParticipant'
      }),
      parameter('tool', {
        description: 'Tool name to call',
        placeholder: 'tool',
        resolverKey: 'toolsForParticipant',
        collectAs: 'toolName'
      }),
      parameter('arguments', {
        optional: true,
        description: 'JSON arguments payload',
        placeholder: '{"key":"value"}',
        appendSpace: false,
        resolverKey: 'argumentTemplatesForTool'
      })
    ]
  })
];

export const commandRegistry = commandDefinitions.map((command, index) => ({
  ...command,
  order: index
}));

export const slashCommandList = commandRegistry.map((command) => ({
  command: command.primary,
  usage: command.usage,
  description: command.description,
  category: command.category
}));

export const slashCommandGroups = Array.from(new Set(commandRegistry.map(cmd => cmd.category)));

function tokenize(text) {
  const tokens = [];
  const regex = /\S+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return tokens;
}

function buildInputContext(text, cursorIndex) {
  const tokens = tokenize(text);
  const effectiveCursor = Math.max(0, Math.min(cursorIndex, text.length));

  let activeIndex = tokens.length;
  let activeToken = {
    value: '',
    start: effectiveCursor,
    end: effectiveCursor,
    prefix: '',
    suffix: '',
    isSynthetic: true
  };

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (effectiveCursor < token.start) {
      activeIndex = index;
      break;
    }
    if (effectiveCursor >= token.start && effectiveCursor <= token.end) {
      const prefixLength = Math.max(0, effectiveCursor - token.start);
      const tokenValue = text.slice(token.start, token.end);
      activeToken = {
        value: tokenValue,
        start: token.start,
        end: token.end,
        prefix: tokenValue.slice(0, prefixLength),
        suffix: tokenValue.slice(prefixLength),
        isSynthetic: false
      };
      activeIndex = index;
      break;
    }
  }

  const tokensBefore = activeToken.isSynthetic
    ? tokens.filter(token => token.end <= activeToken.start)
    : tokens.slice(0, activeIndex);

  return {
    text,
    cursorIndex: effectiveCursor,
    tokens,
    activeToken,
    tokensBefore
  };
}

function matchCommand(command, context) {
  const matchedNodes = [];
  const parameters = {};
  let nodeIndex = 0;

  for (const token of context.tokensBefore) {
    const tokenValue = token.value;
    const result = consumeToken(command.sequence, nodeIndex, tokenValue);
    if (!result) {
      return null;
    }

    matchedNodes.push({
      node: result.node,
      canonicalValue: result.canonicalValue,
      value: tokenValue,
      option: result.option || null
    });

    if (result.parameterName) {
      parameters[result.parameterName] = result.canonicalValue;
    }

    nodeIndex = result.nextIndex;
  }

  return {
    nextIndex: nodeIndex,
    matchedNodes,
    parameters
  };
}

function consumeToken(sequence, startIndex, tokenValue) {
  let index = startIndex;

  while (index < sequence.length) {
    const node = sequence[index];
    const match = matchNode(node, tokenValue);

    if (match.matched) {
      return {
        node,
        canonicalValue: match.canonicalValue,
        option: match.option || null,
        parameterName: match.parameterName || null,
        nextIndex: index + 1
      };
    }

    if (!node.optional) {
      return null;
    }

    index += 1;
  }

  return null;
}

function matchNode(node, tokenValue) {
  const value = tokenValue || '';

  if (node.type === NODE_TYPES.LITERAL) {
    const candidates = [node.value].concat(node.aliases || []);
    const matched = candidates.some(candidate => candidate.toLowerCase() === value.toLowerCase());
    return matched
      ? { matched: true, canonicalValue: node.displayValue || node.value }
      : { matched: false };
  }

  if (node.type === NODE_TYPES.CHOICE) {
    for (const option of node.options) {
      if (option.value.toLowerCase() === value.toLowerCase()) {
        return {
          matched: true,
          canonicalValue: option.displayValue || option.value,
          option
        };
      }
    }
    return { matched: false };
  }

  if (node.type === NODE_TYPES.PARAMETER) {
    if (!node.allowUnknown) {
      const options = resolveNodeOptions(node, { matchedNodes: [], parameters: {} });
      const normalizedValue = value.toLowerCase();
      const found = options.find(option => option.value.toLowerCase() === normalizedValue);
      if (!found) {
        return { matched: false };
      }
    }

    return {
      matched: true,
      canonicalValue: value,
      parameterName: node.collectAs || node.name
    };
  }

  return { matched: false };
}

function resolveNodeOptions(node, context) {
  if (node.type === NODE_TYPES.CHOICE) {
    return node.options;
  }

  if (node.type === NODE_TYPES.PARAMETER) {
    if (Array.isArray(node.options) && node.options.length > 0) {
      return node.options;
    }

    if (node.resolverKey && resolverRegistry[node.resolverKey]) {
      try {
        const result = resolverRegistry[node.resolverKey](context) || [];
        if (Array.isArray(result)) {
          return result.map((option, index) => normalizeOption(option, index));
        }
      } catch (err) {
        // Ignore resolver errors to keep suggestions responsive.
      }
    }

    if (typeof node.resolver === 'function') {
      try {
        const result = node.resolver(context) || [];
        if (Array.isArray(result)) {
          return result.map((option, index) => normalizeOption(option, index));
        }
      } catch (err) {
        // Silently ignore resolver errors for now. Future phases can surface these.
      }
    }
  }

  return [];
}

function getNextNodeWithSuggestions(command, match, context, requestContext) {
  let nodeIndex = match.nextIndex;

  while (nodeIndex < command.sequence.length) {
    const node = command.sequence[nodeIndex];
    const options = resolveNodeOptions(node, {
      command,
      match,
      text: context.text,
      cursorIndex: context.cursorIndex,
      parameters: match.parameters,
      state: requestContext
    });

    const suggestions = buildSuggestionsForNode(command, node, nodeIndex, match, context, options);

    if (suggestions.length > 0) {
      return suggestions;
    }

    if (!node.optional) {
      break;
    }

    nodeIndex += 1;
  }

  return [];
}

function buildSuggestionsForNode(command, node, nodeIndex, match, context, options) {
  const suggestions = [];
  const prefixParts = match.matchedNodes.map(entry => entry.canonicalValue).filter(Boolean);
  const activePrefix = context.activeToken.prefix || '';
  const replacementStart = context.activeToken.start;
  const replacementEnd = context.activeToken.end;
  const hasRemainingNodes = sequenceHasRemainingNodes(command.sequence, nodeIndex);
  const baseKind = nodeIndex === 0 ? 'command' : 'argument';
  const normalizedOptions = getNodeCandidates(node, options);

  normalizedOptions.forEach((option, optionIndex) => {
    const candidateValue = option.insertValue || option.value;
    const candidateDisplay = option.displayValue || option.value;
    const score = computeCandidateScore(activePrefix, candidateValue, nodeIndex);

    if (score === null) {
      return;
    }

    const label = nodeIndex === 0
      ? command.usage
      : [...prefixParts, candidateDisplay].join(' ').trim();

    const shouldAppendSpace = determineAppendSpace(node, hasRemainingNodes);
    const needsSpace = shouldAppendSpace && context.text.slice(replacementEnd, replacementEnd + 1) !== ' ';
    const insertText = candidateValue + (needsSpace ? ' ' : '');
    const nextCursorIndex = replacementStart + insertText.length;
    const description = option.description || node.description || command.description;

    suggestions.push({
      id: `${command.id}:${nodeIndex}:${candidateValue}:${optionIndex}`,
      label,
      description,
      commandId: command.id,
      commandUsage: command.usage,
      category: command.category,
      kind: baseKind,
      nodeType: node.type,
      nodeIndex,
      optionIndex,
      value: candidateValue,
      displayValue: candidateDisplay,
      insertText,
      replacement: {
        start: replacementStart,
        end: replacementEnd
      },
      nextCursorIndex,
      score,
      commandOrder: command.order
    });
  });

  return suggestions;
}

function determineAppendSpace(node, hasRemainingNodes) {
  if (typeof node.appendSpace === 'boolean') {
    return node.appendSpace;
  }

  if (node.type === NODE_TYPES.PARAMETER && node.variadic) {
    return true;
  }

  return hasRemainingNodes;
}

function sequenceHasRemainingNodes(sequence, nodeIndex) {
  for (let index = nodeIndex + 1; index < sequence.length; index++) {
    if (sequence[index]) {
      return true;
    }
  }
  return false;
}

function getNodeCandidates(node, options) {
  if (node.type === NODE_TYPES.LITERAL) {
    return [{
      value: node.insertValue || node.value,
      displayValue: node.displayValue || node.value,
      description: node.description || null,
      insertValue: node.insertValue || node.value,
      index: 0
    }];
  }

  if (node.type === NODE_TYPES.CHOICE || node.type === NODE_TYPES.PARAMETER) {
    return options;
  }

  return [];
}

function computeCandidateScore(prefix, candidate, nodeIndex) {
  const trimmedPrefix = prefix || '';

  if (nodeIndex === 0) {
    return fuzzyScore(trimmedPrefix, candidate);
  }

  if (!trimmedPrefix) {
    return 0;
  }

  const candidateLower = candidate.toLowerCase();
  const prefixLower = trimmedPrefix.toLowerCase();

  if (!candidateLower.startsWith(prefixLower)) {
    return null;
  }

  return candidateLower.length - prefixLower.length;
}

function fuzzyScore(input, command) {
  const needle = (input || '').trim().toLowerCase();
  const haystack = (command || '').toLowerCase();

  if (!needle) {
    return 0;
  }

  let score = 0;
  let lastIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, lastIndex + 1);
    if (index === -1) {
      return null;
    }
    score += index - (lastIndex + 1);
    lastIndex = index;
  }

  score += (haystack.length - needle.length) * 0.01;

  return score;
}

function normalizeRequest(input, limitOverride) {
  if (typeof input === 'string') {
    return {
      text: input,
      cursorIndex: input.length,
      limit: typeof limitOverride === 'number' ? limitOverride : 8,
      context: {}
    };
  }

  const request = input && typeof input === 'object' ? { ...input } : {};
  const text = typeof request.text === 'string' ? request.text : '';
  const cursorIndex = typeof request.cursorIndex === 'number' ? request.cursorIndex : text.length;
  const limit = typeof request.limit === 'number'
    ? request.limit
    : (typeof limitOverride === 'number' ? limitOverride : 8);

  return {
    text,
    cursorIndex,
    limit,
    context: request.context || {}
  };
}

export function getSlashCommandSuggestions(input, limitOverride) {
  const request = normalizeRequest(input, limitOverride);
  const text = request.text || '';
  const trimmed = text.trim();

  if (!trimmed.startsWith('/')) {
    return [];
  }

  const context = buildInputContext(text, request.cursorIndex);
  const requestContext = request.context || {};
  const suggestions = [];

  for (const command of commandRegistry) {
    const match = matchCommand(command, context);
    if (!match) {
      continue;
    }

    const commandSuggestions = getNextNodeWithSuggestions(command, match, context, requestContext);
    suggestions.push(...commandSuggestions);
  }

  suggestions.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }
    if (a.commandOrder !== b.commandOrder) {
      return a.commandOrder - b.commandOrder;
    }
    if (a.nodeIndex !== b.nodeIndex) {
      return a.nodeIndex - b.nodeIndex;
    }
    if (a.optionIndex !== b.optionIndex) {
      return a.optionIndex - b.optionIndex;
    }
    return a.label.localeCompare(b.label);
  });

  return suggestions.slice(0, request.limit);
}

