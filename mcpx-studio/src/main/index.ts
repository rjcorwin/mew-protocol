import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { setupIPC } from './ipc';
import { CLIService } from './services/cli-service';
import { APIService } from './services/api-service';
import { FileSystemService } from './services/filesystem-service';
import { ProcessManager } from './services/process-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // Ignore in dev mode
}

let mainWindow: BrowserWindow | null = null;
let cliService: CLIService;
let apiService: APIService;
let fileSystemService: FileSystemService;
let processManager: ProcessManager;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: path.join(__dirname, '../../public/icon.png')
  });

  // Load the app - in dev mode, use the Vite dev server
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Initialize services
const initializeServices = () => {
  cliService = new CLIService();
  apiService = new APIService();
  fileSystemService = new FileSystemService();
  processManager = new ProcessManager();

  // Setup IPC handlers
  setupIPC(ipcMain, {
    cliService,
    apiService,
    fileSystemService,
    processManager
  });
  
  // Check if backend is running
  apiService.checkHealth().then(isHealthy => {
    if (!isHealthy) {
      console.warn('MCPx Studio Backend is not running. Please run: npx mcpx studio-server');
    } else {
      console.log('Connected to MCPx Studio Backend');
    }
  });
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  initializeServices();
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    // Cleanup processes before quitting
    processManager.cleanup().then(() => {
      app.quit();
    });
  }
});

// Cleanup on app quit
app.on('before-quit', async (event) => {
  event.preventDefault();
  await processManager.cleanup();
  app.exit(0);
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Prevent certificate errors in development
  if (process.env.NODE_ENV === 'development') {
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});