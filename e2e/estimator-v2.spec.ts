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

  test('creates a fresh TEST estimate room through Add Room and persists it', async ({ page }) => {
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
  })
})
