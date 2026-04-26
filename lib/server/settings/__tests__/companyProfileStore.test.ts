import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadCompanyProfileSettings, saveCompanyProfileSettings } from '../companyProfileStore'

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

function createSelectChain(result: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function createUpsertChain(result: unknown) {
  const chain = {
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.select.mockReturnValue(chain)
  return chain
}

function createUpdateChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

describe('company profile settings store', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('loads from orgs when the canonical settings table is missing', async () => {
    const canonicalChain = createSelectChain({
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.company_profile_settings' in the schema cache",
      },
    })
    const orgChain = createSelectChain({
      data: {
        name: 'ACE Painting',
        timezone: 'America/Chicago',
        main_phone: '555-0100',
        business_email: 'hello@example.com',
        address: '1 Main St',
        website: 'https://example.com',
        sender_signature: 'Thanks',
        logo_url: 'https://example.com/logo.png',
      },
      error: null,
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'company_profile_settings') return canonicalChain
      if (table === 'orgs') return orgChain
      throw new Error(`Unexpected table ${table}`)
    })

    await expect(loadCompanyProfileSettings('org-1')).resolves.toEqual({
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'hello@example.com',
      address: '1 Main St',
      website: 'https://example.com',
      sender_signature: 'Thanks',
      logo_url: 'https://example.com/logo.png',
    })
  })

  it('saves to orgs when the canonical settings table is missing', async () => {
    const canonicalUpsert = vi.fn(() =>
      createUpsertChain({
        data: null,
        error: {
          code: 'PGRST205',
          message: "Could not find the table 'public.company_profile_settings' in the schema cache",
        },
      })
    )
    const orgUpdate = vi.fn(() =>
      createUpdateChain({
        data: {
          name: 'ACE Pro Painting',
          timezone: 'America/Chicago',
          main_phone: '',
          business_email: '',
          address: '',
          website: '',
          sender_signature: '',
          logo_url: '',
        },
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'company_profile_settings') return { upsert: canonicalUpsert }
      if (table === 'orgs') return { update: orgUpdate }
      throw new Error(`Unexpected table ${table}`)
    })

    await expect(
      saveCompanyProfileSettings('org-1', {
        business_name: 'ACE Pro Painting',
        timezone: 'America/Chicago',
        main_phone: '',
        business_email: '',
        address: '',
        website: '',
        sender_signature: '',
        logo_url: '',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        business_name: 'ACE Pro Painting',
        timezone: 'America/Chicago',
      })
    )

    expect(orgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ACE Pro Painting',
        timezone: 'America/Chicago',
      })
    )
  })
})
