import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Los componentes se escriben con el runtime JSX automático (como en Next.js)
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true,
    environment: 'node',
    // Las pruebas de componentes declaran `// @vitest-environment jsdom`
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
