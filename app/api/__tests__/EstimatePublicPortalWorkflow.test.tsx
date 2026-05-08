import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockFrom,
  mockEnsureAcceptedEstimateOperationalSnapshot,
  mockWriteEstimatePublicEvent,
  mockSendPublicEstimateAcceptanceNotifications,
  mockSendPublicEstimateDeclineNotification,
  mockBuildCustomerEstimateDocument,
} = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockEnsureAcceptedEstimateOperationalSnapshot: vi.fn(),
  mockWriteEstimatePublicEvent: vi.fn(),
  mockSendPublicEstimateAcceptanceNotifications: vi.fn(),
  mockSendPublicEstimateDeclineNotification: vi.fn(),
  mockBuildCustomerEstimateDocument: vi.fn(),
}))

vi.mock('@/lib/server/org', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/server/org.ts', () => ({
  supabaseAdmin: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/server/customer-send/repository', () => ({
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

vi.mock('@/lib/server/customer-send/repository.ts', () => ({
  writeEstimatePublicEvent: mockWriteEstimatePublicEvent,
}))

vi.mock('@/lib/server/accepted-estimates/service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/accepted-estimates/service')>()
  return {
    ...actual,
    ensureAcceptedEstimateOperationalSnapshot: mockEnsureAcceptedEstimateOperationalSnapshot,
  }
})

vi.mock('@/lib/server/accepted-estimates/service.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/accepted-estimates/service')>()
  return {
    ...actual,
    ensureAcceptedEstimateOperationalSnapshot: mockEnsureAcceptedEstimateOperationalSnapshot,
  }
})

vi.mock('@/lib/server/publicEstimateNotifications', () => ({
  sendPublicEstimateAcceptanceNotifications: mockSendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification: mockSendPublicEstimateDeclineNotification,
}))

vi.mock('@/lib/server/publicEstimateNotifications.ts', () => ({
  sendPublicEstimateAcceptanceNotifications: mockSendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification: mockSendPublicEstimateDeclineNotification,
}))

vi.mock('@/lib/customer-estimates/build', () => ({
  buildCustomerEstimateDocument: mockBuildCustomerEstimateDocument,
}))

import {
  acceptPublicEstimate,
  declinePublicEstimate,
  loadPublicEstimateSnapshot,
  markPublicEstimateViewed,
} from '@/lib/server/estimatePublicPortal'
import {
  buildEstimatePublicPersistedSnapshot,
} from '@/lib/customer-estimates/publicSnapshot'

function createMaybeSingleChain(
  result: unknown,
  hooks?: {
    eq?: (column: string, value: unknown) => void
    in?: (column: string, values: unknown[]) => void
    is?: (column: string, value: unknown) => void
    select?: (columns?: string) => void
    maybeSingle?: () => void
  }
) {
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      hooks?.eq?.(column, value)
      return chain
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      hooks?.in?.(column, values)
      return chain
    }),
    is: vi.fn((column: string, value: unknown) => {
      hooks?.is?.(column, value)
      return chain
    }),
    select: vi.fn((columns?: string) => {
      hooks?.select?.(columns)
      return chain
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  chain.maybeSingle.mockImplementation(() => {
    hooks?.maybeSingle?.()
    return Promise.resolve(result)
  })
  return chain
}

function createUpdateOnlyChain(
  result: { data?: unknown; error: { message?: string } | null },
  onUpdate?: (filters: Record<string, unknown>, orFilter: string | null) => void
) {
  const filters: Record<string, unknown> = {}
  let orFilter: string | null = null
  const chain = {
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value
      return chain
    }),
    or: vi.fn((filter: string) => {
      orFilter = filter
      return chain
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters[column] = value
      return chain
    }),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(() => {
      onUpdate?.({ ...filters }, orFilter)
      return Promise.resolve({
        data: result.data === undefined ? { id: 'updated-row' } : result.data,
        error: result.error,
      })
    }),
  }
  return chain
}

