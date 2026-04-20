import assert from 'node:assert/strict'
import test from 'node:test'
import {
  _test,
  buildRatesFlagsPayloadFromValues,
  parseConstantsTablesDetailed,
} from '../estimateRatesFlags.ts'

function buildSampleConstantsValues() {
  return [
    ['CAT_ProductionRates'],
    [
      'RateID',
      'ScopeID',
      'DisplayName',
      'SurfaceType',
      'Condition',
      'PrepSqFtPerHr',
      'SqFtPerHr',
      'PrimerSqFtPerHr',
      'Active?',
      'Notes',
    ],
    [
      'WALL_STD',
      'WALLS',
      'Walls Standard',
      'Drywall',
      'Std',
      '95',
      '120',
      '110',
      'Y',
      'baseline',
    ],
    [
      'CEIL_STD',
      'CEILINGS',
      'Ceilings Standard',
      'Smooth',
      'Std',
      '80',
      '95',
      '88',
      'Y',
      'ceiling baseline',
    ],
    [
      'TRIM_STD',
      'TRIM',
      'Trim Standard',
      'Baseboard',
      'Std',
      '60',
      '90',
      '75',
      'Y',
      'trim baseline',
    ],
    [],
    ['CAT_HeightFactors'],
    [
      'HeightBandID',
      'DisplayName',
      'MinHeight_ft',
      'MaxHeight_ft',
      'LaborMultiplier',
      'Active?',
    ],
    ['H_8_10', '8-10 ft', '8', '10', '1.15', 'Y'],
    [],
    ['CAT_Supplies'],
    ['SupplyID', 'DisplayName', 'Scope', 'Unit', 'CostPer', 'Active?'],
    ['COLOR_MASK', 'Color Masking', 'Walls', 'per color', '8', 'Y'],
    ['TAPE_SQFT', 'Tape', 'Walls', '$/sqft', '0.35', 'Y'],
    ['MASK_JOB', 'Masking', 'Walls', '$/job', '25', 'Y'],
    [],
    ['CAT_RollerCovers'],
    ['RollerCoverID', 'DisplayName', 'Scope', 'Size_in', 'Price_each', 'Active?'],
    ['ROLLER_9', '9in Roller Cover', 'Wall', '9', '4.5', 'Y'],
    [],
    ['CAT_AccessFees'],
    ['AccessFeeID', 'DisplayName', 'FeeType', 'Amount', 'Unit', 'Active?'],
    ['LADDER', 'Ladder', 'Labor', '100', 'once', 'Y'],
    [],
    ['CAT_WallComplexity'],
    ['ComplexityTypeID', 'DisplayName', 'LaborMultiplier', 'AccessFee$', 'Active?'],
    ['HEAVY', 'Heavy', '1.35', '75', 'Y'],
    [],
    ['CAT_CeilingTypes'],
    ['CeilingTypeID', 'DisplayName', 'LaborMult', 'Surcharge_per_sqft', 'Active?'],
    ['VAULT', 'Vaulted', '1.25', '0.25', 'Y'],
    [],
    ['CAT_RoomFlags'],
    ['FlagID', 'DisplayName', 'WallFactor', 'CeilFactor', 'TrimFactor', 'Active?'],
    ['FURN', 'Heavy furniture', '1.2', '1.1', '1.3', 'Y'],
    [],
    ['SettingKey', 'DefaultValue'],
    ['SchemaVersion', 'v6'],
  ]
}

function findCategoryOrThrow(
  payload: ReturnType<typeof buildRatesFlagsPayloadFromValues>,
  key: string
) {
  const category = payload.categories.find((entry) => entry.key === key)
  assert.ok(category, `missing category: ${key}`)
  return category
}

test('buildRatesFlagsPayloadFromValues parses production split and supply subgroup rows', () => {
  const payload = buildRatesFlagsPayloadFromValues(
    buildSampleConstantsValues(),
    'sheet-1'
  )
  assert.equal(payload.schema_version, 'v6')

  const productionWalls = payload.categories.find(
    (category) => category.key === 'production_rates_walls'
  )
  assert.ok(productionWalls)
  assert.equal(productionWalls?.rows.length, 1)
  assert.equal(productionWalls?.rows[0].id, 'WALL_STD')

  const productionCeilings = payload.categories.find(
    (category) => category.key === 'production_rates_ceilings'
  )
  assert.ok(productionCeilings)
  assert.equal(productionCeilings?.rows.length, 1)
  assert.equal(productionCeilings?.rows[0].id, 'CEIL_STD')

  const productionTrim = payload.categories.find(
    (category) => category.key === 'production_rates_trim'
  )
  assert.ok(productionTrim)
  assert.equal(productionTrim?.rows.length, 1)
  assert.equal(productionTrim?.rows[0].id, 'TRIM_STD')

  const heights = payload.categories.find(
    (category) => category.key === 'height_factors'
  )
  assert.ok(heights)
  assert.equal(heights?.rows.length, 1)
  assert.equal(heights?.rows[0].id, 'H_8_10')

  const perColor = payload.categories.find(
    (category) => category.key === 'supply_rates_per_color'
  )
  assert.ok(perColor)
  assert.equal(perColor?.rows.length, 1)
  assert.equal(perColor?.rows[0].id, 'COLOR_MASK')

  const areaBased = payload.categories.find(
    (category) => category.key === 'supply_rates_area_based'
  )
  assert.ok(areaBased)
  assert.equal(areaBased?.rows.length, 1)
  assert.equal(areaBased?.rows[0].id, 'TAPE_SQFT')

  const perJob = payload.categories.find(
    (category) => category.key === 'supply_rates_per_job'
  )
  assert.ok(perJob)
  assert.equal(perJob?.rows.length, 1)
  assert.equal(perJob?.rows[0].id, 'MASK_JOB')
})

