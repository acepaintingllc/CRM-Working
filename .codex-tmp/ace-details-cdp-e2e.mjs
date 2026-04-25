import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const baseURL = 'http://localhost:3000'
const primaryEstimateId = '21386770-5b49-44f0-a33d-9c7c5174eca9'
const unassignedEstimateId = '1493cf93-646c-4899-b82d-9900334b0968'
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const userDataDir = `${process.env.TEMP}\\ace-cdp-${Date.now()}`
const remotePort = 9223

function loadEnv(path) {
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)\s*$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[match[1].trim()] = value
  }
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

async function retry(fn, timeoutMs = 15000, intervalMs = 250) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(intervalMs)
  }
  if (lastError) throw lastError
  throw new Error(`Timed out after ${timeoutMs}ms`)
}

async function createAuthTools() {
  loadEnv('.env.local')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { data: member, error: memberError } = await admin.from('org_members').select('user_id, org_id').limit(1).single()
  if (memberError) throw memberError
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(member.user_id)
  if (userError) throw userError
  const email = userData.user?.email
  if (!email) throw new Error('Org member has no email')

  async function createApiToken() {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkError) throw linkError
    const { data, error } = await anon.auth.verifyOtp({ type: 'magiclink', token_hash: linkData.properties.hashed_token })
    if (error) throw error
    if (!data.session?.access_token) throw new Error('No access token from magic link')
    return data.session.access_token
  }

  async function createBrowserActionLink(nextPath) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${baseURL}/auth/callback?next=${encodeURIComponent(nextPath)}` },
    })
    if (linkError) throw linkError
    const link = linkData.properties?.action_link
    if (!link) throw new Error('No action link from magic link')
    return link
  }

  return { createApiToken, createBrowserActionLink }
}

async function apiFetch(token, path, init = {}) {
  const headers = new Headers(init.headers ?? {})
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${baseURL}${path}`, { ...init, headers })
}

async function loadInputs(token, estimateId) {
  const response = await apiFetch(token, `/api/estimates/${estimateId}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to load ${estimateId}: ${response.status}`)
  const json = await response.json()
  return structuredClone(json.data.inputs)
}

async function saveInputs(token, estimateId, inputs) {
  const response = await apiFetch(token, `/api/estimates/${estimateId}`, {
    method: 'PUT',
    body: JSON.stringify(inputs),
  })
  if (!response.ok) throw new Error(`Failed to restore ${estimateId}: ${response.status} ${await response.text().catch(() => '')}`)
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
    this.handlers = []
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', (event) => this.onMessage(JSON.parse(event.data)))
  }
  onMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }
    for (const handler of this.handlers) handler(message)
  }
  on(handler) { this.handlers.push(handler) }
  send(method, params = {}, sessionId) {
    const id = this.nextId++
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    this.ws.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  close() { this.ws.close() }
}

async function connectChrome() {
  const browser = spawn(chromePath, [
    `--remote-debugging-port=${remotePort}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ], { stdio: 'ignore' })

  const version = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${remotePort}/json/version`)
    if (!response.ok) return null
    return response.json()
  }, 15000)
  const cdp = new CdpClient(version.webSocketDebuggerUrl)
  await cdp.open()
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  return { browser, cdp, sessionId }
}

async function setupPage(cdp, sessionId, runtimeErrors) {
  cdp.on((message) => {
    if (message.sessionId !== sessionId) return
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(`pageerror: ${message.params.exceptionDetails?.text ?? 'exception'}`)
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      const text = message.params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ')
      runtimeErrors.push(`console: ${text}`)
    }
    if (message.method === 'Network.loadingFailed' && !message.params.requestId?.includes('webpack')) {
      runtimeErrors.push(`requestfailed: ${message.params.errorText}`)
    }
  })
  await cdp.send('Runtime.enable', {}, sessionId)
  await cdp.send('Page.enable', {}, sessionId)
  await cdp.send('Network.enable', {}, sessionId)
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId)
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Evaluation failed')
  return result.result.value
}

async function navigate(cdp, sessionId, url) {
  await cdp.send('Page.navigate', { url }, sessionId)
  await retry(() => evaluate(cdp, sessionId, 'document.readyState === "complete"'), 30000)
}

async function waitFor(cdp, sessionId, expression, timeout = 20000) {
  return retry(() => evaluate(cdp, sessionId, expression), timeout)
}