function createLoadedVersion(status: string) {
  const statusTimestamps = {
    sent_at: '2026-05-01T00:00:00.000Z',
    viewed_at: status === 'viewed' ? '2026-05-01T00:00:00.000Z' : null,
    accepted_at: status === 'accepted' ? '2026-05-01T00:00:00.000Z' : null,
    declined_at: status === 'declined' ? '2026-05-01T00:00:00.000Z' : null,
  }

  const document = {
    meta: {
      estimate_id: 'estimate-1',
      version_state: 'draft',
      flow_version: 'v2',
      title: 'Kitchen Quote',
      version_name: 'Option A',
      quote_date: '2026-05-01',
      sent_at: statusTimestamps.sent_at,
      viewed_at: statusTimestamps.viewed_at,
      accepted_at: statusTimestamps.accepted_at,
      declined_at: statusTimestamps.declined_at,
      status,
      public_token: 'token-1',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'office@example.com',
      address: '123 Main St',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Taylor Smith',
      email: 'taylor@example.com',
      address: '123 Main St',
      phone: '555-0123',
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
    },
    intro_paragraph: '',
    closing_paragraph: '',
    quote_validity_days: 30,
    deposit_language: '',
    card_fee_note: '',
    quote_rows: [],
    scopes: [],
    total: 4250,
    terms: ['Terms line'],
    source_meta: {
      company: {
        business_name: true,
        main_phone: true,
        business_email: true,
        address: true,
        website: false,
        sender_signature: false,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: true,
      },
      overrides: {
        title: false,
        intro_paragraph: false,
        closing_paragraph: false,
        deposit_language: false,
        card_fee_note: false,
      },
    },
    header: {
      company_name: 'ACE Painting',
      contact_lines: ['555-0100', 'office@example.com'],
      logo_url: '',
      document_label: 'QUOTE',
      quote_date_label: '2026-05-01',
    },
    customer_block: {
      lines: ['Taylor Smith', '123 Main St'],
    },
    pricing_block: {
      rows: [],
      total: 4250,
      footer_note: 'Footer note',
    },
    terms_page: {
      title: 'QUOTE TERMS',
      sections: [],
    },
    assembly_meta: {
      missing_company_fields: [],
      missing_payment_fields: [],
      missing_legal_fields: [],
      used_placeholder_fallbacks: false,
      used_explicit_terms_text: true,
    },
  }

  return {
    id: 'version-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    created_by: 'staff-user-1',
    version_number: 2,
    status,
    public_token: 'token-1',
    snapshot_json: buildEstimatePublicPersistedSnapshot({ document }),
    sent_at: statusTimestamps.sent_at,
    viewed_at: statusTimestamps.viewed_at,
    accepted_at: statusTimestamps.accepted_at,
    declined_at: statusTimestamps.declined_at,
    locked_at: status === 'accepted' || status === 'declined' ? '2026-05-01T00:00:00.000Z' : null,
    acceptance_json:
      status === 'accepted'
        ? {
            legal_name: 'Taylor Smith',
            signature_type: 'typed',
          }
        : null,
  }
}

function createAcceptedEventLookup(data: unknown) {
  return {
    select: vi.fn(() =>
      createMaybeSingleChain({
        data,
        error: null,
      })
    ),
  }
}

function createEventLookupSequence(...results: unknown[]) {
  let index = 0
  return {
    select: vi.fn(() => {
      const result = results[Math.min(index, results.length - 1)]
      index += 1
      return createMaybeSingleChain({
        data: result,
        error: null,
      })
    }),
  }
}

function createJobLookup(data: unknown) {
  return {
    select: vi.fn(() =>
      createMaybeSingleChain({
        data,
        error: null,
      })
    ),
  }
}

