import { IpcMain, IpcMainInvokeEvent } from 'electron';
import { CLIService } from './services/cli-service';
import { APIService } from './services/api-service';
import { FileSystemService } from './services/filesystem-service';
import { ProcessManager } from './services/process-manager';

interface Services {
  cliService: CLIService;
  apiService: APIService;
  fileSystemService: FileSystemService;
  processManager: ProcessManager;
}

export function setupIPC(ipcMain: IpcMain, services: Services) {
  // CLI Service handlers
  ipcMain.handle('cli:execute', async (event: IpcMainInvokeEvent, command: string, args: string[]) => {
    try {
      return await services.cliService.execute(command, args);
    } catch (error) {
      console.error('CLI execute error:', error);
      throw error;
    }
  });

  ipcMain.handle('cli:stream', async (event: IpcMainInvokeEvent, command: string, args: string[]) => {
    try {
      const streamId = await services.cliService.stream(command, args, (data) => {
        event.sender.send('cli:stream:data', { streamId, data });
      });
      return streamId;
    } catch (error) {
      console.error('CLI stream error:', error);
      throw error;
    }
  });

  ipcMain.handle('cli:kill', async (event: IpcMainInvokeEvent, processId: string) => {
    try {
      await services.cliService.kill(processId);
    } catch (error) {
      console.error('CLI kill error:', error);
      throw error;
    }
  });

  // File System Service handlers
  ipcMain.handle('fs:readConfig', async (event: IpcMainInvokeEvent, path: string) => {
    try {
      return await services.fileSystemService.readConfig(path);
    } catch (error) {
      console.error('FS read config error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:writeConfig', async (event: IpcMainInvokeEvent, path: string, config: any) => {
    try {
      await services.fileSystemService.writeConfig(path, config);
    } catch (error) {
      console.error('FS write config error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:readLogs', async (event: IpcMainInvokeEvent, component: string, lines: number) => {
    try {
      return await services.fileSystemService.readLogs(component, lines);
    } catch (error) {
      console.error('FS read logs error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:watch', async (event: IpcMainInvokeEvent, path: string) => {
    try {
      const watchId = await services.fileSystemService.watch(path, (change) => {
        event.sender.send('fs:watch:change', { watchId, change });
      });
      return watchId;
    } catch (error) {
      console.error('FS watch error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:unwatch', async (event: IpcMainInvokeEvent, watchId: string) => {
    try {
      services.fileSystemService.unwatch(watchId);
    } catch (error) {
      console.error('FS unwatch error:', error);
      throw error;
    }
  });

  // Process Manager handlers
  ipcMain.handle('process:list', async () => {
    try {
      return services.processManager.list();
    } catch (error) {
      console.error('Process list error:', error);
      throw error;
    }
  });

  ipcMain.handle('process:status', async (event: IpcMainInvokeEvent, id: string) => {
    try {
      return services.processManager.getStatus(id);
    } catch (error) {
      console.error('Process status error:', error);
      throw error;
    }
  });

  // System status
  ipcMain.handle('system:status', async () => {
    try {
      const result = await services.apiService.getStatus();
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get status');
      }
    } catch (error) {
      console.error('System status error:', error);
      throw error;
    }
  });

  // System start
  ipcMain.handle('system:start', async () => {
    try {
      const result = await services.apiService.startSystem();
      return result;
    } catch (error) {
      console.error('System start error:', error);
      throw error;
    }
  });

  // System stop
  ipcMain.handle('system:stop', async () => {
    try {
      const result = await services.apiService.stopSystem();
      return result;
    } catch (error) {
      console.error('System stop error:', error);
      throw error;
    }
  });

  // Agent management
  ipcMain.handle('agent:list', async () => {
    try {
      const result = await services.apiService.getAgents();
      if (result.success) {
        return result.data || [];
      } else {
        console.error('Agent list error:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Agent list error:', error);
      return [];
    }
  });

  ipcMain.handle('agent:create', async (event: IpcMainInvokeEvent, name: string, template: string, options: any) => {
    try {
      const result = await services.apiService.createAgent(name, template, options);
      return result;
    } catch (error) {
      console.error('Agent create error:', error);
      throw error;
    }
  });

  ipcMain.handle('agent:start', async (event: IpcMainInvokeEvent, name: string) => {
    try {
      return await services.apiService.startAgent(name);
    } catch (error) {
      console.error('Agent start error:', error);
      throw error;
    }
  });

  ipcMain.handle('agent:stop', async (event: IpcMainInvokeEvent, name: string) => {
    try {
      return await services.apiService.stopAgent(name);
    } catch (error) {
      console.error('Agent stop error:', error);
      throw error;
    }
  });
}