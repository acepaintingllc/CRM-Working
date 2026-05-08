import { describe, expect, it } from 'vitest'
import {
  buildEstimateCustomerSendContext,
  mapCustomerQuoteSourceModel,
  selectEstimateCustomerSendVersions,
} from '../contextMapper'
import type {
  CustomerQuoteAccessFeeRow,
  CustomerQuoteOtherRow,
  CustomerQuotePaintScopeRow,
  EstimateCustomerSendCalculatedData,
  EstimateCustomerSendRawResources,
  EstimatePublicVersionRow,
} from '../contextTypes'

const baseResources: EstimateCustomerSendRawResources = {
  estimate: {
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
  },
  job: {
    id: 'job-1',
    title: 'Kitchen',
    estimate_date: '2026-04-22',
  },
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
  settingsRow: {
    default_template_key: 'default',
    quote_validity_days: 90,
    terms_text: 'Standard terms',
    walls_paint_id: null,
    walls_primer_id: null,
    ceiling_paint_id: null,
    ceiling_primer_id: null,
    trim_paint_id: null,
    trim_primer_id: null,
    labor_day_policy_enabled: true,
    dayhours: 8,
    rounding_increment_hours: 4,
    override_labor_rate: 55,
    job_minimum_enabled: false,
    job_minimum_amount: 0,
    standard_door_deduction_sf: 21,
    standard_window_deduction_sf: 15,
    baseboard_opening_deduction_lf: 3,
  },
  jobsettings: {},
  rollupFinalTotal: 1044,
  rooms: [{ room_id: 'room-1' }],
  wallScopes: [{ room_id: 'room-1' }],
  segments: [{ id: 'segment-1' }],
  wallSegments: [{ id: 'wall-segment-1' }],
  ceilingSegments: [{ id: 'ceiling-segment-1' }],
  ceilingScopes: [{ room_id: 'room-1' }],
  ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
  trimScopes: [{ room_id: 'room-1' }],
  doorScopes: [{ room_id: 'room-1', door_type_id: 'DOOR_PANEL' }],
  accessFees: [{ id: 'fee-1' }],
  trimItems: [{ id: 'trim-1' }],
  other: [{ id: 'other-1' }],
  publicVersions: [],
  catalogs: { paints: [] },
}

const baseCalculated: EstimateCustomerSendCalculatedData = {
  quoteWallScopes: [],
  quoteCeilingScopes: [],
  quoteTrimScopes: [],
  quoteDoorScopes: [],
  quoteDrywallScopes: [],
  quoteAccessFees: [],
  quoteOtherRows: [],
  pricingSummary: { finalTotal: 2500 },
}

type PaintScopeFixture = Partial<CustomerQuotePaintScopeRow> & {
  effective_total?: unknown
  final_total?: unknown
  raw_total?: unknown
  override_total?: unknown
  paint_coats?: unknown
  wall_coats?: unknown
  ceiling_coats?: unknown
  active?: unknown
  include?: unknown
}

type AccessFeeFixture = Partial<CustomerQuoteAccessFeeRow> & {
  qty?: unknown
  amount?: unknown
  catalog_amount?: unknown
  effective_total?: unknown
  calculated_total?: unknown
  overridden?: unknown
  active?: unknown
  include?: unknown
}

type OtherRowFixture = Partial<CustomerQuoteOtherRow> & {
  qty?: unknown
  effective_total?: unknown
  final_total?: unknown
  override_total?: unknown
}

type PublicVersionFixture = Partial<EstimatePublicVersionRow> & {
  version_number?: unknown
}

function buildPaintScopeRow(overrides: PaintScopeFixture = {}): CustomerQuotePaintScopeRow {
  return {
    id: null,
    room_id: null,
    ...overrides,
  } as CustomerQuotePaintScopeRow
}

function buildAccessFeeRow(overrides: AccessFeeFixture = {}): CustomerQuoteAccessFeeRow {
  return {
    id: null,
    ...overrides,
  } as CustomerQuoteAccessFeeRow
}

function buildOtherRow(overrides: OtherRowFixture = {}): CustomerQuoteOtherRow {
  return {
    id: null,
    ...overrides,
  } as CustomerQuoteOtherRow
}

function buildPublicVersionRow(overrides: PublicVersionFixture = {}): EstimatePublicVersionRow {
  return {
    id: null,
    ...overrides,
  } as EstimatePublicVersionRow
}

