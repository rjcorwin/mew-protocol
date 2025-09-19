#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'grant-coordinator';
const logPath = process.env.GRANT_LOG ? path.resolve(process.env.GRANT_LOG) : null;
const fileServerId = process.env.FILE_SERVER_ID || 'file-server';
const agentId = process.env.AGENT_ID || 'grant-agent';

function append(line) {
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${line}\n`);
  } catch (_) {
    // ignore logging errors in tests
  }
}

function send(envelope) {
  process.stdout.write(
    encodeEnvelope({
      protocol: 'mew/v0.3',
      ...envelope,
    }),
  );
}

const pending = new Map();

function forwardProposal(envelope) {
  const { params } = envelope.payload || {};
  if (!params) return;
  const forwardId = `forward-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  pending.set(forwardId, { originalProposalId: envelope.id, agentId: envelope.from });
  append('FORWARD proposal to file-server');
  send({
    id: forwardId,
    kind: 'mcp/request',
    to: [fileServerId],
    payload: {
      method: params.method || 'tools/call',
      params,
    },
  });
}

function grantCapability(agent, correlationId) {
  append('GRANT capability to agent');
  send({
    kind: 'capability/grant',
    to: [agent],
    correlation_id: correlationId ? [correlationId] : undefined,
    payload: {
      recipient: agent,
      capabilities: [
        {
          kind: 'mcp/request',
          payload: {
            method: 'tools/*',
          },
        },
      ],
    },
  });
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'mcp/proposal' && envelope.to?.includes(fileServerId)) {
    append('RECEIVED proposal');
    forwardProposal(envelope);
    return;
  }

  if (envelope.kind === 'mcp/response' && envelope.from === fileServerId) {
    const pendingEntry = pending.get(envelope.correlation_id?.[0] || envelope.correlation_id);
    if (!pendingEntry) {
      return;
    }
    pending.delete(envelope.correlation_id?.[0] || envelope.correlation_id);

    const success = envelope.payload?.success !== false;
    if (success) {
      append('FORWARD_SUCCESS');
      grantCapability(pendingEntry.agentId || agentId, pendingEntry.originalProposalId);
    } else {
      append('FORWARD_FAILED');
    }
    return;
  }
});

process.stdin.on('data', (chunk) => {
  try {
    parser.push(chunk);
  } catch (error) {
    append(`ERROR ${error.message}`);
  }
});

process.stdin.on('close', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
