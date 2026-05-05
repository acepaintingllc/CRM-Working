import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCeilings } from '../ceilings.ts'
import { calculateDoors } from '../doors.ts'
import { calculateDrywallRepairs } from '../drywall.ts'
import {
  calculateCeilingScopePreviewAreaBreakdown,
  calculateCeilingScopePreviewEffectiveArea,
  calculateDoorScopePreviewCount,
  calculateDoorScopePreviewEffectiveUnits,
  calculateDrywallRepairPreviewEffectiveQuantity,
  calculatePreviewEffectiveTotal,
  calculateTrimScopePreviewEffectiveMeasurement,
} from '../previewCalculations.ts'
import { calculateTrim } from '../trim.ts'
import type { CeilingCalculationInput } from '../ceilingTypes.ts'
import type { TrimCalculationInput } from '../trimTypes.ts'
import type { DoorCalculationInput } from '../../../types/estimator/doors.ts'
import type { DrywallCalculationInput } from '../../../types/estimator/drywall.ts'

const BASE_SETTINGS = {
  labor_rate_per_hour: 50,
  paint_prod_rate_sqft_per_hour: 100,
  primer_prod_rate_sqft_per_hour: 200,
  paint_coverage_sqft_per_gal_per_coat: 200,
  primer_coverage_sqft_per_gal_per_coat: 100,
  paint_coats: 2,
  primer_coats: 1,
  area_supply_cost_per_sf: 0.1,
  per_color_supply_cost: 12,
  paint_price_per_gal: 10,
  primer_price_per_gal: 8,
  spot_prime_percent: 30,
}

function ceilingScope(overrides: Partial<CeilingCalculationInput['scopes'][0]> = {}): CeilingCalculationInput['scopes'][0] {
  return {
    id: 'ceiling-1',
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: 'Ceiling',
    area_sf: null,
    length_in: 144,
    width_in: 120,
    ceiling_geometry_mode: 'FLAT',
    vaulted_area_factor: null,
    vaulted_ridge_length_in: null,
    vaulted_slope_length_in: null,
    vaulted_plane_count: null,
    tray_perimeter_in: null,
    tray_step_height_in: null,
    tray_band_width_in: null,
    coffer_section_length_in: null,
    coffer_section_width_in: null,
    coffer_section_count: null,
    coffer_face_height_in: null,
    coffer_bottom_width_in: null,
    helper_extra_area_sf: null,
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
    ...overrides,
  }
}

function ceilingPreviewScope(scope: CeilingCalculationInput['scopes'][0]) {
  return {
    include: scope.include,
    mode: scope.mode,
    lengthIn: scope.length_in,
    widthIn: scope.width_in,
    areaSf: scope.area_sf,
    ceilingGeometryMode: scope.ceiling_geometry_mode,
    vaultedAreaFactor: scope.vaulted_area_factor,
    vaultedRidgeLengthIn: scope.vaulted_ridge_length_in,
    vaultedSlopeLengthIn: scope.vaulted_slope_length_in,
    vaultedPlaneCount: scope.vaulted_plane_count,
    cofferSectionLengthIn: scope.coffer_section_length_in,
    cofferSectionWidthIn: scope.coffer_section_width_in,
    cofferSectionCount: scope.coffer_section_count,
    cofferFaceHeightIn: scope.coffer_face_height_in,
    cofferBottomWidthIn: scope.coffer_bottom_width_in,
    ceilingTypeId: scope.ceiling_type_id,
    overrideAreaSqFt: scope.override_area_sf,
  }
}

function ceilingPreviewSegment(segment: CeilingCalculationInput['segments'][0]) {
  return {
    include: segment.include,
    shapeType: segment.shape_type,
    quantity: segment.quantity,
    widthIn: segment.width_in,
    heightIn: segment.height_in,
    baseIn: segment.base_in,
    manualAreaSqFt: segment.manual_area_sf,
    overrideAreaSqFt: segment.override_area_sf,
  }
}

