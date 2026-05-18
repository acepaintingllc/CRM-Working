import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const estimateId = process.env.E2E_ESTIMATE_ID
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const testOrgId = process.env.CODEX_BROWSER_TEST_ORG_ID
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createE2EClient() {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function loginToEstimate(page: Page, path: string) {
  await page.goto(`/login?next=${encodeURIComponent(path)}`)
  await page.getByLabel('Email').fill(email!)
  await page.getByLabel('Password').fill(password!)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15_000 })
}

async function expectEstimateBelongsToTestOrg() {
  const supabase = createE2EClient()

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id, org_id, job_id')
    .eq('id', estimateId!)
    .maybeSingle()

  if (estimateError) throw estimateError
  expect(estimate?.org_id).toBe(testOrgId)
  expect(estimate?.job_id).toBeTruthy()
  return { supabase, estimate: estimate! }
}

function parseCurrencyText(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

async function createFreshTestEstimate() {
  const supabase = createE2EClient()
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const suffix = randomUUID().slice(0, 8)
  const emailAddress = `e2e.estimator+${stamp}.${suffix}@example.com`
  const phone = `555-${suffix.slice(0, 3)}-${suffix.slice(3, 7)}`

  const { data: membership, error: membershipError } = await supabase
    .from('org_members')
    .select('org_id, user_id')
    .eq('org_id', testOrgId!)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError
  expect(membership?.org_id).toBe(testOrgId)
  expect(membership?.user_id).toBeTruthy()
  if (!membership?.user_id) throw new Error('No TEST-org membership found for E2E estimate creation.')

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert({
      org_id: testOrgId,
      name: `E2E Estimator Customer ${stamp}-${suffix}`,
      email: emailAddress,
      phone,
      address: '100 Test Lane, Leland, IN 46052',
      street: '100 Test Lane',
      city: 'Leland',
      state: 'IN',
      zip: '46052',
    })
    .select('id')
    .single()

  if (customerError) throw customerError

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      org_id: testOrgId,
      customer_id: customer.id,
      title: `E2E fresh estimator ${stamp}-${suffix}`,
      description: 'Playwright-created estimator flow fixture.',
      status: 'estimate_scheduled',
      estimate_date: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobError) throw jobError

  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .insert({
      org_id: testOrgId,
      job_id: job.id,
      customer_id: customer.id,
      status: 'draft',
      version_name: `E2E Fresh Quote ${stamp}-${suffix}`,
      version_state: 'draft',
      version_kind: 'standard',
      version_sort_order: 0,
      created_by: membership.user_id,
    })
    .select('id, org_id, job_id')
    .single()

  if (estimateError) throw estimateError
  expect(estimate.org_id).toBe(testOrgId)
  return { supabase, estimate }
}

test.beforeAll(async () => {
  test.skip(!estimateId, 'Set E2E_ESTIMATE_ID to run estimator browser checks against a seeded estimate.')
  test.skip(!testOrgId, 'Set CODEX_BROWSER_TEST_ORG_ID to restrict E2E setup to the test org.')
  test.skip(!supabaseUrl || !serviceRoleKey, 'Set Supabase env vars for E2E setup.')

  const { supabase, estimate } = await expectEstimateBelongsToTestOrg()

  const { data: existingRooms, error: roomLoadError } = await supabase
    .from('estimate_rooms')
    .select('id')
    .eq('org_id', testOrgId!)
    .eq('estimate_id', estimateId!)
    .limit(1)

  if (roomLoadError) throw roomLoadError
  if ((existingRooms ?? []).length > 0) return

  const { error: insertRoomError } = await supabase.from('estimate_rooms').insert({
    org_id: testOrgId,
    estimate_id: estimateId,
    job_id: estimate!.job_id,
    position: 0,
    room_id: 'R001',
    room_name: 'E2E Starter Room',
    mode: 'RECT',
    length_in: 144,
    width_in: 120,
    wallheight_in: 96,
    walls_include: 'N',
    ceiling_include: 'N',
    trim_include: 'N',
  })

  if (insertRoomError) throw insertRoomError
})

