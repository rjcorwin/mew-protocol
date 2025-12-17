#!/usr/bin/env node
/**
 * Interactive Test Participant for Scenario 18 - Targeted Stream Delivery [t5d]
 *
 * This participant connects to the MEW space via WebSocket and responds to
 * test commands sent via chat messages. It tracks received stream frames to
 * validate targeted delivery behavior.
 *
 * Usage:
 *   node test-participant.js <participant-id> <token> <port>
 *
 * Commands (sent as chat messages):
 *   - cmd:<participant>:report-streams
 *       → Reports all active streams and their targets
 *   - cmd:<participant>:create-targeted-stream:<target>:<description>
 *       → Creates a new upload stream targeted to specific participant
 *   - cmd:<participant>:create-broadcast-stream:<description>
 *       → Creates a broadcast stream (no target)
 *   - cmd:<participant>:publish-frame:<stream_id>:<data>
 *       → Publishes a frame to a stream
 *   - cmd:<participant>:report-received-frames
 *       → Reports all received stream frames
 *   - cmd:<participant>:clear-received-frames
 *       → Clears received frames list
 */

import WebSocket from 'ws';

const [participantId, token, port = '8080'] = process.argv.slice(2);

if (!participantId || !token) {
  console.error('Usage: test-participant.js <participant-id> <token> [port]');
  process.exit(1);
}

const wsUrl = `ws://localhost:${port}`;

// State tracking
const state = {
  myId: participantId,
  participants: new Map(),
  activeStreams: new Map(),
  receivedFrames: [], // Track all received stream frames
  myCapabilities: []
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

    const joinMessage = {
      type: 'join',
      space: 'scenario-18-targeted-streams',
      token: token,
      participantId: participantId,
      capabilities: []
    };

    ws.send(JSON.stringify(joinMessage));
    console.log(`[${participantId}] Join message sent`);
  });

  ws.on('message', (data) => {
    const dataStr = data.toString();

    // Check if this is a raw stream frame (format: #streamID#data)
    if (dataStr.startsWith('#')) {
      const secondHash = dataStr.indexOf('#', 1);
      if (secondHash > 0) {
        const streamId = dataStr.substring(1, secondHash);
        const frameData = dataStr.substring(secondHash + 1);

        // Record the received frame
        state.receivedFrames.push({
          stream_id: streamId,
          data: frameData,
          received_at: new Date().toISOString()
        });

        console.log(`[${participantId}] Received stream frame: ${streamId} -> ${frameData}`);
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
        target: payload.target,
        encoding: payload.encoding
      });
      console.log(`[${participantId}] Stream opened: ${payload.stream_id}, owner: ${payload.owner}, target: ${JSON.stringify(payload.target)}`);
      break;

    case 'stream/close':
      if (payload.stream_id) {
        state.activeStreams.delete(payload.stream_id);
        console.log(`[${participantId}] Stream closed: ${payload.stream_id}`);
      }
      break;

    case 'system/error':
      console.log(`[${participantId}] Error: ${payload.error} - ${payload.message}`);
      break;

    case 'chat':
      if (payload.text && payload.text.startsWith('cmd:')) {
        handleCommand(payload.text, from);
      }
      break;

    case 'system/presence':
      if (payload.event === 'join') {
        state.participants.set(payload.participant?.id, payload.participant);
      } else if (payload.event === 'leave') {
        state.participants.delete(payload.participant?.id);
      }
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

      case 'create-targeted-stream':
        createTargetedStream(parts[2], parts[3] || 'Targeted stream');
        break;

      case 'create-broadcast-stream':
        createBroadcastStream(parts[2] || 'Broadcast stream');
        break;

      case 'create-malicious-stream':
        // Security test: try to inject authorizedWriters and participantId
        createMaliciousStream(parts[2], parts[3] || 'Malicious stream');
        break;

      case 'publish-frame':
        publishFrame(parts[2], parts[3]);
        break;

      case 'report-received-frames':
        reportReceivedFrames();
        break;

      case 'clear-received-frames':
        clearReceivedFrames();
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
    authorized_writers: s.authorized_writers || [],
    target: s.target || null
  }));

  sendResponse('report-streams', { streams });
}

function createTargetedStream(target, description) {
  const msgId = `stream-req-${Date.now()}`;
  sendMessage({
    id: msgId,
    kind: 'stream/request',
    to: ['gateway'],
    payload: {
      direction: 'upload',
      target: [target], // Single target as array
      description
    }
  });
}

function createBroadcastStream(description) {
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

function createMaliciousStream(fakeAuthorizedWriter, description) {
  // SECURITY TEST: Attempt to inject malicious payload fields
  // A secure gateway should ignore these and use server-determined values
  const msgId = `stream-req-${Date.now()}`;
  sendMessage({
    id: msgId,
    kind: 'stream/request',
    to: ['gateway'],
    payload: {
      direction: 'upload',
      description,
      // Malicious fields - server should ignore these:
      participantId: 'attacker',
      authorizedWriters: [fakeAuthorizedWriter, 'attacker'],
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

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    sendResponse('publish-frame-result', {
      stream_id: streamId,
      success: false,
      error: 'WebSocket not connected'
    });
    return;
  }

  // Send frame via WebSocket (stream frames use raw format: #streamID#data)
  const frameData = `#${streamId}#${data}`;

  try {
    ws.send(frameData);
    // Report success immediately (frame was sent)
    sendResponse('publish-frame-result', {
      stream_id: streamId,
      success: true,
      data
    });
  } catch (err) {
    sendResponse('publish-frame-result', {
      stream_id: streamId,
      success: false,
      error: err.message
    });
  }
}

function reportReceivedFrames() {
  sendResponse('report-received-frames', {
    frame_count: state.receivedFrames.length,
    frames: state.receivedFrames
  });
}

function clearReceivedFrames() {
  state.receivedFrames = [];
  sendResponse('clear-received-frames', { success: true });
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
