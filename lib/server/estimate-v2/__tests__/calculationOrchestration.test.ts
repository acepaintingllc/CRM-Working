import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstimateV2SavePayload } from '@/types/estimator/v2'
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
  calculateCeilingsForSave,
  calculateDoorsForSave,
  calculateEstimateV2ArtifactsFromPayload,
  calculateTrimForSave,
  calculateWallsForSave,
  loadCalculatedEstimateV2Artifacts,
  type EstimateV2CalculationCatalogBundle,
} from '../calculationOrchestration.ts'

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
      id: 'wall-1',
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
      id: 'ceiling-1',
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
      id: 'trim-1',
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
      id: 'door-1',
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
      id: 'drywall-1',
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

    expect(wrapped).toEqual(pure)
    expect(mocks.loadEstimateV2CalculationCatalogs).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })
  })

  it('runs the full parity path for defaults, production rates, conditions, trim modes, and pricing rollup', () => {
    const result = calculateEstimateV2ArtifactsFromPayload({
      payload,
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
        paint_product_id: 'WALL-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
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
    expect(result.trimCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'TRIM-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
        raw_measurement: 54,
      })
    )
    expect(result.trimCalculations.scopes[0].condition_factor).toBeCloseTo(1.265)
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

  it('keeps save helper scope calculations aligned with canonical artifact defaults', async () => {
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
    }

    const canonical = calculateEstimateV2ArtifactsFromPayload({
      payload: payloadWithOrgDefaults,
      calculationCatalogs: catalogs,
      orgDefaults,
    })
    const ensureCatalogs = vi.fn(async () => catalogs)

    const savedWalls = await calculateWallsForSave({
      requestOrigin: 'http://localhost:3000',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      scopes: payloadWithOrgDefaults.room_wall_scopes as never,
      roomRows: payloadWithOrgDefaults.rooms as never,
      segments: payloadWithOrgDefaults.wall_segments as never,
      jobsettings: payloadWithOrgDefaults.jobsettings as never,
      orgDefaults,
      ensureCatalogs,
    })
    const savedCeilings = await calculateCeilingsForSave({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      scopes: payloadWithOrgDefaults.room_ceiling_scopes as never,
      roomRows: payloadWithOrgDefaults.rooms as never,
      segments: payloadWithOrgDefaults.ceiling_scope_segments as never,
      jobsettings: payloadWithOrgDefaults.jobsettings as never,
      orgDefaults,
      ensureCatalogs,
    })
    const savedTrim = await calculateTrimForSave({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      scopes: payloadWithOrgDefaults.room_trim_scopes as never,
      roomRows: payloadWithOrgDefaults.rooms as never,
      wallScopeRows: payloadWithOrgDefaults.room_wall_scopes as never,
      ceilingScopeRows: payloadWithOrgDefaults.room_ceiling_scopes as never,
      jobsettings: payloadWithOrgDefaults.jobsettings as never,
      orgDefaults,
      ensureCatalogs,
    })
    const savedDoors = await calculateDoorsForSave({
      orgId: 'org-1',
      estimateId: 'estimate-1',
      scopes: payloadWithOrgDefaults.room_door_scopes as never,
      roomRows: payloadWithOrgDefaults.rooms as never,
      jobsettings: payloadWithOrgDefaults.jobsettings as never,
      orgDefaults,
      ensureCatalogs,
    })

    expect(savedWalls.wallCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'WALL-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
      })
    )
    expect(savedCeilings.ceilingCalculations.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'CEILING-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
      })
    )
    expect(savedTrim.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'TRIM-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
      })
    )
    expect(savedDoors.scopes[0]).toEqual(
      expect.objectContaining({
        paint_product_id: 'TRIM-DEFAULT',
        primer_product_id: 'PRIMER-DEFAULT',
      })
    )
    expect(savedWalls.wallCalculations.scopes[0].effective_total).toBeCloseTo(
      canonical.wallCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(savedCeilings.ceilingCalculations.scopes[0].effective_total).toBeCloseTo(
      canonical.ceilingCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(savedTrim.scopes[0].effective_total).toBeCloseTo(
      canonical.trimCalculations.scopes[0].effective_total ?? 0,
      2
    )
    expect(savedDoors.scopes[0].effective_total).toBeCloseTo(
      canonical.doorCalculations.scopes[0].effective_total ?? 0,
      2
    )
  })
})
