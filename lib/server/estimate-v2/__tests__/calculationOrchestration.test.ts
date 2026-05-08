import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstimateV2SavePayload } from '@/types/estimator/v2'
import { applyEffectiveProductDefaults } from '@/lib/estimator/v2CalculationPreparation'
import type { EstimateTemplateSettingsRow } from '../../estimateTemplateSettings.ts'

const mocks = vi.hoisted(() => ({
  loadEstimateV2CalculationCatalogs: vi.fn(),
}))

vi.mock('../../org.ts', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}))

vi.mock('../../estimateV2Catalogs.ts', () => ({
  loadEstimateV2CalculationCatalogs: mocks.loadEstimateV2CalculationCatalogs,
  loadEstimateV2RoomModesForTrimFromDb: vi.fn(),
  resolveEstimateV2RoomModeById: (params: {
    rooms: Array<Record<string, unknown>>
    wallScopes: Array<Record<string, unknown>>
    ceilingScopes: Array<Record<string, unknown>>
  }) => {
    const roomMode = new Map<string, 'RECT' | 'SEG'>()
    for (const scope of params.wallScopes) {
      const roomId = String(scope.room_id ?? '').trim().toUpperCase()
      if (!roomId || roomMode.has(roomId)) continue
      roomMode.set(roomId, String(scope.mode ?? '').trim().toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
    }
    for (const scope of params.ceilingScopes) {
      const roomId = String(scope.room_id ?? '').trim().toUpperCase()
      if (!roomId || roomMode.has(roomId)) continue
      roomMode.set(roomId, String(scope.mode ?? '').trim().toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
    }
    for (const room of params.rooms) {
      const roomId = String(room.room_id ?? '').trim().toUpperCase()
      if (!roomId || roomMode.has(roomId)) continue
      roomMode.set(roomId, String(room.mode ?? '').trim().toUpperCase() === 'SEG' ? 'SEG' : 'RECT')
    }
    return roomMode
  },
}))

import {
  calculateEstimateV2ArtifactsForSave,
  calculateEstimateV2ArtifactsFromPayload,
  loadCalculatedEstimateV2Artifacts,
  type EstimateV2CalculationCatalogBundle,
} from '../calculationOrchestration.ts'

type SavePayloadWallScope = EstimateV2SavePayload['room_wall_scopes'][number]
type SavePayloadCeilingScope = EstimateV2SavePayload['room_ceiling_scopes'][number]
type SavePayloadTrimScope = EstimateV2SavePayload['room_trim_scopes'][number]
type SavePayloadDoorScope = NonNullable<EstimateV2SavePayload['room_door_scopes']>[number]

function normalizeWrapperParityValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeWrapperParityValue)
  }
  if (!value || typeof value !== 'object') return value

  const normalized: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (entry == null) continue
    if (key === 'ceiling_geometry_mode' && entry === 'FLAT') continue
    normalized[key] = normalizeWrapperParityValue(entry)
  }
  return normalized
}

