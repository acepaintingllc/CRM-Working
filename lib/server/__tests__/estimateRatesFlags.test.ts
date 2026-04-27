import assert from 'node:assert/strict'
import test from 'node:test'
import {
  _test,
  buildRatesFlagsPayloadFromValues,
  parseConstantsTablesDetailed,
} from '../rates-flags/index.ts'
import { CATEGORY_CONFIGS } from '../rates-flags/categories.ts'
import {
  buildClientRatesFlagsMutationRequests,
  getRatesFlagsParityCategory,
  getRatesFlagsParityCategoryKeys,
} from '../../quotes/__tests__/ratesFlagsParityHelpers.ts'
import {
  ratesFlagsEditableCategoryKeys as sharedRatesFlagsEditableCategoryKeys,
  type RatesFlagsEditableCategoryKey,
  type RatesFlagsFieldDef,
} from '../../../types/estimator/ratesFlags.ts'

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
    ['CAT_ConditionModifiers'],
    [
      'ConditionID',
      'DisplayName',
      'Scope',
      'ModifierType',
      'ActiveFactor',
      'MinorFactor',
      'ModerateFactor',
      'MajorFactor',
      'Active?',
    ],
    ['NEEDS_WASH', 'Surface needs washing', 'wall,ceiling,trim', 'severity', '', '1.05', '1.1', '1.2', 'Y'],
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

function isYnSelectField(field: RatesFlagsFieldDef) {
  return field.options?.length === 2 && field.options[0] === 'Y' && field.options[1] === 'N'
}

function findParityFieldOrThrow(
  description: string,
  predicate: (field: RatesFlagsFieldDef) => boolean
) {
  for (const categoryKey of getRatesFlagsParityCategoryKeys()) {
    const category = getRatesFlagsParityCategory(categoryKey)
    const field = category.fields.find(predicate)
    if (field) return { categoryKey, field }
  }
  throw new Error(`Missing parity field fixture for ${description}`)
}

function getRowString(row: object, key: string) {
  const value: unknown = Reflect.get(row, key)
  return typeof value === 'string' ? value : ''
}

function withCreateValueMutation(
  categoryKey: RatesFlagsEditableCategoryKey,
  mutate: (values: Record<string, unknown>) => Record<string, unknown>
) {
  const request = buildClientRatesFlagsMutationRequests(categoryKey).create
  return {
    ...request,
    values: mutate(Object.fromEntries(Object.entries(request.values))),
  }
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
  const first = condition.rows[0]
  assert.ok(first)
  assert.equal(getRowString(first, 'scope'), 'wall,ceiling,trim')
  assert.equal(getRowString(first, 'moderate_factor'), '1.1')
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
      access_group: 'ladders',
      id: 'SCAFFOLD',
      display_name: 'Scaffold',
      fee_type: 'Labor',
      amount: '200',
      unit: 'once',
      notes: 'new',
      active: 'Y',
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
      access_group: 'ladders',
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
      rowId: 'LADDER',
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
        access_group: 'ladders',
        id: 'bad-id',
        display_name: 'Broken',
        fee_type: 'Labor',
        amount: '10',
        unit: '',
        notes: '',
        active: 'Y',
      },
    },
  })
  assert.equal(badIdPlan.ok, false)
  assert.match((badIdPlan as { ok: false; error: string; status: number }).error, /uppercase snake-case/i)
})