test('payload category grouping returns rates, flags, and room defaults tabs', () => {
  const payload = buildRatesFlagsPayloadFromValues(
    buildSampleConstantsValues(),
    'sheet-1'
  )
  const rates = payload.categories.filter((category) => category.tab === 'rates')
  const flags = payload.categories.filter((category) => category.tab === 'flags')
  const roomDefaults = payload.categories.filter(
    (category) => category.tab === 'room_defaults'
  )
  assert.equal(rates.length, 13)
  assert.equal(flags.length, 4)
  assert.equal(roomDefaults.length, 3)
  assert.ok(
    payload.categories.some((category) => category.key === 'condition_modifiers')
  )
  const condition = findCategoryOrThrow(payload, 'condition_modifiers')
  const first = condition.rows[0] as unknown as Record<string, string>
  assert.equal(first.trim_factor, '1.3')
})

test('mutation plan create/update/archive/reactivate and validation', () => {
  const values = [
    ['CAT_AccessFees'],
    ['AccessFeeID', 'DisplayName', 'FeeType', 'Amount', 'Unit', 'Notes', 'Active?'],
    ['LADDER', 'Ladder', 'Labor', '100', 'once', '', 'Y'],
    [],
  ]
  const tables = parseConstantsTablesDetailed(values)
  const config =
    _test.CATEGORY_CONFIGS.find((entry) => entry.key === 'access_fees_ladders') ??
    null
  assert.ok(config)
  const table = _test.findTableDetailed(tables, ['CAT_AccessFees'])
  assert.ok(table)

  const createRequest = {
    category: 'access_fees_ladders',
    action: 'create',
    values: {
      id: 'SCAFFOLD',
      display_name: 'Scaffold',
      fee_type: 'Labor',
      amount: '200',
      unit: 'once',
      notes: 'new',
    },
  } as const
  const createPlan = _test.buildMutationPlan({
    table: table!,
    config: config!,
    request: createRequest,
  })
  assert.equal(createPlan.ok, true)
  if (createPlan.ok) {
    assert.ok(createPlan.updates.some((update) => update.range === 'Constants!A4'))
    assert.ok(createPlan.updates.some((update) => update.range === 'Constants!G4'))
  }

  const updateRequest = {
    category: 'access_fees_ladders',
    action: 'update',
    original_id: 'LADDER',
    values: {
      id: 'LADDER',
      display_name: '26 ft Ladder',
      fee_type: 'Labor',
      amount: '125',
      unit: 'once',
      notes: '',
      active: 'Y',
    },
  } as const
  const updatePlan = _test.buildMutationPlan({
    table: table!,
    config: config!,
    request: updateRequest,
  })
  assert.equal(updatePlan.ok, true)
  if (updatePlan.ok) {
    assert.ok(updatePlan.updates.some((update) => update.range === 'Constants!A3'))
    assert.ok(updatePlan.updates.some((update) => update.range === 'Constants!G3'))
  }

  const archivePlan = _test.buildMutationPlan({
    table: table!,
    config: config!,
    request: {
      category: 'access_fees_ladders',
      action: 'archive',
      values: { id: 'LADDER' },
    },
  })
  assert.equal(archivePlan.ok, true)
  if (archivePlan.ok) {
    assert.deepEqual(archivePlan.updates, [
      { range: 'Constants!G3', values: [['N']] },
    ])
  }

  const badIdPlan = _test.buildMutationPlan({
    table: table!,
    config: config!,
    request: {
      category: 'access_fees_ladders',
      action: 'create',
      values: {
        id: 'bad-id',
        display_name: 'Broken',
        fee_type: 'Labor',
        amount: '10',
      },
    },
  })
  assert.equal(badIdPlan.ok, false)
  assert.match((badIdPlan as { ok: false; error: string; status: number }).error, /uppercase snake-case/i)
})

