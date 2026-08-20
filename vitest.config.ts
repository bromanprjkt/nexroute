import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Batasi test hanya pada workspace NexRoute (apps/* dan packages/*).
    include: [
      'apps/**/*.{test,spec}.{ts,tsx}',
      'packages/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