test('parseRatesFlagsMutationRequest rejects invalid category-field-action combinations at the route boundary', () => {
  const validProductionRequest = _test.parseRatesFlagsMutationRequest({
    category: 'production_rates_walls',
    action: 'update',
    original_id: 'wall_std',
    values: {
      production_scope: 'walls',
      id: 'wall_std',
      scope_id: 'WALLS',
      display_name: 'Walls Standard',
      surface_type: 'Drywall',
      condition: 'Std',
      prep_sqft_per_hr: '95',
      sqft_per_hr: '120',
      primer_sqft_per_hr: '110',
      notes: '',
      active: 'Y',
    },
  })
  assert.equal(validProductionRequest.ok, true)
  if (validProductionRequest.ok) {
    assert.deepEqual(validProductionRequest.value, {
      category: 'production_rates_walls',
      action: 'update',
      original_id: 'WALL_STD',
      values: {
        production_scope: 'walls',
        id: 'WALL_STD',
        scope_id: 'WALLS',
        display_name: 'Walls Standard',
        surface_type: 'Drywall',
        condition: 'Std',
        prep_sqft_per_hr: '95',
        sqft_per_hr: '120',
        primer_sqft_per_hr: '110',
        notes: '',
        active: 'Y',
      },
    })
  }

  const validRoomTemplateRequest = _test.parseRatesFlagsMutationRequest({
    category: 'room_templates',
    action: 'create',
    values: {
      id: 'BEDROOM',
      display_name: 'Bedroom',
      room_type_id: 'BEDROOM',
      default_wall_rate_id: 'WALL_STD',
      default_ceil_rate_id: 'CEIL_STD',
      default_complexity_id: 'NORMAL',
      default_wall_mode: 'RECT',
      include_walls: 'Y',
      include_ceilings: 'N',
      include_trim: 'N',
      include_doors: 'N',
      include_drywall: 'N',
      notes: '',
    },
  })
  assert.equal(validRoomTemplateRequest.ok, true)
  if (
    validRoomTemplateRequest.ok &&
    (validRoomTemplateRequest.value.action === 'create' ||
      validRoomTemplateRequest.value.action === 'update')
  ) {
    assert.equal(validRoomTemplateRequest.value.values.active, 'Y')
  }

  const unknownCategory = _test.parseRatesFlagsMutationRequest({
    category: 'unit_rates',
    action: 'create',
    values: {},
  })
  assert.equal(unknownCategory.ok, false)
  assert.equal(unknownCategory.error, 'Unknown category.')

  const wrongField = _test.parseRatesFlagsMutationRequest({
    category: 'access_fees_ladders',
    action: 'create',
    values: {
      access_group: 'ladders',
      id: 'LADDER',
      display_name: 'Ladder',
      fee_type: 'Labor',
      amount: '100',
      unit: 'once',
      notes: '',
      active: 'Y',
      sqft_per_hr: '12',
    },
  })
  assert.equal(wrongField.ok, false)
  assert.match(wrongField.error, /does not support field 'sqft_per_hr'/i)

  const mismatchedLiteral = _test.parseRatesFlagsMutationRequest({
    category: 'access_fees_ladders',
    action: 'create',
    values: {
      access_group: 'scaffolding',
      id: 'LADDER',
      display_name: 'Ladder',
      fee_type: 'Labor',
      amount: '100',
      unit: 'once',
      notes: '',
      active: 'Y',
    },
  })
  assert.equal(mismatchedLiteral.ok, false)
  assert.match(mismatchedLiteral.error, /must be 'ladders'/i)

  const mismatchedAreaUnit = _test.parseRatesFlagsMutationRequest({
    category: 'supply_rates_area_based',
    action: 'create',
    values: {
      supply_group: 'area_based',
      id: 'MASKING',
      display_name: 'Masking',
      scope: 'Walls',
      unit: 'per job',
      cost_per: '1.2',
      notes: '',
      active: 'Y',
    },
  })
  assert.equal(mismatchedAreaUnit.ok, false)
  assert.match(mismatchedAreaUnit.error, /must be '\$\/sqft'/i)

  const invalidNumber = _test.parseRatesFlagsMutationRequest({
    category: 'access_fees_ladders',
    action: 'create',
    values: {
      access_group: 'ladders',
      id: 'LADDER',
      display_name: 'Ladder',
      fee_type: 'Labor',
      amount: 'oops',
      unit: 'once',
      notes: '',
      active: 'Y',
    },
  })
  assert.equal(invalidNumber.ok, false)
  assert.match(invalidNumber.error, /must be a valid number/i)

  const missingArchiveId = _test.parseRatesFlagsMutationRequest({
    category: 'access_fees_ladders',
    action: 'archive',
  })
  assert.equal(missingArchiveId.ok, false)
  assert.match(missingArchiveId.error, /rowId/i)

  const missingUpdateOriginalId = _test.parseRatesFlagsMutationRequest({
    category: 'production_rates_walls',
    action: 'update',
    values: {
      production_scope: 'walls',
      id: 'WALL_STD',
      scope_id: 'WALLS',
      display_name: 'Walls',
      surface_type: '',
      condition: '',
      prep_sqft_per_hr: '',
      sqft_per_hr: '120',
      primer_sqft_per_hr: '',
      notes: '',
      active: 'Y',
    },
  })
  assert.equal(missingUpdateOriginalId.ok, false)
  assert.match(missingUpdateOriginalId.error, /original id/i)

  const validRequest = _test.parseRatesFlagsMutationRequest({
    category: 'access_fees_ladders',
    action: 'create',
    values: {
      access_group: 'ladders',
      id: 'LADDER',
      display_name: 'Ladder',
      fee_type: 'Labor',
      amount: '100',
      unit: 'once',
      notes: '',
      active: 'N',
    },
  })
  assert.equal(validRequest.ok, true)
  if (validRequest.ok) {
    assert.deepEqual(validRequest.value, {
      category: 'access_fees_ladders',
      action: 'create',
      values: {
        access_group: 'ladders',
        id: 'LADDER',
        display_name: 'Ladder',
        fee_type: 'Labor',
        amount: '100',
        unit: 'once',
        notes: '',
        active: 'N',
      },
    })
  }
})

