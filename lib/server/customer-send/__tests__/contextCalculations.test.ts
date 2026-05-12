import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveEstimateCustomerSendCalculatedData } from '../contextCalculations'
import {
  buildEstimateChainParityArtifacts,
  buildEstimateChainParityDbRows,
} from '../../estimate-v2/__tests__/estimateChainParityHelpers'
import type { EstimateCustomerSendRawResources } from '../contextTypes'

const { mockLoadCalculatedEstimateV2Artifacts } = vi.hoisted(() => ({
  mockLoadCalculatedEstimateV2Artifacts: vi.fn(),
}))

vi.mock('@/lib/server/estimate-v2/calculationOrchestration', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/server/estimate-v2/calculationOrchestration')>()
  return {
    ...actual,
    loadCalculatedEstimateV2Artifacts: mockLoadCalculatedEstimateV2Artifacts,
  }
})

const baseResources: EstimateCustomerSendRawResources = {
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
    override_labor_rate: 55,
    labor_day_policy_enabled: true,
    dayhours: 8,
    rounding_increment_hours: 4,
    job_minimum_enabled: false,
    job_minimum_amount: 0,
    standard_door_deduction_sf: 21,
    standard_window_deduction_sf: 15,
    baseboard_opening_deduction_lf: 3,
  },
  jobsettings: {
    override_labor_rate: 75,
    labor_day_policy_enabled: false,
    dayhours: 6,
    rounding_increment_hours: 2,
    job_minimum_enabled: true,
    job_minimum_amount: 1500,
  },
  rollupFinalTotal: 1044,
  catalogs: { paint_products: [] },
  rooms: [{ room_id: 'room-1', length_in: 120, width_in: 144, mode: 'RECT' }],
  wallScopes: [{ id: 'wall-raw', room_id: 'room-1', mode: 'RECT' }],
  wallSegments: [{ id: 'wall-segment-1' }],
  ceilingSegments: [{ id: 'ceiling-segment-1' }],
  ceilingScopes: [{ id: 'ceiling-raw', room_id: 'room-1', mode: 'SEG' }],
  ceilingScopeSegments: [{ id: 'ceiling-scope-segment-1' }],
  trimScopes: [{ id: 'trim-raw', room_id: 'room-1' }],
  doorScopes: [{ id: 'door-raw', room_id: 'room-1' }],
  drywallRepairs: [{ id: 'drywall-raw', room_id: 'room-1' }],
  accessFees: [{ id: 'fee-1', access_fee_id: 'LADDER', qty: 2 }],
  trimItems: [],
  other: [{ id: 'other-1', client_description: 'Additional prep' }],
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
  segments: [],
  publicVersions: [],
}

function rowTotalById(rows: Array<{ id?: unknown; effective_total?: unknown }>) {
  return new Map(
    rows.map((row) => [
      String(row.id ?? ''),
      typeof row.effective_total === 'number' ? row.effective_total : null,
    ])
  )
}

function expectRowsMatchCanonicalTotals(params: {
  label: string
  actualRows: Array<{ id?: unknown; effective_total?: unknown }>
  canonicalRows: Array<{ id?: unknown; effective_total?: unknown }>
}) {
  const actualById = rowTotalById(params.actualRows)
  const canonicalById = rowTotalById(params.canonicalRows)
  expect([...actualById.keys()].sort()).toEqual([...canonicalById.keys()].sort())
  for (const [id, expectedTotal] of canonicalById) {
    expect(actualById.get(id), `${params.label}:${id}`).toBeCloseTo(expectedTotal ?? 0, 2)
  }
}

