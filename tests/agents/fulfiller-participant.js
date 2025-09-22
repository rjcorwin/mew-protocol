#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'fulfiller-agent';
const logPath = process.env.FULFILLER_LOG || './fulfiller.log';
fs.mkdirSync(path.dirname(logPath), { recursive: true });

function append(line) {
  fs.appendFileSync(logPath, `${line}\n`);
}

const pending = new Map(); // correlationId -> { proposer, requestName }

function send(envelope) {
  process.stdout.write(encodeEnvelope({ protocol: 'mew/v0.3', ...envelope }));
}

function sendMcpRequest(method, params, proposer) {
  const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  pending.set(id, { proposer, method });
  send({
    id,
    kind: 'mcp/request',
    to: ['calculator-agent'],
    payload: {
      method,
      params,
    },
  });
}

function handleProposal(envelope) {
  const proposer = envelope.from;
  const method = envelope.payload?.method;
  const params = envelope.payload?.params || {};

  append(`PROPOSAL ${proposer} ${method}`);

  if (method !== 'tools/call') {
    sendError(proposer, `Unsupported proposal method: ${method}`);
    return;
  }

  const toolName = params.name;
  const argumentsObj = params.arguments || {};
  sendMcpRequest('tools/call', { name: toolName, arguments: argumentsObj }, proposer);
}

function handleMcpResponse(envelope) {
  const correlation = Array.isArray(envelope.correlation_id)
    ? envelope.correlation_id[0]
    : envelope.correlation_id;
  if (!correlation) {
    return;
  }
  const pendingRequest = pending.get(correlation);
  if (!pendingRequest) {
    return;
  }
  pending.delete(correlation);

  const { proposer } = pendingRequest;
  const payload = envelope.payload || {};

  if (payload.success === false) {
    const message = payload.error || 'Unknown error';
    sendError(proposer, message);
    return;
  }

  const result = payload.result;
  const text = typeof result === 'string' ? result : String(result);
  append(`RESULT ${proposer} ${text}`);
  send({
    kind: 'chat',
    to: [proposer],
    payload: {
      text,
      format: 'plain',
    },
  });
}

function sendError(proposer, message) {
  append(`ERROR ${proposer} ${message}`);
  send({
    kind: 'chat',
    to: [proposer],
    payload: {
      text: `Error fulfilling proposal: ${message}`,
      format: 'plain',
    },
  });
}

const parser = new FrameParser((envelope) => {
  append(`RECV ${envelope.kind || 'unknown'} from ${envelope.from || 'unknown'}`);
  if (envelope.kind === 'mcp/proposal') {
    handleProposal(envelope);
    return;
  }

  if (envelope.kind === 'mcp/response' && envelope.from === 'calculator-agent') {
    handleMcpResponse(envelope);
  }
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    append(`PARSE_ERROR ${error.message}`);
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