const schemaDriftSentinels = {
  // These intentionally compile only while save/load payload rows stay aligned with canonical engine rows.
  wallRequiresCanonicalRowFields: {
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'NONE',
    height_in: null,
    perimeter_in: null,
    standard_door_count: null,
    standard_window_count: null,
    height_factor: null,
    complexity_factor: null,
    wall_flag_factor: null,
    cut_in_top_factor: null,
    cut_in_bottom_factor: null,
    raw_area_sf: null,
    override_area_sf: null,
    effective_area_sf: null,
    raw_paint_hours: null,
    override_paint_hours: null,
    effective_paint_hours: null,
    raw_primer_hours: null,
    override_primer_hours: null,
    effective_primer_hours: null,
    raw_paint_gallons: null,
    override_paint_gallons: null,
    effective_paint_gallons: null,
    raw_primer_gallons: null,
    override_primer_gallons: null,
    effective_primer_gallons: null,
    raw_supply_cost: null,
    override_supply_cost: null,
    effective_supply_cost: null,
    raw_total: null,
    override_total: null,
    effective_total: null,
    notes: null,
  } satisfies SavePayloadWallScope,
  ceilingRequiresCanonicalRowFields: {
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: null,
    area_sf: null,
    length_in: null,
    width_in: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'NONE',
    spot_prime_percent: null,
    ceiling_type_id: null,
    height_factor: null,
    complexity_factor: null,
    ceiling_flag_factor: null,
    override_area_sf: null,
    override_paint_hours: null,
    override_primer_hours: null,
    override_paint_gallons: null,
    override_primer_gallons: null,
    override_supply_cost: null,
    override_total: null,
    raw_area_sf: null,
    effective_area_sf: null,
    raw_paint_hours: null,
    effective_paint_hours: null,
    raw_primer_hours: null,
    effective_primer_hours: null,
    raw_paint_gallons: null,
    effective_paint_gallons: null,
    raw_primer_gallons: null,
    effective_primer_gallons: null,
    raw_supply_cost: null,
    effective_supply_cost: null,
    raw_total: null,
    effective_total: null,
    notes: null,
  } satisfies SavePayloadCeilingScope,
  trimRequiresCanonicalRowFields: {
    room_id: 'R001',
    position: 0,
    include: 'Y',
    scope_name: null,
    trim_type_id: null,
    trim_family: null,
    unit_type: 'LF',
    measurement_mode: 'MANUAL',
    helper_source: null,
    measurement_value: null,
    helper_value: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    paint_enabled: 'Y',
    prime_mode: 'NONE',
    spot_prime_percent: null,
    production_rate_id: null,
    prep_factor: null,
    height_factor: null,
    profile_factor: null,
    room_flag_factor: null,
    masking_factor: null,
    stair_factor: null,
    difficult_finish_factor: null,
    caulk_fill_factor: null,
    override_measurement: null,
    override_hours: null,
    override_gallons: null,
    override_supply_cost: null,
    override_total: null,
    override_description: null,
    raw_measurement: null,
    effective_measurement: null,
    raw_paint_hours: null,
    effective_paint_hours: null,
    raw_primer_hours: null,
    effective_primer_hours: null,
    raw_paint_gallons: null,
    effective_paint_gallons: null,
    raw_primer_gallons: null,
    effective_primer_gallons: null,
    raw_supply_cost: null,
    effective_supply_cost: null,
    raw_total: null,
    effective_total: null,
    notes: null,
  } satisfies SavePayloadTrimScope,
  doorRequiresCanonicalRowFields: {
    room_id: 'R001',
    paint_product_id: null,
    primer_product_id: null,
  } satisfies SavePayloadDoorScope,
}

void schemaDriftSentinels

// @ts-expect-error EstimateV2SavePayload wall scopes must expose canonical wall engine fields.
const schemaDriftMissingWallField: SavePayloadWallScope = { room_id: 'R001' }
void schemaDriftMissingWallField

const orgDefaults: EstimateTemplateSettingsRow = {
  default_template_key: 'standard',
  quote_validity_days: 30,
  terms_text: '',
  walls_paint_id: 'WALL-DEFAULT',
  walls_primer_id: 'PRIMER-DEFAULT',
  ceiling_paint_id: 'CEILING-DEFAULT',
  ceiling_primer_id: 'PRIMER-DEFAULT',
  trim_paint_id: 'TRIM-DEFAULT',
  trim_primer_id: 'PRIMER-DEFAULT',
  labor_day_policy_enabled: true,
  dayhours: 8,
  rounding_increment_hours: 4,
  override_labor_rate: 50,
  job_minimum_enabled: true,
  job_minimum_amount: 900,
  standard_door_deduction_sf: 20,
  standard_window_deduction_sf: 10,
  baseboard_opening_deduction_lf: 3,
}