test('ceiling preview area matches server for flat, vaulted, coffered, SEG, include=N, and overrides', () => {
  const cases: Array<{
    name: string
    scope: CeilingCalculationInput['scopes'][0]
    segments?: CeilingCalculationInput['segments']
    catalogs?: CeilingCalculationInput['catalogs']
  }> = [
    { name: 'flat rectangle', scope: ceilingScope() },
    { name: 'direct area', scope: ceilingScope({ area_sf: 95, length_in: null, width_in: null }) },
    {
      name: 'vaulted factor',
      scope: ceilingScope({ ceiling_geometry_mode: 'VAULTED', vaulted_area_factor: 1.2 }),
    },
    {
      name: 'vaulted measured',
      scope: ceilingScope({
        ceiling_geometry_mode: 'VAULTED',
        vaulted_ridge_length_in: 180,
        vaulted_slope_length_in: 120,
        vaulted_plane_count: 2,
        vaulted_area_factor: 1.2,
      }),
    },
    {
      name: 'coffered helper',
      scope: ceilingScope({
        ceiling_geometry_mode: 'COFFERED',
        coffer_section_length_in: 48,
        coffer_section_width_in: 36,
        coffer_section_count: 6,
        coffer_face_height_in: 6,
        coffer_bottom_width_in: 4,
      }),
    },
    { name: 'excluded', scope: ceilingScope({ include: 'N', prime_mode: 'FULL' }) },
    { name: 'area override', scope: ceilingScope({ override_area_sf: 72 }) },
    {
      name: 'area factor',
      scope: ceilingScope({ ceiling_type_id: 'vaulted' }),
      catalogs: { ceiling_types: [{ id: 'vaulted', labor_mult: 1, area_factor: 1.25 }] },
    },
    {
      name: 'segment mode',
      scope: ceilingScope({ id: 'seg-scope', mode: 'SEG', length_in: null, width_in: null }),
      segments: [
        {
          id: 'seg-0',
          ceiling_scope_id: 'seg-scope',
          room_id: 'R001',
          position: 0,
          segment_name: 'Rectangle',
          include: 'Y',
          shape_type: 'RECTANGLE',
          quantity: 2,
          width_in: 72,
          height_in: 48,
          base_in: null,
          manual_area_sf: null,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          notes: null,
        },
        {
          id: 'seg-1',
          ceiling_scope_id: 'seg-scope',
          room_id: 'R001',
          position: 1,
          segment_name: 'Manual',
          include: 'Y',
          shape_type: 'MANUAL',
          quantity: 1,
          width_in: null,
          height_in: null,
          base_in: null,
          manual_area_sf: 40,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          notes: null,
        },
        {
          id: 'seg-2',
          ceiling_scope_id: 'seg-scope',
          room_id: 'R001',
          position: 2,
          segment_name: 'Triangle',
          include: 'Y',
          shape_type: 'TRIANGLE',
          quantity: 1,
          width_in: null,
          height_in: 96,
          base_in: 144,
          manual_area_sf: null,
          raw_area_sf: null,
          override_area_sf: null,
          effective_area_sf: null,
          notes: null,
        },
      ],
    },
  ]

  for (const item of cases) {
    const result = calculateCeilings({
      settings: BASE_SETTINGS,
      scopes: [item.scope],
      segments: item.segments ?? [],
      catalogs: item.catalogs,
    })
    assert.equal(
      calculateCeilingScopePreviewEffectiveArea({
        scope: ceilingPreviewScope(item.scope),
        segments: (item.segments ?? []).map(ceilingPreviewSegment),
        ceilingTypes: item.catalogs?.ceiling_types ?? undefined,
      }),
      result.scopes[0].effective_area_sf,
      item.name
    )
  }
})

