import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/mew': 'src/cli/index.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  bundle: true,
  shims: false, // Don't need shims since we're using native ESM
  banner: {
    js: '#!/usr/bin/env node',
  },
  minify: false,
  sourcemap: true,
  // Don't bundle dependencies - let Node.js resolve them from node_modules
  noExternal: [],
  // Clean output directory before build
  clean: false, // Let tsc handle cleaning dist/
});