const catalogs: EstimateV2CalculationCatalogBundle = {
  source: {
    production_rates: [
      {
        id: 'WALL_COMPLEX',
        scope_id: 'WALLS',
        sqft_per_hr: 80,
        prep_sqft_per_hr: 70,
        primer_sqft_per_hr: 120,
        active: 'Y',
      },
      {
        id: 'CEIL_STD',
        scope_id: 'CEILINGS',
        sqft_per_hr: 100,
        prep_sqft_per_hr: 90,
        primer_sqft_per_hr: 130,
        active: 'Y',
      },
    ],
    access_fees: [
      {
        id: 'LADDER-TALL',
        label: 'Tall ladder',
        access_group: 'ladders',
        fee_type: 'flat',
        amount: 125,
        unit: 'each',
        notes: null,
      },
    ],
  },
  wall: {
    paint_products: [
      {
        id: 'WALL-DEFAULT',
        type: 'paint',
        label: 'Default Wall Paint',
        price_per_gal: 40,
        coverage_sqft_per_gal_per_coat: 350,
      },
      {
        id: 'CEILING-DEFAULT',
        type: 'paint',
        label: 'Default Ceiling Paint',
        price_per_gal: 35,
        coverage_sqft_per_gal_per_coat: 350,
      },
      {
        id: 'TRIM-DEFAULT',
        type: 'paint',
        label: 'Default Trim Paint',
        price_per_gal: 55,
        coverage_sqft_per_gal_per_coat: 300,
      },
      {
        id: 'PRIMER-DEFAULT',
        type: 'primer',
        label: 'Default Primer',
        price_per_gal: 20,
        coverage_sqft_per_gal_per_coat: 250,
      },
    ],
    supplies_rates: [
      { key: 'AREA', supply_group: 'area', scope: 'Walls', unit: 'sqft', value: 0.05, crew_multiplier: 'N' },
      { key: 'PER_JOB', supply_group: 'per job', scope: 'all', unit: 'job', value: 12, crew_multiplier: 'Y' },
    ],
    condition_modifiers: [
      {
        id: 'ROOM_ROUGH',
        label: 'Rough room',
        scope: 'room',
        modifier_type: 'severity',
        factor_field: null,
        levels: { moderate: 1.1 },
        active: 'Y',
      },
      {
        id: 'WALL_PATCHY',
        label: 'Patchy walls',
        scope: 'wall',
        modifier_type: 'severity',
        factor_field: null,
        levels: { major: 1.2 },
        active: 'Y',
      },
      {
        id: 'CEIL_STAINED',
        label: 'Stained ceiling',
        scope: 'ceiling',
        modifier_type: 'severity',
        factor_field: null,
        levels: { minor: 1.05 },
        active: 'Y',
      },
      {
        id: 'TRIM_DETAILED',
        label: 'Detailed trim',
        scope: 'trim',
        modifier_type: 'severity',
        factor_field: null,
        levels: { moderate: 1.15 },
        active: 'Y',
      },
    ],
  },
  ceiling: {
    paint_products: [],
    supplies_rates: [],
    condition_modifiers: [],
    ceiling_types: [{ id: 'FLAT', labor_mult: 1, area_factor: 1 }],
  },
  trim: {
    paint_products: [],
    supplies_rates: [],
    condition_modifiers: [],
    trim_items: [
      {
        id: 'CROWN',
        family: 'CROWN',
        default_unit_type: 'LF',
        helper_allowed: true,
        default_production_rate_id: 'CROWN_RATE',
        trim_category: 'crown',
        measurement_class: 'linear',
        picker_group: null,
      },
    ],
    production_rates: [
      {
        id: 'CROWN_RATE',
        scope_id: 'CROWN',
        units_per_hour: 30,
        prep_units_per_hour: null,
        primer_units_per_hour: 45,
      },
    ],
  },
  door: {
    door_unit_rates: [
      {
        id: 'PANEL',
        label: 'Panel door',
        unit_rate_type: 'interior',
        unit: 'side',
        default_qty: 1,
        labor_rate: 0.5,
        material_rate: 6,
        amount: null,
      },
    ],
  },
  drywall: {
    drywall_unit_rates: [
      {
        id: 'flat_wall_crack',
        label: 'Flat wall crack',
        unit_rate_type: 'flat_wall_crack',
        unit: 'LF',
        amount: 14,
        labor_rate: null,
        material_rate: null,
        ceiling_multiplier: null,
      },
    ],
  },
}

