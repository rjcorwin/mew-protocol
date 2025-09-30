import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.config.ts',
        '**/*.d.ts',
        'tests/**',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});