test('ceiling preview breakdown exposes canonical base, helper, factor, final, override, and missing-input values', () => {
  const vaulted = calculateCeilingScopePreviewAreaBreakdown({
    scope: ceilingPreviewScope(
      ceilingScope({
        ceiling_geometry_mode: 'VAULTED',
        vaulted_area_factor: 1.2,
      })
    ),
  })
  assert.equal(vaulted.baseArea, 120)
  assert.equal(vaulted.helperExtraArea, 24)
  assert.equal(vaulted.areaFactor, 1)
  assert.equal(vaulted.finalArea, 144)
  assert.equal(vaulted.effectiveArea, 144)

  const coffered = calculateCeilingScopePreviewAreaBreakdown({
    scope: ceilingPreviewScope(
      ceilingScope({
        ceiling_type_id: 'coffered',
        ceiling_geometry_mode: 'COFFERED',
        coffer_section_length_in: 48,
        coffer_section_width_in: 36,
        coffer_section_count: 2,
        coffer_face_height_in: 6,
        coffer_bottom_width_in: 4,
      })
    ),
    ceilingTypes: [{ id: 'coffered', area_factor: 1.25 }],
  })
  assert.equal(coffered.baseArea, 120)
  assert.equal(coffered.helperExtraArea, 23.3333)
  assert.equal(coffered.areaFactor, 1.25)
  assert.equal(coffered.finalArea, 179.1666)
  assert.equal(coffered.effectiveArea, 179.1666)

  const overridden = calculateCeilingScopePreviewAreaBreakdown({
    scope: ceilingPreviewScope(ceilingScope({ override_area_sf: 72 })),
  })
  assert.equal(overridden.finalArea, 120)
  assert.equal(overridden.effectiveArea, 72)

  const missing = calculateCeilingScopePreviewAreaBreakdown({
    scope: ceilingPreviewScope(ceilingScope({ length_in: null, width_in: null, area_sf: null })),
  })
  assert.equal(missing.baseArea, null)
  assert.equal(missing.finalArea, null)
  assert.equal(missing.effectiveArea, null)
})

test('ceiling preview returns null for dirty missing inputs until server recalculation supplies fallback zero', () => {
  const scope = ceilingScope({ length_in: null, width_in: null, area_sf: null })
  const result = calculateCeilings({ settings: BASE_SETTINGS, scopes: [scope], segments: [] })

  assert.equal(calculateCeilingScopePreviewEffectiveArea({ scope: ceilingPreviewScope(scope) }), null)
  assert.equal(result.scopes[0].effective_area_sf, 0)
  assert.ok(result.missing_inputs.some((input) => input.field === 'length_in'))
})

test('ceiling preview documents dirty-only fallbacks that server does not use', () => {
  const room = { lengthIn: 180, widthIn: 120 }
  const scope = ceilingScope({
    ceiling_geometry_mode: 'VAULTED',
    length_in: null,
    width_in: 120,
    vaulted_slope_length_in: 144,
    vaulted_plane_count: 2,
  })
  const result = calculateCeilings({ settings: BASE_SETTINGS, scopes: [scope], segments: [] })

  assert.equal(
    calculateCeilingScopePreviewEffectiveArea({
      scope: ceilingPreviewScope(scope),
      room,
    }),
    360
  )
  assert.equal(result.scopes[0].effective_area_sf, 0)
  assert.ok(result.missing_inputs.some((input) => input.field === 'length_in'))
})

function trimScope(overrides: Partial<TrimCalculationInput['scopes'][0]> = {}): TrimCalculationInput['scopes'][0] {
  return {
    id: 'trim-1',
    room_id: 'R001',
    position: 0,
    include: 'Y',
    scope_name: 'Baseboard',
    trim_type_id: 'BASE',
    trim_family: 'BASE',
    unit_type: 'LF',
    measurement_mode: 'ROOM_HELPER',
    helper_source: 'ROOM_PERIMETER',
    measurement_value: null,
    helper_value: null,
    baseboard_opening_count: null,
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
    ...overrides,
  }
}

function trimPreviewScope(scope: TrimCalculationInput['scopes'][0]) {
  return {
    include: scope.include,
    measurementMode: scope.measurement_mode,
    helperSource: scope.helper_source,
    measurementValue: scope.measurement_value,
    helperValue: scope.helper_value,
    overrideMeasurement: scope.override_measurement,
  }
}