test('access fee ID-first classification routes canonical ladder/scaffolding IDs and leaves specialty empty', () => {
  const values = [
    ['CAT_AccessFees'],
    ['AccessFeeID', 'DisplayName', 'FeeType', 'Amount', 'Unit', 'Active?'],
    ['26LADDER_EXT', '26 Extension', 'Labor', '125', 'ea', 'Y'],
    ['SMALL_EXT', 'Small Extension', 'Labor', '95', 'ea', 'Y'],
    ['10FT_STEP', '10 Step', 'Labor', '85', 'ea', 'Y'],
    ['ROLLING_SCAFFOLD_1LVL', 'Rolling Scaffold 1', 'Labor', '200', 'ea', 'Y'],
    ['ROLLING_SCAFFOLD_2LVL', 'Rolling Scaffold 2', 'Labor', '320', 'ea', 'Y'],
    [],
  ]

  const payload = buildRatesFlagsPayloadFromValues(values, 'sheet-1')
  const ladders = findCategoryOrThrow(payload, 'access_fees_ladders')
  const scaffolding = findCategoryOrThrow(payload, 'access_fees_scaffolding')
  const specialty = findCategoryOrThrow(payload, 'access_fees_specialty')

  assert.deepEqual(
    ladders.rows.map((row) => row.id),
    ['26LADDER_EXT', 'SMALL_EXT', '10FT_STEP']
  )
  assert.deepEqual(
    scaffolding.rows.map((row) => row.id),
    ['ROLLING_SCAFFOLD_1LVL', 'ROLLING_SCAFFOLD_2LVL']
  )
  assert.equal(specialty.rows.length, 0)
})

test('supply ID-first classification routes canonical IDs before unit keyword heuristics', () => {
  const values = [
    ['CAT_Supplies'],
    ['SupplyID', 'DisplayName', 'Scope', 'Unit', 'CostPer', 'Active?'],
    ['BRUSH_WALL', 'Brush', 'Walls', '$/job', '5', 'Y'],
    ['TRAY_WALL', 'Tray liner', 'Walls', '$/sqft', '1', 'Y'],
    ['BRUSH_TRIM', 'Brush', 'Trim', '$/job', '5', 'Y'],
    ['MISC_WALL', 'Misc consumables', 'Walls', '$/job', '0.06', 'Y'],
    ['MISC_CEIL', 'Misc consumables', 'Ceilings', '$/job', '0.07', 'Y'],
    ['BRUSH_CEIL', 'Brush', 'Ceilings', '$/sqft', '5', 'Y'],
    ['TRAY_CEIL', 'Tray liner', 'Ceilings', '$/sqft', '1', 'Y'],
    ['TAPE_MASK', 'Masking Tape', 'All', '$/sqft', '3', 'Y'],
    ['DROP_CLOTH', 'Drop Cloth / Plastic', 'All', '$/sqft', '0', 'Y'],
    [],
  ]

  const payload = buildRatesFlagsPayloadFromValues(values, 'sheet-1')
  const perColor = findCategoryOrThrow(payload, 'supply_rates_per_color')
  const areaBased = findCategoryOrThrow(payload, 'supply_rates_area_based')
  const perJob = findCategoryOrThrow(payload, 'supply_rates_per_job')

  assert.deepEqual(
    perColor.rows.map((row) => row.id),
    ['BRUSH_WALL', 'TRAY_WALL', 'BRUSH_TRIM']
  )
  assert.deepEqual(
    areaBased.rows.map((row) => row.id),
    ['MISC_WALL', 'MISC_CEIL']
  )
  assert.deepEqual(
    perJob.rows.map((row) => row.id),
    ['BRUSH_CEIL', 'TRAY_CEIL', 'TAPE_MASK', 'DROP_CLOTH']
  )
})

test('height factors parse min/max and render multiplier/range fields', () => {
  const values = [
    ['CAT_HeightFactors'],
    [
      'HeightBandID',
      'DisplayName',
      'MinHeight_ft',
      'MaxHeight_ft',
      'LaborMultiplier',
      'Notes',
      'Active?',
    ],
    ['HF_0_10', '0-10 ft', '0', '10', '1.00', 'Standard', 'Y'],
    ['HF_10_12', '10-12 ft', '10', '12', '1.15', 'Step Ladder', 'Y'],
    ['HF_12_16', '12-16 ft', '12', '16', '1.30', 'Tall / Staging', 'Y'],
    ['HF_16_PLUS', '16+ ft', '16', '', '1.50', 'Scaffold', 'Y'],
    [],
  ]

  const payload = buildRatesFlagsPayloadFromValues(values, 'sheet-1')
  const heights = findCategoryOrThrow(payload, 'height_factors')
  assert.equal(heights.rows.length, 4)

  const h0 = heights.rows.find((row) => row.id === 'HF_0_10')
  const h16 = heights.rows.find((row) => row.id === 'HF_16_PLUS')
  assert.ok(h0)
  assert.ok(h16)

  assert.equal((h0 as unknown as Record<string, string>).primary_value, '1.00')
  assert.equal((h0 as unknown as Record<string, string>).secondary_value, '0 - 10')
  assert.equal((h16 as unknown as Record<string, string>).primary_value, '1.50')
  assert.equal((h16 as unknown as Record<string, string>).secondary_value, '16')
})
