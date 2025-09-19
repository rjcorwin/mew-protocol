#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { FrameParser, encodeEnvelope } = require('../../cli/src/stdio/utils');

const participantId = process.env.MEW_PARTICIPANT_ID || 'grant-agent';
const logPath = process.env.DRIVER_LOG ? path.resolve(process.env.DRIVER_LOG) : null;
const fileServerId = process.env.FILE_SERVER_ID || 'file-server';
const coordinatorId = process.env.COORDINATOR_ID || 'grant-coordinator';

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

let proposalId = null;
let directRequestId = null;
let receivedGrant = false;

function sendProposal() {
  proposalId = `proposal-${Date.now()}`;
  append('SEND proposal foo.txt');
  send({
    id: proposalId,
    kind: 'mcp/proposal',
    to: [fileServerId],
    payload: {
      method: 'tools/call',
      params: {
        name: 'write_file',
        arguments: {
          path: 'foo.txt',
          content: 'foo',
        },
      },
    },
  });
}

function sendDirectRequest() {
  if (directRequestId) return;
  directRequestId = `request-${Date.now()}`;
  append('SEND direct bar.txt');
  send({
    id: directRequestId,
    kind: 'mcp/request',
    to: [fileServerId],
    payload: {
      method: 'tools/call',
      params: {
        name: 'write_file',
        arguments: {
          path: 'bar.txt',
          content: 'bar',
        },
      },
    },
  });
}

const parser = new FrameParser((envelope) => {
  if (envelope.kind === 'system/welcome') {
    append('WELCOME');
    setTimeout(sendProposal, 250);
    return;
  }

  if (envelope.kind === 'capability/grant' && envelope.from === coordinatorId) {
    receivedGrant = true;
    append('RECEIVED grant');
    setTimeout(sendDirectRequest, 250);
    return;
  }

  if (envelope.kind === 'mcp/response' && envelope.from === fileServerId) {
    if (envelope.correlation_id?.includes(directRequestId)) {
      const success = envelope.payload?.success !== false;
      if (success) {
        append('OK direct-request');
        append('DONE');
        setTimeout(() => process.exit(0), 250);
      } else {
        append('FAIL direct-request');
        append(`DEBUG ${JSON.stringify(envelope.payload)}`);
        process.exit(1);
      }
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

process.stdin.on('close', () => process.exit(receivedGrant ? 0 : 1));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
