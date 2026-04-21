import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockServerGetSessionUserOrg,
  mockLoadCompanyProfileSettings,
  mockSaveCompanyProfileSettings,
  mockLoadQuoteSendDefaults,
  mockSaveQuoteSendDefaults,
  mockLoadEstimateDefaults,
  mockSaveEstimateDefaults,
} = vi.hoisted(() => ({
  mockServerGetSessionUserOrg: vi.fn(),
  mockLoadCompanyProfileSettings: vi.fn(),
  mockSaveCompanyProfileSettings: vi.fn(),
  mockLoadQuoteSendDefaults: vi.fn(),
  mockSaveQuoteSendDefaults: vi.fn(),
  mockLoadEstimateDefaults: vi.fn(),
  mockSaveEstimateDefaults: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  getSessionUserOrg: mockServerGetSessionUserOrg,
}))

vi.mock('@/lib/server/settings/companyProfileStore', () => ({
  loadCompanyProfileSettings: mockLoadCompanyProfileSettings,
  saveCompanyProfileSettings: mockSaveCompanyProfileSettings,
}))

vi.mock('@/lib/server/settings/quoteSendDefaultsStore', () => ({
  loadQuoteSendDefaults: mockLoadQuoteSendDefaults,
  saveQuoteSendDefaults: mockSaveQuoteSendDefaults,
}))

vi.mock('@/lib/server/settings/estimateDefaultsStore', () => ({
  loadEstimateDefaults: mockLoadEstimateDefaults,
  saveEstimateDefaults: mockSaveEstimateDefaults,
}))

vi.mock('@/lib/settings/companyProfile', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/companyProfile')>('@/lib/settings/companyProfile')
  return {
    ...actual,
  }
})

vi.mock('@/lib/settings/quoteSendDefaults', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/quoteSendDefaults')>('@/lib/settings/quoteSendDefaults')
  return {
    ...actual,
  }
})

vi.mock('@/lib/settings/estimateDefaults', async () => {
  const actual = await vi.importActual<typeof import('@/lib/settings/estimateDefaults')>('@/lib/settings/estimateDefaults')
  return {
    ...actual,
  }
})

import { GET as getCompanyRoute, PUT as putCompanyRoute } from '../company/route'
import { GET as getEstimateDefaultsRoute, PUT as putEstimateDefaultsRoute } from '../estimate-defaults/route'
import { GET as getQuoteSendDefaultsRoute, PUT as putQuoteSendDefaultsRoute } from '../quote-send-defaults/route'

