import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': rootDir,
      'server-only': fileURLToPath(new URL('./test-support/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    include: ['app/**/__tests__/**/*.test.{ts,tsx}'],
  },
})