test('rates flags client draft adapter requests parse successfully for every editable category', () => {
  const categoryConfigKeys = CATEGORY_CONFIGS.map((config) => config.key).sort()
  const adapterKeys = [...getRatesFlagsParityCategoryKeys()].sort()
  assert.deepEqual(adapterKeys, categoryConfigKeys)

  for (const categoryKey of getRatesFlagsParityCategoryKeys()) {
    const requests = buildClientRatesFlagsMutationRequests(categoryKey)
    const cases = [
      requests.create,
      requests.update,
      requests.archive,
      requests.reactivate,
    ] as const

    for (const request of cases) {
      const parsed = _test.parseRatesFlagsMutationRequest(request)
      assert.equal(parsed.ok, true, `${categoryKey} ${request.action}`)
      if (parsed.ok) {
        assert.deepEqual(parsed.value, request, `${categoryKey} ${request.action}`)
      }
    }
  }
})

test('rates flags parser, category config, and client mutation fields stay in parity', () => {
  const sharedKeys = [...sharedRatesFlagsEditableCategoryKeys].sort()
  const configKeys = CATEGORY_CONFIGS.map((config) => config.key).sort()
  const adapterKeys = [...getRatesFlagsParityCategoryKeys()].sort()
  const parserKeys = [..._test.getRatesFlagsMutationParserCategoryKeys()].sort()

  assert.deepEqual(configKeys, sharedKeys)
  assert.deepEqual(adapterKeys, sharedKeys)
  assert.deepEqual(parserKeys, sharedKeys)

  for (const categoryKey of sharedRatesFlagsEditableCategoryKeys) {
    const category = getRatesFlagsParityCategory(categoryKey)
    const requests = buildClientRatesFlagsMutationRequests(categoryKey)
    const categoryFieldKeys = category.fields.map((field) => field.key).sort()
    const requiredFieldKeys = category.fields
      .filter((field) => field.required)
      .map((field) => field.key)
      .sort()
    const draftFieldKeys = Object.keys(requests.draft).sort()
    const mutationFieldKeys = Object.keys(requests.create.values).sort()
    const parserFieldKeys = _test.getRatesFlagsMutationParserFieldKeys(categoryKey).sort()
    const parserRequiredFieldKeys = _test
      .getRatesFlagsMutationParserRequiredFieldKeys(categoryKey)
      .sort()

    assert.deepEqual(draftFieldKeys, categoryFieldKeys, `${categoryKey} draft fields`)
    assert.deepEqual(parserFieldKeys, mutationFieldKeys, `${categoryKey} mutation parser fields`)
    assert.deepEqual(parserRequiredFieldKeys, requiredFieldKeys, `${categoryKey} required fields`)
  }
})