catalogs.ceiling = {
  ...catalogs.wall,
  ceiling_types: [{ id: 'FLAT', labor_mult: 1, area_factor: 1 }],
}
catalogs.trim = {
  ...catalogs.wall,
  trim_items: catalogs.trim?.trim_items ?? [],
  production_rates: catalogs.trim?.production_rates ?? [],
}

const payload: EstimateV2SavePayload = {
  jobsettings: {
    labor_day_policy_enabled: true,
    dayhours: 8,
    rounding_increment_hours: 4,
    override_labor_rate: 60,
    job_minimum_enabled: true,
    job_minimum_amount: 1000,
    crew_size: 2,
    walls_paint_id: null,
    walls_primer_id: null,
    ceiling_paint_id: null,
    ceiling_primer_id: null,
    trim_paint_id: null,
    trim_primer_id: null,
    standard_door_deduction_sf: 20,
    standard_window_deduction_sf: 10,
    baseboard_opening_deduction_lf: 3,
    condition_selections: null,
  },
  rooms: [
    {
      id: 'room-1',
      room_id: 'R001',
      room_name: 'Living',
      notes: null,
      position: 0,
      room_type_id: null,
      wall_complexity_id: 'WALL_COMPLEX',
      length_in: 180,
      width_in: 144,
      wallheight_in: 96,
      condition_selections: { ROOM_ROUGH: 'moderate' },
    },
  ],
  room_wall_scopes: [
    {
      ...schemaDriftSentinels.wallRequiresCanonicalRowFields,
      id: '11111111-1111-4111-8111-111111111111',
      room_id: 'R001',
      position: 0,
      mode: 'RECT',
      include: 'Y',
      scope_name: 'Walls',
      color_id: 'WHITE',
      paint_product_id: null,
      primer_product_id: null,
      prime_mode: 'FULL',
      height_in: 96,
      perimeter_in: 648,
      standard_door_count: 1,
      standard_window_count: 2,
      condition_selections: { WALL_PATCHY: 'major' },
    },
  ],
  wall_segments: [],
  room_flags: [],
  rollers: [],
  access_fees: [
    {
      id: 'fee-1',
      room_id: null,
      access_fee_id: 'ladder-tall',
      qty: 2,
      actual_cost_override: null,
      notes: null,
      position: 0,
      active: 'Y',
    },
  ],
  room_ceiling_scopes: [
    {
      ...schemaDriftSentinels.ceilingRequiresCanonicalRowFields,
      id: '22222222-2222-4222-8222-222222222222',
      room_id: 'R001',
      position: 0,
      mode: 'RECT',
      include: 'Y',
      scope_name: 'Ceiling',
      paint_product_id: null,
      primer_product_id: null,
      prime_mode: 'NONE',
      length_in: 180,
      width_in: 144,
      ceiling_type_id: 'FLAT',
      condition_selections: { CEIL_STAINED: 'minor' },
    },
  ],
  ceiling_scope_segments: [],
  room_trim_scopes: [
    {
      ...schemaDriftSentinels.trimRequiresCanonicalRowFields,
      id: '33333333-3333-4333-8333-333333333333',
      room_id: 'R001',
      position: 0,
      include: 'Y',
      scope_name: 'Crown',
      trim_type_id: 'CROWN',
      trim_family: 'CROWN',
      unit_type: 'LF',
      measurement_mode: 'ROOM_HELPER',
      helper_source: 'ROOM_PERIMETER',
      paint_product_id: null,
      primer_product_id: null,
      paint_enabled: 'Y',
      prime_mode: 'NONE',
      condition_selections: { TRIM_DETAILED: 'moderate' },
    },
  ],
  room_door_scopes: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      room_id: 'R001',
      position: 0,
      include: 'Y',
      scope_name: 'Panel',
      door_type_id: 'PANEL',
      paint_product_id: null,
      primer_product_id: null,
      prime_mode: 'NONE',
      quantity: 2,
      sides: 2,
    },
  ],
  drywall_repairs: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      room_id: 'R001',
      position: 0,
      surface: 'wall',
      repair_type: 'flat_wall_crack',
      unit: 'LF',
      quantity: 4,
    },
  ],
  other: [
    {
      id: 'other-1',
      room_id: 'R001',
      active: 'Y',
      pricing_mode: 'fixed',
      fixed_amount: 75,
      description: 'Extra prep',
    },
  ],
}