test.describe('Estimator V2', () => {
  test.skip(!estimateId, 'Set E2E_ESTIMATE_ID to run estimator browser checks against a seeded estimate.')
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for a test-account login.')

  test('saves an editor room edit and reloads it into summary', async ({ page }) => {
    const roomName = `E2E Trust Room ${new Date().toISOString().replace(/[:.]/g, '-')}`

    await loginToEstimate(page, `/crm/estimates/${estimateId}/v2`)

    await expect(page.getByRole('main')).toBeVisible()
    const saveDraft = page.getByRole('button', { name: 'Save draft' })
    await expect(saveDraft).toBeVisible()

    const roomNameInput = page.getByLabel('Room Name')
    await expect(roomNameInput).toBeVisible()
    await roomNameInput.fill(roomName)
    await page.getByLabel('Length (in)').fill('144')
    await page.getByLabel('Width (in)').fill('120')
    await page.getByLabel('Height (in)').fill('96')

    await expect(saveDraft).toBeEnabled({ timeout: 10_000 })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimateId}`) &&
        response.request().method() === 'PUT'
    )
    await saveDraft.click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })

    await page.goto(`/crm/estimates/${estimateId}/v2/summary`)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(/total/i).first()).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
  })

  test('saves summary pricing policy edits through the API and database', async ({ page }) => {
    const { supabase } = await expectEstimateBelongsToTestOrg()
    const { data: currentJobSettings, error: currentJobSettingsError } = await supabase
      .from('estimate_jobsettings')
      .select('dayhours, rounding_increment_hours, override_labor_rate')
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimateId!)
      .maybeSingle()

    if (currentJobSettingsError) throw currentJobSettingsError

    const currentLaborRate = Number(currentJobSettings?.override_labor_rate)
    const currentDayHours = Number(currentJobSettings?.dayhours)
    const currentRoundIncrement = Number(currentJobSettings?.rounding_increment_hours)
    const laborRate = currentLaborRate === 71 ? 72 : 71
    const dayHours = currentDayHours === 7 ? 8 : 7
    const roundIncrement = currentRoundIncrement === 0.5 ? 1 : 0.5

    await loginToEstimate(page, `/crm/estimates/${estimateId}/v2/summary`)

    await expect(page.getByRole('main')).toBeVisible()
    await page.getByRole('button', { name: 'Expand pricing policies' }).click()

    const laborRateInput = page.getByLabel('Labor rate dollars per hour')
    await expect(laborRateInput).toBeVisible()
    await page.getByLabel('Hours per day').fill(String(dayHours))
    await page.getByLabel('Round labor hours increment').fill(String(roundIncrement))

    const policySaveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimateId}`) &&
        response.request().method() === 'PUT'
    )
    await laborRateInput.fill(String(laborRate))
    const policySaveResponse = await policySaveResponsePromise
    expect(policySaveResponse.ok()).toBeTruthy()

    await expect(page.getByText('Saving summary policy changes...')).toBeHidden({ timeout: 15_000 })
    await page.reload()
    await page.getByRole('button', { name: 'Expand pricing policies' }).click()
    await expect(page.getByLabel('Labor rate dollars per hour')).toHaveValue(String(laborRate), {
      timeout: 15_000,
    })
    await expect(page.getByLabel('Hours per day')).toHaveValue(String(dayHours))
    await expect(page.getByLabel('Round labor hours increment')).toHaveValue(String(roundIncrement))

    const { data: jobSettings, error } = await supabase
      .from('estimate_jobsettings')
      .select('org_id, estimate_id, dayhours, rounding_increment_hours, override_labor_rate')
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimateId!)
      .maybeSingle()

    if (error) throw error
    expect(jobSettings?.org_id).toBe(testOrgId)
    expect(jobSettings?.estimate_id).toBe(estimateId)
    expect(Number(jobSettings?.dayhours)).toBe(dayHours)
    expect(Number(jobSettings?.rounding_increment_hours)).toBe(roundIncrement)
    expect(Number(jobSettings?.override_labor_rate)).toBe(laborRate)
  })

  test('creates a fresh TEST estimate room through Add Room and produces priced summary output', async ({ page }) => {
    const { supabase, estimate } = await createFreshTestEstimate()
    const roomName = `E2E Added Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const addRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(addRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await addRoomButton.click()

    const roomNameInput = page.getByLabel('Room Name')
    await expect
      .poll(
        async () => page.getByLabel('Room Name').count(),
        { message: `Room editor did not open. Page errors: ${pageErrors.join(' | ') || 'none'}` }
      )
      .toBe(1)
    await expect(roomNameInput).toBeVisible()
    await roomNameInput.fill(roomName)
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('96')

    const saveDraft = page.getByRole('button', { name: 'Save draft' })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await saveDraft.click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()

    const summaryCurrencyTexts = await page.locator('main').getByText(/\$[\d,]+(?:\.\d{2})?/).allTextContents()
    expect(summaryCurrencyTexts.some((value) => parseCurrencyText(value) > 0)).toBeTruthy()

    const { data: rooms, error: roomError } = await supabase
      .from('estimate_rooms')
      .select('org_id, estimate_id, job_id, room_name, length_in, width_in, wallheight_in')
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)

    if (roomError) throw roomError
    expect(rooms).toHaveLength(1)
    expect(rooms?.[0]?.org_id).toBe(testOrgId)
    expect(rooms?.[0]?.estimate_id).toBe(estimate.id)
    expect(rooms?.[0]?.job_id).toBe(estimate.job_id)
    expect(rooms?.[0]?.room_name).toBe(roomName)
    expect(Number(rooms?.[0]?.length_in)).toBe(168)
    expect(Number(rooms?.[0]?.width_in)).toBe(132)
    expect(Number(rooms?.[0]?.wallheight_in)).toBe(96)

    const { data: wallScopes, error: wallScopeError } = await supabase
      .from('estimate_room_wall_scopes')
      .select('org_id, estimate_id, job_id, room_id, include, effective_area_sf, effective_total')
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)
      .eq('active', 'Y')

    if (wallScopeError) throw wallScopeError
    expect(wallScopes).toHaveLength(1)
    expect(wallScopes?.[0]?.org_id).toBe(testOrgId)
    expect(wallScopes?.[0]?.estimate_id).toBe(estimate.id)
    expect(wallScopes?.[0]?.job_id).toBe(estimate.job_id)
    expect(wallScopes?.[0]?.room_id).toBe('R001')
    expect(wallScopes?.[0]?.include).toBe('Y')
    expect(Number(wallScopes?.[0]?.effective_area_sf)).toBeGreaterThan(0)
    expect(Number(wallScopes?.[0]?.effective_total)).toBeGreaterThan(0)
  })

  test('prices a fresh TEST estimate ceiling scope and persists calculated ceiling totals', async ({ page }) => {
    const { supabase, estimate } = await createFreshTestEstimate()
    const roomName = `E2E Ceiling Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const addRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(addRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await addRoomButton.click()

    const roomNameInput = page.getByLabel('Room Name')
    await expect
      .poll(
        async () => page.getByLabel('Room Name').count(),
        { message: `Room editor did not open. Page errors: ${pageErrors.join(' | ') || 'none'}` }
      )
      .toBe(1)
    await expect(roomNameInput).toBeVisible()
    await roomNameInput.fill(roomName)
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('96')

    const ceilingsToggle = page.getByRole('button', { name: 'Ceilings excluded' })
    await expect(ceilingsToggle).toBeEnabled()
    await ceilingsToggle.click()
    await expect(page.getByRole('button', { name: 'Ceilings included' })).toBeVisible()
    await expect(page.getByText('Ceiling Sq Ft')).toBeVisible()
    await expect(page.getByLabel('Ceiling Type')).toBeVisible()
    await expect(page.locator('main').getByText('154').first()).toBeVisible()

    const saveDraft = page.getByRole('button', { name: 'Save draft' })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await saveDraft.click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })
    await expect(page.getByText('Ceiling Sq Ft')).toBeVisible()

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    await expect(page.locator('main').getByText('Ceilings').first()).toBeVisible()

    const summaryCurrencyTexts = await page.locator('main').getByText(/\$[\d,]+(?:\.\d{2})?/).allTextContents()
    expect(summaryCurrencyTexts.some((value) => parseCurrencyText(value) > 0)).toBeTruthy()

    const { data: ceilingScopes, error: ceilingScopeError } = await supabase
      .from('estimate_room_ceiling_scopes')
      .select(
        'org_id, estimate_id, job_id, room_id, include, raw_area_sf, effective_area_sf, raw_paint_hours, effective_paint_hours, raw_paint_gallons, effective_paint_gallons, effective_total'
      )
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)
      .eq('active', 'Y')

    if (ceilingScopeError) throw ceilingScopeError
    expect(ceilingScopes).toHaveLength(1)
    expect(ceilingScopes?.[0]?.org_id).toBe(testOrgId)
    expect(ceilingScopes?.[0]?.estimate_id).toBe(estimate.id)
    expect(ceilingScopes?.[0]?.job_id).toBe(estimate.job_id)
    expect(ceilingScopes?.[0]?.room_id).toBe('R001')
    expect(ceilingScopes?.[0]?.include).toBe('Y')
    expect(Number(ceilingScopes?.[0]?.raw_area_sf)).toBeCloseTo(154, 1)
    expect(Number(ceilingScopes?.[0]?.effective_area_sf)).toBeGreaterThan(0)
    expect(Number(ceilingScopes?.[0]?.raw_paint_hours)).toBeGreaterThan(0)
    expect(Number(ceilingScopes?.[0]?.effective_paint_hours)).toBeGreaterThan(0)
    expect(Number(ceilingScopes?.[0]?.raw_paint_gallons)).toBeGreaterThan(0)
    expect(Number(ceilingScopes?.[0]?.effective_paint_gallons)).toBeGreaterThan(0)
    expect(Number(ceilingScopes?.[0]?.effective_total)).toBeGreaterThan(0)
  })

  test('prices a fresh TEST estimate trim scope and persists calculated trim totals', async ({ page }) => {
    const { supabase, estimate } = await createFreshTestEstimate()
    const roomName = `E2E Trim Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const addRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(addRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await addRoomButton.click()

    const roomNameInput = page.getByLabel('Room Name')
    await expect
      .poll(
        async () => page.getByLabel('Room Name').count(),
        { message: `Room editor did not open. Page errors: ${pageErrors.join(' | ') || 'none'}` }
      )
      .toBe(1)
    await expect(roomNameInput).toBeVisible()
    await roomNameInput.fill(roomName)
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('96')

    const trimToggle = page.getByRole('button', { name: 'Trim excluded' })
    await expect(trimToggle).toBeEnabled()
    await trimToggle.click()
    await expect(page.getByRole('button', { name: 'Trim included' })).toBeVisible()

    await expect(page.getByText('Trim Setup').first()).toBeVisible()
    await expect(page.getByLabel('Measurement Mode').first()).toBeVisible()
    await expect(page.getByText('Final Measurement')).toBeVisible()

    const saveDraft = page.getByRole('button', { name: 'Save draft' })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await saveDraft.click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })
    await expect(page.getByText('Trim Setup').first()).toBeVisible()

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    await expect(page.locator('main').getByText('Trim').first()).toBeVisible()

    const summaryCurrencyTexts = await page.locator('main').getByText(/\$[\d,]+(?:\.\d{2})?/).allTextContents()
    expect(summaryCurrencyTexts.some((value) => parseCurrencyText(value) > 0)).toBeTruthy()

    const { data: trimScopes, error: trimScopeError } = await supabase
      .from('estimate_room_trim_scopes')
      .select(
        'org_id, estimate_id, job_id, room_id, include, trim_type_id, unit_type, measurement_mode, helper_value, raw_measurement, effective_measurement, raw_paint_hours, effective_paint_gallons, effective_total'
      )
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)
      .eq('active', 'Y')

    if (trimScopeError) throw trimScopeError
    expect(trimScopes).toHaveLength(1)
    expect(trimScopes?.[0]?.org_id).toBe(testOrgId)
    expect(trimScopes?.[0]?.estimate_id).toBe(estimate.id)
    expect(trimScopes?.[0]?.job_id).toBe(estimate.job_id)
    expect(trimScopes?.[0]?.room_id).toBe('R001')
    expect(trimScopes?.[0]?.include).toBe('Y')
    expect(trimScopes?.[0]?.trim_type_id).toBeTruthy()
    expect(trimScopes?.[0]?.unit_type).toBe('LF')
    expect(trimScopes?.[0]?.measurement_mode).toBe('ROOM_HELPER')
    expect(Number(trimScopes?.[0]?.helper_value)).toBeCloseTo(50, 1)
    expect(Number(trimScopes?.[0]?.raw_measurement)).toBeGreaterThan(0)
    expect(Number(trimScopes?.[0]?.effective_measurement)).toBeGreaterThan(0)
    expect(Number(trimScopes?.[0]?.effective_measurement)).toBeCloseTo(50, 1)
    expect(Number(trimScopes?.[0]?.raw_paint_hours)).toBeGreaterThan(0)
    expect(Number(trimScopes?.[0]?.effective_paint_gallons)).toBeGreaterThan(0)
    expect(Number(trimScopes?.[0]?.effective_total)).toBeGreaterThan(0)
  })

  test('prices a fresh TEST estimate door scope and persists calculated door totals', async ({ page }) => {
    const { supabase, estimate } = await createFreshTestEstimate()
    const roomName = `E2E Door Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const addRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(addRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await addRoomButton.click()

    const roomNameInput = page.getByLabel('Room Name')
    await expect
      .poll(
        async () => page.getByLabel('Room Name').count(),
        { message: `Room editor did not open. Page errors: ${pageErrors.join(' | ') || 'none'}` }
      )
      .toBe(1)
    await expect(roomNameInput).toBeVisible()
    await roomNameInput.fill(roomName)
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('96')

    const doorsToggle = page.getByRole('button', { name: 'Doors excluded' })
    await expect(doorsToggle).toBeEnabled()
    await doorsToggle.click()
    await expect(page.getByRole('button', { name: 'Doors included' })).toBeVisible()

    const doorTypeSelect = page.getByLabel('Door Type').first()
    if ((await doorTypeSelect.count()) === 0) {
      const addDoorButton = page.getByRole('button', { name: '+ Add Door' })
      await expect(addDoorButton).toBeEnabled()
      await addDoorButton.click()
    }

    await expect(page.getByLabel('Door Type').first()).toBeVisible()
    await page.getByLabel('Door Type').first().selectOption({ index: 1 })
    const selectedDoorTypeId = await page.getByLabel('Door Type').first().inputValue()
    await page.getByLabel('Quantity').first().fill('2')
    await page.getByLabel('Sides').first().selectOption('2')
    await expect(page.getByText('Final Units').first()).toBeVisible()

    const saveDraft = page.getByRole('button', { name: 'Save draft' })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await saveDraft.click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })
    await expect(page.getByLabel('Door Type').first()).toBeVisible()
    await expect(page.getByLabel('Quantity').first()).toHaveValue('2')
    await expect(page.getByLabel('Sides').first()).toHaveValue('2')

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    await expect(page.locator('main').getByText('Doors').first()).toBeVisible()

    const summaryCurrencyTexts = await page.locator('main').getByText(/\$[\d,]+(?:\.\d{2})?/).allTextContents()
    expect(summaryCurrencyTexts.some((value) => parseCurrencyText(value) > 0)).toBeTruthy()

    const { data: doorScopes, error: doorScopeError } = await supabase
      .from('estimate_room_door_scopes')
      .select(
        'org_id, estimate_id, job_id, room_id, include, door_type_id, quantity, sides, raw_units, effective_units, raw_paint_hours, effective_material_cost, effective_total'
      )
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)
      .eq('active', 'Y')

    if (doorScopeError) throw doorScopeError
    expect(doorScopes).toHaveLength(1)
    expect(doorScopes?.[0]?.org_id).toBe(testOrgId)
    expect(doorScopes?.[0]?.estimate_id).toBe(estimate.id)
    expect(doorScopes?.[0]?.job_id).toBe(estimate.job_id)
    expect(doorScopes?.[0]?.room_id).toBe('R001')
    expect(doorScopes?.[0]?.include).toBe('Y')
    expect(doorScopes?.[0]?.door_type_id).toBe(selectedDoorTypeId)
    expect(Number(doorScopes?.[0]?.quantity)).toBe(2)
    expect(Number(doorScopes?.[0]?.sides)).toBe(2)
    expect(Number(doorScopes?.[0]?.raw_units)).toBe(4)
    expect(Number(doorScopes?.[0]?.effective_units)).toBeGreaterThan(0)
    expect(Number(doorScopes?.[0]?.effective_units)).toBe(4)
    expect(Number(doorScopes?.[0]?.raw_paint_hours)).toBeGreaterThan(0)
    expect(Number(doorScopes?.[0]?.effective_material_cost)).toBeGreaterThanOrEqual(0)
    expect(Number(doorScopes?.[0]?.effective_total)).toBeGreaterThan(0)
  })

  test('prices a fresh TEST estimate drywall repair and persists calculated repair totals', async ({ page }) => {
    const { supabase, estimate } = await createFreshTestEstimate()
    const roomName = `E2E Drywall Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const addRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(addRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await addRoomButton.click()

    const roomNameInput = page.getByLabel('Room Name')
    await expect
      .poll(
        async () => page.getByLabel('Room Name').count(),
        { message: `Room editor did not open. Page errors: ${pageErrors.join(' | ') || 'none'}` }
      )
      .toBe(1)
    await expect(roomNameInput).toBeVisible()
    await roomNameInput.fill(roomName)
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('96')

    await expect(page.getByRole('button', { name: 'Wall Drywall Repairs ^' })).toBeVisible()
    const addRepairButton = page.getByRole('button', { name: '+ Add repair' }).first()
    await expect(addRepairButton).toBeEnabled()
    await addRepairButton.click()

    await expect(page.getByLabel('Repair Type').first()).toBeVisible()
    const selectedRepairType = await page.getByLabel('Repair Type').first().inputValue()
    await page.getByLabel(/Quantity \((LF|SQFT)\)/).first().fill('4')

    const saveDraft = page.getByRole('button', { name: 'Save draft' })
    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await saveDraft.click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })
    await expect(page.getByLabel('Repair Type').first()).toBeVisible()
    await expect(page.getByLabel(/Quantity \((LF|SQFT)\)/).first()).toHaveValue('4')

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    await expect(page.locator('main').getByText('Drywall').first()).toBeVisible()

    const summaryCurrencyTexts = await page.locator('main').getByText(/\$[\d,]+(?:\.\d{2})?/).allTextContents()
    expect(summaryCurrencyTexts.some((value) => parseCurrencyText(value) > 0)).toBeTruthy()

    const { data: drywallRepairs, error: drywallRepairError } = await supabase
      .from('estimate_drywall_repairs')
      .select(
        'org_id, estimate_id, job_id, room_id, surface, repair_type, unit, quantity, raw_quantity, effective_quantity, base_unit_rate, calculated_total, effective_total'
      )
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)
      .eq('active', 'Y')

    if (drywallRepairError) throw drywallRepairError
    expect(drywallRepairs).toHaveLength(1)
    expect(drywallRepairs?.[0]?.org_id).toBe(testOrgId)
    expect(drywallRepairs?.[0]?.estimate_id).toBe(estimate.id)
    expect(drywallRepairs?.[0]?.job_id).toBe(estimate.job_id)
    expect(drywallRepairs?.[0]?.room_id).toBe('R001')
    expect(drywallRepairs?.[0]?.surface).toBe('wall')
    expect(drywallRepairs?.[0]?.repair_type).toBe(selectedRepairType)
    expect(drywallRepairs?.[0]?.unit).toBeTruthy()
    expect(Number(drywallRepairs?.[0]?.quantity)).toBe(4)
    expect(Number(drywallRepairs?.[0]?.raw_quantity)).toBe(4)
    expect(Number(drywallRepairs?.[0]?.effective_quantity)).toBeGreaterThan(0)
    expect(Number(drywallRepairs?.[0]?.effective_quantity)).toBe(4)
    expect(Number(drywallRepairs?.[0]?.base_unit_rate)).toBeGreaterThan(0)
    expect(Number(drywallRepairs?.[0]?.calculated_total)).toBeGreaterThan(0)
    expect(Number(drywallRepairs?.[0]?.effective_total)).toBeGreaterThan(0)
  })
  test('persists details page material overrides for a fresh priced TEST estimate', async ({ page }) => {
    const { estimate } = await createFreshTestEstimate()
    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const detailsAddRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(detailsAddRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await detailsAddRoomButton.click()
    await expect(page.getByLabel('Room Name')).toBeVisible()
    await page.getByLabel('Room Name').fill('Details Materials Room')
    await page.getByLabel('Length (in)').fill('180')
    await page.getByLabel('Width (in)').fill('144')
    await page.getByLabel('Height (in)').fill('96')

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      ),
      page.getByRole('button', { name: /Save draft/i }).click(),
    ])

    await page.goto(`/crm/estimates/${estimate.id}/v2/details`)
    await expect(page.getByRole('heading', { name: 'Details & Overrides' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Material Overview' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Paint Planning' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Product' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Override' }).first()).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Final' }).first()).toBeVisible()

    const overrideInput = page.getByLabel(/override gallons/i).first()
    await overrideInput.fill('6.25')

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      ),
      page.getByRole('button', { name: 'Save Draft' }).click(),
    ])

    await page.reload()
    await expect(page.getByLabel(/override gallons/i).first()).toHaveValue('6.25')

    const e2e = createE2EClient()
    const { data: wallScope, error } = await e2e
      .from('estimate_room_wall_scopes')
      .select('override_paint_gallons')
      .eq('estimate_id', estimate.id)
      .eq('active', 'Y')
      .not('override_paint_gallons', 'is', null)
      .limit(1)
      .maybeSingle()

    expect(error).toBeNull()
    expect(Number(wallScope?.override_paint_gallons ?? 0)).toBeCloseTo(6.25, 2)
  })

  test('blocks editor navigation with unsaved changes until the user confirms', async ({ page }) => {
    const { estimate } = await createFreshTestEstimate()
    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const guardAddRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(guardAddRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await guardAddRoomButton.click()
    await expect(page.getByLabel('Room Name')).toBeVisible()
    await page.getByLabel('Room Name').fill('Unsaved Navigation Room')

    await page.getByRole('button', { name: /Back/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Leave with unsaved changes?' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(new RegExp(`/crm/estimates/${estimate.id}/v2$`))
    await expect(page.getByRole('heading', { name: 'Leave with unsaved changes?' })).toBeHidden()

    await page.getByRole('button', { name: /Back/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Leave with unsaved changes?' })).toBeVisible()
    await page.getByRole('button', { name: 'Discard changes and leave quote editor' }).click()
    await expect(page).not.toHaveURL(new RegExp(`/crm/estimates/${estimate.id}/v2$`))
  })

  test('blocks invalid included wall scope values and saves after correction', async ({ page }) => {
    const { estimate } = await createFreshTestEstimate()
    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)

    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const validationAddRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(validationAddRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await validationAddRoomButton.click()
    await expect(page.getByLabel('Room Name')).toBeVisible()
    await page.getByLabel('Room Name').fill('Validation Room')
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('')

    await expect(page.getByText('Validation Room: height is required for RECT wall mode', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Save draft/i })).toBeDisabled()

    await page.getByLabel('Height (in)').fill('96')
    await expect(page.getByText('Validation Room: height is required for RECT wall mode', { exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: /Save draft/i })).toBeEnabled()

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      ),
      page.getByRole('button', { name: /Save draft/i }).click(),
    ])
  })
  async function createFreshPricedEstimateThroughEditor(page: Page, roomName: string) {
    const { supabase, estimate } = await createFreshTestEstimate()
    await loginToEstimate(page, `/crm/estimates/${estimate.id}/v2`)
    await expect(page.getByText('No rooms yet - add the first one.')).toBeVisible()
    const addRoomButton = page.getByRole('button', { name: '+ Add room' })
    await expect(addRoomButton).toBeEnabled()
    await page.waitForLoadState('networkidle')
    await addRoomButton.click()
    await expect(page.getByLabel('Room Name')).toBeVisible()
    await page.getByLabel('Room Name').fill(roomName)
    await page.getByLabel('Length (in)').fill('168')
    await page.getByLabel('Width (in)').fill('132')
    await page.getByLabel('Height (in)').fill('96')

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await page.getByRole('button', { name: /Save draft/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    return { supabase, estimate, roomName }
  }

  async function readVisibleLargestCurrency(page: Page) {
    const currencyTexts = await page.locator('main').getByText(/\$[\d,]+(?:\.\d{2})?/).allTextContents()
    const values = currencyTexts.map(parseCurrencyText).filter((value) => value > 0)
    expect(values.length).toBeGreaterThan(0)
    return Math.max(...values)
  }

  function roundedCurrencyText(value: number) {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }

  test('loads customer send review for a fresh priced TEST estimate without sending email', async ({ page }) => {
    const { estimate, roomName } = await createFreshPricedEstimateThroughEditor(
      page,
      `Send Readiness Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    )

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    const summaryTotal = await readVisibleLargestCurrency(page)
    const summaryTotalText = roundedCurrencyText(summaryTotal)

    await page.getByRole('link', { name: /Send to client/i }).click()
    await expect(page.getByText('Customer Quote')).toBeVisible()
    await expect(page.getByText('Customer Preview')).toBeVisible()
    await expect(page.getByText(summaryTotalText).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send Test' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Send Quote|Resolve blockers before sending|Save draft to refresh preview before sending/i })).toBeVisible()
  })

  test('opens a TEST-only public quote preview and matches the internal summary total', async ({ page }) => {
    const { supabase, estimate, roomName } = await createFreshPricedEstimateThroughEditor(
      page,
      `Public Preview Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    )

    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    const summaryTotal = await readVisibleLargestCurrency(page)
    const summaryTotalText = roundedCurrencyText(summaryTotal)

    await page.goto(`/crm/estimates/${estimate.id}/send`)
    await expect(page.getByText('Customer Preview')).toBeVisible()

    const publicToken = `codex_e2e_${randomUUID().replace(/-/g, '')}`
    const { data: draftVersion, error: draftLookupError } = await supabase
      .from('estimate_public_versions')
      .select('id, org_id, estimate_id, status, snapshot_json')
      .eq('org_id', testOrgId!)
      .eq('estimate_id', estimate.id)
      .eq('status', 'draft')
      .order('version_number', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(draftLookupError).toBeNull()
    expect(draftVersion?.id).toBeTruthy()
    expect(draftVersion?.snapshot_json).toBeTruthy()

    const { error: publishError } = await supabase
      .from('estimate_public_versions')
      .update({
        status: 'sent',
        public_token: publicToken,
        sent_at: new Date().toISOString(),
      })
      .eq('org_id', testOrgId!)
      .eq('id', draftVersion!.id)

    expect(publishError).toBeNull()

    await page.goto(`/quote/${publicToken}`)
    await expect(page.getByText('Your quote total')).toBeVisible()
    await expect(page.getByText(summaryTotalText).first()).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    await expect(page.getByText(/Walls|wall/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Accept Quote/i })).toBeVisible()
  })

  test('loads the quote route aliases for editor summary and send review', async ({ page }) => {
    const roomName = `Quote Alias Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const { estimate } = await createFreshPricedEstimateThroughEditor(page, roomName)

    await page.goto(`/crm/quotes/${estimate.id}`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })

    await page.goto(`/crm/quotes/${estimate.id}/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(roomName).first()).toBeVisible()
    await expect(page.getByText('Final Total').first()).toBeVisible()

    const sendLink = page.getByRole('link', { name: /Send to client/i })
    await expect(sendLink).toHaveAttribute('href', `/crm/quotes/${estimate.id}/send`)
    await sendLink.click()
    await expect(page).toHaveURL(new RegExp(`/crm/quotes/${estimate.id}/send$`))
    await expect(page.getByText('Customer Quote')).toBeVisible()
    await expect(page.getByText('Customer Preview')).toBeVisible()
  })

  test('runs the estimator editor and summary flow in a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const roomName = `Mobile Smoke Room ${new Date().toISOString().replace(/[:.]/g, '-')}`
    const { estimate } = await createFreshPricedEstimateThroughEditor(page, roomName)

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(roomName, { timeout: 15_000 })
    await page.getByLabel('Room Name').fill(`${roomName} Edited`)

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/estimates/${estimate.id}`) &&
        response.request().method() === 'PUT'
    )
    await expect(page.getByRole('button', { name: /Save draft/i })).toBeVisible()
    await page.getByRole('button', { name: /Save draft/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await page.reload()
    await expect(page.getByLabel('Room Name')).toHaveValue(`${roomName} Edited`, { timeout: 15_000 })
    await page.goto(`/crm/estimates/${estimate.id}/v2/summary`)
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByText(`${roomName} Edited`).first()).toBeVisible()
    await expect(page.getByText('Final Total').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Send to client/i })).toBeVisible()
  })
})