function jsonRequest(method: string, body: unknown) {
  return new Request(`http://localhost/${method.toLowerCase()}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('settings routes', () => {
  beforeEach(() => {
    mockServerGetSessionUserOrg.mockReset()
    mockLoadCompanyProfileSettings.mockReset()
    mockSaveCompanyProfileSettings.mockReset()
    mockLoadQuoteSendDefaults.mockReset()
    mockSaveQuoteSendDefaults.mockReset()
    mockLoadEstimateDefaults.mockReset()
    mockSaveEstimateDefaults.mockReset()
    mockServerGetSessionUserOrg.mockResolvedValue({ orgId: 'org-1', userId: 'user-1' })
  })

  it('returns stable GET envelopes for the settings resources', async () => {
    mockLoadCompanyProfileSettings.mockResolvedValue({
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: '',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    })
    mockLoadQuoteSendDefaults.mockResolvedValue({
      default_template_key: 'default',
      quote_validity_days: 90,
      terms_text: 'Terms',
    })
    mockLoadEstimateDefaults.mockResolvedValue({
      walls_paint_id: null,
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      override_labor_rate: 65,
    })

    await expect((await getCompanyRoute()).json()).resolves.toEqual({
      data: expect.objectContaining({ business_name: 'ACE Painting' }),
    })
    await expect((await getQuoteSendDefaultsRoute()).json()).resolves.toEqual({
      data: expect.objectContaining({ default_template_key: 'default' }),
    })
    await expect((await getEstimateDefaultsRoute()).json()).resolves.toEqual({
      data: expect.objectContaining({ override_labor_rate: 65 }),
    })
  })

  it('returns stable PUT envelopes for successful saves', async () => {
    mockSaveCompanyProfileSettings.mockResolvedValue({
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '',
      business_email: '',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    })
    mockSaveQuoteSendDefaults.mockResolvedValue({
      default_template_key: 'default',
      quote_validity_days: 30,
      terms_text: 'Terms',
    })
    mockSaveEstimateDefaults.mockResolvedValue({
      walls_paint_id: 'paint-1',
      walls_primer_id: null,
      ceiling_paint_id: null,
      ceiling_primer_id: null,
      trim_paint_id: null,
      trim_primer_id: null,
      override_labor_rate: 50,
    })

    const companyResponse = await putCompanyRoute(
      jsonRequest('PUT', {
        data: {
          business_name: 'ACE Painting',
          timezone: 'America/Chicago',
          main_phone: '',
          business_email: '',
          address: '',
          website: '',
          sender_signature: '',
          logo_url: '',
        },
      })
    )
    const quoteResponse = await putQuoteSendDefaultsRoute(
      jsonRequest('PUT', {
        data: {
          default_template_key: 'default',
          quote_validity_days: 30,
          terms_text: 'Terms',
        },
      })
    )
    const estimateResponse = await putEstimateDefaultsRoute(
      jsonRequest('PUT', {
        data: {
          walls_paint_id: 'paint-1',
          walls_primer_id: null,
          ceiling_paint_id: null,
          ceiling_primer_id: null,
          trim_paint_id: null,
          trim_primer_id: null,
          override_labor_rate: 50,
        },
      })
    )

    await expect(companyResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ business_name: 'ACE Painting' }),
      notice: 'Company profile saved.',
    })
    await expect(quoteResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ quote_validity_days: 30 }),
      notice: 'Quote send defaults saved.',
    })
    await expect(estimateResponse.json()).resolves.toEqual({
      data: expect.objectContaining({ walls_paint_id: 'paint-1' }),
      notice: 'Estimate defaults saved.',
    })
  })

  it('returns body parser errors before reaching the settings services', async () => {
    const malformedResponse = await putCompanyRoute(
      new Request('http://localhost/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      })
    )

    const wrongTypeResponse = await putQuoteSendDefaultsRoute(
      new Request('http://localhost/quote-send-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ data: { default_template_key: 'default' } }),
      })
    )

    const oversizedResponse = await putEstimateDefaultsRoute(
      new Request('http://localhost/estimate-defaults', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(70 * 1024),
        },
        body: JSON.stringify({ data: { override_labor_rate: 40 } }),
      })
    )

    expect(malformedResponse.status).toBe(400)
    expect(wrongTypeResponse.status).toBe(415)
    expect(oversizedResponse.status).toBe(413)
    await expect(malformedResponse.json()).resolves.toEqual({ error: 'Invalid JSON body.' })
    await expect(wrongTypeResponse.json()).resolves.toEqual({ error: 'Expected application/json body.' })
    await expect(oversizedResponse.json()).resolves.toEqual({ error: 'Request body too large.' })
    expect(mockSaveCompanyProfileSettings).not.toHaveBeenCalled()
    expect(mockSaveQuoteSendDefaults).not.toHaveBeenCalled()
    expect(mockSaveEstimateDefaults).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid settings payloads', async () => {
    const companyResponse = await putCompanyRoute(
      jsonRequest('PUT', {
        data: {
          business_name: '',
          timezone: 'America/Chicago',
        },
      })
    )

    const quoteResponse = await putQuoteSendDefaultsRoute(
      jsonRequest('PUT', {
        data: {
          default_template_key: 'bad',
          quote_validity_days: 30,
          terms_text: 'Terms',
        },
      })
    )

    const estimateResponse = await putEstimateDefaultsRoute(
      jsonRequest('PUT', {
        data: {
          walls_paint_id: null,
          walls_primer_id: null,
          ceiling_paint_id: null,
          ceiling_primer_id: null,
          trim_paint_id: null,
          trim_primer_id: null,
          override_labor_rate: -10,
        },
      })
    )

    expect(companyResponse.status).toBe(400)
    expect(quoteResponse.status).toBe(400)
    expect(estimateResponse.status).toBe(400)
    await expect(companyResponse.json()).resolves.toEqual({ error: 'Business name is required.' })
    await expect(quoteResponse.json()).resolves.toEqual({ error: 'Default template preset is invalid.' })
    await expect(estimateResponse.json()).resolves.toEqual({ error: 'Labor rate must be between 0 and 10000.' })
  })

  it('maps auth failures through the shared session guard', async () => {
    mockServerGetSessionUserOrg.mockResolvedValueOnce({ error: 'Not authenticated' })
    mockServerGetSessionUserOrg.mockResolvedValueOnce({ error: 'Org access denied' })

    const companyResponse = await getCompanyRoute()
    const quoteResponse = await getQuoteSendDefaultsRoute()

    expect(companyResponse.status).toBe(401)
    expect(quoteResponse.status).toBe(403)
    await expect(companyResponse.json()).resolves.toEqual({ error: 'Not authenticated' })
    await expect(quoteResponse.json()).resolves.toEqual({ error: 'Org access denied' })
  })
})
