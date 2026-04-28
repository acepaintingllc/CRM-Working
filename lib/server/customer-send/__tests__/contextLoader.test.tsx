import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadEstimateCustomerSendResources,
} from '../contextLoader'
import {
  loadEstimateCustomerSendVersionResources,
} from '../contextRepository'

const {
  mockFrom,
  mockLoadCompanyProfileSettings,
  mockLoadQuoteSendDefaults,
  mockGetEstimateCatalogs,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockLoadCompanyProfileSettings: vi.fn(),
  mockLoadQuoteSendDefaults: vi.fn(),
  mockGetEstimateCatalogs: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/server/settings/companyProfileStore', () => ({
  loadCompanyProfileSettings: mockLoadCompanyProfileSettings,
}))

vi.mock('@/lib/server/settings/quoteSendDefaultsStore', () => ({
  loadQuoteSendDefaults: mockLoadQuoteSendDefaults,
}))

vi.mock('@/lib/server/estimateCatalogs', () => ({
  getEstimateCatalogs: mockGetEstimateCatalogs,
}))

function createMaybeSingleChain(result: unknown) {
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  return chain
}

function createOrderedCollectionChain(result: unknown) {
  const promise = Promise.resolve(result)
  const chain = {
    eq: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  }
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.is.mockReturnValue(chain)
  chain.not.mockReturnValue(chain)
  return chain
}

const estimateRow = {
  id: 'estimate-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  status: 'draft',
  version_name: 'Kitchen Quote',
  version_state: 'draft',
  version_kind: 'standard',
  version_sort_order: 1,
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-02T00:00:00.000Z',
}

function buildTableMap(overrides?: Record<string, unknown>) {
  return {
    estimates: createMaybeSingleChain({
      data: estimateRow,
      error: null,
    }),
    jobs: createMaybeSingleChain({
      data: { id: 'job-1', title: 'Kitchen', estimate_date: '2026-04-22' },
      error: null,
    }),
    customers: createMaybeSingleChain({
      data: {
        id: 'customer-1',
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: '555-1212',
        address: '123 Main',
        street: '123 Main',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      },
      error: null,
    }),
    estimate_template_settings: createMaybeSingleChain({
      data: { updated_at: '2026-04-01T00:00:00.000Z' },
      error: null,
    }),
    estimate_jobsettings: createMaybeSingleChain({
      data: { override_labor_rate: 75 },
      error: null,
    }),
    estimate_rooms: createOrderedCollectionChain({
      data: [{ room_id: 'room-1' }],
      error: null,
    }),
    estimate_room_wall_scopes: createOrderedCollectionChain({
      data: [{ room_id: 'room-1' }],
      error: null,
    }),
    estimate_segments: [
      createOrderedCollectionChain({
        data: [{ id: 'segment-1' }],
        error: null,
      }),
      createOrderedCollectionChain({
        data: [{ id: 'wall-segment-1' }],
        error: null,
      }),
    ],
    estimate_ceiling_segments: createOrderedCollectionChain({
      data: [{ id: 'ceiling-segment-1' }],
      error: null,
    }),
    estimate_room_ceiling_scopes: createOrderedCollectionChain({
      data: [{ room_id: 'room-1' }],
      error: null,
    }),
    estimate_room_ceiling_scope_segments: createOrderedCollectionChain({
      data: [{ id: 'ceiling-scope-segment-1' }],
      error: null,
    }),
    estimate_room_trim_scopes: createOrderedCollectionChain({
      data: [{ room_id: 'room-1' }],
      error: null,
    }),
    estimate_trim_items: createOrderedCollectionChain({
      data: [{ id: 'trim-1' }],
      error: null,
    }),
    estimate_other: createOrderedCollectionChain({
      data: [{ id: 'other-1' }],
      error: null,
    }),
    estimate_public_versions: createOrderedCollectionChain({
      data: [
        { id: 'version-2', version_number: 2, created_at: '2026-04-02T00:00:00.000Z' },
        { id: 'version-1', version_number: 1, created_at: '2026-04-01T00:00:00.000Z' },
      ],
      error: null,
    }),
    ...overrides,
  }
}

function installTableMap(tableMap: Record<string, unknown>) {
  const segmentEntries = Array.isArray(tableMap.estimate_segments)
    ? [...tableMap.estimate_segments]
    : []

  mockFrom.mockImplementation((table: string) => {
    if (table === 'estimate_segments') {
      const nextEntry = segmentEntries.shift()
      if (!nextEntry) throw new Error(`Unexpected extra table ${table}`)
      return nextEntry
    }

    const entry = tableMap[table]
    if (!entry) throw new Error(`Unexpected table ${table}`)
    return entry
  })
}

