import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-key'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  applyAcceptedEstimateSideEffects: vi.fn(),
  ensureAcceptedEstimateOperationalSnapshot: vi.fn(),
  writeEstimatePublicEvent: vi.fn(),
  saveCustomerSendDraftVersion: vi.fn(),
  submitCustomerSendMessage: vi.fn(),
  sendPublicEstimateAcceptanceNotifications: vi.fn(),
  sendPublicEstimateDeclineNotification: vi.fn(),
}))

const state = vi.hoisted(() => ({
  store: null as ReturnType<
    typeof import('../customer-send/__tests__/customerSendContractHarness')['createPublicVersionStore']
  > | null,
}))

vi.mock('../org.ts', () => ({
  supabaseAdmin: {
    from: mocks.from,
  },
}))

vi.mock('../accepted-estimates/service.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../accepted-estimates/service.ts')>()
  return {
    ...actual,
    applyAcceptedEstimateSideEffects: mocks.applyAcceptedEstimateSideEffects,
    ensureAcceptedEstimateOperationalSnapshot: mocks.ensureAcceptedEstimateOperationalSnapshot,
  }
})

vi.mock('../customer-send/repository.ts', () => ({
  saveCustomerSendDraftVersion: mocks.saveCustomerSendDraftVersion,
  upgradeCustomerSendLegacyVersionSnapshot: vi.fn(async () => {
    throw new Error('legacy upgrade not expected in public portal tests')
  }),
  writeEstimatePublicEvent: mocks.writeEstimatePublicEvent,
}))

vi.mock('../customer-send/delivery.ts', () => ({
  submitCustomerSendMessage: mocks.submitCustomerSendMessage,
}))

vi.mock('../publicEstimateNotifications.ts', () => ({
  sendPublicEstimateAcceptanceNotifications: mocks.sendPublicEstimateAcceptanceNotifications,
  sendPublicEstimateDeclineNotification: mocks.sendPublicEstimateDeclineNotification,
}))

import {
  loadCustomerSendPageData,
  submitCustomerSendMutation,
} from '../customer-send/service'
import {
  buildEstimatePublicPersistedSnapshot,
} from '../../customer-estimates/publicSnapshot'
import {
  attachPersistedVersionToContext,
  buildCustomerSendContractContext,
  createPublicVersionStore,
} from '../customer-send/__tests__/customerSendContractHarness'

const {
  acceptPublicEstimate,
  loadPublicEstimatePortalSnapshot,
} = await import('../estimatePublicPortal')

function buildDocument() {
  return {
    meta: {
      estimate_id: 'estimate-1',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      flow_version: 'v2',
      title: 'Kitchen Quote',
      quote_date: '2026-05-01',
      sent_at: '2026-05-01T12:00:00.000Z',
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      status: 'sent',
      public_token: 'token-1',
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '555-0100',
      business_email: 'hello@example.test',
      address: '123 Main St',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Taylor Smith',
      email: 'taylor@example.test',
      phone: '555-0123',
      address: '123 Main St',
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
      contact_lines: ['555-0100', 'hello@example.test'],
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
}

function buildVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'version-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    created_by: 'staff-user-1',
    version_number: 2,
    status: 'sent',
    public_token: 'token-1',
    sent_at: '2026-05-01T12:00:00.000Z',
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    locked_at: '2026-05-01T12:00:00.000Z',
    acceptance_json: null,
    snapshot_json: buildEstimatePublicPersistedSnapshot({
      document: buildDocument(),
      draft: {
        subject: 'Kitchen Quote ready',
      },
    }),
    ...overrides,
  }
}

function createSelectChain(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return chain
}

function createUpdateChain(result: unknown) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  return chain
}

