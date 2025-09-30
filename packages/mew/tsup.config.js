import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'bin/mew': 'src/cli/index.js',
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
  // Don't bundle Node.js built-ins
  external: [],
  // Clean output directory before build
  clean: false, // Let tsc handle cleaning dist/
});