test('trim preview measurement matches server for manual, room helper, RECT and SEG room mode, override, and include=N', () => {
  const catalogs: TrimCalculationInput['catalogs'] = {
    trim_items: [
      { id: 'BASE', family: 'BASE', default_unit_type: 'LF', helper_allowed: true, default_production_rate_id: null },
    ],
  }
  const cases: Array<{
    name: string
    scope: TrimCalculationInput['scopes'][0]
    room: TrimCalculationInput['rooms'][0]
  }> = [
    {
      name: 'manual',
      scope: trimScope({ measurement_mode: 'MANUAL', helper_source: null, measurement_value: 28 }),
      room: { room_id: 'R001', length_in: 144, width_in: 120, mode: 'RECT' },
    },
    {
      name: 'room helper RECT',
      scope: trimScope(),
      room: { room_id: 'R001', length_in: 144, width_in: 120, mode: 'RECT' },
    },
    {
      name: 'room helper SEG preview/server zero',
      scope: trimScope(),
      room: { room_id: 'R001', length_in: 144, width_in: 120, mode: 'SEG' },
    },
    {
      name: 'override measurement',
      scope: trimScope({ measurement_mode: 'MANUAL', helper_source: null, measurement_value: 28, override_measurement: 12 }),
      room: { room_id: 'R001', length_in: 144, width_in: 120, mode: 'RECT' },
    },
    {
      name: 'include=N',
      scope: trimScope({ include: 'N', measurement_value: 28 }),
      room: { room_id: 'R001', length_in: 144, width_in: 120, mode: 'RECT' },
    },
  ]

  for (const item of cases) {
    const result = calculateTrim({
      settings: BASE_SETTINGS,
      rooms: [item.room],
      scopes: [item.scope],
      catalogs,
    })

    assert.equal(
      calculateTrimScopePreviewEffectiveMeasurement({
        scope: trimPreviewScope(item.scope),
        room: { lengthIn: item.room.length_in, widthIn: item.room.width_in, mode: item.room.mode },
      }),
      result.scopes[0].effective_measurement,
      item.name
    )
  }
})

test('trim ROOM_PERIMETER preview and server calculations use current room dimensions over stale helper value', () => {
  const room = { room_id: 'R001', length_in: 182, width_in: 146, mode: 'RECT' as const }
  const scope = trimScope({ helper_value: 44 })
  const result = calculateTrim({
    settings: BASE_SETTINGS,
    rooms: [room],
    scopes: [scope],
    catalogs: {
      trim_items: [
        { id: 'BASE', family: 'BASE', default_unit_type: 'LF', helper_allowed: true, default_production_rate_id: null },
      ],
    },
  })

  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: trimPreviewScope(scope),
      room: { lengthIn: room.length_in, widthIn: room.width_in, mode: room.mode },
    }),
    54.6667
  )
  assert.equal(result.scopes[0].helper_value, 54.6667)
  assert.equal(result.scopes[0].effective_measurement, 54.6667)
})

test('trim ROOM_HELPER keeps explicit helper values for non-room-perimeter sources', () => {
  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: {
        include: 'Y',
        measurementMode: 'ROOM_HELPER',
        helperSource: null,
        measurementValue: null,
        helperValue: 44,
        overrideMeasurement: null,
      },
      room: { lengthIn: 182, widthIn: 146, mode: 'RECT' },
    }),
    44
  )
})

test('trim preview total matches server when override total is available and stays pending otherwise', () => {
  const overridden = trimScope({ measurement_mode: 'MANUAL', helper_source: null, measurement_value: 20, override_total: 99 })
  const excluded = trimScope({ include: 'N', measurement_mode: 'MANUAL', helper_source: null, measurement_value: 20, override_total: 99 })
  const calculated = trimScope({ measurement_mode: 'MANUAL', helper_source: null, measurement_value: 20, override_total: null })

  const result = calculateTrim({
    settings: BASE_SETTINGS,
    rooms: [{ room_id: 'R001', length_in: 144, width_in: 120, mode: 'RECT' }],
    scopes: [overridden, excluded, calculated],
  })

  assert.equal(calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: overridden.override_total }), result.scopes[0].effective_total)
  assert.equal(calculatePreviewEffectiveTotal({ include: 'N', overrideTotal: excluded.override_total }), result.scopes[1].effective_total)
  assert.equal(calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: calculated.override_total }), null)
  assert.notEqual(result.scopes[2].effective_total, null)
})