describe('customer send context loader', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockLoadCompanyProfileSettings.mockReset()
    mockLoadQuoteSendDefaults.mockReset()
    mockGetEstimateCatalogs.mockReset()

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
      terms_text: 'Standard terms',
    })
    mockGetEstimateCatalogs.mockResolvedValue({
      catalogs: { paints: [] },
    })
  })

  it('returns Quote not found when the base estimate is missing', async () => {
    installTableMap({
      estimates: createMaybeSingleChain({
        data: null,
        error: null,
      }),
    })

    const result = await loadEstimateCustomerSendResources({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'missing',
    })

    expect(result).toEqual({ error: 'Quote not found' })
  })

  it('maps required query errors into the stable error contract', async () => {
    installTableMap(
      buildTableMap({
        estimate_room_trim_scopes: createOrderedCollectionChain({
          data: null,
          error: { message: 'trim query failed' },
        }),
      })
    )

    const result = await loadEstimateCustomerSendResources({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result).toEqual({ error: 'trim query failed' })
  })

  it('falls back for optional settings/default loaders and degrades catalog failures to null', async () => {
    installTableMap(buildTableMap())
    mockLoadCompanyProfileSettings.mockRejectedValue(new Error('boom'))
    mockLoadQuoteSendDefaults.mockRejectedValue(new Error('boom'))
    mockGetEstimateCatalogs.mockRejectedValue(new Error('boom'))

    const result = await loadEstimateCustomerSendResources({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result).toEqual(
      expect.objectContaining({
        company: expect.objectContaining({
          business_name: '',
          timezone: 'America/Chicago',
        }),
        quoteDefaults: expect.objectContaining({
          default_template_key: 'default',
          quote_validity_days: 90,
          terms_text: '',
        }),
        catalogs: null,
      })
    )
  })

  it('assembles the same raw resource shape on success', async () => {
    installTableMap(buildTableMap())

    const result = await loadEstimateCustomerSendResources({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result).toEqual({
      estimate: estimateRow,
      job: { id: 'job-1', title: 'Kitchen', estimate_date: '2026-04-22' },
      customer: {
        id: 'customer-1',
        name: 'Taylor',
        email: 'taylor@example.com',
        phone: '555-1212',
        address: '123 Main',
        street: '123 Main',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
      },
      company: {
        business_name: 'ACE Painting',
        timezone: 'America/Chicago',
        main_phone: '',
        business_email: '',
        address: '',
        website: '',
        sender_signature: '',
        logo_url: '',
      },
      quoteDefaults: {
        default_template_key: 'default',
        quote_validity_days: 90,
        terms_text: 'Standard terms',
      },
      settingsRow: { updated_at: '2026-04-01T00:00:00.000Z' },
      jobsettings: { override_labor_rate: 75 },
      rooms: [{ room_id: 'room-1' }],
      wallScopes: [{ room_id: 'room-1' }],
      segments: [{ id: 'segment-1' }],
      wallSegments: [{ id: 'wall-segment-1' }],
      ceilingSegments: [{ id: 'ceiling-segment-1' }],
      ceilingScopes: [{ room_id: 'room-1' }],
      ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
      trimScopes: [{ room_id: 'room-1' }],
      trimItems: [{ id: 'trim-1' }],
      other: [{ id: 'other-1' }],
      publicVersions: [
        { id: 'version-2', version_number: 2, created_at: '2026-04-02T00:00:00.000Z' },
        { id: 'version-1', version_number: 1, created_at: '2026-04-01T00:00:00.000Z' },
      ],
      catalogs: { paints: [] },
    })
  })

  it('keeps public version ordering descending by version number and creation date', async () => {
    const versionChain = createOrderedCollectionChain({
      data: [{ id: 'version-2' }, { id: 'version-1' }],
      error: null,
    })
    installTableMap({
      estimate_public_versions: versionChain,
    })

    const result = await loadEstimateCustomerSendVersionResources({
      orgId: 'org-1',
      estimateId: 'estimate-1',
    })

    expect(versionChain.order).toHaveBeenNthCalledWith(1, 'version_number', {
      ascending: false,
    })
    expect(versionChain.order).toHaveBeenNthCalledWith(2, 'created_at', {
      ascending: false,
    })
    expect(result).toEqual({
      publicVersions: [{ id: 'version-2' }, { id: 'version-1' }],
    })
  })
})
