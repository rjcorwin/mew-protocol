import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { INDEX_HTML_TEMPLATE } from './indexHtml.js';

let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  const preloadPath = fileURLToPath(new URL('./preload.js', import.meta.url));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b132b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  const rendererUrl = new URL('./renderer.js', import.meta.url).toString();
  const html = INDEX_HTML_TEMPLATE.replace('__RENDERER_URL__', rendererUrl);
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

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