test('rates flags parser rejects required, select, Y/N, numeric, and unsupported extra fields from client-shaped requests', () => {
  const required = findParityFieldOrThrow(
    'required field',
    (field) => field.required === true
  )
  const missingRequired = withCreateValueMutation(required.categoryKey, (values) => {
    const { [required.field.key]: _removed, ...rest } = values
    void _removed
    return rest
  })
  const missingRequiredParsed = _test.parseRatesFlagsMutationRequest(missingRequired)
  assert.equal(missingRequiredParsed.ok, false)
  assert.match(missingRequiredParsed.error, /is required/i)

  const select = findParityFieldOrThrow(
    'select field',
    (field) => field.type === 'select' && !field.readOnly && !isYnSelectField(field)
  )
  const invalidSelectParsed = _test.parseRatesFlagsMutationRequest(
    withCreateValueMutation(select.categoryKey, (values) => ({
      ...values,
      [select.field.key]: '__INVALID_SELECT__',
    }))
  )
  assert.equal(invalidSelectParsed.ok, false)
  assert.match(invalidSelectParsed.error, /must be one of/i)

  const yn = findParityFieldOrThrow(
    'Y/N field',
    (field) => field.type === 'select' && !field.readOnly && isYnSelectField(field)
  )
  const invalidYnParsed = _test.parseRatesFlagsMutationRequest(
    withCreateValueMutation(yn.categoryKey, (values) => ({
      ...values,
      [yn.field.key]: 'maybe',
    }))
  )
  assert.equal(invalidYnParsed.ok, false)
  assert.match(invalidYnParsed.error, /must be Y or N/i)

  const numeric = findParityFieldOrThrow(
    'numeric field',
    (field) => field.type === 'number'
  )
  const invalidNumberParsed = _test.parseRatesFlagsMutationRequest(
    withCreateValueMutation(numeric.categoryKey, (values) => ({
      ...values,
      [numeric.field.key]: 'not-a-number',
    }))
  )
  assert.equal(invalidNumberParsed.ok, false)
  assert.match(invalidNumberParsed.error, /must be a valid number/i)

  for (const categoryKey of getRatesFlagsParityCategoryKeys()) {
    const requestWithExtraValue = withCreateValueMutation(categoryKey, (values) => ({
      ...values,
      unsupported_extra_field: 'nope',
    }))
    const extraValueParsed = _test.parseRatesFlagsMutationRequest(requestWithExtraValue)
    assert.equal(extraValueParsed.ok, false, `${categoryKey} extra values field`)
    assert.match(extraValueParsed.error, /does not support field 'unsupported_extra_field'/i)

    const createRequest = buildClientRatesFlagsMutationRequests(categoryKey).create
    const extraTopLevelParsed = _test.parseRatesFlagsMutationRequest({
      ...createRequest,
      unsupported_extra_field: 'nope',
    })
    assert.equal(extraTopLevelParsed.ok, false, `${categoryKey} extra top-level field`)
    assert.match(extraTopLevelParsed.error, /Body does not support field 'unsupported_extra_field'/i)
  }
})

test('rates flags parser rejects category-specific mutation validation failures', () => {
  const negativeAmount = _test.parseRatesFlagsMutationRequest(
    withCreateValueMutation('access_fees_ladders', (values) => ({
      ...values,
      amount: '-1',
    }))
  )
  assert.equal(negativeAmount.ok, false)
  assert.match(negativeAmount.error, /amount must not be negative/i)

  const invertedHeightRange = _test.parseRatesFlagsMutationRequest(
    withCreateValueMutation('height_factors', (values) => ({
      ...values,
      min_height_ft: '12',
      max_height_ft: '10',
    }))
  )
  assert.equal(invertedHeightRange.ok, false)
  assert.match(
    invertedHeightRange.error,
    /min height \(ft\) must be less than or equal to max height \(ft\)/i
  )

  const blankDisplayName = _test.parseRatesFlagsMutationRequest(
    withCreateValueMutation('production_rates_walls', (values) => ({
      ...values,
      display_name: '   ',
    }))
  )
  assert.equal(blankDisplayName.ok, false)
  assert.match(blankDisplayName.error, /display name is required/i)
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

  assert.equal(getRowString(h0, 'primary_value'), '1.00')
  assert.equal(getRowString(h0, 'secondary_value'), '0 - 10')
  assert.equal(getRowString(h16, 'primary_value'), '1.50')
  assert.equal(getRowString(h16, 'secondary_value'), '16')
})