test('trim preview documents helper-source eligibility as a server-only validation rule', () => {
  const scope = trimScope({ helper_source: null, helper_value: 44 })
  const result = calculateTrim({
    settings: BASE_SETTINGS,
    rooms: [{ room_id: 'R001', length_in: 144, width_in: 120, mode: 'RECT' }],
    scopes: [scope],
    catalogs: {
      trim_items: [{ id: 'BASE', family: 'BASE', default_unit_type: 'LF', helper_allowed: true, default_production_rate_id: null }],
    },
  })

  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: trimPreviewScope(scope),
      room: { lengthIn: 144, widthIn: 120, mode: 'RECT' },
    }),
    44
  )
  assert.equal(result.scopes[0].effective_measurement, 0)
  assert.ok(result.missing_inputs.some((input) => input.field === 'helper_source'))
})

test('trim preview preserves include=N, helper value, manual value, and missing helper behavior', () => {
  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: { include: 'N', measurementMode: 'MANUAL', measurementValue: 20, helperValue: null, overrideMeasurement: null },
    }),
    0
  )
  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: { include: 'Y', measurementMode: 'MANUAL', measurementValue: 20, helperValue: null, overrideMeasurement: 8 },
    }),
    8
  )
  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: { include: 'Y', measurementMode: 'ROOM_HELPER', measurementValue: null, helperValue: 44, overrideMeasurement: null },
    }),
    44
  )
  assert.equal(
    calculateTrimScopePreviewEffectiveMeasurement({
      scope: { include: 'Y', measurementMode: 'ROOM_HELPER', measurementValue: null, helperValue: null, overrideMeasurement: null },
      room: { lengthIn: 144, widthIn: 120, mode: 'SEG' },
    }),
    0
  )
})

test('door preview units and count match server for quantity, sides, excluded, and invalid sides inputs', () => {
  const scopes: DoorCalculationInput['scopes'] = [
    { id: 'door-1', room_id: 'R001', include: 'Y', door_type_id: 'STD', quantity: 2, sides: 1 },
    { id: 'door-2', room_id: 'R001', include: 'Y', door_type_id: 'STD', quantity: 2, sides: 2 },
    { id: 'door-3', room_id: 'R001', include: 'N', door_type_id: 'STD', quantity: 2, sides: 2 },
    { id: 'door-4', room_id: 'R001', include: 'Y', door_type_id: 'STD', quantity: 3, sides: 3 },
  ]
  const result = calculateDoors({
    scopes,
    settings: { labor_rate_per_hour: 50 },
    catalogs: { door_unit_rates: [{ id: 'STD', label: 'Standard', unit_rate_type: null, unit: null, default_qty: null, labor_rate: 1, material_rate: 5, amount: null }] },
  })

  for (const scope of scopes) {
    const server = result.scopes.find((row) => row.id === scope.id)
    assert.ok(server)
    assert.equal(
      calculateDoorScopePreviewEffectiveUnits({
        include: scope.include ?? 'Y',
        quantity: scope.quantity,
        sides: scope.sides,
      }),
      server.effective_units,
      String(scope.id)
    )
    assert.equal(
      calculateDoorScopePreviewCount({
        include: scope.include ?? 'Y',
        quantity: scope.quantity,
      }),
      scope.include === 'N' ? 0 : scope.quantity == null ? null : Number(scope.quantity),
      String(scope.id)
    )
  }
})

