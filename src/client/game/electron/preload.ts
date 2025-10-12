import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('mewElectron', {
  version: process.versions.electron
});