const pageJs = {
  hasHeading: (text) => `Array.from(document.querySelectorAll('h1,h2,h3')).some((el) => el.textContent?.trim() === ${JSON.stringify(text)})`,
  hasText: (text) => `document.body.innerText.includes(${JSON.stringify(text)})`,
  hasTextRegex: (source, flags = 'i') => `new RegExp(${JSON.stringify(source)}, ${JSON.stringify(flags)}).test(document.body.innerText)`,
  urlIncludes: (text) => `location.href.includes(${JSON.stringify(text)})`,
}

async function fillFirstOverride(cdp, sessionId, value) {
  return evaluate(cdp, sessionId, `(() => {
    const el = Array.from(document.querySelectorAll('input')).find((input) => input.getAttribute('aria-label')?.endsWith('override gallons'));
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`)
}

async function chooseAllSelects(cdp, sessionId) {
  return evaluate(cdp, sessionId, `(() => {
    let changed = 0;
    for (const el of document.querySelectorAll('select')) {
      const option = Array.from(el.options).find((entry) => entry.value);
      if (!option) continue;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(el, option.value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      changed += 1;
    }
    return changed;
  })()`)
}

async function fillAllQuantities(cdp, sessionId, value) {
  return evaluate(cdp, sessionId, `(() => {
    let changed = 0;
    for (const el of Array.from(document.querySelectorAll('input')).filter((input) => input.getAttribute('placeholder') === 'Qty')) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      changed += 1;
    }
    return changed;
  })()`)
}

async function firstQuantityValue(cdp, sessionId) {
  return evaluate(cdp, sessionId, `document.querySelector('input[placeholder="Qty"]')?.value ?? null`)
}

async function clickButton(cdp, sessionId, text, requireEnabled = false) {
  return evaluate(cdp, sessionId, `(() => {
    const button = Array.from(document.querySelectorAll('button')).find((entry) => entry.textContent?.includes(${JSON.stringify(text)})${requireEnabled ? ' && !entry.disabled' : ''});
    if (!button) return false;
    button.click();
    return true;
  })()`)
}

async function firstContinueDisabled(cdp, sessionId) {
  return evaluate(cdp, sessionId, `Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('Continue to Summary') && button.disabled)`)
}

async function enableMissingRatesIntercept(cdp, sessionId) {
  cdp.on(async (message) => {
    if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return
    if (message.params.request.url.includes('/api/estimates/v2/rates-flags')) {
      const body = Buffer.from(JSON.stringify({ data: { categories: [{ key: 'supply_rates_roller_covers', rows: [] }] } })).toString('base64')
      await cdp.send('Fetch.fulfillRequest', {
        requestId: message.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body,
      }, sessionId)
    } else {
      await cdp.send('Fetch.continueRequest', { requestId: message.params.requestId }, sessionId)
    }
  })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*api/estimates/v2/rates-flags*' }] }, sessionId)
}

