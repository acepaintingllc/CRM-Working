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
  buildV2DoorScopeRows,
  buildV2DrywallRepairRows,
  toTrimCalculationCatalogs,
  toDoorCalculationCatalogs,
  toDrywallCalculationCatalogs,
} from '../estimateV2RoutePayload.ts'

test('buildV2RoomRosterRows assigns generated IDs and enforces uniqueness', () => {
  const rows = buildV2RoomRosterRows([
    { room_name: 'Living', room_id: 'R001', condition_selections: { room_furnished: 'active', bad: 'invalid' } },
    { room_name: 'Kitchen', room_id: '' },
    { room_name: 'Hall', room_id: 'R010' },
  ])
  assert.equal(rows.length, 3)
  assert.equal(rows[0].room_id, 'R001')
  assert.equal(rows[1].room_id, 'R002')
  assert.equal(rows[2].room_id, 'R010')
  assert.deepEqual(rows[0].condition_selections, { ROOM_FURNISHED: 'active' })
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
        condition_selections: { wall_cut_in: 'major', noop: 'none' },
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
  assert.deepEqual(scope.condition_selections, { WALL_CUT_IN: 'major' })
  assert.equal(parsed.modeByRoom.get('R001'), 'RECT')
})

test('buildV2WallSegmentRows enforces SEG-only ownership and allows partial dimensions', () => {
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

  const partial = buildV2WallSegmentRows(
    [{ wall_scope_id: '33333333-3333-4333-8333-333333333333', shape_type: 'TRIANGLE', height_in: 96, quantity: 1 }],
    scopeRows
  )
  assert.equal(partial[0].shape_type, 'TRIANGLE')
  assert.equal(partial[0].base_in, null)
  assert.equal(partial[0].height_in, 96)

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
    condition_modifiers: [
      {
        id: 'WALL_TEXTURE',
        display_name: 'Heavy wall texture',
        scope: 'wall',
        modifier_type: 'severity',
        factor_field: 'complexity_factor',
        levels: { minor: '1.10', moderate: '1.20' },
      },
    ],
  })
  assert.ok(catalogs)
  const cast = catalogs as {
    paint_products: Array<{ id: string; type: string; price_per_gal: number | null }>
    supplies_rates: Array<{ key: string; value: number }>
    condition_modifiers: Array<{ id: string; scope: string; levels: { minor?: number; moderate?: number } }>
  }
  assert.equal(cast.paint_products.length, 1)
  assert.equal(cast.paint_products[0].id, 'P1')
  assert.equal(cast.paint_products[0].price_per_gal, 42.5)
  assert.equal(cast.supplies_rates.length, 1)
  assert.equal(cast.supplies_rates[0].key, 'WALL_PER_COLOR')
  assert.equal(cast.supplies_rates[0].value, 12)
  assert.equal(cast.condition_modifiers[0].id, 'WALL_TEXTURE')
  assert.equal(cast.condition_modifiers[0].scope, 'wall')
  assert.equal(cast.condition_modifiers[0].levels.moderate, 1.2)
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
        ceiling_geometry_mode: 'TRAY',
        tray_perimeter_in: '480',
        tray_step_height_in: '12',
        tray_band_width_in: '18',
        area_sf: '200',
        length_in: '144',
        width_in: '120',
        height_factor: '1.1',
        complexity_factor: '1.2',
        condition_selections: { ceil_texture: 'moderate' },
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
  assert.equal(scope.ceiling_geometry_mode, 'TRAY')
  assert.equal(scope.tray_perimeter_in, 480)
  assert.equal(scope.tray_step_height_in, 12)
  assert.equal(scope.tray_band_width_in, 18)
  assert.equal(scope.area_sf, 200)
  assert.equal(scope.length_in, 144)
  assert.equal(scope.width_in, 120)
  assert.equal(scope.height_factor, 1.1)
  assert.equal(scope.complexity_factor, 1.2)
  assert.deepEqual(scope.condition_selections, { CEIL_TEXTURE: 'moderate' })
  assert.equal(scope.color_id, 'B')
  assert.equal(parsed.modeByRoom.get('R001'), 'RECT')
})

