import fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface FileChange {
  type: 'change' | 'rename';
  path: string;
  timestamp: Date;
}

export class FileSystemService {
  private watchers: Map<string, FSWatcher> = new Map();
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.mcpx');
  }

  async readConfig(configPath: string): Promise<any> {
    try {
      const fullPath = path.isAbsolute(configPath) 
        ? configPath 
        : path.join(this.baseDir, configPath);
      
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to read config from ${configPath}:`, error);
      throw error;
    }
  }

  async writeConfig(configPath: string, config: any): Promise<void> {
    try {
      const fullPath = path.isAbsolute(configPath) 
        ? configPath 
        : path.join(this.baseDir, configPath);
      
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(`Failed to write config to ${configPath}:`, error);
      throw error;
    }
  }

  async readLogs(component: string, lines: number = 100): Promise<string[]> {
    try {
      const logPath = path.join(this.baseDir, 'logs', `${component}.log`);
      const content = await fs.readFile(logPath, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines);
    } catch (error) {
      console.error(`Failed to read logs for ${component}:`, error);
      return [];
    }
  }

  async watch(
    watchPath: string, 
    onChange: (change: FileChange) => void
  ): Promise<string> {
    const id = uuidv4();
    const fullPath = path.isAbsolute(watchPath) 
      ? watchPath 
      : path.join(this.baseDir, watchPath);

    const watcher = watch(fullPath, (eventType, filename) => {
      onChange({
        type: eventType as 'change' | 'rename',
        path: filename ? path.join(fullPath, filename) : fullPath,
        timestamp: new Date()
      });
    });

    this.watchers.set(id, watcher);
    return id;
  }

  unwatch(watchId: string): void {
    const watcher = this.watchers.get(watchId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watchId);
    }
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const fullPath = path.isAbsolute(dirPath) 
        ? dirPath 
        : path.join(this.baseDir, dirPath);
      
      return await fs.readdir(fullPath);
    } catch (error) {
      console.error(`Failed to list directory ${dirPath}:`, error);
      return [];
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(this.baseDir, filePath);
      
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  cleanup(): void {
    this.watchers.forEach((watcher) => {
      watcher.close();
    });
    this.watchers.clear();
  }
}