async function main() {
  const runtimeErrors = []
  const auth = await createAuthTools()
  const apiToken = await auth.createApiToken()
  const originalPrimaryInputs = await loadInputs(apiToken, primaryEstimateId)
  const originalUnassignedInputs = await loadInputs(apiToken, unassignedEstimateId)
  const { browser, cdp, sessionId } = await connectChrome()
  await setupPage(cdp, sessionId, runtimeErrors)

  const results = []
  const check = (name, condition) => {
    if (!condition) throw new Error(`Verification failed: ${name}`)
    results.push(`PASS ${name}`)
  }

  try {
    const detailsPath = `/crm/estimates/${primaryEstimateId}/v2/details`
    await navigate(cdp, sessionId, await auth.createBrowserActionLink(detailsPath))
    await waitFor(cdp, sessionId, pageJs.urlIncludes(detailsPath), 30000)
    await waitFor(cdp, sessionId, pageJs.hasHeading('Details & Overrides'), 30000)
    check('canonical details page loads', true)
    check('material overview visible', await evaluate(cdp, sessionId, pageJs.hasText('Material Overview')))

    check('override input found', await fillFirstOverride(cdp, sessionId, '-1'))
    await waitFor(cdp, sessionId, pageJs.hasTextRegex('override gallons must be a zero or positive number'), 15000)
    check('invalid material override blocks continue', await firstContinueDisabled(cdp, sessionId))

    await fillFirstOverride(cdp, sessionId, '4')
    await waitFor(cdp, sessionId, pageJs.hasTextRegex('4\\s*gal'), 15000)
    check('material override updates displayed VM', true)

    check('roller/applicator selects changed', (await chooseAllSelects(cdp, sessionId)) > 0)
    check('roller/applicator quantities changed', (await fillAllQuantities(cdp, sessionId, '2')) > 0)
    await waitFor(cdp, sessionId, 'Array.from(document.querySelectorAll("input[placeholder=\\"Qty\\"]")).every((input) => input.value === "2")', 15000)
    await waitFor(cdp, sessionId, 'Array.from(document.querySelectorAll("select")).every((select) => !select.options.length || select.value)', 15000)
    await waitFor(cdp, sessionId, 'Array.from(document.querySelectorAll("button")).some((button) => button.textContent?.includes("Continue to Summary") && !button.disabled)', 20000)
    check('continue allowed after complete roller/applicator edits', true)

    check('save draft clicked', await clickButton(cdp, sessionId, 'Save Draft'))
    await waitFor(cdp, sessionId, pageJs.hasTextRegex('Saved|All changes saved'), 30000)
    check('details save completed', true)

    await cdp.send('Page.reload', { ignoreCache: true }, sessionId)
    await waitFor(cdp, sessionId, pageJs.hasHeading('Details & Overrides'), 30000)
    await waitFor(cdp, sessionId, 'document.querySelector("input[placeholder=\\"Qty\\"]")?.value === "2"', 30000)
    check('roller/applicator edits persist after reload', await firstQuantityValue(cdp, sessionId) === '2')

    check('continue clicked', await clickButton(cdp, sessionId, 'Continue to Summary', true))
    await waitFor(cdp, sessionId, pageJs.urlIncludes(`/crm/estimates/${primaryEstimateId}/v2/summary`), 30000)
    check('continue navigates to canonical summary', true)

    await navigate(cdp, sessionId, `${baseURL}/crm/quotes/${primaryEstimateId}/details`)
    await waitFor(cdp, sessionId, pageJs.hasHeading('Details & Overrides'), 30000)
    check('quote alias reaches canonical details behavior', await evaluate(cdp, sessionId, pageJs.urlIncludes(`/crm/quotes/${primaryEstimateId}/details`)))

    await navigate(cdp, sessionId, `${baseURL}/crm/estimates/${unassignedEstimateId}/v2/details`)
    await waitFor(cdp, sessionId, pageJs.hasHeading('Details & Overrides'), 30000)
    check('unassigned wall scope page loads', true)
    check('unassigned wall roller selects changed', (await chooseAllSelects(cdp, sessionId)) > 0)
    check('unassigned wall roller quantities changed', (await fillAllQuantities(cdp, sessionId, '3')) > 0)
    check('unassigned save clicked', await clickButton(cdp, sessionId, 'Save Draft'))
    await waitFor(cdp, sessionId, pageJs.hasTextRegex('Saved|All changes saved'), 30000)
    await cdp.send('Page.reload', { ignoreCache: true }, sessionId)
    await waitFor(cdp, sessionId, pageJs.hasHeading('Details & Overrides'), 30000)
    await waitFor(cdp, sessionId, 'document.querySelector("input[placeholder=\\"Qty\\"]")?.value === "3"', 30000)
    check('unassigned wall scope roller identity round-trips after reload', await firstQuantityValue(cdp, sessionId) === '3')

    await enableMissingRatesIntercept(cdp, sessionId)
    await navigate(cdp, sessionId, `${baseURL}/crm/estimates/${primaryEstimateId}/v2/details?missing-roller-options=1`)
    await waitFor(cdp, sessionId, pageJs.hasTextRegex('No roller or applicator options are configured'), 30000)
    await waitFor(cdp, sessionId, pageJs.hasTextRegex('Wall roller cover options are not configured'), 30000)
    check('missing roller options show clear validation issue', true)
    check('missing roller options block continue', await firstContinueDisabled(cdp, sessionId))

    const fatalErrors = runtimeErrors.filter((message) => !message.includes('Download the React DevTools'))
    check('no console/runtime/request errors', fatalErrors.length === 0)
    process.stdout.write(`${results.join('\n')}\n`)
  } finally {
    await saveInputs(apiToken, primaryEstimateId, originalPrimaryInputs)
    await saveInputs(apiToken, unassignedEstimateId, originalUnassignedInputs)
    cdp.close()
    browser.kill()
    try { fs.rmSync(userDataDir, { recursive: true, force: true }) } catch {}
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
