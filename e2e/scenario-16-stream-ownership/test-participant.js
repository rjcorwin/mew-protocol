#!/usr/bin/env node
/**
 * Interactive Test Participant for Scenario 16
 *
 * This participant connects to the MEW space via WebSocket and responds to
 * test commands sent via chat messages. It maintains state about streams
 * and can report what it observes, enabling the test to validate internal
 * state that isn't visible in envelope logs alone.
 *
 * Usage:
 *   node test-participant.js <participant-id> <token> <port>
 *
 * Commands (sent as chat messages):
 *   - cmd:report-streams
 *       → Reports all active streams and their authorized_writers
 *   - cmd:create-stream:<description>
 *       → Creates a new upload stream with given description
 *   - cmd:publish-frame:<stream_id>:<data>
 *       → Attempts to publish a frame, reports success/failure
 *   - cmd:grant-write:<stream_id>:<participant_id>:<reason>
 *       → Sends grant-write message
 *   - cmd:revoke-write:<stream_id>:<participant_id>:<reason>
 *       → Sends revoke-write message
 *   - cmd:transfer-ownership:<stream_id>:<new_owner>:<reason>
 *       → Sends transfer-ownership message
 */

import WebSocket from 'ws';
import http from 'http';

const [participantId, token, port = '8080'] = process.argv.slice(2);

if (!participantId || !token) {
  console.error('Usage: test-participant.js <participant-id> <token> [port]');
  process.exit(1);
}

const wsUrl = `ws://localhost:${port}`;
const httpUrl = `http://localhost:${port}/participants/${participantId}/messages`;

// State tracking
const state = {
  myId: participantId,
  participants: new Map(),
  activeStreams: new Map(),
  myCapabilities: [],
  pendingFramePublishes: new Map() // Map of frameData -> {streamId, authorized, timeout}
};

let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function connect() {
  console.log(`[${participantId}] Connecting to ${wsUrl}...`);

  ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  ws.on('open', () => {
    console.log(`[${participantId}] WebSocket connected, sending join...`);
    reconnectAttempts = 0;

    // Send join message (non-protocol message used for WebSocket handshake)
    const joinMessage = {
      type: 'join',
      space: 'scenario-16-stream-ownership',  // Match the space name
      token: token,
      participantId: participantId,
      capabilities: []
    };

    ws.send(JSON.stringify(joinMessage));
    console.log(`[${participantId}] Join message sent`);
  });

  ws.on('message', (data) => {
    const dataStr = data.toString();

    // Check if this is a raw stream frame
    if (dataStr.startsWith('#')) {
      // Check if we're waiting for this frame
      if (state.pendingFramePublishes.has(dataStr)) {
        const pending = state.pendingFramePublishes.get(dataStr);
        clearTimeout(pending.timeout);
        sendResponse('publish-frame-result', {
          stream_id: pending.streamId,
          success: true,
          authorized: pending.authorized
        });
        state.pendingFramePublishes.delete(dataStr);
      }
      return;
    }

    try {
      const envelope = JSON.parse(dataStr);
      console.log(`[${participantId}] Received:`, envelope.kind, envelope.from);
      handleMessage(envelope);
    } catch (err) {
      console.error(`[${participantId}] Error parsing message:`, err);
    }
  });

  ws.on('error', (err) => {
    console.error(`[${participantId}] WebSocket error:`, err.message);
  });

  ws.on('close', () => {
    console.log(`[${participantId}] Disconnected`);

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`[${participantId}] Reconnecting (attempt ${reconnectAttempts})...`);
      setTimeout(connect, 1000);
    } else {
      console.error(`[${participantId}] Max reconnect attempts reached, exiting`);
      process.exit(1);
    }
  });
}

function handleMessage(envelope) {
  const { kind, from, payload } = envelope;

  // Update state based on message type
  switch (kind) {
    case 'system/welcome':
      state.myCapabilities = payload.you?.capabilities || [];
      state.participants = new Map(
        (payload.participants || []).map(p => [p.id, p])
      );
      state.activeStreams = new Map(
        (payload.active_streams || []).map(s => [s.stream_id, s])
      );
      console.log(`[${participantId}] Welcome received. Active streams:`,
        Array.from(state.activeStreams.keys()));
      break;

    case 'stream/open':
      state.activeStreams.set(payload.stream_id, {
        stream_id: payload.stream_id,
        owner: payload.owner,
        authorized_writers: payload.authorized_writers || [payload.owner],
        encoding: payload.encoding
      });
      console.log(`[${participantId}] Stream opened: ${payload.stream_id}, owner: ${payload.owner}`);
      break;

    case 'stream/write-granted':
      const grantStream = state.activeStreams.get(payload.stream_id);
      if (grantStream) {
        grantStream.authorized_writers = payload.authorized_writers;
        console.log(`[${participantId}] Write granted on ${payload.stream_id} to ${payload.participant_id}`);
      }
      break;

    case 'stream/write-revoked':
      const revokeStream = state.activeStreams.get(payload.stream_id);
      if (revokeStream) {
        revokeStream.authorized_writers = payload.authorized_writers;
        console.log(`[${participantId}] Write revoked on ${payload.stream_id} from ${payload.participant_id}`);
      }
      break;

    case 'stream/ownership-transferred':
      const transferStream = state.activeStreams.get(payload.stream_id);
      if (transferStream) {
        transferStream.owner = payload.new_owner;
        transferStream.authorized_writers = payload.authorized_writers;
        console.log(`[${participantId}] Ownership transferred on ${payload.stream_id}: ${payload.previous_owner} → ${payload.new_owner}`);
      }
      break;

    case 'system/error':
      // Check if this is an unauthorized frame publish error
      if (payload.error === 'unauthorized_stream_write') {
        // Find and complete any pending frame publish for this stream
        for (const [frameData, pending] of state.pendingFramePublishes) {
          if (pending.streamId === payload.stream_id) {
            clearTimeout(pending.timeout);
            sendResponse('publish-frame-result', {
              stream_id: pending.streamId,
              success: false,
              authorized: pending.authorized,
              error: payload.message
            });
            state.pendingFramePublishes.delete(frameData);
            break;
          }
        }
      }
      break;

    case 'chat':
      if (payload.text && payload.text.startsWith('cmd:')) {
        handleCommand(payload.text, from);
      }
      break;

    case 'participant/joined':
      state.participants.set(payload.participant_id, payload);
      break;

    case 'participant/left':
      state.participants.delete(payload.participant_id);
      break;
  }
}

