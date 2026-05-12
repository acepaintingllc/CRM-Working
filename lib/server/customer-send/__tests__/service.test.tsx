import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  normalizeCustomerSendDraftScopeText: vi.fn(),
  mergeCustomerSendDraftInput: vi.fn(),
  didCustomerSendArtifactInputsChange: vi.fn(),
  sanitizeCustomerSendDraft: vi.fn(),
  buildCustomerSendDocument: vi.fn(),
  buildCustomerSendPublicMeta: vi.fn(),
  buildCustomerSendPublicUrl: vi.fn(),
  resolveCustomerSendVersionState: vi.fn(),
  saveCustomerSendDraftVersion: vi.fn(),
  upgradeCustomerSendLegacyVersionSnapshot: vi.fn(),
  submitCustomerSendMessage: vi.fn(),
  validateCustomerSendReadiness: vi.fn(),
  asText: vi.fn(),
}))

vi.mock('../draft', () => ({
  normalizeCustomerSendDraftScopeText: mocks.normalizeCustomerSendDraftScopeText,
  mergeCustomerSendDraftInput: mocks.mergeCustomerSendDraftInput,
  didCustomerSendArtifactInputsChange: mocks.didCustomerSendArtifactInputsChange,
  normalizeCustomerSendMode: (value: unknown) =>
    String(value ?? '').trim().toLowerCase() === 'send' ? 'send' : 'test',
  sanitizeCustomerSendDraft: mocks.sanitizeCustomerSendDraft,
}))

vi.mock('../document', () => ({
  buildCustomerSendDocument: mocks.buildCustomerSendDocument,
  buildCustomerSendPublicMeta: mocks.buildCustomerSendPublicMeta,
  buildCustomerSendPublicUrl: mocks.buildCustomerSendPublicUrl,
  resolveCustomerSendVersionState: mocks.resolveCustomerSendVersionState,
  asText: mocks.asText,
}))

vi.mock('../repository', () => ({
  saveCustomerSendDraftVersion: mocks.saveCustomerSendDraftVersion,
  upgradeCustomerSendLegacyVersionSnapshot: mocks.upgradeCustomerSendLegacyVersionSnapshot,
}))

vi.mock('../delivery', () => ({
  submitCustomerSendMessage: mocks.submitCustomerSendMessage,
}))

vi.mock('@/lib/customer-send/readiness', () => ({
  validateCustomerSendReadiness: mocks.validateCustomerSendReadiness,
}))

import {
  loadCustomerSendPageData,
  saveCustomerSendDraftMutation,
  submitCustomerSendMutation,
} from '../service'
import {
  buildCustomerSendPersistedSnapshot,
  type CustomerQuoteSourceModel,
} from '../types'

const canonicalDraft = {
  to_email: 'customer@example.com',
  cc_email: '',
  bcc_email: '',
  subject: 'Quote ready',
  body: '',
  template_key: 'default',
  title: 'Kitchen Quote',
  intro_paragraph: '',
  closing_paragraph: '',
  terms_text: '',
  scope_text_edits: {
    walls: '',
    ceilings: '',
    trim: '',
    doors: '',
    cabinets: '',
    other: '',
  },
  quote_validity_days: 30,
  deposit_language: '',
  card_fee_note: '',
}

const assembledDocument = {
  meta: {
    estimate_id: 'estimate-1',
    version_name: 'Kitchen Quote',
    version_state: 'draft',
    flow_version: 'v2',
    title: 'Kitchen Quote',
    quote_date: '2026-04-22',
    sent_at: null,
    viewed_at: null,
    accepted_at: null,
    declined_at: null,
    status: 'draft',
    public_token: null,
  },
  company: {
    business_name: 'ACE Painting',
    timezone: 'America/Chicago',
    main_phone: '555-1212',
    business_email: 'hello@example.com',
    address: '123 Main',
    website: '',
    sender_signature: '',
    logo_url: '',
  },
  customer: {
    name: 'Taylor',
    email: 'customer@example.com',
    phone: '555-1212',
    address: '123 Main',
    street: '123 Main',
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
  total: 1200,
  terms: [],
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
    contact_lines: ['555-1212', 'hello@example.com'],
    logo_url: '',
    document_label: 'QUOTE',
    quote_date_label: '2026-04-22',
  },
  customer_block: {
    lines: ['Taylor', '123 Main'],
  },
  pricing_block: {
    rows: [],
    total: 1200,
    footer_note: 'Footer',
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

const estimateTemplateSettingsRow = {
  default_template_key: 'default',
  quote_validity_days: 30,
  terms_text: '',
  walls_paint_id: null,
  walls_primer_id: null,
  ceiling_paint_id: null,
  ceiling_primer_id: null,
  trim_paint_id: null,
  trim_primer_id: null,
  labor_day_policy_enabled: true,
  dayhours: 8,
  rounding_increment_hours: 4,
  override_labor_rate: 75,
  job_minimum_enabled: false,
  job_minimum_amount: 0,
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
  baseboard_opening_deduction_lf: 3,
}

function buildCanonicalVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    status: 'draft',
    version_number: 2,
    public_token: 'live-token',
    draft_json: null,
    snapshot_json: buildCustomerSendPersistedSnapshot({
      document: assembledDocument,
      draft: canonicalDraft,
    }),
    ...overrides,
  }
}

function buildLegacyVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    status: 'draft',
    version_number: 2,
    public_token: 'live-token',
    draft_json: canonicalDraft,
    snapshot_json: assembledDocument,
    ...overrides,
  }
}

function buildContext(overrides: Partial<CustomerQuoteSourceModel> = {}): CustomerQuoteSourceModel {
  const canonicalVersion = buildCanonicalVersion()

  return {
    estimate: {
      id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      status: 'draft',
      version_name: 'Kitchen Quote',
      version_state: 'draft',
      version_kind: 'standard',
      version_sort_order: 1,
      created_at: null,
      updated_at: null,
    },
    job: {
      id: 'job-1',
      title: 'Kitchen',
      estimate_date: '2026-04-22',
      customer_name: 'Taylor',
      customer_email: 'customer@example.com',
      customer_phone: '555-1212',
      customer_address: '123 Main',
    },
    customer: {
      id: 'customer-1',
      name: 'Taylor',
      email: 'customer@example.com',
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
      main_phone: '555-1212',
      business_email: 'hello@example.com',
      address: '123 Main',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    settings: {
      default_template_key: 'friendly',
    },
    inputs: {
      rooms: [],
      room_wall_scopes: [],
      segments: [],
      wall_segments: [],
      ceiling_segments: [],
      room_ceiling_scopes: [],
      ceiling_scope_segments: [],
      room_trim_scopes: [],
      room_door_scopes: [],
      access_fees: [],
      prejob: [],
      trim_items: [],
      other: [],
      jobsettings: {},
      org_defaults: estimateTemplateSettingsRow,
    },
    catalogs: null,
    pricing_summary: {
      finalTotal: 1200,
    },
    latest_public_version: canonicalVersion,
    latest_sent_version: null,
    latest_draft_version: canonicalVersion,
    public_url: 'https://example.test/quote/fallback-token',
    public_versions: [canonicalVersion],
    ...overrides,
  }
}

describe('customer send canonical artifact contract', () => {
  const context = buildContext()

  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset()
    }

    mocks.asText.mockImplementation((value: unknown) => (value == null ? '' : String(value).trim()))
    mocks.resolveCustomerSendVersionState.mockReturnValue({
      latestDraft: context.public_versions[0],
      latestVersion: context.public_versions[0],
    })
    mocks.sanitizeCustomerSendDraft.mockImplementation((value: unknown) => ({
      sanitized: true,
      ...(value as Record<string, unknown>),
    }))
    mocks.mergeCustomerSendDraftInput.mockImplementation(
      ({
        baseDraft,
        body,
      }: {
        baseDraft: Record<string, unknown>
        body: Record<string, unknown>
      }) => ({
        ...baseDraft,
        ...((body?.draft as Record<string, unknown> | undefined) ?? {}),
        scope_text_edits: {
          ...((baseDraft.scope_text_edits as Record<string, unknown> | undefined) ?? {}),
          ...(((body?.draft as Record<string, unknown> | undefined)?.scope_text_edits as
            | Record<string, unknown>
            | undefined) ?? {}),
        },
      })
    )
    mocks.didCustomerSendArtifactInputsChange.mockReturnValue(true)
    mocks.normalizeCustomerSendDraftScopeText.mockImplementation(
      ({ draft }: { draft: Record<string, unknown> }) => ({
        ok: true,
        data: {
          ...draft,
          to_email: String(draft.to_email ?? 'customer@example.com').trim(),
        },
      })
    )
    mocks.buildCustomerSendPublicMeta.mockReturnValue({
      status: 'draft',
      public_token: null,
    })
    mocks.buildCustomerSendDocument.mockReturnValue({
      ok: true,
      data: assembledDocument,
    })
    mocks.validateCustomerSendReadiness.mockReturnValue({
      blockers: [],
      warnings: [],
      readyToSend: true,
    })
    mocks.buildCustomerSendPublicUrl.mockReturnValue('https://example.test/quote/live-token')
    mocks.saveCustomerSendDraftVersion.mockResolvedValue({
      ok: true,
      data: buildCanonicalVersion(),
    })
    mocks.upgradeCustomerSendLegacyVersionSnapshot.mockResolvedValue({
      ok: true,
      data: buildCanonicalVersion(),
    })
    mocks.submitCustomerSendMessage.mockResolvedValue({
      ok: true,
      data: {
        mode: 'send',
        public_url: 'https://example.test/quote/live-token',
        version: buildCanonicalVersion({ status: 'sent' }),
        document: assembledDocument,
      },
    })
  })

  it('persists one preview artifact when no persisted version exists yet', async () => {
    mocks.resolveCustomerSendVersionState.mockReturnValueOnce({
      latestDraft: null,
      latestVersion: null,
    })

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildContext({
        public_versions: [],
        latest_public_version: null,
        latest_draft_version: null,
      }),
    })

    expect(result.ok).toBe(true)
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        version: expect.objectContaining({
          id: 'draft-1',
          snapshot_json: expect.objectContaining({
            artifact_kind: 'customer_estimate_artifact',
            artifact_version: 1,
            document: assembledDocument,
          }),
        }),
        document: assembledDocument,
      }),
    })
    expect(mocks.buildCustomerSendDocument).toHaveBeenCalledTimes(1)
    expect(mocks.saveCustomerSendDraftVersion).toHaveBeenCalledTimes(1)
  })

  it('reuses a canonical persisted preview unchanged and skips live rebuild', async () => {
    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context,
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        version: context.public_versions[0],
        document: assembledDocument,
      }),
    })
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftVersion).not.toHaveBeenCalled()
    expect(mocks.normalizeCustomerSendDraftScopeText).not.toHaveBeenCalled()
  })

  it('rebuilds a canonical persisted preview when company profile fields changed', async () => {
    const staleDocument = {
      ...assembledDocument,
      company: {
        ...assembledDocument.company,
        business_name: '',
        main_phone: '',
        business_email: '',
      },
    }
    const staleVersion = buildCanonicalVersion({
      public_token: null,
      snapshot_json: buildCustomerSendPersistedSnapshot({
        document: staleDocument,
        draft: canonicalDraft,
      }),
    })
    mocks.resolveCustomerSendVersionState.mockReturnValueOnce({
      latestDraft: staleVersion,
      latestVersion: staleVersion,
    })

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildContext({
        public_versions: [staleVersion],
        latest_public_version: staleVersion,
        latest_draft_version: staleVersion,
      }),
    })

    expect(result.ok).toBe(true)
    expect(mocks.normalizeCustomerSendDraftScopeText).toHaveBeenCalled()
    expect(mocks.buildCustomerSendDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          company: expect.objectContaining({
            business_name: 'ACE Painting',
            main_phone: '555-1212',
            business_email: 'hello@example.com',
          }),
        }),
      })
    )
    expect(mocks.saveCustomerSendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        document: assembledDocument,
      })
    )
  })

  it('returns a canonical persisted preview even when live artifact generation is blocked', async () => {
    mocks.normalizeCustomerSendDraftScopeText.mockReturnValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'Scope defaults drifted',
    })

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildContext({
        artifact_generation_blocked_reason:
          'Unable to load canonical estimate calculations for customer send: boom',
      }),
    })

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        version: context.public_versions[0],
        document: assembledDocument,
      }),
    })
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftVersion).not.toHaveBeenCalled()
    expect(mocks.normalizeCustomerSendDraftScopeText).not.toHaveBeenCalled()
  })

  it('fails closed when a persisted preview artifact is unreadable', async () => {
    const malformedDraft = buildCanonicalVersion({
      snapshot_json: {},
    })
    mocks.resolveCustomerSendVersionState.mockReturnValueOnce({
      latestDraft: malformedDraft,
      latestVersion: malformedDraft,
    })

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildContext({
        public_versions: [malformedDraft],
      }),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Customer send preview snapshot is unreadable',
    })
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftVersion).not.toHaveBeenCalled()
    expect(mocks.upgradeCustomerSendLegacyVersionSnapshot).not.toHaveBeenCalled()
  })

  it('fails closed when a persisted preview artifact is incomplete', async () => {
    const malformedDraft = buildCanonicalVersion({
      draft_json: null,
      snapshot_json: {
        document: assembledDocument,
      },
    })
    mocks.resolveCustomerSendVersionState.mockReturnValueOnce({
      latestDraft: malformedDraft,
      latestVersion: malformedDraft,
    })

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildContext({
        public_versions: [malformedDraft],
      }),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Customer send preview snapshot draft is missing',
    })
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
  })

  it('migrates a legacy bare-document preview once through the explicit upgrade path', async () => {
    const legacyDraft = buildLegacyVersion()
    mocks.resolveCustomerSendVersionState.mockReturnValueOnce({
      latestDraft: legacyDraft,
      latestVersion: legacyDraft,
    })

    const result = await loadCustomerSendPageData({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      context: buildContext({
        public_versions: [legacyDraft],
      }),
    })

    expect(result.ok).toBe(true)
    expect(mocks.upgradeCustomerSendLegacyVersionSnapshot).toHaveBeenCalledWith({
      orgId: 'org-1',
      version: legacyDraft,
      document: assembledDocument,
      draft: expect.objectContaining({ sanitized: true, to_email: 'customer@example.com' }),
    })
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftVersion).not.toHaveBeenCalled()
  })

  it('reuses the persisted artifact on draft save when only delivery-copy fields change', async () => {
    mocks.didCustomerSendArtifactInputsChange.mockReturnValueOnce(false)

    const result = await saveCustomerSendDraftMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        draft: {
          subject: 'Updated subject only',
          body: 'Updated email body only',
        },
      },
      context,
    })

    expect(result.ok).toBe(true)
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        document: assembledDocument,
      })
    )
  })

  it('reuses the persisted artifact unchanged on send when only delivery-copy fields change', async () => {
    mocks.didCustomerSendArtifactInputsChange.mockReturnValueOnce(false)

    const result = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          subject: 'Updated send subject only',
          body: 'Updated send body only',
        },
      },
      context,
      copy: {
        sendNotice: 'Quote sent.',
        sendFailureMessage: 'Unable to send quote',
        lockFailureMessage: 'Unable to lock quote',
      },
    })

    expect(result.ok).toBe(true)
    expect(mocks.buildCustomerSendDocument).not.toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        document: assembledDocument,
      })
    )
    expect(mocks.submitCustomerSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        version: expect.objectContaining({
          snapshot_json: expect.objectContaining({
            document: assembledDocument,
          }),
        }),
      })
    )
  })

  it('normalizes generated scope wording before comparing a live send to the persisted artifact', async () => {
    mocks.didCustomerSendArtifactInputsChange.mockReturnValueOnce(false)
    const scopeDocument = {
      ...assembledDocument,
      scopes: [
        {
          key: 'walls' as const,
          label: 'Walls',
          text: 'Prep and paint 2 coats on walls in Kitchen, using SW Duration Home',
          price: 1200,
        },
      ],
    }
    const scopedVersion = buildCanonicalVersion({
      snapshot_json: buildCustomerSendPersistedSnapshot({
        document: scopeDocument,
        draft: canonicalDraft,
      }),
    })
    mocks.resolveCustomerSendVersionState.mockReturnValueOnce({
      latestDraft: scopedVersion,
      latestVersion: scopedVersion,
    })

    const result = await submitCustomerSendMutation({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: {
        mode: 'send',
        draft: {
          ...canonicalDraft,
          scope_text_edits: {
            ...canonicalDraft.scope_text_edits,
            walls: 'Prep and paint 2 coats on walls in Kitchen, using SW Duration Home',
          },
        },
      },
      context: buildContext({
        public_versions: [scopedVersion],
        latest_public_version: scopedVersion,
        latest_draft_version: scopedVersion,
      }),
      copy: {
        sendNotice: 'Quote sent.',
        sendFailureMessage: 'Unable to send quote',
        lockFailureMessage: 'Unable to lock quote',
      },
    })

    expect(result.ok).toBe(true)
    expect(mocks.normalizeCustomerSendDraftScopeText).not.toHaveBeenCalled()
    expect(mocks.didCustomerSendArtifactInputsChange).toHaveBeenCalledWith({
      currentDraft: expect.objectContaining({
        scope_text_edits: expect.objectContaining({ walls: '' }),
      }),
      nextDraft: expect.objectContaining({
        scope_text_edits: expect.objectContaining({ walls: '' }),
      }),
    })
    expect(mocks.submitCustomerSendMessage).toHaveBeenCalled()
  })
})
