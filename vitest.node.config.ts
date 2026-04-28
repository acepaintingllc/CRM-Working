import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default {
  resolve: {
    alias: {
      '@': rootDir,
      'server-only': fileURLToPath(new URL('./test-support/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/*.test.{ts,tsx}'],
    pool: 'threads',
  },
}
