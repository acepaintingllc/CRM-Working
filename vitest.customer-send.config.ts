import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

const config = {
  resolve: {
    alias: {
      '@': rootDir,
      'server-only': fileURLToPath(new URL('./test-support/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    include: ['lib/server/customer-send/__tests__/**/*.test.{ts,tsx}'],
    pool: 'threads',
  },
}

export default config
