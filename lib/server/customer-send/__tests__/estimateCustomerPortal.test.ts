import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEstimateCustomerSendResources: vi.fn(),
  loadEstimateCustomerSendEstimate: vi.fn(),
  loadEstimateCustomerSendVersionResources: vi.fn(),
  deriveEstimateCustomerSendCalculatedData: vi.fn(),
  mapCustomerQuoteSourceModel: vi.fn(),
  buildPersistedArtifactCustomerSendContext: vi.fn(),
}))

vi.mock('../contextLoader', () => ({
  loadEstimateCustomerSendResources: mocks.loadEstimateCustomerSendResources,
}))

vi.mock('../contextRepository', () => ({
  loadEstimateCustomerSendEstimate: mocks.loadEstimateCustomerSendEstimate,
  loadEstimateCustomerSendVersionResources: mocks.loadEstimateCustomerSendVersionResources,
}))

vi.mock('../contextCalculations', () => ({
  deriveEstimateCustomerSendCalculatedData: mocks.deriveEstimateCustomerSendCalculatedData,
  resolveRoomModeById: () => new Map<string, 'RECT' | 'SEG'>(),
}))

vi.mock('../contextMapper', () => ({
  mapCustomerQuoteSourceModel: mocks.mapCustomerQuoteSourceModel,
  buildPersistedArtifactCustomerSendContext: mocks.buildPersistedArtifactCustomerSendContext,
}))

import { loadEstimateCustomerSendContext } from '../../estimateCustomerPortal'
import { buildCustomerSendPersistedSnapshot } from '../types'
import type {
  CustomerSendDraft,
  EstimateCustomerSendRawResources,
} from '../types'