test('door preview keeps missing quantity as a dirty fallback until server recalculation supplies zero units', () => {
  const scope: DoorCalculationInput['scopes'][0] = {
    id: 'door-missing',
    room_id: 'R001',
    include: 'Y',
    door_type_id: 'STD',
    quantity: null,
    sides: 2,
  }
  const result = calculateDoors({
    scopes: [scope],
    settings: { labor_rate_per_hour: 50 },
    catalogs: { door_unit_rates: [{ id: 'STD', label: 'Standard', unit_rate_type: null, unit: null, default_qty: null, labor_rate: 1, material_rate: 5, amount: null }] },
  })

  assert.equal(
    calculateDoorScopePreviewEffectiveUnits({
      include: scope.include ?? 'Y',
      quantity: scope.quantity,
      sides: scope.sides,
    }),
    null
  )
  assert.equal(result.scopes[0].effective_units, 0)
  assert.ok(result.missing_inputs.some((input) => input.field === 'quantity'))
})

test('effective total preview handles include=N, override, and dirty calculated fallback', () => {
  assert.equal(calculatePreviewEffectiveTotal({ include: 'N', overrideTotal: 100 }), 0)
  assert.equal(calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: 100 }), 100)
  assert.equal(calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: '' }), null)
})

test('door preview total uses override totals but stays pending for calculated door pricing', () => {
  const overridden: DoorCalculationInput['scopes'][0] = {
    id: 'door-overridden',
    room_id: 'R001',
    include: 'Y',
    door_type_id: 'STD',
    quantity: 2,
    sides: 2,
    override_total: 275,
  }
  const calculated: DoorCalculationInput['scopes'][0] = {
    id: 'door-calculated',
    room_id: 'R001',
    include: 'Y',
    door_type_id: 'STD',
    quantity: 2,
    sides: 2,
    override_total: null,
  }
  const result = calculateDoors({
    scopes: [overridden, calculated],
    settings: { labor_rate_per_hour: 50 },
    catalogs: {
      door_unit_rates: [
        {
          id: 'STD',
          label: 'Standard',
          unit_rate_type: null,
          unit: null,
          default_qty: null,
          labor_rate: 1,
          material_rate: 5,
          amount: null,
        },
      ],
    },
  })

  assert.equal(
    calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: overridden.override_total }),
    result.scopes[0].effective_total
  )
  assert.equal(calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: calculated.override_total }), null)
  assert.notEqual(result.scopes[1].effective_total, null)
})

test('drywall preview quantity matches server rounding and total uses override or pending fallback', () => {
  const overridden: DrywallCalculationInput['repairs'][0] = {
    id: 'drywall-overridden',
    room_id: 'R001',
    position: 0,
    surface: 'wall',
    repair_type: 'flat_wall_crack',
    unit: 'LF',
    quantity: 2.2,
    override_total: 80,
  }
  const calculated: DrywallCalculationInput['repairs'][0] = {
    id: 'drywall-calculated',
    room_id: 'R001',
    position: 1,
    surface: 'ceiling',
    repair_type: 'ceiling_crack',
    unit: 'LF',
    quantity: 2.2,
    override_total: null,
  }
  const result = calculateDrywallRepairs({
    repairs: [overridden, calculated],
    catalogs: {
      drywall_unit_rates: [
        {
          id: 'flat_wall_crack',
          label: 'Flat wall crack',
          unit_rate_type: 'flat_wall_crack',
          unit: 'LF',
          amount: 12,
          ceiling_multiplier: null,
        },
        {
          id: 'ceiling_crack',
          label: 'Ceiling crack',
          unit_rate_type: 'ceiling_crack',
          unit: 'LF',
          amount: 12,
          ceiling_multiplier: 1.5,
        },
      ],
    },
  })

  assert.equal(
    calculateDrywallRepairPreviewEffectiveQuantity({ quantity: overridden.quantity }),
    result.scopes[0].effective_quantity
  )
  assert.equal(
    calculateDrywallRepairPreviewEffectiveQuantity({ quantity: calculated.quantity }),
    result.scopes[1].effective_quantity
  )
  assert.equal(
    calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: overridden.override_total }),
    result.scopes[0].effective_total
  )
  assert.equal(calculatePreviewEffectiveTotal({ include: 'Y', overrideTotal: calculated.override_total }), null)
  assert.notEqual(result.scopes[1].effective_total, null)
})