describe('estimatePublicPortal canonical artifact enforcement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-07T18:00:00.000Z'))

    mocks.from.mockReset()
    mocks.applyAcceptedEstimateSideEffects.mockReset()
    mocks.ensureAcceptedEstimateOperationalSnapshot.mockReset()
    mocks.writeEstimatePublicEvent.mockReset()
    mocks.saveCustomerSendDraftVersion.mockReset()
    mocks.submitCustomerSendMessage.mockReset()
    mocks.sendPublicEstimateAcceptanceNotifications.mockReset()
    mocks.sendPublicEstimateDeclineNotification.mockReset()
    state.store = null

    mocks.applyAcceptedEstimateSideEffects.mockResolvedValue({
      ok: true,
      data: null,
    })
    mocks.ensureAcceptedEstimateOperationalSnapshot.mockResolvedValue({
      ok: true,
      data: { id: 'snapshot-1' },
    })
    mocks.writeEstimatePublicEvent.mockResolvedValue({
      ok: true,
      data: null,
    })
    mocks.saveCustomerSendDraftVersion.mockImplementation(async (params) => {
      if (!state.store) throw new Error('store not initialized')
      return { ok: true as const, data: state.store.persistDraft(params) }
    })
    mocks.submitCustomerSendMessage.mockImplementation(async (params) => {
      if (!state.store) throw new Error('store not initialized')
      const sentVersion = state.store.markSent({
        version: params.version,
        publicToken: params.version.public_token ?? 'persisted-token',
        sentAt: '2026-05-07T18:00:00.000Z',
      })
      return {
        ok: true as const,
        data: {
          mode: params.mode,
          public_url: `https://example.test/quote/${sentVersion.public_token}`,
          version: sentVersion,
          document: sentVersion.snapshot_json?.document ?? null,
        },
      }
    })
    mocks.sendPublicEstimateAcceptanceNotifications.mockResolvedValue({
      internal: { messageId: 'internal-1' },
      customer: { messageId: 'customer-1' },
    })
  })

  it('reads the public quote only from the persisted customer artifact path', async () => {
    state.store = createPublicVersionStore()
    const initialContext = buildCustomerSendContractContext()

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'estimate_public_versions') {
        throw new Error(`Unexpected table ${table}`)
      }
      const selectFilters: Record<string, unknown> = {}
      const selectChain = {
        eq: vi.fn((column: string, value: unknown) => {
          selectFilters[column] = value
          return selectChain
        }),
        maybeSingle: vi.fn(async () => ({
          data:
            selectFilters.public_token && state.store
              ? state.store.getByToken(String(selectFilters.public_token))
              : state.store?.version ?? null,
          error: null,
        })),
      }
      const updateFilters: Record<string, unknown> = {}
      const updateChain = {
        eq: vi.fn((column: string, value: unknown) => {
          updateFilters[column] = value
          return updateChain
        }),
        in: vi.fn(() => updateChain),
        is: vi.fn(() => updateChain),
        select: vi.fn(() => updateChain),
        maybeSingle: vi.fn(async () => ({
          data:
            updateFilters.id && state.store
              ? state.store.markViewed('2026-05-07T18:05:00.000Z')
              : null,
          error: null,
        })),
      }
      return {
        select: vi.fn(() => selectChain),
        update: vi.fn(() => updateChain),
      }
    })

    const preview = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: initialContext,
    })

    expect(preview.ok).toBe(true)
    if (!preview.ok) throw new Error(preview.message)
    const previewVersion = state.store?.version
    expect(previewVersion).toBeTruthy()
    if (!previewVersion) throw new Error('preview version missing')

    const sendResult = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          to_email: 'taylor@example.test',
        },
      },
      context: attachPersistedVersionToContext(initialContext, previewVersion),
      copy: {
        sendNotice: 'Quote sent.',
        sendFailureMessage: 'Unable to send quote',
        lockFailureMessage: 'Unable to lock quote',
      },
    })

    expect(sendResult.ok).toBe(true)
    if (!sendResult.ok) throw new Error(sendResult.message)
    const sentVersion = state.store?.version
    expect(sentVersion).toBeTruthy()
    if (!sentVersion) throw new Error('sent version missing')

    const result = await loadPublicEstimatePortalSnapshot({
      token: String(sentVersion.public_token),
      actorType: 'customer',
      metadata: { route: 'public-page' },
      origin: 'https://example.test',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: String(sentVersion.id),
        public_url: `https://example.test/quote/${sentVersion.public_token}`,
        document: preview.data.document,
        snapshot_json: sentVersion.snapshot_json,
      }),
    })
  })

  it('fails closed when the persisted public artifact is unreadable or incomplete', async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table !== 'estimate_public_versions') {
        throw new Error(`Unexpected table ${table}`)
      }
      return {
        select: vi.fn(() =>
          createSelectChain({
            data: buildVersion({
              snapshot_json: {},
            }),
            error: null,
          })
        ),
      }
    })

    const unreadable = await loadPublicEstimatePortalSnapshot({
      token: 'token-1',
      actorType: 'customer',
      metadata: { route: 'public-page' },
      origin: 'https://example.test',
    })

    expect(unreadable).toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Quote snapshot is unreadable',
    })

    mocks.from.mockImplementation((table: string) => {
      if (table !== 'estimate_public_versions') {
        throw new Error(`Unexpected table ${table}`)
      }
      return {
        select: vi.fn(() =>
          createSelectChain({
            data: buildVersion({
              snapshot_json: {
                draft: {
                  subject: 'Missing document',
                },
              },
            }),
            error: null,
          })
        ),
      }
    })

    const incomplete = await loadPublicEstimatePortalSnapshot({
      token: 'token-1',
      actorType: 'customer',
      metadata: { route: 'public-page' },
      origin: 'https://example.test',
    })

    expect(incomplete).toEqual({
      ok: false,
      kind: 'not_found',
      message: 'Quote snapshot is unreadable',
    })
  })

  it('accepts a sent public quote and requests immutable accepted snapshot creation', async () => {
    const loadedVersion = buildVersion()
    const acceptedVersion = buildVersion({
      status: 'accepted',
      accepted_at: '2026-05-07T18:00:00.000Z',
      locked_at: '2026-05-07T18:00:00.000Z',
      acceptance_json: {
        legal_name: 'Taylor Smith',
        accepted_terms: true,
      },
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: loadedVersion,
              error: null,
            })
          ),
          update: vi.fn(() =>
            createUpdateChain({
              data: acceptedVersion,
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_at: null,
                accepted_public_version_id: null,
              },
              error: null,
            })
          ),
        }
      }
      if (table === 'estimate_public_events') {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: null,
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
      origin: 'https://example.test',
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        estimate_version_id: 'version-1',
        status: 'accepted',
        accepted_at: '2026-05-07T18:00:00.000Z',
      }),
    })
    expect(mocks.applyAcceptedEstimateSideEffects).toHaveBeenCalledWith(
      expect.anything(),
      {
        orgId: 'org-1',
        jobId: 'job-1',
        estimateId: 'estimate-1',
        publicVersionId: 'version-1',
        acceptedAt: '2026-05-07T18:00:00.000Z',
      }
    )
    expect(mocks.ensureAcceptedEstimateOperationalSnapshot).toHaveBeenCalledWith({
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'staff-user-1',
      estimateId: 'estimate-1',
      publicVersionId: 'version-1',
    })
  })

  it('keeps acceptance committed when immutable accepted snapshot reconciliation fails after ownership updates', async () => {
    const loadedVersion = buildVersion()
    const acceptedVersion = buildVersion({
      status: 'accepted',
      accepted_at: '2026-05-07T18:00:00.000Z',
      locked_at: '2026-05-07T18:00:00.000Z',
      acceptance_json: {
        legal_name: 'Taylor Smith',
        accepted_terms: true,
      },
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    mocks.ensureAcceptedEstimateOperationalSnapshot.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'snapshot insert failed',
    })

    mocks.from.mockImplementation((table: string) => {
      if (table === 'estimate_public_versions') {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: loadedVersion,
              error: null,
            })
          ),
          update: vi.fn(() =>
            createUpdateChain({
              data: acceptedVersion,
              error: null,
            })
          ),
        }
      }
      if (table === 'estimates') {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: {
                id: 'estimate-1',
                job_id: 'job-1',
                accepted_at: null,
                accepted_public_version_id: null,
              },
              error: null,
            })
          ),
        }
      }
      if (table === 'estimate_public_events') {
        return {
          select: vi.fn(() =>
            createSelectChain({
              data: null,
              error: null,
            })
          ),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })

    try {
      const result = await acceptPublicEstimate({
        token: 'token-1',
        legalName: 'Taylor Smith',
        acceptedTerms: true,
        origin: 'https://example.test',
      })

      expect(result).toEqual({
        ok: true,
        data: expect.objectContaining({
          estimate_version_id: 'version-1',
          status: 'accepted',
        }),
      })
      expect(mocks.applyAcceptedEstimateSideEffects).toHaveBeenCalledTimes(1)
      expect(consoleError).toHaveBeenCalledWith(
        '[public-estimate-acceptance] snapshot creation failed',
        'snapshot insert failed'
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
