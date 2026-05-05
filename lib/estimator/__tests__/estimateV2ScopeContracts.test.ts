import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls } from '../walls.ts'
import { calculateCeilings } from '../ceilings.ts'
import { calculateTrim } from '../trim.ts'
import { calculateDoors } from '../doors.ts'
import { buildSimpleWallsInput, round2 } from './estimateV2ShippingFixtures.ts'

function assertZeroEffectiveScope(scope: Record<string, unknown>) {
  for (const key of [
    'effective_area_sf',
    'effective_paint_hours',
    'effective_primer_hours',
    'effective_paint_gallons',
    'effective_primer_gallons',
    'effective_supply_cost',
    'effective_total',
  ]) {
    assert.equal(scope[key] ?? 0, 0, `${key} should be zero for excluded scopes`)
  }
}

test('walls contract: include=N contributes zero and room totals exclude it', () => {
  const input = buildSimpleWallsInput()
  input.scopes.push({ ...input.scopes[0], id: 'excluded-wall', include: 'N', override_total: 9999 })
  const result = calculateWalls(input)
  const excluded = result.scopes.find((scope) => scope.id === 'excluded-wall')
  assert.ok(excluded)
  assertZeroEffectiveScope(excluded as unknown as Record<string, unknown>)
  assert.equal(result.room_totals[0].effective_total, result.scopes[0].effective_total)
})

