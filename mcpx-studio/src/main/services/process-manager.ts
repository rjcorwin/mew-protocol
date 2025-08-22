import { ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessInfo {
  id: string;
  command: string;
  pid?: number;
  status: 'running' | 'stopped' | 'error';
  startTime: Date;
  exitCode?: number;
}

export class ProcessManager {
  private processes: Map<string, ProcessInfo> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();

  register(command: string, process: ChildProcess): string {
    const id = uuidv4();
    
    const info: ProcessInfo = {
      id,
      command,
      pid: process.pid,
      status: 'running',
      startTime: new Date()
    };

    this.processes.set(id, info);
    this.childProcesses.set(id, process);

    // Handle process exit
    process.on('exit', (code) => {
      const processInfo = this.processes.get(id);
      if (processInfo) {
        processInfo.status = code === 0 ? 'stopped' : 'error';
        processInfo.exitCode = code || undefined;
      }
      this.childProcesses.delete(id);
    });

    process.on('error', () => {
      const processInfo = this.processes.get(id);
      if (processInfo) {
        processInfo.status = 'error';
      }
      this.childProcesses.delete(id);
    });

    return id;
  }

  getStatus(id: string): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  list(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  kill(id: string): boolean {
    const process = this.childProcesses.get(id);
    if (process) {
      process.kill('SIGTERM');
      this.childProcesses.delete(id);
      
      const info = this.processes.get(id);
      if (info) {
        info.status = 'stopped';
      }
      return true;
    }
    return false;
  }

  async cleanup(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    this.childProcesses.forEach((process, id) => {
      promises.push(new Promise((resolve) => {
        process.on('exit', () => resolve());
        process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (process.killed === false) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      }));
    });

    await Promise.all(promises);
    this.childProcesses.clear();
    this.processes.clear();
  }
}