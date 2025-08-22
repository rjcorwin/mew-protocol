import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // CLI Service
  cli: {
    execute: (command: string, args: string[]) => 
      ipcRenderer.invoke('cli:execute', command, args),
    stream: (command: string, args: string[]) => 
      ipcRenderer.invoke('cli:stream', command, args),
    kill: (processId: string) => 
      ipcRenderer.invoke('cli:kill', processId),
    onStreamData: (callback: (data: any) => void) => {
      ipcRenderer.on('cli:stream:data', (event: IpcRendererEvent, data) => callback(data));
    }
  },

  // File System Service
  fs: {
    readConfig: (path: string) => 
      ipcRenderer.invoke('fs:readConfig', path),
    writeConfig: (path: string, config: any) => 
      ipcRenderer.invoke('fs:writeConfig', path, config),
    readLogs: (component: string, lines: number) => 
      ipcRenderer.invoke('fs:readLogs', component, lines),
    watch: (path: string) => 
      ipcRenderer.invoke('fs:watch', path),
    unwatch: (watchId: string) => 
      ipcRenderer.invoke('fs:unwatch', watchId),
    onWatchChange: (callback: (data: any) => void) => {
      ipcRenderer.on('fs:watch:change', (event: IpcRendererEvent, data) => callback(data));
    }
  },

  // Process Manager
  process: {
    list: () => 
      ipcRenderer.invoke('process:list'),
    status: (id: string) => 
      ipcRenderer.invoke('process:status', id)
  },

  // System
  system: {
    status: () => 
      ipcRenderer.invoke('system:status'),
    start: () =>
      ipcRenderer.invoke('system:start'),
    stop: () =>
      ipcRenderer.invoke('system:stop')
  },

  // Agent Management
  agent: {
    list: () => 
      ipcRenderer.invoke('agent:list'),
    create: (name: string, template: string, options?: any) => 
      ipcRenderer.invoke('agent:create', name, template, options),
    start: (name: string) => 
      ipcRenderer.invoke('agent:start', name),
    stop: (name: string) => 
      ipcRenderer.invoke('agent:stop', name)
  },

  // Utility
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for TypeScript
export interface ElectronAPI {
  cli: {
    execute: (command: string, args: string[]) => Promise<any>;
    stream: (command: string, args: string[]) => Promise<string>;
    kill: (processId: string) => Promise<void>;
    onStreamData: (callback: (data: any) => void) => void;
  };
  fs: {
    readConfig: (path: string) => Promise<any>;
    writeConfig: (path: string, config: any) => Promise<void>;
    readLogs: (component: string, lines: number) => Promise<string[]>;
    watch: (path: string) => Promise<string>;
    unwatch: (watchId: string) => Promise<void>;
    onWatchChange: (callback: (data: any) => void) => void;
  };
  process: {
    list: () => Promise<any[]>;
    status: (id: string) => Promise<any>;
  };
  system: {
    status: () => Promise<any>;
    start: () => Promise<any>;
    stop: () => Promise<any>;
  };
  agent: {
    list: () => Promise<any[]>;
    create: (name: string, template: string, options?: any) => Promise<any>;
    start: (name: string) => Promise<any>;
    stop: (name: string) => Promise<any>;
  };
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}