test('walls contract: excluded RECT and SEG scopes do not require geometry, assumptions, or segments', () => {
  const rect = buildSimpleWallsInput().scopes[0]
  const rectResult = calculateWalls({
    settings: {},
    scopes: [
      {
        ...rect,
        id: 'excluded-rect-wall',
        include: 'N',
        perimeter_in: null,
        height_in: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_coats: null,
        prime_mode: 'FULL',
      },
    ],
    segments: [],
  })
  assert.deepEqual(rectResult.missing_inputs, [])
  assert.equal(rectResult.scopes[0].effective_area_sf, 0)
  assert.equal(rectResult.scopes[0].effective_total, 0)

  const segResult = calculateWalls({
    settings: {},
    scopes: [
      {
        ...rect,
        id: 'excluded-seg-wall',
        include: 'N',
        mode: 'SEG',
        perimeter_in: null,
        height_in: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_coats: null,
        prime_mode: 'FULL',
      },
    ],
    segments: [
      {
        id: 'excluded-wall-segment',
        wall_scope_id: 'excluded-seg-wall',
        room_id: 'R001',
        position: 0,
        segment_name: 'Excluded segment',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 0,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: null,
        standard_door_count: null,
        standard_window_count: null,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  })
  assert.deepEqual(segResult.missing_inputs, [])
  assert.equal(segResult.scopes[0].effective_area_sf, 0)
  assert.equal(segResult.scopes[0].effective_total, 0)
})

test('walls contract: override_total wins after component calculations', () => {
  const input = buildSimpleWallsInput()
  input.scopes[0].override_total = 777
  const result = calculateWalls(input)
  assert.equal(result.scopes[0].effective_total, 777)
  assert.equal(result.room_totals[0].effective_total, 777)
})

test('ceilings contract: override_supply_cost and override_total are reflected in totals', () => {
  const result = calculateCeilings({
    settings: { labor_rate_per_hour: 50, area_supply_cost_per_sf: 0.1, per_color_supply_cost: 0 },
    scopes: [
      {
        id: 'ceiling-override',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Ceiling',
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        prime_mode: 'NONE',
        spot_prime_percent: null,
        ceiling_type_id: null,
        ceiling_geometry_mode: 'FLAT',
        vaulted_area_factor: null,
        tray_perimeter_in: null,
        tray_step_height_in: null,
        tray_band_width_in: null,
        coffer_section_length_in: null,
        coffer_section_width_in: null,
        coffer_section_count: null,
        coffer_face_height_in: null,
        coffer_bottom_width_in: null,
        helper_extra_area_sf: null,
        height_factor: 1,
        complexity_factor: 1,
        ceiling_flag_factor: 1,
        area_sf: 100,
        length_in: null,
        width_in: null,
        override_area_sf: null,
        override_paint_hours: null,
        override_primer_hours: null,
        override_paint_gallons: null,
        override_primer_gallons: null,
        override_supply_cost: 22,
        override_total: 333,
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
      },
    ],
    segments: [],
  })
  assert.equal(result.scopes[0].effective_supply_cost, 22)
  assert.equal(result.scopes[0].effective_total, 333)
  assert.equal(result.room_totals[0].effective_total, 333)
})

test('ceilings contract: excluded RECT and SEG scopes do not require geometry, assumptions, or segments', () => {
  const baseScope = {
    id: 'excluded-ceiling',
    room_id: 'R001',
    position: 0,
    mode: 'RECT' as const,
    include: 'N' as const,
    scope_name: 'Excluded ceiling',
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'FULL' as const,
    spot_prime_percent: null,
    ceiling_type_id: null,
    ceiling_geometry_mode: 'FLAT' as const,
    vaulted_area_factor: null,
    tray_perimeter_in: null,
    tray_step_height_in: null,
    tray_band_width_in: null,
    coffer_section_length_in: null,
    coffer_section_width_in: null,
    coffer_section_count: null,
    coffer_face_height_in: null,
    coffer_bottom_width_in: null,
    helper_extra_area_sf: null,
    height_factor: 1,
    complexity_factor: 1,
    ceiling_flag_factor: 1,
    area_sf: null,
    length_in: null,
    width_in: null,
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
    paint_coats: null,
    primer_coats: null,
  }

  const rectResult = calculateCeilings({ settings: {}, scopes: [baseScope], segments: [] })
  assert.deepEqual(rectResult.missing_inputs, [])
  assert.equal(rectResult.scopes[0].effective_area_sf, 0)
  assert.equal(rectResult.scopes[0].effective_total, 0)

  const segResult = calculateCeilings({
    settings: {},
    scopes: [{ ...baseScope, id: 'excluded-seg-ceiling', mode: 'SEG' }],
    segments: [
      {
        id: 'excluded-ceiling-segment',
        ceiling_scope_id: 'excluded-seg-ceiling',
        room_id: 'R001',
        position: 0,
        segment_name: 'Excluded segment',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 0,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: null,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  })
  assert.deepEqual(segResult.missing_inputs, [])
  assert.equal(segResult.scopes[0].effective_area_sf, 0)
  assert.equal(segResult.scopes[0].effective_total, 0)
})

test('trim contract: room total equals sum of included trim scope totals', () => {
  const baseScope = {
    id: 'trim-a',
    room_id: 'R001',
    position: 0,
    include: 'Y' as const,
    scope_name: 'Base',
    trim_type_id: 'BASE',
    trim_family: 'BASE',
    unit_type: 'LF' as const,
    measurement_mode: 'MANUAL' as const,
    helper_source: null,
    measurement_value: 40,
    helper_value: null,
    baseboard_opening_count: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    paint_enabled: 'Y' as const,
    prime_mode: 'NONE' as const,
    spot_prime_percent: null,
    production_rate_id: null,
    prep_factor: 1,
    height_factor: 1,
    profile_factor: 1,
    room_flag_factor: 1,
    masking_factor: 1,
    stair_factor: 1,
    difficult_finish_factor: 1,
    caulk_fill_factor: 1,
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
  }
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [
      baseScope,
      {
        ...baseScope,
        id: 'trim-b-excluded',
        position: 1,
        include: 'N',
        scope_name: 'Excluded',
        measurement_value: 999,
        override_total: 9999,
      },
    ],
  })
  const includedTotal = round2(
    result.scopes
      .filter((scope) => scope.include === 'Y')
      .reduce((sum, scope) => sum + (scope.effective_total ?? 0), 0)
  )
  assert.equal(round2(result.room_totals[0].effective_total), includedTotal)
})

test('trim and doors contract: excluded scopes do not require measurement or quantity inputs', () => {
  const trimResult = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: null, width_in: null, mode: 'SEG' }],
    settings: {},
    scopes: [
      {
        id: 'excluded-trim',
        room_id: 'R001',
        position: 0,
        include: 'N',
        scope_name: 'Excluded trim',
        trim_type_id: null,
        trim_family: null,
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: null,
        helper_value: null,
        baseboard_opening_count: null,
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'FULL',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: 1,
        height_factor: 1,
        profile_factor: 1,
        room_flag_factor: 1,
        masking_factor: 1,
        stair_factor: 1,
        difficult_finish_factor: 1,
        caulk_fill_factor: 1,
        paint_coats: null,
        primer_coats: null,
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
      },
    ],
  })
  assert.deepEqual(trimResult.missing_inputs, [])
  assert.equal(trimResult.scopes[0].effective_measurement, 0)
  assert.equal(trimResult.scopes[0].effective_total, 0)

  const doorResult = calculateDoors({
    settings: {},
    scopes: [
      {
        id: 'excluded-door',
        room_id: 'R001',
        position: 0,
        include: 'N',
        scope_name: 'Excluded door',
        door_type_id: null,
        quantity: null,
        sides: null,
        prime_mode: 'FULL',
      },
    ],
  })
  assert.deepEqual(doorResult.missing_inputs, [])
  assert.equal(doorResult.scopes[0].effective_units, 0)
  assert.equal(doorResult.scopes[0].effective_total, 0)
})
