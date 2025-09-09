import { defineConfig } from 'vite';

export default defineConfig({
  root: './client',
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  },
  build: {
    outDir: '../dist'
  }
});