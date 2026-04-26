import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildV2RoomRosterRows,
  buildV2WallScopeRows,
  buildV2WallSegmentRows,
  toWallCalculationCatalogs,
  buildV2CeilingScopeRows,
  buildV2CeilingSegmentRows,
  toCeilingCalculationCatalogs,
  buildV2TrimScopeRows,
  toTrimCalculationCatalogs,
} from '../estimateV2RoutePayload.ts'

test('buildV2RoomRosterRows assigns generated IDs and enforces uniqueness', () => {
  const rows = buildV2RoomRosterRows([
    { room_name: 'Living', room_id: 'R001' },
    { room_name: 'Kitchen', room_id: '' },
    { room_name: 'Hall', room_id: 'R010' },
  ])
  assert.equal(rows.length, 3)
  assert.equal(rows[0].room_id, 'R001')
  assert.equal(rows[1].room_id, 'R002')
  assert.equal(rows[2].room_id, 'R010')
})

test('buildV2WallScopeRows enforces one RECT scope per room and no mixed room mode', () => {
  assert.throws(
    () =>
      buildV2WallScopeRows(
        [
          { room_id: 'R001', mode: 'RECT', include: 'Y' },
          { room_id: 'R001', mode: 'RECT', include: 'Y' },
        ],
        new Set(['R001'])
      ),
    /only one active RECT wall scope is allowed/i
  )

  assert.throws(
    () =>
      buildV2WallScopeRows(
        [
          { room_id: 'R001', mode: 'RECT', include: 'Y' },
          { room_id: 'R001', mode: 'SEG', include: 'Y' },
        ],
        new Set(['R001'])
      ),
    /all wall scopes must use the same mode/i
  )
})

test('buildV2WallScopeRows maps v2 wall fields including coats and spot prime aliases', () => {
  const parsed = buildV2WallScopeRows(
    [
      {
        id: '11111111-1111-4111-8111-111111111111',
        room_id: 'r001',
        mode: 'rect',
        include: 'Y',
        scope_name: 'Walls',
        color_id: 'b',
        paint_product_id: 'P1',
        primer_product_id: 'PR1',
        prime_mode: 'SPOT',
        height_in: '96',
        perimeter_in: '444',
        standard_door_count: '1',
        standard_window_count: '2',
        complexity_factor: '1.2',
        paint_coats: '3',
        wall_spot_prime_pct: '40',
      },
    ],
    new Set(['R001'])
  )

  assert.equal(parsed.scopeRows.length, 1)
  const scope = parsed.scopeRows[0]
  assert.equal(scope.room_id, 'R001')
  assert.equal(scope.position, 0)
  assert.equal(scope.mode, 'RECT')
  assert.equal(scope.prime_mode, 'SPOT')
  assert.equal(scope.color_id, 'B')
  assert.equal(scope.paint_coats, 3)
  assert.equal(scope.spot_prime_percent, 40)
  assert.equal(scope.complexity_factor, 1.2)
  assert.equal(parsed.modeByRoom.get('R001'), 'RECT')
})

test('buildV2WallSegmentRows enforces SEG-only ownership and shape-required dimensions', () => {
  const scopeRows = buildV2WallScopeRows(
    [
      {
        id: '22222222-2222-4222-8222-222222222222',
        room_id: 'R100',
        mode: 'RECT',
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        room_id: 'R101',
        mode: 'SEG',
      },
    ],
    new Set(['R100', 'R101'])
  ).scopeRows

  assert.throws(
    () =>
      buildV2WallSegmentRows(
        [{ wall_scope_id: '22222222-2222-4222-8222-222222222222', shape_type: 'MANUAL', manual_area_sf: 10, quantity: 1 }],
        scopeRows
      ),
    /segments can only belong to SEG scopes/i
  )

  assert.throws(
    () =>
      buildV2WallSegmentRows(
        [{ wall_scope_id: '33333333-3333-4333-8333-333333333333', shape_type: 'TRIANGLE', height_in: 96, quantity: 1 }],
        scopeRows
      ),
    /triangle segments require base and height/i
  )

  const segments = buildV2WallSegmentRows(
    [
      {
        id: '44444444-4444-4444-8444-444444444444',
        wall_scope_id: '33333333-3333-4333-8333-333333333333',
        shape_type: 'RECTANGLE',
        width_in: 120,
        height_in: 96,
        quantity: 1,
        include: 'Y',
      },
      {
        wall_scope_id: '33333333-3333-4333-8333-333333333333',
        shape_type: 'MANUAL',
        manual_area_sf: 30,
        quantity: 2,
        include: 'Y',
      },
    ],
    scopeRows
  )
  assert.equal(segments.length, 2)
  assert.equal(segments[0].room_id, 'R101')
  assert.equal(segments[0].position, 0)
  assert.equal(segments[1].position, 1)
})