describe('customer send context calculations', () => {
  beforeEach(() => {
    mockLoadCalculatedEstimateV2Artifacts.mockReset()
    mockLoadCalculatedEstimateV2Artifacts.mockResolvedValue({
      quoteWallScopes: [{ id: 'wall-output' }],
      quoteCeilingScopes: [{ id: 'ceiling-output' }],
      quoteTrimScopes: [{ id: 'trim-output' }],
      quoteDoorScopes: [{ id: 'door-output' }],
      drywallCalculations: { scopes: [{ id: 'drywall-output' }] },
      accessFeeCalculation: {
        rows: [
          {
            id: 'fee-1',
            label: 'Tall ladder',
            group: 'ladders',
            catalogAmount: 75,
            calculatedTotal: 150,
            total: 150,
            overridden: false,
          },
        ],
      },
      otherCalculations: {
        scopes: [{ id: 'other-1', effective_total: 85, pricing_mode: 'fixed' }],
      },
      prejobCalculations: { scopes: [] },
      pricingSummary: { finalTotal: 3200 },
    })
  })

  it('uses the canonical V2 calculation pipeline for customer quote outputs', async () => {
    const result = await deriveEstimateCustomerSendCalculatedData(baseResources, {
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(mockLoadCalculatedEstimateV2Artifacts).toHaveBeenCalledWith({
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      jobsettings: baseResources.jobsettings,
      rooms: baseResources.rooms,
      roomWallScopes: baseResources.wallScopes,
      wallSegments: baseResources.wallSegments,
      roomCeilingScopes: baseResources.ceilingScopes,
      ceilingScopeSegments: baseResources.ceilingScopeSegments,
      roomTrimScopes: baseResources.trimScopes,
      roomDoorScopes: baseResources.doorScopes,
      drywallRepairs: baseResources.drywallRepairs,
      accessFees: baseResources.accessFees,
      other: baseResources.other,
      prejob: [],
      orgDefaults: baseResources.settingsRow,
    })
    expect(result.data).toEqual({
      quoteWallScopes: [expect.objectContaining({ id: 'wall-output' })],
      quoteCeilingScopes: [expect.objectContaining({ id: 'ceiling-output' })],
      quoteTrimScopes: [expect.objectContaining({ id: 'trim-output' })],
      quoteDoorScopes: [expect.objectContaining({ id: 'door-output' })],
      quoteDrywallScopes: [expect.objectContaining({ id: 'drywall-output' })],
      quoteAccessFees: [
        expect.objectContaining({
          id: 'fee-1',
          label: 'Tall ladder',
          access_group: 'ladders',
          catalog_amount: 75,
          calculated_total: 150,
          effective_total: 150,
          overridden: false,
        }),
      ],
      quotePrejobRows: [],
      quoteOtherRows: [
        expect.objectContaining({
          id: 'other-1',
          effective_total: 85,
        }),
      ],
      pricingSummary: { finalTotal: 3200 },
    })
  })

  it('keeps preparation semantics owned by canonical artifacts, not customer-send raw rows', async () => {
    const staleRawResources: EstimateCustomerSendRawResources = {
      ...baseResources,
      settingsRow: {
        ...baseResources.settingsRow,
        walls_paint_id: 'ORG-WALL-DEFAULT',
        ceiling_paint_id: 'ORG-CEILING-DEFAULT',
        trim_paint_id: 'ORG-TRIM-DEFAULT',
      },
      rooms: [
        {
          room_id: 'R001',
          length_in: 120,
          width_in: 120,
          mode: 'SEG',
          wall_complexity_id: 'STALE-WALL-RATE',
          condition_selections: { STALE_ROOM: 'major' },
        },
      ],
      wallScopes: [
        {
          id: 'wall-raw',
          room_id: 'R001',
          mode: 'RECT',
          paint_product_id: null,
          paint_prod_rate_sqft_per_hour: 1,
          primer_prod_rate_sqft_per_hour: 1,
          condition_factor: 9,
          condition_selections: { STALE_WALL: 'major' },
          effective_total: 1,
        },
      ],
      ceilingScopes: [
        {
          id: 'ceiling-raw',
          room_id: 'R001',
          mode: 'SEG',
          paint_product_id: null,
          paint_prod_rate_sqft_per_hour: 2,
          condition_factor: 8,
          effective_total: 2,
        },
      ],
      trimScopes: [
        {
          id: 'trim-raw',
          room_id: 'R001',
          paint_product_id: null,
          condition_factor: 7,
          effective_total: 3,
        },
      ],
      doorScopes: [
        {
          id: 'door-raw',
          room_id: 'R001',
          paint_product_id: null,
          condition_factor: 6,
          effective_total: 4,
        },
      ],
    }
    mockLoadCalculatedEstimateV2Artifacts.mockResolvedValue({
      quoteWallScopes: [
        {
          id: 'wall-raw',
          room_id: 'R001',
          paint_product_id: null,
          paint_product_label: 'Canonical restored wall product',
          effective_total: 101,
          condition_factor: 1.32,
          paint_prod_rate_sqft_per_hour: 80,
        },
      ],
      quoteCeilingScopes: [
        {
          id: 'ceiling-raw',
          room_id: 'R001',
          paint_product_id: null,
          paint_product_label: 'Canonical restored ceiling product',
          effective_total: 202,
          condition_factor: 1.155,
          paint_prod_rate_sqft_per_hour: 100,
        },
      ],
      quoteTrimScopes: [
        {
          id: 'trim-raw',
          room_id: 'R001',
          paint_product_id: null,
          paint_product_label: 'Canonical restored trim product',
          effective_total: 303,
          condition_factor: 1.265,
          raw_measurement: 54,
        },
      ],
      quoteDoorScopes: [
        {
          id: 'door-raw',
          room_id: 'R001',
          paint_product_id: null,
          paint_product_label: 'Canonical restored door product',
          effective_total: 404,
          condition_factor: 1.1,
        },
      ],
      drywallCalculations: { scopes: [] },
      accessFeeCalculation: { rows: [] },
      otherCalculations: { scopes: [] },
      prejobCalculations: { scopes: [] },
      pricingSummary: { finalTotal: 1010 },
    })

    const result = await deriveEstimateCustomerSendCalculatedData(staleRawResources, {
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(mockLoadCalculatedEstimateV2Artifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        rooms: staleRawResources.rooms,
        roomWallScopes: staleRawResources.wallScopes,
        roomCeilingScopes: staleRawResources.ceilingScopes,
        roomTrimScopes: staleRawResources.trimScopes,
        roomDoorScopes: staleRawResources.doorScopes,
        orgDefaults: staleRawResources.settingsRow,
      })
    )
    expect(result.data.quoteWallScopes[0]).toEqual({
      id: 'wall-raw',
      room_id: 'R001',
      mode: null,
      active: null,
      include: null,
      paint_product_id: null,
      paint_product_label: 'Canonical restored wall product',
      notes: null,
      scope_notes: null,
      walls_prep_override: null,
      ceiling_prep_override: null,
      paint_coats: null,
      wall_coats: null,
      ceiling_coats: null,
      prime_mode: null,
      effective_total: 101,
      final_total: null,
      raw_total: null,
      override_total: null,
    })
    expect(result.data.quoteCeilingScopes[0]?.effective_total).toBe(202)
    expect(result.data.quoteTrimScopes[0]?.effective_total).toBe(303)
    expect(result.data.quoteDoorScopes[0]?.effective_total).toBe(404)
    expect(result.data.quoteWallScopes[0]).not.toHaveProperty('condition_factor')
    expect(result.data.quoteWallScopes[0]).not.toHaveProperty('paint_prod_rate_sqft_per_hour')
    expect(result.data.quoteTrimScopes[0]).not.toHaveProperty('raw_measurement')
    expect(result.data.pricingSummary?.finalTotal).toBe(1010)
  })

  it('derives customer-send prejob rows from canonical calculated prejob scopes', async () => {
    const rawResources: EstimateCustomerSendRawResources = {
      ...baseResources,
      prejob: [
        {
          id: 'prejob-1',
          room_id: 'room-1',
          position: 0,
          active: 'Y',
          trip_name: 'Wallpaper prep',
          trip_num: 2,
          trip_rate: 75,
          manual_adjustment: 25,
          notes: 'Calculated row should survive',
        },
      ],
    }
    mockLoadCalculatedEstimateV2Artifacts.mockResolvedValue({
      quoteWallScopes: [],
      quoteCeilingScopes: [],
      quoteTrimScopes: [],
      quoteDoorScopes: [],
      drywallCalculations: { scopes: [] },
      accessFeeCalculation: { rows: [] },
      otherCalculations: { scopes: [] },
      prejobCalculations: {
        scopes: [
          {
            id: 'prejob-1',
            room_id: 'ROOM-1',
            position: 0,
            include: 'Y',
            label: 'Wallpaper prep',
            trip_count: 2,
            trip_rate: 75,
            manual_adjustment: 25,
            calculated_total: 150,
            raw_total: 175,
            effective_total: 175,
          },
        ],
      },
      pricingSummary: { finalTotal: 175 },
    })

    const result = await deriveEstimateCustomerSendCalculatedData(rawResources, {
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(mockLoadCalculatedEstimateV2Artifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        prejob: rawResources.prejob,
      })
    )
    expect(result.data.quotePrejobRows).toHaveLength(1)
    const row = result.data.quotePrejobRows[0]
    expect(row?.id).toBe('prejob-1')
    expect(row?.room_id).toBe('ROOM-1')
    expect(row?.include).toBe('Y')
    expect(row?.trip_name ?? row?.label).toBe('Wallpaper prep')
    expect(row?.trip_num).toBe(2)
    expect(row?.trip_rate).toBe(75)
    expect(row?.manual_adjustment).toBe(25)
    expect(row?.calculated_total).toBe(150)
    expect(row?.raw_total).toBe(175)
    expect(row?.effective_total).toBe(175)
    expect(row?.final_total).toBe(175)
    expect(row?.notes).toBe('Calculated row should survive')
  })

  it('keeps customer-send calculated rows aligned with canonical load calculation totals', async () => {
    const artifacts = buildEstimateChainParityArtifacts('full-room-quote')
    const rows = buildEstimateChainParityDbRows(artifacts)
    mockLoadCalculatedEstimateV2Artifacts.mockResolvedValue(artifacts.calculationArtifacts)

    const result = await deriveEstimateCustomerSendCalculatedData(
      {
        ...baseResources,
        settingsRow: {
          ...baseResources.settingsRow,
          walls_paint_id: null,
          walls_primer_id: null,
          ceiling_paint_id: null,
          ceiling_primer_id: null,
          trim_paint_id: null,
          trim_primer_id: null,
        },
        jobsettings: rows.estimate_jobsettings,
        rooms: rows.estimate_rooms,
        wallScopes: rows.estimate_room_wall_scopes,
        wallSegments: rows.estimate_segments.wallSegments,
        ceilingScopes: rows.estimate_room_ceiling_scopes,
        ceilingScopeSegments: rows.estimate_room_ceiling_scope_segments,
        trimScopes: rows.estimate_room_trim_scopes,
        doorScopes: rows.estimate_room_door_scopes,
        drywallRepairs: rows.estimate_drywall_repairs,
        accessFees: rows.estimate_access_fees,
        other: rows.estimate_other,
      } as EstimateCustomerSendRawResources,
      {
        requestOrigin: 'https://example.test',
        orgId: String(rows.estimates.org_id),
        userId: 'user-1',
        estimateId: String(rows.estimates.id),
      }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.message)
    expect(mockLoadCalculatedEstimateV2Artifacts).toHaveBeenCalledWith(
      expect.objectContaining({
        jobsettings: rows.estimate_jobsettings,
        rooms: rows.estimate_rooms,
        roomWallScopes: rows.estimate_room_wall_scopes,
        wallSegments: rows.estimate_segments.wallSegments,
        roomCeilingScopes: rows.estimate_room_ceiling_scopes,
        ceilingScopeSegments: rows.estimate_room_ceiling_scope_segments,
        roomTrimScopes: rows.estimate_room_trim_scopes,
        roomDoorScopes: rows.estimate_room_door_scopes,
        drywallRepairs: rows.estimate_drywall_repairs,
        accessFees: rows.estimate_access_fees,
        other: rows.estimate_other,
      })
    )

    expectRowsMatchCanonicalTotals({
      label: 'walls',
      actualRows: result.data.quoteWallScopes,
      canonicalRows: artifacts.calculationArtifacts.quoteWallScopes,
    })
    expectRowsMatchCanonicalTotals({
      label: 'ceilings',
      actualRows: result.data.quoteCeilingScopes,
      canonicalRows: artifacts.calculationArtifacts.quoteCeilingScopes,
    })
    expectRowsMatchCanonicalTotals({
      label: 'trim',
      actualRows: result.data.quoteTrimScopes,
      canonicalRows: artifacts.calculationArtifacts.quoteTrimScopes,
    })
    expectRowsMatchCanonicalTotals({
      label: 'doors',
      actualRows: result.data.quoteDoorScopes,
      canonicalRows: artifacts.calculationArtifacts.quoteDoorScopes,
    })
    expectRowsMatchCanonicalTotals({
      label: 'drywall',
      actualRows: result.data.quoteDrywallScopes ?? [],
      canonicalRows: artifacts.calculationArtifacts.drywallCalculations.scopes,
    })
    expectRowsMatchCanonicalTotals({
      label: 'other',
      actualRows: result.data.quoteOtherRows,
      canonicalRows: artifacts.calculationArtifacts.otherCalculations.scopes,
    })
    expectRowsMatchCanonicalTotals({
      label: 'accessFees',
      actualRows: result.data.quoteAccessFees,
      canonicalRows: artifacts.calculationArtifacts.accessFeeCalculation.rows.map((row) => ({
        id: row.id,
        effective_total: row.total,
      })),
    })
    expect(result.data.pricingSummary?.finalTotal).toBeCloseTo(
      artifacts.calculationArtifacts.pricingSummary.finalTotal,
      2
    )
  })

  it('fails closed when canonical calculations cannot be loaded', async () => {
    mockLoadCalculatedEstimateV2Artifacts.mockRejectedValue(new Error('boom'))

    const result = await deriveEstimateCustomerSendCalculatedData(baseResources, {
      requestOrigin: 'https://example.test',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })

    expect(result).toEqual({
      ok: false,
      kind: 'server_error',
      message: 'Unable to load canonical estimate calculations for customer send: boom',
    })
  })
})