function handleCommand(commandText, from) {
  const parts = commandText.slice(4).split(':'); // Remove 'cmd:' prefix
  const targetParticipant = parts[0];

  // Ignore commands not addressed to this participant
  if (targetParticipant !== participantId) {
    return;
  }

  const command = parts[1];
  console.log(`[${participantId}] Received command: ${command} from ${from}`);

  try {
    switch (command) {
      case 'report-streams':
        reportStreams();
        break;

      case 'create-stream':
        createStream(parts[2] || 'Test stream');
        break;

      case 'publish-frame':
        publishFrame(parts[2], parts[3]);
        break;

      case 'grant-write':
        grantWrite(parts[2], parts[3], parts[4]);
        break;

      case 'revoke-write':
        revokeWrite(parts[2], parts[3], parts[4]);
        break;

      case 'transfer-ownership':
        transferOwnership(parts[2], parts[3], parts[4]);
        break;

      default:
        sendResponse(`unknown-command`, { command });
    }
  } catch (err) {
    console.error(`[${participantId}] Error handling command:`, err);
    sendResponse('command-error', { command, error: err.message });
  }
}

function reportStreams() {
  const streams = Array.from(state.activeStreams.values()).map(s => ({
    stream_id: s.stream_id,
    owner: s.owner,
    authorized_writers: s.authorized_writers || []
  }));

  sendResponse('report-streams', { streams });
}

function createStream(description) {
  const msgId = `stream-req-${Date.now()}`;
  sendMessage({
    id: msgId,
    kind: 'stream/request',
    to: ['gateway'],
    payload: {
      direction: 'upload',
      description
    }
  });
}

function publishFrame(streamId, data) {
  if (!streamId || !data) {
    sendResponse('publish-frame-error', {
      error: 'Missing stream_id or data',
      stream_id: streamId
    });
    return;
  }

  const stream = state.activeStreams.get(streamId);
  const authorized = stream?.authorized_writers?.includes(participantId);

  // Send frame via WebSocket (stream frames use raw format: #streamID#data)
  const frameData = `#${streamId}#${data}`;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    sendResponse('publish-frame-result', {
      stream_id: streamId,
      success: false,
      authorized,
      error: 'WebSocket not connected'
    });
    return;
  }

  // Set up timeout for response
  const timeout = setTimeout(() => {
    // If no response after 2 seconds, report as failed
    if (state.pendingFramePublishes.has(frameData)) {
      state.pendingFramePublishes.delete(frameData);
      sendResponse('publish-frame-result', {
        stream_id: streamId,
        success: false,
        authorized,
        error: 'Gateway did not confirm frame delivery'
      });
    }
  }, 2000);

  // Track this pending publish
  state.pendingFramePublishes.set(frameData, {
    streamId,
    authorized,
    timeout
  });

  // Send the frame
  try {
    ws.send(frameData);
  } catch (err) {
    clearTimeout(timeout);
    state.pendingFramePublishes.delete(frameData);
    sendResponse('publish-frame-result', {
      stream_id: streamId,
      success: false,
      authorized,
      error: err.message
    });
  }
}

function grantWrite(streamId, participantToGrant, reason = '') {
  const msgId = `grant-${Date.now()}`;
  sendMessage({
    id: msgId,
    kind: 'stream/grant-write',
    payload: {
      stream_id: streamId,
      participant_id: participantToGrant,
      reason
    }
  });
}

function revokeWrite(streamId, participantToRevoke, reason = '') {
  const msgId = `revoke-${Date.now()}`;
  sendMessage({
    id: msgId,
    kind: 'stream/revoke-write',
    payload: {
      stream_id: streamId,
      participant_id: participantToRevoke,
      reason
    }
  });
}

function transferOwnership(streamId, newOwner, reason = '') {
  const msgId = `transfer-${Date.now()}`;
  sendMessage({
    id: msgId,
    kind: 'stream/transfer-ownership',
    payload: {
      stream_id: streamId,
      new_owner: newOwner,
      reason
    }
  });
}

function sendMessage(envelope) {
  const fullEnvelope = {
    protocol: 'mew/v0.4',
    ts: new Date().toISOString(),
    from: participantId,
    ...envelope
  };

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(fullEnvelope));
  } else {
    console.error(`[${participantId}] Cannot send message: WebSocket not open`);
  }
}

function sendResponse(responseType, data) {
  sendMessage({
    id: `response-${Date.now()}`,
    kind: 'chat',
    payload: {
      text: `response:${responseType}`,
      data,
      format: 'plain'
    }
  });
}

// Handle process signals
process.on('SIGINT', () => {
  console.log(`[${participantId}] Shutting down...`);
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`[${participantId}] Shutting down...`);
  if (ws) {
    ws.close();
  }
  process.exit(0);
});

// Start connection
connect();
