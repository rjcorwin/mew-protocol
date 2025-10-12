import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { MEWParticipant } from '@mew-protocol/mew/participant';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let participant;
let activeProfile = null;
let movementStreamId;
let worldStreamId;
let participantIdentity = null;
const streamRequests = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

async function connectParticipant(config) {
  disconnectParticipant();

  activeProfile = {
    displayName: config.username?.trim() || config.participantId,
    playerType: 'human',
    speed: config.speed && Number.isFinite(config.speed) ? config.speed : undefined
  };
  participantIdentity = config.participantId;

  participant = new MEWParticipant({
    gateway: config.gateway,
    space: config.space,
    token: config.token,
    participant_id: config.participantId,
    reconnect: true
  });

  participant.on('welcome', () => {
    sendToRenderer('connection-state', { state: 'ready' });
    requestMovementStream();
  });
  participant.on('error', (error) => {
    sendToRenderer('error', { message: error.message || String(error) });
  });
  participant.on('stream/request', (envelope) => handleStreamRequest(envelope));
  participant.on('stream/open', (envelope) => handleStreamOpen(envelope));
  participant.on('stream/close', (envelope) => handleStreamClose(envelope));
  participant.on('stream/data', handleStreamData);

  sendToRenderer('connection-state', { state: 'connecting' });
  try {
    await participant.connect();
  } catch (error) {
    sendToRenderer('error', { message: error.message || String(error) });
    disconnectParticipant();
  }
}

function disconnectParticipant() {
  if (participant) {
    participant.off('stream/data', handleStreamData);
    participant.disconnect();
  }
  participant = null;
  streamRequests.clear();
  movementStreamId = undefined;
  worldStreamId = undefined;
  activeProfile = null;
  participantIdentity = null;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function requestMovementStream() {
  if (!participant) return;
  const requestId = participant.requestStream({
    direction: 'upload',
    description: 'isometric-player-input'
  }, 'gateway');

  streamRequests.set(requestId, {
    description: 'isometric-player-input',
    from: participantIdentity
  });
}

function handleStreamRequest(envelope) {
  streamRequests.set(envelope.id, {
    description: envelope.payload?.description,
    from: envelope.from
  });
}

function handleStreamOpen(envelope) {
  const correlationId = envelope.correlation_id?.[0];
  if (!correlationId) return;

  const meta = streamRequests.get(correlationId);
  if (!meta) return;

  const streamId = envelope.payload?.stream_id;
  if (!streamId) return;

  if (meta.description === 'isometric-player-input' && meta.from === participantIdentity) {
    movementStreamId = streamId;
    sendMovementHandshake();
    return;
  }

  if (meta.description === 'isometric-world-state') {
    worldStreamId = streamId;
    sendToRenderer('connection-state', { state: 'world-stream', streamId });
  }
}

function handleStreamClose(envelope) {
  const streamId = envelope.payload?.stream_id || envelope.correlation_id?.[0];
  if (!streamId) return;

  if (streamId === movementStreamId) {
    movementStreamId = undefined;
    return;
  }

  if (streamId === worldStreamId) {
    worldStreamId = undefined;
  }
}

function handleStreamData(frame) {
  try {
    const payload = JSON.parse(frame.payload);
    if (payload?.type === 'world-state') {
      worldStreamId = worldStreamId || frame.streamId;
      sendToRenderer('world-state', payload);
    }
  } catch (error) {
    // ignore invalid frames
  }
}

function sendMovementHandshake() {
  if (!participant || !movementStreamId) return;
  const payload = {
    type: 'join',
    displayName: activeProfile?.displayName || participantIdentity,
    playerType: activeProfile?.playerType || 'human'
  };
  if (activeProfile?.speed) {
    payload.speed = activeProfile.speed;
  }
  participant.sendStreamData(movementStreamId, JSON.stringify(payload));
}

function sendMovementCommand(command) {
  if (!participant || !movementStreamId) return;
  participant.sendStreamData(movementStreamId, JSON.stringify(command));
}

ipcMain.handle('connect', async (_event, config) => {
  await connectParticipant(config);
});

ipcMain.handle('disconnect', () => {
  disconnectParticipant();
});

ipcMain.on('movement-command', (_event, command) => {
  sendMovementCommand(command);
});

function setupApp() {
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    disconnectParticipant();
  });
}

setupApp();
