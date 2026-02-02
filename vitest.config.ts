import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/**',
      '**/e2e/**',
      '**/*.e2e.ts',
      '**/*.e2e.tsx',
      '**/playwright.config.ts'
    ],
    env: {
      VITE_VAPID_PUBLIC_KEY: 'BNGp7pVYOxZYvz9WvLmXJcRWgp6nMdYwqh6z8qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6qR6',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '*.config.ts',
        'src/main.tsx',
        'src/components/ui/**', // Exclude UI components from shadcn
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
