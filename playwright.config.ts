import { defineConfig, devices } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

for (const fileName of ['.env.local', '.env']) {
  if (!existsSync(fileName)) continue
  for (const line of readFileSync(fileName, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalsAt = trimmed.indexOf('=')
    if (equalsAt === -1) continue
    const key = trimmed.slice(0, equalsAt).trim()
    let value = trimmed.slice(equalsAt + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] ??= value
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const shouldStartWebServer = Boolean(
  process.env.E2E_START_SERVER ||
    (process.env.E2E_ESTIMATE_ID && process.env.E2E_EMAIL && process.env.E2E_PASSWORD)
)

export default defineConfig({
  testDir: './e2e',
  outputDir: './playwright-test-results',
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: shouldStartWebServer
    ? {
        command: 'npm.cmd run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
})