test('buildOverlayFromRows maps trim items and room types from DB rows', () => {
  const overlay = _test.buildOverlayFromRows({
    templateVersion: 3,
    rows: [
      {
        id: 'row-trim',
        org_id: 'org-1',
        template_id: 'tmpl-1',
        category_key: 'unit_rates_trim',
        row_id: 'BASE_STD',
        display_name: 'Baseboard Standard',
        active: 'Y',
        sort_order: 0,
        values_json: {
          id: 'BASE_STD',
          display_name: 'Baseboard Standard',
          unit_rate_type: 'BASEBOARD',
          unit: 'LF',
          helper_allowed: 'Y',
          default_production_rate_id: 'TRIM_BASE_STD',
        },
      },
      {
        id: 'row-room',
        org_id: 'org-1',
        template_id: 'tmpl-1',
        category_key: 'room_types',
        row_id: 'BEDROOM',
        display_name: 'Bedroom',
        active: 'Y',
        sort_order: 1,
        values_json: {
          id: 'BEDROOM',
          display_name: 'Bedroom',
          default_wall_rate_id: 'WALL_STD',
          default_ceil_rate_id: 'CEIL_STD',
          default_complexity_id: 'NORMAL',
          default_wall_mode: 'RECT',
          top_cut_in_factor: '1.1',
          bot_cut_in_factor: '1.0',
          typical_height_ft: '9',
        },
      },
      {
        id: 'row-prod',
        org_id: 'org-1',
        template_id: 'tmpl-1',
        category_key: 'production_rates_trim',
        row_id: 'TRIM_BASE_STD',
        display_name: 'Trim Baseboard',
        active: 'Y',
        sort_order: 2,
        values_json: {
          id: 'TRIM_BASE_STD',
          production_scope: 'trim',
          scope_id: 'TRIM',
          display_name: 'Trim Baseboard',
          surface_type: 'BASEBOARD',
          sqft_per_hr: '90',
        },
      },
    ],
  })

  assert.equal(overlay.template_version, 3)
  assert.equal(overlay.trim_items.length, 1)
  assert.equal(overlay.trim_items[0].id, 'BASE_STD')
  assert.equal(overlay.trim_items[0].helper_allowed, true)
  assert.equal(overlay.trim_items[0].default_production_rate_id, 'TRIM_BASE_STD')
  assert.equal(overlay.room_types.length, 1)
  assert.equal(overlay.room_types[0].id, 'BEDROOM')
  assert.equal(overlay.room_types[0].default_wall_mode, 'RECT')
  assert.equal(overlay.production_rates.length, 1)
  assert.equal(overlay.production_rates[0].id, 'TRIM_BASE_STD')
})

test('buildOverlayFromRows expands condition modifier scope checkboxes', () => {
  const overlay = _test.buildOverlayFromRows({
    templateVersion: 3,
    rows: [
      {
        id: 'row-condition',
        org_id: 'org-1',
        template_id: 'tmpl-1',
        category_key: 'condition_modifiers',
        row_id: 'NEEDS_WASH',
        display_name: 'Surface needs washing',
        active: 'Y',
        sort_order: 0,
        values_json: {
          id: 'NEEDS_WASH',
          display_name: 'Surface needs washing',
          scope: 'wall,ceiling,trim',
          modifier_type: 'severity',
          minor_factor: '1.05',
          moderate_factor: '1.1',
          major_factor: '1.2',
        },
      },
    ],
  })

  assert.deepEqual(
    overlay.condition_modifiers.map((row) => row.scope),
    ['wall', 'ceiling', 'trim']
  )
  assert.equal(overlay.condition_modifiers[1].id, 'NEEDS_WASH')
  assert.equal(overlay.condition_modifiers[1].levels.moderate, 1.1)
})

test('ensureTemplateState creates an empty template on first access', async () => {
  const calls: string[] = []
  const fakeSupabase = {
    from(table: string) {
      calls.push(table)
      if (table === 'estimator_template_constants') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          maybeSingle: async () => ({ data: null, error: null }),
          insert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: {
                      id: 'tmpl-1',
                      org_id: 'org-1',
                      version: 1,
                      seeded_at: '2026-01-01T00:00:00Z',
                    },
                    error: null,
                  }),
                }
              },
            }
          },
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }

  _test.setSupabaseAdminProvider(async () => fakeSupabase)
  try {
    const state = await _test.ensureTemplateState('org-1')
    assert.equal(state.template?.id, 'tmpl-1')
    assert.equal(state.rows.length, 0)
    assert.deepEqual(calls, ['estimator_template_constants', 'estimator_template_constants'])
  } finally {
    _test.setSupabaseAdminProvider(null)
  }
})