test('toWallCalculationCatalogs normalizes product and supply rows', () => {
  const catalogs = toWallCalculationCatalogs({
    paint_products: [{ id: 'P1', type: 'Paint', price_per_gal: '42.5', coverage_sqft_per_gal_per_coat: '350' }],
    supplies_rates: [{ key: 'WALL_PER_COLOR', scope: 'Walls', unit: 'per color', value: '12' }],
  })
  assert.ok(catalogs)
  const cast = catalogs as {
    paint_products: Array<{ id: string; type: string; price_per_gal: number | null }>
    supplies_rates: Array<{ key: string; value: number }>
  }
  assert.equal(cast.paint_products.length, 1)
  assert.equal(cast.paint_products[0].id, 'P1')
  assert.equal(cast.paint_products[0].price_per_gal, 42.5)
  assert.equal(cast.supplies_rates.length, 1)
  assert.equal(cast.supplies_rates[0].key, 'WALL_PER_COLOR')
  assert.equal(cast.supplies_rates[0].value, 12)
})

// ─── Ceiling scope / segment builders ─────────────────────────────────────────

test('buildV2CeilingScopeRows throws on two RECT ceiling scopes or mixed mode per room', () => {
  assert.throws(
    () =>
      buildV2CeilingScopeRows(
        [
          { room_id: 'R001', mode: 'RECT', include: 'Y' },
          { room_id: 'R001', mode: 'RECT', include: 'Y' },
        ],
        new Set(['R001'])
      ),
    /only one active RECT ceiling scope is allowed/i
  )

  assert.throws(
    () =>
      buildV2CeilingScopeRows(
        [
          { room_id: 'R001', mode: 'RECT', include: 'Y' },
          { room_id: 'R001', mode: 'SEG', include: 'Y' },
        ],
        new Set(['R001'])
      ),
    /all ceiling scopes must use the same mode/i
  )
})

test('buildV2CeilingScopeRows maps ceiling-specific fields and auto-assigns position', () => {
  const parsed = buildV2CeilingScopeRows(
    [
      {
        id: '11111111-1111-4111-8111-111111111111',
        room_id: 'r001',
        mode: 'rect',
        include: 'Y',
        scope_name: 'Main Ceiling',
        color_id: 'b',
        ceiling_type_id: 'vaulted',
        prime_mode: 'SPOT',
        spot_prime_percent: '40',
        area_sf: '200',
        length_in: '144',
        width_in: '120',
        height_factor: '1.1',
        complexity_factor: '1.2',
      },
    ],
    new Set(['R001'])
  )

  assert.equal(parsed.scopeRows.length, 1)
  const scope = parsed.scopeRows[0]
  assert.equal(scope.room_id, 'R001')
  assert.equal(scope.mode, 'RECT')
  assert.equal(scope.position, 0)
  assert.equal(scope.ceiling_type_id, 'vaulted')
  assert.equal(scope.prime_mode, 'SPOT')
  assert.equal(scope.spot_prime_percent, 40)
  assert.equal(scope.area_sf, 200)
  assert.equal(scope.length_in, 144)
  assert.equal(scope.width_in, 120)
  assert.equal(scope.height_factor, 1.1)
  assert.equal(scope.complexity_factor, 1.2)
  assert.equal(scope.color_id, 'B')
  assert.equal(parsed.modeByRoom.get('R001'), 'RECT')
})

test('buildV2CeilingSegmentRows enforces SEG-only ownership and shape-required dimensions, maps valid rows', () => {
  const scopeRows = buildV2CeilingScopeRows(
    [
      { id: '22222222-2222-4222-8222-222222222222', room_id: 'R100', mode: 'RECT' },
      { id: '33333333-3333-4333-8333-333333333333', room_id: 'R101', mode: 'SEG' },
    ],
    new Set(['R100', 'R101'])
  ).scopeRows

  assert.throws(
    () =>
      buildV2CeilingSegmentRows(
        [{ ceiling_scope_id: '22222222-2222-4222-8222-222222222222', shape_type: 'MANUAL', manual_area_sf: 10, quantity: 1 }],
        scopeRows
      ),
    /segments can only belong to SEG scopes/i
  )

  assert.throws(
    () =>
      buildV2CeilingSegmentRows(
        [{ ceiling_scope_id: '33333333-3333-4333-8333-333333333333', shape_type: 'TRIANGLE', height_in: 96, quantity: 1 }],
        scopeRows
      ),
    /triangle segments require base and height/i
  )

  const segments = buildV2CeilingSegmentRows(
    [
      {
        id: '44444444-4444-4444-8444-444444444444',
        ceiling_scope_id: '33333333-3333-4333-8333-333333333333',
        shape_type: 'RECTANGLE',
        width_in: 120,
        height_in: 96,
        quantity: 1,
        include: 'Y',
      },
      {
        ceiling_scope_id: '33333333-3333-4333-8333-333333333333',
        shape_type: 'MANUAL',
        manual_area_sf: 30,
        quantity: 2,
        include: 'Y',
      },
    ],
    scopeRows
  )
  assert.equal(segments.length, 2)
  assert.equal(segments[0].room_id, 'R101')
  assert.equal(segments[0].position, 0)
  assert.equal(segments[1].position, 1)
  assert.equal(segments[1].manual_area_sf, 30)
})