function buildSourceModel(params?: {
  resources?: Partial<EstimateCustomerSendRawResources>
  calculated?: Partial<EstimateCustomerSendCalculatedData>
}) {
  return mapCustomerQuoteSourceModel({
    origin: 'https://example.test',
    resources: {
      ...baseResources,
      ...params?.resources,
    },
    calculated: {
      ...baseCalculated,
      ...params?.calculated,
    },
  })
}

describe('customer send context mapper', () => {
  it('prefers latest draft, then latest sent, then newest version for preview selection', () => {
    const draftPreferred = selectEstimateCustomerSendVersions([
      { id: 'version-3', status: 'draft' },
      { id: 'version-2', status: 'sent', public_token: 'abc' },
      { id: 'version-1', status: 'accepted', public_token: 'def' },
    ])
    expect(draftPreferred.latestDraftVersion?.id).toBe('version-3')
    expect(draftPreferred.latestSentVersion?.id).toBe('version-2')
    expect(draftPreferred.previewVersion?.id).toBe('version-3')

    const sentFallback = selectEstimateCustomerSendVersions([
      { id: 'version-2', status: 'accepted', public_token: 'abc' },
      { id: 'version-1', status: 'superseded' },
    ])
    expect(sentFallback.latestDraftVersion).toBeNull()
    expect(sentFallback.latestSentVersion?.id).toBe('version-2')
    expect(sentFallback.previewVersion?.id).toBe('version-2')

    const newestFallback = selectEstimateCustomerSendVersions([{ id: 'version-1', status: 'drafted?' }])
    expect(newestFallback.previewVersion?.id).toBe('version-1')
  })

  it('assembles the final send context shape with derived job and public version fields', () => {
    const context = buildEstimateCustomerSendContext({
      origin: 'https://example.test',
      resources: {
        ...baseResources,
        publicVersions: [
          { id: 'version-2', status: 'draft' },
          { id: 'version-1', status: 'sent', public_token: 'token-1' },
        ],
      },
      calculated: {
        quoteWallScopes: [{ id: 'wall-calculated' }],
        quoteCeilingScopes: [{ id: 'ceiling-calculated' }],
        quoteTrimScopes: [{ id: 'trim-calculated' }],
        quoteDoorScopes: [{ id: 'door-calculated' }],
        quoteAccessFees: [{ id: 'fee-calculated' }],
        quoteOtherRows: [{ id: 'other-calculated' }],
        pricingSummary: { finalTotal: 2500 },
      },
    })

    expect(context.job).toEqual({
      id: 'job-1',
      title: 'Kitchen',
      estimate_date: '2026-04-22',
      customer_name: 'Taylor',
      customer_email: 'taylor@example.com',
      customer_phone: '555-1212',
      customer_address: '123 Main',
    })
    expect(context.settings).toEqual({
      default_template_key: 'default',
      quote_validity_days: 90,
      terms_text: 'Standard terms',
      updated_at: null,
    })
    expect(context.inputs.room_wall_scopes).toEqual([
      expect.objectContaining({ id: 'wall-calculated' }),
    ])
    expect(context.inputs.room_ceiling_scopes).toEqual([
      expect.objectContaining({ id: 'ceiling-calculated' }),
    ])
    expect(context.inputs.room_trim_scopes).toEqual([
      expect.objectContaining({ id: 'trim-calculated' }),
    ])
    expect(context.inputs.room_door_scopes).toEqual([
      expect.objectContaining({ id: 'door-calculated' }),
    ])
    expect(context.inputs.access_fees).toEqual([
      expect.objectContaining({ id: 'fee-calculated' }),
    ])
    expect(context.inputs.other).toEqual([
      expect.objectContaining({ id: 'other-calculated' }),
    ])
    expect(context.pricing_summary).toEqual({ finalTotal: 2500 })
    expect(context.latest_draft_version?.id).toBe('version-2')
    expect(context.latest_sent_version?.id).toBe('version-1')
    expect(context.latest_public_version?.id).toBe('version-2')
    expect(context.public_url).toBe('https://example.test/quote/token-1')
  })

  it('falls back to the rollup final total when recalculation cannot produce pricing', () => {
    const context = buildEstimateCustomerSendContext({
      origin: 'https://example.test',
      resources: baseResources,
      calculated: {
        quoteWallScopes: [],
        quoteCeilingScopes: [],
        quoteTrimScopes: [],
        quoteDoorScopes: [],
        quoteAccessFees: [],
        quoteOtherRows: [],
        pricingSummary: null,
      },
    })

    expect(context.pricing_summary).toEqual({ finalTotal: 1044 })
  })

  it('normalizes nullable customer and document-facing settings fields to stable defaults', () => {
    const context = buildSourceModel({
      resources: {
        customer: {
          id: 'customer-1',
          name: null,
          email: '  ',
          phone: null,
          address: '',
          street: ' ',
          city: null,
          state: null,
          zip: '',
        },
        quoteDefaults: {
          default_template_key: '',
          quote_validity_days: 0,
          terms_text: '',
          terms_sections: undefined,
          template_presets: undefined,
        },
      },
    })

    expect(context.job.customer_name).toBe('')
    expect(context.job.customer_email).toBe('')
    expect(context.job.customer_phone).toBe('')
    expect(context.job.customer_address).toBe('')
    expect(context.customer).toEqual({
      id: 'customer-1',
      name: '',
      email: '',
      phone: '',
      address: '',
      street: null,
      city: null,
      state: null,
      zip: null,
    })
    expect(context.settings).toEqual({
      default_template_key: '',
      quote_validity_days: 0,
      terms_text: '',
      terms_sections: undefined,
      template_presets: undefined,
      updated_at: null,
    })
  })

  it('normalizes numeric totals and missing values consistently on calculated scope rows', () => {
    const context = buildSourceModel({
      calculated: {
        quoteWallScopes: [
          buildPaintScopeRow({
            id: 'wall-1',
            room_id: ' room-1 ',
            effective_total: 120.5,
            final_total: null,
            raw_total: null,
            override_total: null,
            paint_coats: 2,
            wall_coats: null,
          }),
        ],
        quoteAccessFees: [
          buildAccessFeeRow({
            id: 'fee-1',
            qty: 3,
            amount: 42.5,
            catalog_amount: null,
            effective_total: null,
            overridden: true,
          }),
        ],
        quoteOtherRows: [
          buildOtherRow({
            id: 'other-1',
            qty: 2,
            effective_total: 88.25,
            final_total: null,
          }),
        ],
      },
    })

    expect(context.inputs.room_wall_scopes[0]).toEqual(
      expect.objectContaining({
        id: 'wall-1',
        room_id: 'room-1',
        effective_total: 120.5,
        final_total: null,
        raw_total: null,
        override_total: null,
        paint_coats: 2,
        wall_coats: null,
      })
    )
    expect(context.inputs.access_fees[0]).toEqual(
      expect.objectContaining({
        id: 'fee-1',
        qty: 3,
        amount: 42.5,
        catalog_amount: null,
        effective_total: null,
        overridden: true,
      })
    )
    expect(context.inputs.other[0]).toEqual(
      expect.objectContaining({
        id: 'other-1',
        qty: 2,
        effective_total: 88.25,
        final_total: null,
      })
    )
  })

  it('normalizes include and active flags consistently across scope rows', () => {
    const context = buildSourceModel({
      calculated: {
        quoteWallScopes: [
          buildPaintScopeRow({
            id: 'wall-1',
            active: 'N',
            include: 'Y',
          }),
        ],
        quoteAccessFees: [
          buildAccessFeeRow({
            id: 'fee-1',
            active: null,
            include: 'N',
          }),
        ],
      },
    })

    expect(context.inputs.room_wall_scopes[0]).toEqual(
      expect.objectContaining({
        id: 'wall-1',
        active: 'N',
        include: 'Y',
      })
    )
    expect(context.inputs.access_fees[0]).toEqual(
      expect.objectContaining({
        id: 'fee-1',
        active: null,
        include: 'N',
      })
    )
  })

  it('preserves paint-product fallback source fields from jobsettings and org defaults', () => {
    const context = buildSourceModel({
      resources: {
        jobsettings: {
          wall_paint_id: 'JOB-WALL',
          trim_paint_id: 'JOB-TRIM',
        },
        settingsRow: {
          ...baseResources.settingsRow,
          walls_paint_id: 'ORG-WALL',
          ceiling_paint_id: 'ORG-CEIL',
          trim_paint_id: 'ORG-TRIM',
        },
      },
    })

    expect(context.inputs.jobsettings).toEqual(
      expect.objectContaining({
        wall_paint_id: 'JOB-WALL',
        trim_paint_id: 'JOB-TRIM',
      })
    )
    expect(context.inputs.org_defaults).toEqual(
      expect.objectContaining({
        walls_paint_id: 'ORG-WALL',
        ceiling_paint_id: 'ORG-CEIL',
        trim_paint_id: 'ORG-TRIM',
      })
    )
  })

  it('stabilizes partially missing access-fee and other-row enrichment into typed nullable rows', () => {
    const context = buildSourceModel({
      calculated: {
        quoteAccessFees: [
          buildAccessFeeRow({
            id: 'fee-1',
            label: '  Ladder setup  ',
            access_group: null,
            catalog_amount: 75,
            calculated_total: null,
          }),
        ],
        quoteOtherRows: [
          buildOtherRow({
            id: 'other-1',
            client_description: '  Wallpaper removal  ',
            location: null,
            pricing_mode: 'fixed',
            override_total: null,
          }),
        ],
      },
    })

    expect(context.inputs.access_fees[0]).toEqual(
      expect.objectContaining({
        id: 'fee-1',
        label: 'Ladder setup',
        access_group: null,
        catalog_amount: 75,
        calculated_total: null,
        effective_total: null,
      })
    )
    expect(context.inputs.other[0]).toEqual(
      expect.objectContaining({
        id: 'other-1',
        client_description: 'Wallpaper removal',
        location: null,
        pricing_mode: 'fixed',
        override_total: null,
      })
    )
  })

  it('normalizes public versions before selection and keeps sent-link fallback behavior intact', () => {
    const context = buildSourceModel({
      resources: {
        publicVersions: [
          buildPublicVersionRow({
            id: ' version-3 ',
            status: ' draft ',
            public_token: '   ',
            version_number: 3,
          }),
          buildPublicVersionRow({
            id: 'version-2',
            status: ' accepted ',
            public_token: ' token-2 ',
            created_at: ' 2026-04-02T00:00:00.000Z ',
          }),
        ],
      },
    })

    expect(context.latest_draft_version).toEqual(
      expect.objectContaining({
        id: 'version-3',
        status: 'draft',
        public_token: null,
        version_number: 3,
      })
    )
    expect(context.latest_sent_version).toEqual(
      expect.objectContaining({
        id: 'version-2',
        status: 'accepted',
        public_token: 'token-2',
        created_at: '2026-04-02T00:00:00.000Z',
      })
    )
    expect(context.latest_public_version?.id).toBe('version-3')
    expect(context.public_url).toBe('https://example.test/quote/token-2')
  })

  it('keeps document metadata flattened because preview, send link, and history have distinct owners', () => {
    const context = buildSourceModel({
      resources: {
        publicVersions: [
          buildPublicVersionRow({
            id: 'version-3',
            status: 'draft',
          }),
          buildPublicVersionRow({
            id: 'version-2',
            status: 'sent',
            public_token: 'token-2',
          }),
          buildPublicVersionRow({
            id: 'version-1',
            status: 'accepted',
            public_token: 'token-1',
          }),
        ],
      },
    })

    expect(context).not.toHaveProperty('document_metadata')
    expect(context.latest_public_version?.id).toBe('version-3')
    expect(context.latest_draft_version?.id).toBe('version-3')
    expect(context.latest_sent_version?.id).toBe('version-2')
    expect(context.public_url).toBe('https://example.test/quote/token-2')
    expect(context.public_versions.map((row) => row.id)).toEqual([
      'version-3',
      'version-2',
      'version-1',
    ])
  })

  it('normalizes null and missing catalog payloads to stable empty catalog arrays', () => {
    const nullCatalogs = buildSourceModel({
      resources: {
        catalogs: null,
      },
    })
    const missingCatalogArrays = buildSourceModel({
      resources: {
        catalogs: {},
      },
    })

    expect(nullCatalogs.catalogs).toBeNull()
    expect(missingCatalogArrays.catalogs).toEqual({
      paint_products: [],
      trim_items: [],
      door_types: [],
    })
  })

  it('prefers paint_products and still supports legacy paints catalog payloads', () => {
    const paintProductsContext = buildSourceModel({
      resources: {
        catalogs: {
          paint_products: [
            {
              id: ' paint-1 ',
              display_id: ' sw-001 ',
              display_name: '  Snowbound  ',
            },
          ],
        },
      },
    })
    const legacyPaintsContext = buildSourceModel({
      resources: {
        catalogs: {
          paints: [
            {
              id: ' legacy-1 ',
              label: '  Legacy White  ',
            },
          ],
        },
      },
    })

    expect(paintProductsContext.catalogs?.paint_products).toEqual([
      {
        id: 'paint-1',
        display_id: 'sw-001',
        display_name: 'Snowbound',
        label: null,
        name: null,
      },
    ])
    expect(legacyPaintsContext.catalogs?.paint_products).toEqual([
      {
        id: 'legacy-1',
        display_id: null,
        display_name: null,
        label: 'Legacy White',
        name: null,
      },
    ])
  })
})
