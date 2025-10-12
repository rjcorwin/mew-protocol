import { contextBridge, ipcRenderer } from 'electron';

function subscribe(channel, callback) {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('mewBridge', {
  connect: (config) => ipcRenderer.invoke('connect', config),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  sendMove: (command) => ipcRenderer.send('movement-command', command),
  onWorldState: (callback) => subscribe('world-state', callback),
  onConnectionState: (callback) => subscribe('connection-state', callback),
  onError: (callback) => subscribe('error', callback)
});