test('toCeilingCalculationCatalogs includes ceiling_types with normalized labor_mult', () => {
  const catalogs = toCeilingCalculationCatalogs({
    ceiling_types: [{ id: 'vaulted', labor_mult: '1.5' }],
    paint_products: [{ id: 'P1', type: 'Paint', price_per_gal: '42.5', coverage_sqft_per_gal_per_coat: '350' }],
    supplies_rates: [],
  })
  assert.ok(catalogs)
  const cast = catalogs as {
    ceiling_types: Array<{ id: string; labor_mult: number | null }>
    paint_products: Array<{ id: string }>
  }
  assert.equal(cast.ceiling_types.length, 1)
  assert.equal(cast.ceiling_types[0].id, 'vaulted')
  assert.equal(cast.ceiling_types[0].labor_mult, 1.5)
  assert.equal(cast.paint_products.length, 1)
})

test('buildV2TrimScopeRows maps trim row fields and validates room IDs', () => {
  const parsed = buildV2TrimScopeRows(
    [
      {
        id: '55555555-5555-4555-8555-555555555555',
        room_id: 'r001',
        include: 'Y',
        trim_type_id: 'base_std',
        trim_family: 'baseboard',
        unit_type: 'lf',
        measurement_mode: 'room_helper',
        helper_source: 'ROOM_PERIMETER',
        helper_value: '120',
        baseboard_opening_count: '1.5',
        production_rate_id: 'trim_base',
        prime_mode: 'SPOT',
        paint_enabled: 'Y',
        spot_prime_percent: '35',
      },
    ],
    new Set(['R001'])
  )
  assert.equal(parsed.scopeRows.length, 1)
  const row = parsed.scopeRows[0]
  assert.equal(row.room_id, 'R001')
  assert.equal(row.position, 0)
  assert.equal(row.trim_type_id, 'BASE_STD')
  assert.equal(row.unit_type, 'LF')
  assert.equal(row.measurement_mode, 'ROOM_HELPER')
  assert.equal(row.helper_source, 'ROOM_PERIMETER')
  assert.equal(row.helper_value, 120)
  assert.equal(row.baseboard_opening_count, 1.5)
  assert.equal(row.prime_mode, 'SPOT')
  assert.equal(row.spot_prime_percent, 35)

  assert.throws(
    () => buildV2TrimScopeRows([{ room_id: 'R404' }], new Set(['R001'])),
    /room is missing or invalid/i
  )
})

test('toTrimCalculationCatalogs maps trim_items and production_rates rows', () => {
  const catalogs = toTrimCalculationCatalogs({
    trim_items: [
      {
        id: 'BASE_STD',
        family: 'BASEBOARD',
        unit_type: 'LF',
        helper_allowed: 'Y',
        default_production_rate_id: 'TRIM_BASE',
      },
    ],
    production_rates: [
      { id: 'TRIM_BASE', scope_id: 'TRIM', sqft_per_hr: '90', prep_sqft_per_hr: '70', primer_sqft_per_hr: '80' },
    ],
    paint_products: [{ id: 'P1', type: 'Paint', price_per_gal: '40', coverage_sqft_per_gal_per_coat: '350' }],
  })
  assert.ok(catalogs)
  const cast = catalogs as {
    trim_items: Array<{ id: string; default_unit_type: string; helper_allowed: boolean }>
    production_rates: Array<{ id: string; units_per_hour: number | null }>
  }
  assert.equal(cast.trim_items.length, 1)
  assert.equal(cast.trim_items[0].id, 'BASE_STD')
  assert.equal(cast.trim_items[0].default_unit_type, 'LF')
  assert.equal(cast.trim_items[0].helper_allowed, true)
  assert.equal(cast.production_rates.length, 1)
  assert.equal(cast.production_rates[0].id, 'TRIM_BASE')
  assert.equal(cast.production_rates[0].units_per_hour, 90)
})
