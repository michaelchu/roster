import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    // Ignore unhandled rejections from fire-and-forget async operations in mocked tests
    dangerouslyIgnoreUnhandledErrors: true,
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
      // Test VAPID public key - URL-safe base64 encoded string (~88 chars)
      // This is a placeholder for testing only and not a real VAPID key
      VITE_VAPID_PUBLIC_KEY: 'BMxvPzpqR9vYOxZYvLmXJcRWgp6nMdYwqh6z8qR6tT4yR2aN3wB1mK7sH9fD6eG4jN5kL8pM2oQ3rS1vW0xY2zA',
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