describe('Estimator V2 calculation orchestration pure adapter', () => {
  beforeEach(() => {
    mocks.loadEstimateV2CalculationCatalogs.mockReset()
    mocks.loadEstimateV2CalculationCatalogs.mockResolvedValue(catalogs)
  })

  it('applies effective product defaults for calculation rows and restores persisted product IDs', () => {
    const productDefaults = applyEffectiveProductDefaults({
      rows: [
        { id: 'uses-defaults', paint_product_id: null, primer_product_id: '' },
        { id: 'keeps-explicit', paint_product_id: 'CUSTOM-PAINT', primer_product_id: 'CUSTOM-PRIMER' },
      ],
      defaultPaintProductId: 'DEFAULT-PAINT',
      defaultPrimerProductId: 'DEFAULT-PRIMER',
    })

    expect(productDefaults.rows).toEqual([
      { id: 'uses-defaults', paint_product_id: 'DEFAULT-PAINT', primer_product_id: 'DEFAULT-PRIMER' },
      { id: 'keeps-explicit', paint_product_id: 'CUSTOM-PAINT', primer_product_id: 'CUSTOM-PRIMER' },
    ])

    expect(
      productDefaults.restorePersistedProductIds([
        {
          id: 'uses-defaults',
          paint_product_id: 'DEFAULT-PAINT',
          primer_product_id: 'DEFAULT-PRIMER',
          effective_total: 12,
        },
        {
          id: 'keeps-explicit',
          paint_product_id: 'CUSTOM-PAINT',
          primer_product_id: 'CUSTOM-PRIMER',
          effective_total: 24,
        },
      ])
    ).toEqual([
      { id: 'uses-defaults', paint_product_id: null, primer_product_id: null, effective_total: 12 },
      {
        id: 'keeps-explicit',
        paint_product_id: 'CUSTOM-PAINT',
        primer_product_id: 'CUSTOM-PRIMER',
        effective_total: 24,
      },
    ])
  })

  it('matches the DB/catalog-loading wrapper when catalogs are supplied as fixtures', async () => {
    const pure = calculateEstimateV2ArtifactsFromPayload({
      payload,
      calculationCatalogs: catalogs,
      orgDefaults,
    })
    const wrapped = await loadCalculatedEstimateV2Artifacts({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      jobsettings: payload.jobsettings,
      rooms: payload.rooms,
      roomWallScopes: payload.room_wall_scopes,
      wallSegments: payload.wall_segments,
      roomCeilingScopes: payload.room_ceiling_scopes,
      ceilingScopeSegments: payload.ceiling_scope_segments,
      roomTrimScopes: payload.room_trim_scopes,
      roomDoorScopes: payload.room_door_scopes,
      drywallRepairs: payload.drywall_repairs,
      accessFees: payload.access_fees,
      other: payload.other,
      orgDefaults,
    })

    expect(normalizeWrapperParityValue(wrapped)).toEqual(
      normalizeWrapperParityValue(pure)
    )
    expect(mocks.loadEstimateV2CalculationCatalogs).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })
  })

  it('runs the full parity path for defaults, production rates, conditions, trim modes, and pricing rollup', () => {
    const payloadWithDoorCondition = structuredClone(payload) as EstimateV2SavePayload
    if (payloadWithDoorCondition.room_door_scopes?.[0]) {
      payloadWithDoorCondition.room_door_scopes[0].condition_factor = 1.25
    }

    const result = calculateEstimateV2ArtifactsFromPayload({
      payload: payloadWithDoorCondition,
      calculationCatalogs: catalogs,
      orgDefaults,
    })

    expect(result.wallCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'WALL-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        paint_prod_rate_sqft_per_hour: 80,
        primer_prod_rate_sqft_per_hour: 120,
        condition_factor: 1.32,
      })
    )
    expect(result.quoteWallScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
      })
    )
    expect(result.ceilingCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'CEILING-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        paint_prod_rate_sqft_per_hour: 100,
        primer_prod_rate_sqft_per_hour: 130,
      })
    )
    expect(result.ceilingCalculations.scopes[0].condition_factor).toBeCloseTo(1.155)
    expect(result.quoteCeilingScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
      })
    )
    expect(result.trimCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'TRIM-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        raw_measurement: 54,
      })
    )
    expect(result.trimCalculations.scopes[0].condition_factor).toBeCloseTo(1.265)
    expect(result.quoteTrimScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
      })
    )
    expect(result.doorCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'TRIM-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        condition_factor: 1.25,
        effective_total: expect.any(Number),
      })
    )
    expect(result.quoteDoorScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
      })
    )
    expect(result.doorCalculations.scopes[0].effective_total).toBeGreaterThan(0)
    expect(result.drywallCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        base_unit_rate: 14,
        effective_total: 56,
      })
    )
    expect(result.otherCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        effective_total: 75,
      })
    )
    expect(result.accessFeeCalculation).toEqual(
      expect.objectContaining({
        total: 250,
      })
    )
    expect(result.pricingSummary).toEqual(
      expect.objectContaining({
        sharedAccessCost: 250,
        finalTotal: expect.any(Number),
        accessFeeAllocation: expect.objectContaining({
          walls: expect.any(Number),
          ceilings: expect.any(Number),
          trim: expect.any(Number),
        }),
      })
    )
    expect(result.pricingSummary.finalTotal).toBeGreaterThanOrEqual(1000)
  })

  it('keeps inactive drywall repairs zeroed through canonical artifact calculation', () => {
    const baseline = calculateEstimateV2ArtifactsFromPayload({
      payload,
      calculationCatalogs: catalogs,
      orgDefaults,
    })
    const payloadWithInactiveDrywall = structuredClone(payload) as EstimateV2SavePayload
    payloadWithInactiveDrywall.drywall_repairs = [
      ...(payloadWithInactiveDrywall.drywall_repairs ?? []),
      {
        id: '66666666-6666-4666-8666-666666666666',
        room_id: 'R001',
        position: 1,
        active: 'N',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 99,
        override_total: 999,
      },
    ]

    const result = calculateEstimateV2ArtifactsFromPayload({
      payload: payloadWithInactiveDrywall,
      calculationCatalogs: catalogs,
      orgDefaults,
    })

    const inactiveRepair = result.drywallCalculations.scopes.find((scope) => scope.id === '66666666-6666-4666-8666-666666666666')
    expect(inactiveRepair).toEqual(
      expect.objectContaining({
        include: 'N',
        active: 'N',
        raw_total: 0,
        effective_total: 0,
      })
    )
    expect(result.drywallCalculations.room_totals).toEqual([
      expect.objectContaining({
        room_id: 'R001',
        scope_count: 1,
        effective_total: 56,
      }),
    ])
    expect(result.pricingSummary.finalTotal).toBe(baseline.pricingSummary.finalTotal)
  })

  it('keeps save calculation artifacts aligned with canonical artifact defaults', async () => {
    const payloadWithOrgDefaults = structuredClone(payload) as EstimateV2SavePayload
    const jobsettings = payloadWithOrgDefaults.jobsettings as unknown as Record<string, unknown>
    jobsettings.walls_paint_id = null
    jobsettings.walls_primer_id = null
    jobsettings.ceiling_paint_id = null
    jobsettings.ceiling_primer_id = null
    jobsettings.trim_paint_id = null
    jobsettings.trim_primer_id = null
    jobsettings.override_labor_rate = null
    jobsettings.crew_size = 3.8
    jobsettings.standard_door_deduction_sf = null
    jobsettings.standard_window_deduction_sf = null
    jobsettings.baseboard_opening_deduction_lf = null
    payloadWithOrgDefaults.room_wall_scopes[0].paint_product_id = 'WALL-DEFAULT'
    payloadWithOrgDefaults.room_wall_scopes[0].primer_product_id = null
    payloadWithOrgDefaults.room_ceiling_scopes[0].paint_product_id = null
    payloadWithOrgDefaults.room_ceiling_scopes[0].primer_product_id = null
    payloadWithOrgDefaults.room_trim_scopes[0].paint_product_id = null
    payloadWithOrgDefaults.room_trim_scopes[0].primer_product_id = null
    if (payloadWithOrgDefaults.room_door_scopes?.[0]) {
      payloadWithOrgDefaults.room_door_scopes[0].paint_product_id = null
      payloadWithOrgDefaults.room_door_scopes[0].primer_product_id = null
      payloadWithOrgDefaults.room_door_scopes[0].condition_factor = 1.25
    }

    const canonical = calculateEstimateV2ArtifactsFromPayload({
      payload: payloadWithOrgDefaults,
      calculationCatalogs: catalogs,
      orgDefaults,
    })
    const ensureCatalogs = vi.fn(async () => catalogs)

    const saveArtifacts = await calculateEstimateV2ArtifactsForSave({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      roomRows: payloadWithOrgDefaults.rooms as never,
      wallScopeRows: payloadWithOrgDefaults.room_wall_scopes as never,
      wallSegmentRows: payloadWithOrgDefaults.wall_segments as never,
      ceilingScopeRows: payloadWithOrgDefaults.room_ceiling_scopes as never,
      ceilingSegmentRows: payloadWithOrgDefaults.ceiling_scope_segments as never,
      trimScopeRows: payloadWithOrgDefaults.room_trim_scopes as never,
      doorScopeRows: payloadWithOrgDefaults.room_door_scopes as never,
      drywallRepairRows: payloadWithOrgDefaults.drywall_repairs as never,
      accessFeeRows: [
        {
          id: 'fee-1',
          room_id: null,
          access_fee_id: 'LADDER-TALL',
          qty: 2,
          actual_cost_override: null,
          notes: null,
          position: 0,
          active: 'Y',
        },
      ],
      otherRows: payloadWithOrgDefaults.other as never,
      jobsettings: payloadWithOrgDefaults.jobsettings as never,
      orgDefaults,
      ensureCatalogs,
    })

    expect(saveArtifacts.wallCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'WALL-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        paint_prod_rate_sqft_per_hour: 80,
        primer_prod_rate_sqft_per_hour: 120,
        condition_factor: 1.32,
      })
    )
    expect(saveArtifacts.wallCalculations.assumptions.labor_rate_per_hour).toBe(orgDefaults.override_labor_rate)
    expect(saveArtifacts.quoteWallScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'WALL-DEFAULT',
        primer_product_id: null,
        raw_area_sf: canonical.quoteWallScopes[0].raw_area_sf,
        effective_total: canonical.quoteWallScopes[0].effective_total,
      })
    )
    expect(saveArtifacts.ceilingCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'CEILING-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        paint_prod_rate_sqft_per_hour: 100,
        primer_prod_rate_sqft_per_hour: 130,
      })
    )
    expect(saveArtifacts.ceilingCalculations.scopes[0].condition_factor).toBeCloseTo(1.155)
    expect(saveArtifacts.quoteCeilingScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
        raw_area_sf: canonical.quoteCeilingScopes[0].raw_area_sf,
        effective_total: canonical.quoteCeilingScopes[0].effective_total,
      })
    )
    expect(saveArtifacts.trimCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'TRIM-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        raw_measurement: 54,
      })
    )
    expect(saveArtifacts.trimCalculations.scopes[0].condition_factor).toBeCloseTo(1.265)
    expect(saveArtifacts.quoteTrimScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
        raw_measurement: canonical.quoteTrimScopes[0].raw_measurement,
        effective_total: canonical.quoteTrimScopes[0].effective_total,
      })
    )
    expect(saveArtifacts.quoteDoorScopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: null,
        primer_product_id: null,
        effective_total: canonical.quoteDoorScopes[0]?.effective_total,
      })
    )
    expect(saveArtifacts.quoteDoorScopes[0].condition_factor).toBeCloseTo(1.25)
    expect(saveArtifacts.wallCalculations.scopes[0].effective_total).toBeCloseTo(
      canonical.wallCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(saveArtifacts.ceilingCalculations.scopes[0].effective_total).toBeCloseTo(
      canonical.ceilingCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(saveArtifacts.trimCalculations.scopes[0].effective_total).toBeCloseTo(
      canonical.trimCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(saveArtifacts.doorCalculations.scopes[0].effective_total).toBeCloseTo(
      canonical.doorCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(saveArtifacts.accessFeeCalculation.total).toBe(canonical.accessFeeCalculation.total)
    expect(saveArtifacts.otherCalculations.scopes).toEqual(
      canonical.otherCalculations.scopes.map((scope) =>
        expect.objectContaining({
          id: scope.id,
          raw_total: scope.raw_total,
          effective_total: scope.effective_total,
        })
      )
    )
    expect(saveArtifacts.pricingSummary.sharedAccessCost).toBe(canonical.pricingSummary.sharedAccessCost)
    expect(saveArtifacts.pricingSummary.prePolicyTotal).toBeCloseTo(
      canonical.pricingSummary.prePolicyTotal,
      2
    )
    expect(saveArtifacts.pricingSummary.postLaborPolicyTotal).toBeCloseTo(
      canonical.pricingSummary.postLaborPolicyTotal,
      2
    )
    expect(saveArtifacts.pricingSummary.finalTotal).toBeCloseTo(
      canonical.pricingSummary.finalTotal,
      2
    )
  })

  it('treats omitted save access fee and other rows as empty arrays', async () => {
    const payloadWithoutAccessOrOther = {
      ...structuredClone(payload),
      access_fees: [],
      other: [],
    } as EstimateV2SavePayload

    const canonical = calculateEstimateV2ArtifactsFromPayload({
      payload: payloadWithoutAccessOrOther,
      calculationCatalogs: catalogs,
      orgDefaults,
    })
    const ensureCatalogs = vi.fn(async () => catalogs)

    const saveArtifacts = await calculateEstimateV2ArtifactsForSave({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      roomRows: payloadWithoutAccessOrOther.rooms as never,
      wallScopeRows: payloadWithoutAccessOrOther.room_wall_scopes as never,
      wallSegmentRows: payloadWithoutAccessOrOther.wall_segments as never,
      ceilingScopeRows: payloadWithoutAccessOrOther.room_ceiling_scopes as never,
      ceilingSegmentRows: payloadWithoutAccessOrOther.ceiling_scope_segments as never,
      trimScopeRows: payloadWithoutAccessOrOther.room_trim_scopes as never,
      doorScopeRows: payloadWithoutAccessOrOther.room_door_scopes as never,
      drywallRepairRows: payloadWithoutAccessOrOther.drywall_repairs as never,
      jobsettings: payloadWithoutAccessOrOther.jobsettings as never,
      orgDefaults,
      ensureCatalogs,
    })

    expect(saveArtifacts.accessFeeCalculation.total).toBe(0)
    expect(saveArtifacts.accessFeeCalculation.rows).toEqual([])
    expect(saveArtifacts.otherCalculations.scopes).toEqual([])
    expect(saveArtifacts.pricingSummary.sharedAccessCost).toBe(0)
    expect(saveArtifacts.pricingSummary.prePolicyTotal).toBeCloseTo(
      canonical.pricingSummary.prePolicyTotal,
      2
    )
    expect(saveArtifacts.pricingSummary.postLaborPolicyTotal).toBeCloseTo(
      canonical.pricingSummary.postLaborPolicyTotal,
      2
    )
    expect(saveArtifacts.pricingSummary.finalTotal).toBeCloseTo(
      canonical.pricingSummary.finalTotal,
      2
    )
  })
})