describe('estimate public portal transitions', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockFrom.mockReset()
    mockEnsureAcceptedEstimateOperationalSnapshot.mockReset()
    mockEnsureAcceptedEstimateOperationalSnapshot.mockResolvedValue({
      ok: true,
      data: { id: 'snapshot-1' },
    })
    mockWriteEstimatePublicEvent.mockReset()
    mockWriteEstimatePublicEvent.mockResolvedValue({ ok: true, data: null })
    mockSendPublicEstimateAcceptanceNotifications.mockReset()
    mockSendPublicEstimateDeclineNotification.mockReset()
    mockBuildCustomerEstimateDocument.mockReset()
    mockSendPublicEstimateAcceptanceNotifications.mockResolvedValue({
      internal: { messageId: 'internal-1' },
      customer: { messageId: 'customer-1' },
    })
    mockSendPublicEstimateDeclineNotification.mockResolvedValue({
      internal: { messageId: 'internal-1' },
    })
  })

  it('accepts sent quotes and writes one accepted event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T00:00:00.000Z'))

    const calls: string[] = []
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
        maybeSingle: () => {
          calls.push('public-version-update')
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({
          org_id: 'org-1',
          id: 'estimate-1',
          accepted_public_version_id: null,
        })
        calls.push('estimate-update')
      })
    )
    const jobUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({ org_id: 'org-1', id: 'job-1' })
        calls.push('job-update')
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected accepted result')
    expect(result.data).toEqual(
      expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
        accepted_at: '2026-05-01T00:00:00.000Z',
      })
    )
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'accepted',
        acceptance_json: expect.objectContaining({
          legal_name: 'Taylor Smith',
          user_agent: 'Vitest',
          ip: '127.0.0.1',
        }),
      })
    )
    expect(estimateUpdateSpy).toHaveBeenCalledWith({
      accepted_at: '2026-04-01T00:00:00.000Z',
      accepted_public_version_id: 'version-1',
      version_state: 'live',
    })
    expect(jobUpdateSpy).toHaveBeenCalledWith({
      linked_estimate_id: 'estimate-1',
    })
    expect(mockEnsureAcceptedEstimateOperationalSnapshot).toHaveBeenCalledWith({
      requestOrigin: '',
      orgId: 'org-1',
      userId: 'staff-user-1',
      estimateId: 'estimate-1',
      publicVersionId: 'version-1',
    })
    expect(calls).toEqual([
      'public-version-update',
      'estimate-update',
      'job-update',
    ])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockSendPublicEstimateAcceptanceNotifications).toHaveBeenCalledTimes(1)
    expect(mockSendPublicEstimateAcceptanceNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: undefined,
        orgId: 'org-1',
        userId: 'staff-user-1',
        publicToken: 'token-1',
        acceptedBy: 'Taylor Smith',
        acceptedAt: '2026-04-01T00:00:00.000Z',
      })
    )
    expect(mockSendPublicEstimateDeclineNotification).not.toHaveBeenCalled()
  })

  it('logs notification delivery failures without rolling back accepted quotes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSendPublicEstimateAcceptanceNotifications.mockResolvedValueOnce({
      internal: { error: 'Gmail authorization required' },
      customer: { skipped: true, reason: 'missing_sender_user' },
    })

    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      origin: 'https://example.test',
    })

    expect(result.ok).toBe(true)
    expect(errorSpy).toHaveBeenCalledWith(
      '[public-estimate-notification] acceptance internal failed',
      'Gmail authorization required'
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[public-estimate-notification] acceptance customer skipped',
      'missing_sender_user'
    )

    errorSpy.mockRestore()
  })

  it('blocks acceptance after the public quote validity window expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T00:00:00.000Z'))

    const sentVersion = createLoadedVersion('sent')
    const sentDocument = (sentVersion.snapshot_json as Record<string, unknown>)
      .document as Record<string, unknown>
    const expiredVersion = {
      ...sentVersion,
      sent_at: '2026-04-01T00:00:00.000Z',
      snapshot_json: {
        ...((sentVersion.snapshot_json as Record<string, unknown> | null | undefined) ?? {}),
        document: {
          ...sentDocument,
          quote_validity_days: 30,
          meta: {
            ...((sentDocument.meta as Record<string, unknown> | null | undefined) ?? {}),
            sent_at: '2026-04-01T00:00:00.000Z',
          },
        },
      },
    }
    const updateSpy = vi.fn()

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: expiredVersion,
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'This quote has expired. Please contact us for an updated quote.',
    })
    expect(updateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(mockSendPublicEstimateAcceptanceNotifications).not.toHaveBeenCalled()
  })

  it('marks viewed with org and status guards and writes one viewed event', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'))

    const updateFilters: Array<[string, unknown]> = []
    const updateStatusFilters: Array<[string, unknown[]]> = []
    const nullFilters: Array<[string, unknown]> = []
    const viewedVersion = {
      ...createLoadedVersion('viewed'),
      viewed_at: '2026-04-02T12:00:00.000Z',
    }
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain(
        {
          data: viewedVersion,
          error: null,
        },
        {
          eq: (column, value) => {
            updateFilters.push([column, value])
          },
          in: (column, values) => {
            updateStatusFilters.push([column, values])
          },
          is: (column, value) => {
            nullFilters.push([column, value])
          },
        }
      )
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await markPublicEstimateViewed({
      orgId: 'org-1',
      versionId: 'version-1',
      actorType: 'staff',
      metadata: { origin: 'preview' },
    })

    expect(result).toEqual({
      ok: true,
      viewed_at: '2026-04-02T12:00:00.000Z',
      version: viewedVersion,
    })
    expect(updateSpy).toHaveBeenCalledWith({
      status: 'viewed',
      viewed_at: '2026-04-02T12:00:00.000Z',
    })
    expect(updateFilters).toEqual([
      ['org_id', 'org-1'],
      ['id', 'version-1'],
    ])
    expect(updateStatusFilters).toEqual([
      ['status', ['sent', 'viewed']],
    ])
    expect(nullFilters).toEqual([
      ['viewed_at', null],
    ])
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith({
      orgId: 'org-1',
      versionId: 'version-1',
      eventType: 'viewed',
      actorType: 'staff',
      metadata: { origin: 'preview' },
    })
  })

  it('keeps the loaded snapshot when viewed update races and affects no row', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'))

    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: null,
        error: null,
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                ...createLoadedVersion('sent'),
                viewed_at: null,
              },
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('token-1')

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'sent',
        viewed_at: null,
      }),
    })
    expect(updateSpy).toHaveBeenCalledWith({
      status: 'viewed',
      viewed_at: '2026-04-02T12:00:00.000Z',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
    expect(mockBuildCustomerEstimateDocument).not.toHaveBeenCalled()
  })

  it('loads persisted public snapshots without invoking customer document builders', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('viewed'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('token-1')

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'viewed',
      }),
    })
    expect(mockBuildCustomerEstimateDocument).not.toHaveBeenCalled()
  })

  it('fails closed for legacy public snapshots instead of rendering them', async () => {
    const canonicalVersion = createLoadedVersion('viewed')
    const canonicalSnapshot = canonicalVersion.snapshot_json as Record<string, unknown>
    const legacyVersion = {
      ...canonicalVersion,
      snapshot_json: {
        document: canonicalSnapshot.document,
        draft: { subject: 'Legacy public draft' },
      },
    }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: legacyVersion,
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loadPublicEstimateSnapshot('token-1')

    expect(result).toEqual({
      ok: false,
      kind: 'not_found',
      message:
        'Quote snapshot requires migration to the canonical customer artifact before public rendering.',
    })
    expect(mockBuildCustomerEstimateDocument).not.toHaveBeenCalled()
  })

  it('treats already-viewed rows as a no-op and skips viewed event writes', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-02T12:00:00.000Z'))

    const nullFilters: Array<[string, unknown]> = []
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain(
        {
          data: null,
          error: null,
        },
        {
          is: (column, value) => {
            nullFilters.push([column, value])
          },
        }
      )
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          update: updateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await markPublicEstimateViewed({
      orgId: 'org-1',
      versionId: 'version-1',
      actorType: 'customer',
    })

    expect(result).toEqual({
      ok: true,
      viewed_at: null,
      version: null,
    })
    expect(nullFilters).toEqual([
      ['viewed_at', null],
    ])
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('returns conflict when status-conditional accept update affects no row', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: null,
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Quote status changed before this action completed',
    })
    expect(estimateUpdateSpy).not.toHaveBeenCalled()
    expect(jobUpdateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects accepting a stale public version when the estimate is already accepted by another version', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_public_version_id: 'version-2',
                accepted_at: '2026-04-01T00:00:00.000Z',
              },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Estimate is already accepted by another public version',
    })
    expect(updateSpy).not.toHaveBeenCalled()
    expect(estimateUpdateSpy).not.toHaveBeenCalled()
    expect(jobUpdateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('maps accepted public version unique-index races to conflict', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: null,
        error: {
          message:
            'duplicate key value violates unique constraint "estimate_public_versions_one_accepted_per_estimate_idx"',
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_public_version_id: null,
                accepted_at: null,
              },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Estimate is already accepted by another public version',
    })
    expect(estimateUpdateSpy).not.toHaveBeenCalled()
    expect(jobUpdateSpy).not.toHaveBeenCalled()
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('can repair ownership and event after event write fails following public accept', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('accepted'),
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
      })
    )
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'Unable to write event',
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('sent'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const firstResult = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(firstResult).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Unable to write event',
    })
    expect(updateSpy).toHaveBeenCalledTimes(1)
    expect(estimateUpdateSpy).toHaveBeenCalledTimes(1)
    expect(jobUpdateSpy).toHaveBeenCalledTimes(1)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const retryResult = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(retryResult).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledTimes(2)
    expect(jobUpdateSpy).toHaveBeenCalledTimes(2)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(2)
  })

  it.each(['estimate_sent', 'follow_up'])(
    'repairs accepted retry ownership without scheduling when initial job update fails and job is %s',
    async () => {
      const updateSpy = vi.fn(() =>
        createMaybeSingleChain({
          data: createLoadedVersion('accepted'),
          error: null,
        })
      )
      const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
      const jobUpdateSpy = vi
        .fn()
        .mockImplementationOnce(() =>
          createUpdateOnlyChain({
            error: { message: 'Unable to update job' },
          })
        )
        .mockImplementation(() => createUpdateOnlyChain({ error: null }))

      mockFrom.mockImplementation((table: string) => {
        if (table === 'estimate_public_versions') {
          return {
            select: vi.fn(() =>
              createMaybeSingleChain({
                data: createLoadedVersion('sent'),
                error: null,
              })
            ),
            update: updateSpy,
          }
        }
        if (table === 'estimates') {
          return {
            select: vi.fn(() =>
              createMaybeSingleChain({
                data: { id: 'estimate-1', job_id: 'job-1' },
                error: null,
              })
            ),
            update: estimateUpdateSpy,
          }
        }
        if (table === 'jobs') {
          return {
            update: jobUpdateSpy,
          }
        }
        throw new Error(`Unexpected table ${table}`)
      })

      const firstResult = await acceptPublicEstimate({
        token: 'token-1',
        legalName: 'Taylor Smith',
        acceptedTerms: true,
      })

      expect(firstResult).toEqual({
        ok: false,
        kind: 'server_error',
        message: 'Unable to update job',
      })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'estimate_public_versions') {
          return {
            select: vi.fn(() =>
              createMaybeSingleChain({
                data: createLoadedVersion('accepted'),
                error: null,
              })
            ),
          }
        }
        if (table === 'estimates') {
          return {
            select: vi.fn(() =>
              createMaybeSingleChain({
                data: { id: 'estimate-1', job_id: 'job-1' },
                error: null,
              })
            ),
            update: estimateUpdateSpy,
          }
        }
        if (table === 'jobs') {
          return {
            update: jobUpdateSpy,
          }
        }
        if (table === 'estimate_public_events') {
          return createAcceptedEventLookup(null)
        }
        throw new Error(`Unexpected table ${table}`)
      })

      const retryResult = await acceptPublicEstimate({
        token: 'token-1',
        legalName: 'Taylor Smith',
        acceptedTerms: true,
      })

      expect(retryResult).toEqual({
        ok: true,
        data: expect.objectContaining({
          estimate_version_id: 'version-1',
          status: 'accepted',
        }),
      })
      expect(jobUpdateSpy).toHaveBeenLastCalledWith({
        linked_estimate_id: 'estimate-1',
      })
      expect(mockEnsureAcceptedEstimateOperationalSnapshot).toHaveBeenCalledWith({
        requestOrigin: '',
        orgId: 'org-1',
        userId: 'staff-user-1',
        estimateId: 'estimate-1',
        publicVersionId: 'version-1',
      })
      expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    }
  )

  it('reconciles ownership and writes missing event for repeated accept', async () => {
    const estimateUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({
          org_id: 'org-1',
          id: 'estimate-1',
          accepted_public_version_id: null,
        })
      })
    )
    const jobUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({ org_id: 'org-1', id: 'job-1' })
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledWith({
      accepted_at: '2026-05-01T00:00:00.000Z',
      accepted_public_version_id: 'version-1',
      version_state: 'live',
    })
    expect(jobUpdateSpy).toHaveBeenCalledWith({
      linked_estimate_id: 'estimate-1',
    })
    expect(mockEnsureAcceptedEstimateOperationalSnapshot).toHaveBeenCalledWith({
      requestOrigin: '',
      orgId: 'org-1',
      userId: 'staff-user-1',
      estimateId: 'estimate-1',
      publicVersionId: 'version-1',
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('writes missing accepted event without rescheduling an already linked completed job on repeated accept', async () => {
    const estimateUpdateSpy = vi.fn(() =>
      createUpdateOnlyChain({ error: null }, (filters) => {
        expect(filters).toEqual({
          org_id: 'org-1',
          id: 'estimate-1',
          accepted_public_version_id: null,
        })
      })
    )
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: 'estimate-1',
            status: 'completed',
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledWith({
      accepted_at: '2026-05-01T00:00:00.000Z',
      accepted_public_version_id: 'version-1',
      version_state: 'live',
    })
    expect(jobUpdateSpy).toHaveBeenCalledWith({
      linked_estimate_id: 'estimate-1',
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('treats duplicate terminal accepted event writes as idempotent success', async () => {
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message:
        'duplicate key value violates unique constraint "estimate_public_events_terminal_once_idx"',
    })
    const eventLookup = createEventLookupSequence(null, {
      id: 'event-1',
      event_type: 'accepted',
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return eventLookup
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate terminal accept when the stored terminal event is declined', async () => {
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    mockWriteEstimatePublicEvent.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message:
        'duplicate key value violates unique constraint "estimate_public_events_terminal_once_idx"',
    })
    const eventLookup = createEventLookupSequence(null, {
      id: 'event-1',
      event_type: 'declined',
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return eventLookup
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Public quote already has a different terminal event',
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
  })

  it('reconciles ownership without duplicating existing event for repeated accept', async () => {
    const estimateUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))
    const jobUpdateSpy = vi.fn(() => createUpdateOnlyChain({ error: null }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: { id: 'estimate-1', job_id: 'job-1' },
              error: null,
            })
          ),
          update: estimateUpdateSpy,
        }
      }
      if (table === 'jobs') {
        return {
          ...createJobLookup({
            id: 'job-1',
            linked_estimate_id: null,
          }),
          update: jobUpdateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup({ id: 'event-1' })
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
      }),
    })
    expect(estimateUpdateSpy).toHaveBeenCalledTimes(1)
    expect(jobUpdateSpy).toHaveBeenCalledTimes(1)
    expect(mockEnsureAcceptedEstimateOperationalSnapshot).toHaveBeenCalledWith({
      requestOrigin: '',
      orgId: 'org-1',
      userId: 'staff-user-1',
      estimateId: 'estimate-1',
      publicVersionId: 'version-1',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects accepting a declined quote as a conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('declined'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot accept a declined quote',
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('declines viewed quotes and writes one declined event', async () => {
    const updateSpy = vi.fn(() =>
      createMaybeSingleChain({
        data: createLoadedVersion('declined'),
        error: null,
      }, {
        in: (column, values) => {
          expect(column).toBe('status')
          expect(values).toEqual(['sent', 'viewed'])
        },
      })
    )

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('viewed'),
              error: null,
            })
          ),
          update: updateSpy,
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Going another direction',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected declined result')
    expect(result.data).toEqual(
      expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'declined',
        declined_at: '2026-05-01T00:00:00.000Z',
      })
    )
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'declined',
      })
    )
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
        metadata: { reason: 'Going another direction' },
      })
    )
    expect(mockSendPublicEstimateDeclineNotification).toHaveBeenCalledTimes(1)
    expect(mockSendPublicEstimateDeclineNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: undefined,
        orgId: 'org-1',
        userId: 'staff-user-1',
        publicToken: 'token-1',
        declinedAt: expect.any(String),
        reason: 'Going another direction',
      })
    )
    expect(mockSendPublicEstimateAcceptanceNotifications).not.toHaveBeenCalled()
  })

  it('writes missing declined event for repeated decline', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('declined'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup(null)
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Still declining',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'declined',
      }),
    })
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledTimes(1)
    expect(mockWriteEstimatePublicEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'declined',
        actorType: 'customer',
        metadata: { reason: 'Still declining' },
      })
    )
  })

  it('does not duplicate existing declined event for repeated decline', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('declined'),
              error: null,
            })
          ),
        }
      }
      if (table === 'estimate_public_events') {
        return createAcceptedEventLookup({ id: 'event-1' })
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Still declining',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'declined',
      }),
    })
    expect(mockWriteEstimatePublicEvent).not.toHaveBeenCalled()
  })

  it('rejects declining an accepted quote as a conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('accepted'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await declinePublicEstimate({
      token: 'token-1',
      reason: 'Too late',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'Cannot decline an accepted quote',
    })
  })

  it('rejects accepting a superseded quote as a conflict', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createMaybeSingleChain({
              data: createLoadedVersion('superseded'),
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    const result = await acceptPublicEstimate({
      token: 'token-1',
      legalName: 'Taylor Smith',
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
    })

    expect(result).toEqual({
      ok: false,
      kind: 'conflict',
      message: 'A newer quote is available.',
    })
  })
})
