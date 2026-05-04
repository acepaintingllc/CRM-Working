import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire('C:/Users/ehrha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')
const { chromium } = require('playwright')

const outDir = 'C:/Users/ehrha/Documents/ace-crm-working/test-results/estimate-v2-verify'
const outPath = path.join(outDir, 'narrow-editor.png')
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 1 })
const consoleErrors = []

page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text())
  }
})

await page.goto('http://localhost:3000/crm/quotes/35b462d8-7ade-4533-8b68-0b530ee744dd', {
  waitUntil: 'load',
  timeout: 60_000,
})
await page.locator('body').waitFor({ state: 'visible', timeout: 30_000 })

await page.screenshot({ path: outPath, fullPage: true })

const metrics = await page.evaluate(() => ({
  url: window.location.href,
  title: document.title,
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  scrollHeight: document.documentElement.scrollHeight,
  hasHeader: document.body.innerText.includes('Quote Version 3'),
  hasRooms: document.body.innerText.includes('Rooms'),
  hasRoomSetup: document.body.innerText.includes('Room Setup'),
  hasWalls: document.body.innerText.includes('Walls'),
  hasCeilings: document.body.innerText.includes('Ceilings'),
  hasTrim: document.body.innerText.includes('Trim'),
  hasDoors: document.body.innerText.includes('Doors'),
  hasFooterActions:
    document.body.innerText.includes('Save draft') &&
    document.body.innerText.includes('Save & continue'),
  hasRunningTotal: document.body.innerText.includes('Running total'),
  bodySnippet: document.body.innerText.slice(0, 800),
}))

await browser.close()

console.error(JSON.stringify({ outPath, metrics, consoleErrors }, null, 2))