const canonicalDraft: CustomerSendDraft = {
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
  scope_text_edits: {},
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

const settingsRow = {
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

function buildResources(overrides: Partial<EstimateCustomerSendRawResources> = {}) {
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
    job: { id: 'job-1', title: 'Kitchen', estimate_date: '2026-04-22' },
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
      main_phone: '',
      business_email: '',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    quoteDefaults: {
      default_template_key: 'default',
      quote_validity_days: 30,
      terms_text: '',
    },
    settingsRow,
    jobsettings: {},
    rollupFinalTotal: 1200,
    rooms: [],
    wallScopes: [],
    segments: [],
    wallSegments: [],
    ceilingSegments: [],
    ceilingScopes: [],
    ceilingScopeSegments: [],
    trimScopes: [],
    doorScopes: [],
    drywallRepairs: [],
    accessFees: [],
    trimItems: [],
    other: [],
    publicVersions: [],
    catalogs: null,
    ...overrides,
  } satisfies EstimateCustomerSendRawResources
}

function buildCanonicalVersion() {
  return {
    id: 'version-1',
    status: 'draft',
    version_number: 1,
    public_token: null,
    draft_json: null,
    snapshot_json: buildCustomerSendPersistedSnapshot({
      document: assembledDocument,
      draft: canonicalDraft,
    }),
  }
}

function buildLegacyVersion() {
  return {
    id: 'version-1',
    status: 'draft',
    version_number: 1,
    public_token: null,
    draft_json: canonicalDraft,
    snapshot_json: assembledDocument,
  }
}

describe('estimate customer portal persisted artifact preview context', () => {
  beforeEach(() => {
    mocks.loadEstimateCustomerSendResources.mockReset()
    mocks.loadEstimateCustomerSendEstimate.mockReset()
    mocks.loadEstimateCustomerSendVersionResources.mockReset()
    mocks.deriveEstimateCustomerSendCalculatedData.mockReset()
    mocks.mapCustomerQuoteSourceModel.mockReset()
    mocks.buildPersistedArtifactCustomerSendContext.mockReset()

    mocks.mapCustomerQuoteSourceModel.mockImplementation(
      (params: { calculated: { pricingSummary: unknown } }) => ({
        estimate: { id: 'estimate-1' },
        public_versions: [],
        pricing_summary: params.calculated.pricingSummary,
      })
    )
    mocks.loadEstimateCustomerSendEstimate.mockResolvedValue(buildResources().estimate)
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [],
    })
    mocks.buildPersistedArtifactCustomerSendContext.mockReturnValue({
      estimate: { id: 'estimate-1' },
      public_versions: [buildCanonicalVersion()],
      pricing_summary: { finalTotal: 1200 },
      artifact_generation_blocked_reason: null,
    })
  })

  it('returns a persisted canonical artifact preview context without full resource loading or live calculation', async () => {
    const canonicalVersion = buildCanonicalVersion()
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [canonicalVersion],
    })

    const result = await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      allowPersistedArtifactPreview: true,
      operation: 'read',
    })

    expect(result).toEqual({
      estimate: { id: 'estimate-1' },
      public_versions: [canonicalVersion],
      pricing_summary: { finalTotal: 1200 },
      artifact_generation_blocked_reason: null,
    })
    expect(mocks.loadEstimateCustomerSendResources).not.toHaveBeenCalled()
    expect(mocks.deriveEstimateCustomerSendCalculatedData).not.toHaveBeenCalled()
    expect(mocks.buildPersistedArtifactCustomerSendContext).toHaveBeenCalledWith({
      origin: 'https://example.test',
      estimate: buildResources().estimate,
      publicVersions: [canonicalVersion],
      artifactState: expect.objectContaining({
        kind: 'canonical',
        document: assembledDocument,
      }),
    })
  })

  it('uses artifact-only context for delivery-only save changes', async () => {
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [buildCanonicalVersion()],
    })

    const result = await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      allowPersistedArtifactPreview: true,
      operation: 'save',
      draftSource: {
        draft: {
          subject: 'Delivery copy only',
          body: 'Email body only',
        },
      },
    })

    expect(result).toEqual(
      expect.objectContaining({
        artifact_generation_blocked_reason: null,
      })
    )
    expect(mocks.loadEstimateCustomerSendResources).not.toHaveBeenCalled()
    expect(mocks.deriveEstimateCustomerSendCalculatedData).not.toHaveBeenCalled()
  })

  it('uses artifact-only context for send even when direct POST includes document-impacting fields', async () => {
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [buildCanonicalVersion()],
    })

    await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      allowPersistedArtifactPreview: true,
      operation: 'send',
      draftSource: {
        draft: {
          title: 'Changed direct send title',
          quote_validity_days: 7,
          scope_text_edits: {
            walls: 'Changed wording',
          },
        },
      },
    })

    expect(mocks.loadEstimateCustomerSendResources).not.toHaveBeenCalled()
    expect(mocks.deriveEstimateCustomerSendCalculatedData).not.toHaveBeenCalled()
  })

  it('requires full live context for document-impacting save regeneration', async () => {
    const canonicalVersion = buildCanonicalVersion()
    const liveResources = buildResources({
      publicVersions: [canonicalVersion],
    })
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [canonicalVersion],
    })
    mocks.loadEstimateCustomerSendResources.mockResolvedValue(liveResources)
    mocks.deriveEstimateCustomerSendCalculatedData.mockResolvedValue({
      ok: true,
      data: {
        quoteWallScopes: [],
        quoteCeilingScopes: [],
        quoteTrimScopes: [],
        quoteDoorScopes: [],
        quoteDrywallScopes: [],
        quoteAccessFees: [],
        quoteOtherRows: [],
        pricingSummary: { finalTotal: 1300 },
      },
    })

    const result = await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      allowPersistedArtifactPreview: true,
      operation: 'save',
      draftSource: {
        draft: {
          title: 'Regenerated title',
        },
      },
    })

    expect(result).toEqual({
      estimate: { id: 'estimate-1' },
      public_versions: [],
      pricing_summary: { finalTotal: 1300 },
    })
    expect(mocks.loadEstimateCustomerSendResources).toHaveBeenCalled()
    expect(mocks.deriveEstimateCustomerSendCalculatedData).toHaveBeenCalled()
  })

  it('fails closed without artifact fallback when document-impacting save regeneration cannot calculate', async () => {
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [buildCanonicalVersion()],
    })
    mocks.loadEstimateCustomerSendResources.mockResolvedValue(
      buildResources({
        publicVersions: [buildCanonicalVersion()],
      })
    )
    mocks.deriveEstimateCustomerSendCalculatedData.mockResolvedValue({
      ok: false,
      kind: 'server_error',
      message: 'Unable to load canonical estimate calculations for customer send: boom',
    })

    const result = await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      allowPersistedArtifactPreview: true,
      operation: 'save',
      draftSource: {
        draft: {
          title: 'Regenerated title',
        },
      },
    })

    expect(result).toEqual({
      error: 'Unable to load canonical estimate calculations for customer send: boom',
    })
  })

  it('still requires live calculation when persisted preview mode is not allowed', async () => {
    mocks.loadEstimateCustomerSendResources.mockResolvedValue(
      buildResources({
        publicVersions: [buildCanonicalVersion()],
      })
    )
    mocks.deriveEstimateCustomerSendCalculatedData.mockResolvedValue({
      ok: false,
      kind: 'server_error',
      message: 'Unable to load canonical estimate calculations for customer send: boom',
    })

    const result = await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result).toEqual({
      error: 'Unable to load canonical estimate calculations for customer send: boom',
    })
  })

  it('does not bypass live calculation for a legacy persisted artifact', async () => {
    mocks.loadEstimateCustomerSendVersionResources.mockResolvedValue({
      publicVersions: [buildLegacyVersion()],
    })
    mocks.loadEstimateCustomerSendResources.mockResolvedValue(
      buildResources({
        publicVersions: [buildLegacyVersion()],
      })
    )
    mocks.deriveEstimateCustomerSendCalculatedData.mockResolvedValue({
      ok: false,
      kind: 'server_error',
      message: 'Unable to load canonical estimate calculations for customer send: boom',
    })

    const result = await loadEstimateCustomerSendContext({
      origin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      allowPersistedArtifactPreview: true,
    })

    expect(result).toEqual({
      error: 'Unable to load canonical estimate calculations for customer send: boom',
    })
  })
})