test('buildV2CeilingSegmentRows enforces SEG-only ownership and allows partial dimensions', () => {
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

  const partial = buildV2CeilingSegmentRows(
    [{ ceiling_scope_id: '33333333-3333-4333-8333-333333333333', shape_type: 'TRIANGLE', height_in: 96, quantity: 1 }],
    scopeRows
  )
  assert.equal(partial[0].shape_type, 'TRIANGLE')
  assert.equal(partial[0].base_in, null)
  assert.equal(partial[0].height_in, 96)

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

test('toCeilingCalculationCatalogs includes ceiling_types with normalized labor_mult and area_factor', () => {
  const catalogs = toCeilingCalculationCatalogs({
    ceiling_types: [{ id: 'vaulted', labor_mult: '1.5', area_factor: '1.2' }],
    paint_products: [{ id: 'P1', type: 'Paint', price_per_gal: '42.5', coverage_sqft_per_gal_per_coat: '350' }],
    supplies_rates: [],
  })
  assert.ok(catalogs)
  const cast = catalogs as {
    ceiling_types: Array<{ id: string; labor_mult: number | null; area_factor: number | null }>
    paint_products: Array<{ id: string }>
  }
  assert.equal(cast.ceiling_types.length, 1)
  assert.equal(cast.ceiling_types[0].id, 'vaulted')
  assert.equal(cast.ceiling_types[0].labor_mult, 1.5)
  assert.equal(cast.ceiling_types[0].area_factor, 1.2)
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
        condition_selections: { trim_oil_based: 'active' },
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
  assert.deepEqual(row.condition_selections, { TRIM_OIL_BASED: 'active' })

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

test('toTrimCalculationCatalogs passes through trim_category, measurement_class, picker_group metadata', () => {
  const catalogs = toTrimCalculationCatalogs({
    trim_items: [
      {
        id: 'BASE_STD',
        family: 'BASEBOARD',
        unit_type: 'LF',
        helper_allowed: 'Y',
        default_production_rate_id: 'TRIM_BASE',
        trim_category: 'base',
        measurement_class: 'linear',
        picker_group: 'base_molding',
      },
      {
        id: 'DOOR_PREHUNG',
        family: 'DOOR',
        unit_type: 'EA',
        helper_allowed: 'N',
        default_production_rate_id: 'TRIM_DOOR',
        trim_category: 'door_window',
        measurement_class: 'opening',
        picker_group: 'doors_windows',
      },
      {
        id: 'LEGACY_ITEM',
        family: 'OTHER',
        unit_type: 'LF',
        helper_allowed: 'N',
        default_production_rate_id: null,
        // no metadata fields — should get null
      },
    ],
    production_rates: [],
    paint_products: [],
  })
  assert.ok(catalogs)
  const items = (catalogs as { trim_items: Array<Record<string, unknown>> }).trim_items
  assert.equal(items.length, 3)

  // Item with all metadata
  assert.equal(items[0].id, 'BASE_STD')
  assert.equal(items[0].trim_category, 'base')
  assert.equal(items[0].measurement_class, 'linear')
  assert.equal(items[0].picker_group, 'base_molding')

  // Item with door_window metadata
  assert.equal(items[1].id, 'DOOR_PREHUNG')
  assert.equal(items[1].trim_category, 'door_window')
  assert.equal(items[1].measurement_class, 'opening')
  assert.equal(items[1].picker_group, 'doors_windows')

  // Legacy item without metadata — fields should be null
  assert.equal(items[2].id, 'LEGACY_ITEM')
  assert.equal(items[2].trim_category, null)
  assert.equal(items[2].measurement_class, null)
  assert.equal(items[2].picker_group, null)
})

test('buildV2DoorScopeRows maps door row fields and validates room IDs', () => {
  const parsed = buildV2DoorScopeRows(
    [
      {
        id: '66666666-6666-4666-8666-666666666666',
        room_id: 'r001',
        include: 'Y',
        scope_name: 'Hall Door',
        door_type_id: 'panel_std',
        color_id: 'trim_white',
        paint_product_id: 'p_trim',
        primer_product_id: 'p_primer',
        prime_mode: 'SPOT',
        quantity: '2',
        sides: '1',
        paint_coats: '2',
        primer_coats: '1',
        spot_prime_percent: '25',
        condition_factor: '1.15',
        labor_rate: '0.35',
        material_rate: '6',
        override_paint_hours: '3',
        override_primer_hours: '0.5',
        override_material_cost: '22',
        override_supply_cost: '8',
        override_total: '250',
        notes: 'customer only wants hallway side',
      },
    ],
    new Set(['R001'])
  )

  assert.equal(parsed.scopeRows.length, 1)
  const row = parsed.scopeRows[0]
  assert.equal(row.room_id, 'R001')
  assert.equal(row.position, 0)
  assert.equal(row.include, 'Y')
  assert.equal(row.door_type_id, 'PANEL_STD')
  assert.equal(row.color_id, 'TRIMWHITE')
  assert.equal(row.paint_product_id, 'p_trim')
  assert.equal(row.primer_product_id, 'p_primer')
  assert.equal(row.prime_mode, 'SPOT')
  assert.equal(row.quantity, 2)
  assert.equal(row.sides, 1)
  assert.equal(row.spot_prime_percent, 25)
  assert.equal(row.condition_factor, 1.15)
  assert.equal(row.labor_rate, 0.35)
  assert.equal(row.material_rate, 6)
  assert.equal(row.override_total, 250)

  assert.throws(
    () => buildV2DoorScopeRows([{ room_id: 'R404' }], new Set(['R001'])),
    /room is missing or invalid/i
  )
})

test('buildV2DrywallRepairRows validates room, surface, repair type, unit, and quantity', () => {
  const rows = buildV2DrywallRepairRows(
    [
      {
        id: '55555555-5555-4555-8555-555555555555',
        room_id: 'r001',
        surface: 'wall',
        repair_type: 'patch_opening_repair',
        quantity: '2.25',
        override_total: '175',
      },
      {
        room_id: 'R001',
        surface: 'ceiling',
        repair_type: 'ceiling_crack',
        quantity: '3.1',
      },
    ],
    new Set(['R001'])
  ).repairRows

  assert.equal(rows[0].room_id, 'R001')
  assert.equal(rows[0].unit, 'SQFT')
  assert.equal(rows[0].quantity, 2.25)
  assert.equal(rows[0].override_total, 175)
  assert.equal(rows[1].unit, 'LF')
  assert.equal(rows[1].position, 0)

  assert.throws(
    () =>
      buildV2DrywallRepairRows(
        [{ room_id: 'R001', surface: 'ceiling', repair_type: 'flat_wall_crack', quantity: 1 }],
        new Set(['R001'])
      ),
    /not valid for ceiling/i
  )
})

test('toDoorCalculationCatalogs normalizes direct and category-based door rate rows', () => {
  const direct = toDoorCalculationCatalogs({
    door_types: [
      {
        id: 'PANEL_STD',
        label: 'Panel Door',
        unit_rate_type: 'interior',
        unit: 'door side',
        default_qty: '1',
        labor_rate: '0.35',
        material_rate: '6.5',
        amount: '0',
      },
    ],
  })
  const category = toDoorCalculationCatalogs({
    categories: [
      {
        key: 'unit_rates_doors',
        rows: [
          {
            id: 'SLAB',
            display_name: 'Slab Door',
            unit_rate_type: 'interior',
            unit: 'door side',
            default_qty: '2',
            labor_rate: '0.25',
            material_rate: '',
            amount: '4',
          },
        ],
      },
    ],
  })

  assert.equal(direct?.door_unit_rates?.[0]?.id, 'PANEL_STD')
  assert.equal(direct?.door_unit_rates?.[0]?.label, 'Panel Door')
  assert.equal(direct?.door_unit_rates?.[0]?.labor_rate, 0.35)
  assert.equal(direct?.door_unit_rates?.[0]?.material_rate, 6.5)
  assert.equal(category?.door_unit_rates?.[0]?.id, 'SLAB')
  assert.equal(category?.door_unit_rates?.[0]?.default_qty, 2)
  assert.equal(category?.door_unit_rates?.[0]?.amount, 4)
})

test('toDrywallCalculationCatalogs normalizes drywall rates with ceiling multiplier', () => {
  const catalogs = toDrywallCalculationCatalogs({
    categories: [
      {
        key: 'unit_rates_drywall',
        rows: [
          {
            id: 'PATCH_OPENING_REPAIR',
            display_name: 'Patch/opening repair',
            unit_rate_type: 'patch_opening_repair',
            unit: 'SQFT',
            amount: '45',
            ceiling_multiplier: '1.25',
          },
        ],
      },
    ],
  })

  assert.equal(catalogs?.drywall_unit_rates?.[0]?.id, 'patch_opening_repair')
  assert.equal(catalogs?.drywall_unit_rates?.[0]?.amount, 45)
  assert.equal(catalogs?.drywall_unit_rates?.[0]?.ceiling_multiplier, 1.25)
})
