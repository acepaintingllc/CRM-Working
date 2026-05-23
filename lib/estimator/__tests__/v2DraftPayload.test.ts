import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEstimateV2SavePayload,
  deriveEstimateV2Scope,
  deriveEstimateV2Segment,
  sortByPosition,
} from '../v2DraftPayload.ts'
import type { EstimateV2ConditionSelections } from '@/types/estimator/v2Conditions'
import type { EstimateV2RoomDraft } from '@/types/estimator/v2Rooms'
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2CeilingScopeDraft,
  EstimateV2OtherItemDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
} from '@/types/estimator/v2Scopes'
import type { EstimateV2JobSettingsDraft } from '@/types/estimator/v2Settings'

test('sortByPosition returns rows ordered by ascending position', () => {
  const rows = sortByPosition([
    { id: 'b', position: 2 },
    { id: 'a', position: 0 },
    { id: 'c', position: 1 },
  ])
  assert.deepEqual(rows.map((row) => row.id), ['a', 'c', 'b'])
})

test('deriveEstimateV2Segment applies opening deductions and override area', () => {
  const derived = deriveEstimateV2Segment({
    id: 'seg-1',
    wallScopeId: 'scope-1',
    roomId: 'R001',
    position: 0,
    segmentName: 'Main wall',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '144',
    heightIn: '96',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '1',
    standardWindowCount: '1',
    overrideAreaSqFt: '50',
    notes: '',
  })

  assert.equal(derived.rawArea, 96)
  assert.equal(derived.deductionArea, 36)
  assert.equal(derived.deductionAdjustedArea, 60)
  assert.equal(derived.effectiveArea, 50)
})

test('deriveEstimateV2Scope sums SEG segment areas and honors override', () => {
  const derived = deriveEstimateV2Scope(
    {
      id: 'scope-1',
      roomId: 'R001',
      position: 0,
      mode: 'SEG',
      include: 'Y',
      scopeName: 'Walls',
      colorId: 'A',
      paintProductId: '',
      primerProductId: '',
      primeMode: 'NONE',
      heightIn: '',
      perimeterIn: '',
      standardDoorCount: '',
      standardWindowCount: '',
      heightFactor: '1',
      complexityFactor: '1',
      wallFlagFactor: '1',
      cutInTopFactor: '1',
      cutInBottomFactor: '1',
      paintCoats: '2',
      primerCoats: '1',
      spotPrimePercent: '',
      overrideAreaSqFt: '90',
      overridePaintHours: '',
      overridePrimerHours: '',
      overridePaintGallons: '',
      overridePrimerGallons: '',
      overrideSupplyCost: '',
      overrideTotal: '',
      notes: '',
    },
    [
      {
        id: 'seg-1',
        wallScopeId: 'scope-1',
        roomId: 'R001',
        position: 1,
        segmentName: 'B',
        include: 'Y',
        shapeType: 'MANUAL',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '30',
        standardDoorCount: '',
        standardWindowCount: '',
        overrideAreaSqFt: '',
        notes: '',
      },
      {
        id: 'seg-2',
        wallScopeId: 'scope-1',
        roomId: 'R001',
        position: 0,
        segmentName: 'A',
        include: 'Y',
        shapeType: 'MANUAL',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '80',
        standardDoorCount: '',
        standardWindowCount: '',
        overrideAreaSqFt: '',
        notes: '',
      },
    ]
  )

  assert.equal(derived.rawArea, 110)
  assert.equal(derived.effectiveArea, 90)
})

test('buildEstimateV2SavePayload maps rooms, scopes, segments, ceilings, and trim rows', () => {
  const payload = buildEstimateV2SavePayload(
    {
      laborDayEnabled: true,
      dayhours: 8,
      roundingIncrementHours: 4,
      laborRate: 65,
      jobMinEnabled: false,
      jobMinAmount: 0,
      crewSize: 2,
      wallPaintProductId: '',
      wallPrimerProductId: '',
      ceilingPaintProductId: '',
      ceilingPrimerProductId: '',
      trimPaintProductId: '',
      trimPrimerProductId: '',
    },
    [
      {
        id: 'room-1',
        roomId: 'R001',
        roomName: 'Living',
        roomTypeId: '',
        lengthIn: '144',
        widthIn: '120',
        heightIn: '96',
        wallComplexityId: '',
        conditionSelections: { ROOM_FURNISHED: 'active' },
        notes: '',
        position: 0,
      },
    ],
    [
      {
        id: 'scope-1',
        roomId: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scopeName: 'Walls',
        colorId: 'A',
        paintProductId: 'PAINT-1',
        primerProductId: 'PRIMER-1',
        primeMode: 'SPOT',
        heightIn: '96',
        perimeterIn: '528',
        standardDoorCount: '1',
        standardWindowCount: '2',
        heightFactor: '1',
        complexityFactor: '1',
        wallFlagFactor: '1',
        cutInTopFactor: '1',
        cutInBottomFactor: '1',
        conditionSelections: { WALL_CUT_IN: 'moderate' },
        paintCoats: '2',
        primerCoats: '1',
        spotPrimePercent: '35',
        overrideAreaSqFt: '',
        overridePaintHours: '',
        overridePrimerHours: '',
        overridePaintGallons: '',
        overridePrimerGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        notes: '',
      },
    ],
    [],
    [
      { id: 'flag-1', roomId: 'R001', flagId: 'FLAG-1', position: 0 },
      { id: 'flag-stale-room', roomId: 'R404', flagId: 'FLAG-2', position: 0 },
      { id: 'flag-duplicate', roomId: 'R001', flagId: 'FLAG-1', position: 1 },
      { id: 'flag-2', roomId: 'R001', flagId: 'FLAG-2', position: 5 },
    ],
    [
      {
        id: 'ceil-1',
        roomId: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scopeName: 'Ceiling',
        colorId: 'B',
        paintProductId: 'PAINT-2',
        primerProductId: 'PRIMER-2',
        primeMode: 'NONE',
        spotPrimePercent: '',
        ceilingTypeId: 'flat',
        ceilingGeometryMode: 'TRAY',
        vaultedAreaFactor: '',
        vaultedRidgeLengthIn: '180',
        vaultedSlopeLengthIn: '120',
        vaultedPlaneCount: '2',
        trayPerimeterIn: '480',
        trayStepHeightIn: '12',
        trayBandWidthIn: '18',
        cofferSectionLengthIn: '',
        cofferSectionWidthIn: '',
        cofferSectionCount: '',
        cofferFaceHeightIn: '',
        cofferBottomWidthIn: '',
        lengthIn: '',
        widthIn: '',
        areaSf: '120',
        heightFactor: '1',
        complexityFactor: '1',
        ceilingFlagFactor: '1',
        conditionSelections: { CEIL_TEXTURE: 'major' },
        paintCoats: '1',
        primerCoats: '1',
        overrideAreaSqFt: '',
        overridePaintHours: '',
        overridePrimerHours: '',
        overridePaintGallons: '',
        overridePrimerGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        notes: '',
      },
    ],
    [],
    [
      {
        id: 'trim-1',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        scopeName: 'Baseboard',
        trimTypeId: 'BASE_STD',
        trimFamily: 'BASEBOARD',
        unitType: 'LF',
        measurementMode: 'MANUAL',
        helperSource: '',
        measurementValue: '42',
        helperValue: '',
        baseboardOpeningCount: '1.5',
        colorId: 'A',
        paintProductId: 'PAINT-3',
        primerProductId: 'PRIMER-3',
        paintEnabled: 'Y',
        primeMode: 'NONE',
        spotPrimePercent: '',
        productionRateId: 'RATE-1',
        prepFactor: '1',
        heightFactor: '1',
        profileFactor: '1',
        roomFlagFactor: '1',
        maskingFactor: '1',
        stairFactor: '1',
        difficultFinishFactor: '1',
        caulkFillFactor: '1',
        conditionSelections: { TRIM_CAULKING: 'minor' },
        paintCoats: '1',
        primerCoats: '1',
        overrideMeasurement: '10',
        overrideHours: '2',
        overrideGallons: '3',
        overrideSupplyCost: '4',
        overrideTotal: '5',
        overrideDescription: 'hidden override',
        notes: '',
      },
    ],
    [
      {
        id: 'wall-roller-missing-target',
        scope: 'Wall',
        wallColorId: '',
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '2',
        notes: 'Missing target',
        position: 0,
      },
      {
        id: 'wall-roller-1',
        scope: 'Wall',
        wallColorId: 'COLOR1',
        selectedOptionId: 'WALL_12',
        rollerSizeIn: '12',
        coversQty: '3',
        notes: 'Wall cover',
        position: 1,
      },
      {
        id: 'ceiling-roller-1',
        scope: 'Ceiling',
        wallColorId: '',
        selectedOptionId: 'CEIL_14',
        rollerSizeIn: '14',
        coversQty: '1',
        notes: 'Ceiling cover',
        position: 2,
      },
      {
        id: 'trim-applicator-1',
        scope: 'Trim',
        wallColorId: '',
        selectedOptionId: 'TRIM_4',
        rollerSizeIn: '4',
        coversQty: '1',
        notes: 'Trim applicator',
        position: 3,
      },
    ],
    [],
    [
      {
        id: 'drywall-1',
        roomId: 'R001',
        position: 0,
        surface: 'wall',
        repairType: 'flat_wall_crack',
        unit: 'LF',
        quantity: '6.25',
        overrideTotal: '125',
      },
    ]
  )

  assert.equal(payload.jobsettings.crew_size, 2)

  assert.equal(payload.rooms.length, 1)
  assert.equal(payload.room_wall_scopes.length, 1)
  assert.equal(payload.room_flags.length, 2)
  assert.equal(payload.room_ceiling_scopes.length, 1)
  assert.equal(payload.room_trim_scopes.length, 1)
  assert.equal(payload.rooms[0].room_id, 'R001')
  assert.deepEqual(payload.rooms[0].condition_selections, { ROOM_FURNISHED: 'active' })
  assert.equal(payload.room_wall_scopes[0].room_id, 'R001')
  assert.deepEqual(payload.room_flags, [
    { id: 'flag-1', room_id: 'R001', flag_id: 'FLAG-1', position: 0, active: 'Y' },
    { id: 'flag-2', room_id: 'R001', flag_id: 'FLAG-2', position: 1, active: 'Y' },
  ])
  assert.deepEqual(payload.room_wall_scopes[0].condition_selections, { WALL_CUT_IN: 'moderate' })
  assert.equal(payload.room_ceiling_scopes[0].color_id, 'COLOR0')
  assert.equal(payload.room_ceiling_scopes[0].ceiling_geometry_mode, 'TRAY')
  assert.equal(payload.room_ceiling_scopes[0].tray_perimeter_in, 480)
  assert.equal(payload.room_ceiling_scopes[0].tray_step_height_in, 12)
  assert.equal(payload.room_ceiling_scopes[0].tray_band_width_in, 18)
  assert.equal(payload.room_ceiling_scopes[0].vaulted_ridge_length_in, 180)
  assert.equal(payload.room_ceiling_scopes[0].vaulted_slope_length_in, 120)
  assert.equal(payload.room_ceiling_scopes[0].vaulted_plane_count, 2)
  assert.equal(payload.room_ceiling_scopes[0].helper_extra_area_sf, null)
  assert.deepEqual(payload.room_ceiling_scopes[0].condition_selections, { CEIL_TEXTURE: 'major' })
  assert.equal(payload.room_trim_scopes[0].trim_type_id, 'BASE_STD')
  assert.equal(payload.room_trim_scopes[0].paint_product_id, 'PAINT-3')
  assert.equal(payload.room_trim_scopes[0].primer_product_id, 'PRIMER-3')
  assert.deepEqual(payload.room_trim_scopes[0].condition_selections, { TRIM_CAULKING: 'minor' })
  assert.equal(payload.room_trim_scopes[0].baseboard_opening_count, 1.5)
  assert.equal(payload.room_trim_scopes[0].override_measurement, 10)
  assert.equal(payload.room_trim_scopes[0].override_hours, 2)
  assert.equal(payload.room_trim_scopes[0].override_gallons, 3)
  assert.equal(payload.room_trim_scopes[0].override_supply_cost, 4)
  assert.equal(payload.room_trim_scopes[0].override_total, 5)
  assert.equal(payload.room_trim_scopes[0].override_description, 'hidden override')
  assert.deepEqual(payload.drywall_repairs, [
    {
      id: 'drywall-1',
      room_id: 'R001',
      position: 0,
      include: 'Y',
      active: 'Y',
      surface: 'wall',
      repair_type: 'flat_wall_crack',
      unit: 'LF',
      quantity: 6.25,
      override_total: 125,
    },
  ])
  assert.deepEqual(
    payload.rollers.map((roller) => ({
      id: roller.id,
      scope: roller.scope,
      wall_color_id: roller.wall_color_id,
      selected_option_id: roller.selected_option_id,
    })),
    [
      {
        id: 'wall-roller-1',
        scope: 'Wall',
        wall_color_id: 'COLOR1',
        selected_option_id: 'WALL_12',
      },
      {
        id: 'ceiling-roller-1',
        scope: 'Ceiling',
        wall_color_id: null,
        selected_option_id: 'CEIL_14',
      },
      {
        id: 'trim-applicator-1',
        scope: 'Trim',
        wall_color_id: null,
        selected_option_id: 'TRIM_4',
      },
    ]
  )
})

function minimalJobSettings(overrides: Partial<EstimateV2JobSettingsDraft> = {}): EstimateV2JobSettingsDraft {
  return {
    laborDayEnabled: false,
    dayhours: 8,
    roundingIncrementHours: 4,
    laborRate: 60,
    jobMinEnabled: false,
    jobMinAmount: 0,
    crewSize: 1,
    wallPaintProductId: '',
    wallPrimerProductId: '',
    ceilingPaintProductId: '',
    ceilingPrimerProductId: '',
    trimPaintProductId: '',
    trimPrimerProductId: '',
    ...overrides,
  }
}

function minimalRoom(): EstimateV2RoomDraft {
  return {
    id: 'room-1',
    roomId: 'R001',
    roomName: 'Room',
    roomTypeId: '',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    wallComplexityId: '',
    notes: '',
    position: 0,
  }
}

function minimalWallScope(): EstimateV2WallScopeDraft {
  return {
    id: 'wall-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: 'A',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '',
    perimeterIn: '',
    standardDoorCount: '',
    standardWindowCount: '',
    heightFactor: '1',
    complexityFactor: '1',
    wallFlagFactor: '1',
    cutInTopFactor: '1',
    cutInBottomFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    spotPrimePercent: '',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}

function minimalCeilingScope(): EstimateV2CeilingScopeDraft {
  return {
    id: 'ceil-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: '',
    lengthIn: '',
    widthIn: '',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
  }
}

function minimalTrimScope(): EstimateV2TrimScopeDraft {
  return {
    id: 'trim-1',
    roomId: 'R001',
    position: 0,
    include: 'Y',
    scopeName: '',
    trimTypeId: '',
    trimFamily: '',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '',
    helperValue: '',
    baseboardOpeningCount: '',
    colorId: '',
    paintProductId: '',
    primerProductId: '',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: '',
    prepFactor: '1',
    heightFactor: '1',
    profileFactor: '1',
    roomFlagFactor: '1',
    maskingFactor: '1',
    stairFactor: '1',
    difficultFinishFactor: '1',
    caulkFillFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
  }
}

test('condition_factor is null on all scope types when no resolvedConditionFactors set', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings(),
    [minimalRoom()],
    [minimalWallScope()],
    [],
    [],
    [minimalCeilingScope()],
    [],
    [minimalTrimScope()]
  )
  assert.equal(payload.room_wall_scopes[0].condition_factor, null)
  assert.equal(payload.room_ceiling_scopes[0].condition_factor, null)
  assert.equal(payload.room_trim_scopes[0].condition_factor, null)
})

test('condition_factor writes wall * room product onto wall scopes', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({ resolvedConditionFactors: { room: 1.15, wall: 1.2, ceiling: 1, trim: 1 } }),
    [minimalRoom()],
    [minimalWallScope()],
    [],
    [],
    [],
    [],
    []
  )
  assert.ok(Math.abs(Number(payload.room_wall_scopes[0].condition_factor) - 1.15 * 1.2) < 0.0001)
})

test('condition_factor writes ceiling * room product onto ceiling scopes', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({ resolvedConditionFactors: { room: 1.1, wall: 1, ceiling: 1.3, trim: 1 } }),
    [minimalRoom()],
    [],
    [],
    [],
    [minimalCeilingScope()],
    [],
    []
  )
  assert.ok(Math.abs(Number(payload.room_ceiling_scopes[0].condition_factor) - 1.1 * 1.3) < 0.0001)
})

test('condition_factor writes trim * room product onto trim scopes', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({ resolvedConditionFactors: { room: 1.05, wall: 1, ceiling: 1, trim: 1.25 } }),
    [minimalRoom()],
    [],
    [],
    [],
    [],
    [],
    [minimalTrimScope()]
  )
  assert.ok(Math.abs(Number(payload.room_trim_scopes[0].condition_factor) - 1.05 * 1.25) < 0.0001)
})

test('condition_factor is null when scope factor is 1 and room factor is 1', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({ resolvedConditionFactors: { room: 1, wall: 1, ceiling: 1, trim: 1 } }),
    [minimalRoom()],
    [minimalWallScope()],
    [],
    [],
    [minimalCeilingScope()],
    [],
    [minimalTrimScope()]
  )
  assert.equal(payload.room_wall_scopes[0].condition_factor, null)
  assert.equal(payload.room_ceiling_scopes[0].condition_factor, null)
  assert.equal(payload.room_trim_scopes[0].condition_factor, null)
})

test('jobsettings.condition_selections is null when not set on draft', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings(),
    [minimalRoom()],
    [],
    [],
    [],
    [],
    [],
    []
  )
  assert.equal(payload.jobsettings.condition_selections, null)
})

test('jobsettings.condition_selections is persisted from draft', () => {
  const selections: EstimateV2ConditionSelections = {
    room: { ROOM_FURNISHED: 'active' },
    wall: {},
    ceiling: {},
    trim: { TRIM_CAULK: 'minor' },
  }
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({ conditionSelections: selections }),
    [minimalRoom()],
    [],
    [],
    [],
    [],
    [],
    []
  )
  assert.deepEqual(payload.jobsettings.condition_selections, selections)
})

test('job-level condition selections are merged into room and scope rows', () => {
  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({
      conditionSelections: {
        room: { ROOM_FURNISHED: 'active' },
        wall: { WALL_TEXTURE: 'moderate' },
        ceiling: { CEIL_TEXTURE: 'major' },
        trim: { TRIM_OIL_BASED: 'active' },
      },
    }),
    [minimalRoom()],
    [minimalWallScope()],
    [],
    [],
    [minimalCeilingScope()],
    [],
    [minimalTrimScope()]
  )

  assert.deepEqual(payload.rooms[0].condition_selections, { ROOM_FURNISHED: 'active' })
  assert.deepEqual(payload.room_wall_scopes[0].condition_selections, { WALL_TEXTURE: 'moderate' })
  assert.deepEqual(payload.room_ceiling_scopes[0].condition_selections, { CEIL_TEXTURE: 'major' })
  assert.deepEqual(payload.room_trim_scopes[0].condition_selections, { TRIM_OIL_BASED: 'active' })
})

test('buildEstimateV2SavePayload defaults whitespace access fee numeric fields', () => {
  const accessFee: EstimateV2AccessFeeDraft = {
    id: 'access-fee-1',
    roomId: '',
    accessFeeId: ' ladder-tall ',
    qty: '   ',
    actualCostOverride: '   ',
    notes: '',
    position: 0,
  }

  const payload = buildEstimateV2SavePayload(
    minimalJobSettings(),
    [minimalRoom()],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [accessFee]
  )

  assert.deepEqual(payload.access_fees, [
    {
      id: 'access-fee-1',
      room_id: null,
      access_fee_id: 'LADDER-TALL',
      qty: 1,
      actual_cost_override: null,
      notes: null,
      position: 0,
      active: 'Y',
    },
  ])
})

test('buildEstimateV2SavePayload maps Other item drafts to persisted rows', () => {
  const otherItem: EstimateV2OtherItemDraft = {
    id: 'other-1',
    roomId: 'R001',
    position: 0,
    include: 'Y',
    description: 'Custom niche repair',
    customerLabel: 'Niche repair',
    pricingMode: 'quantity_rate',
    quantity: '2',
    unitRate: '85',
    laborHours: '',
    laborRate: '',
    materialCost: '',
    supplyCost: '',
    fixedAmount: '',
    rollupTarget: 'walls',
    customerVisibility: 'rollup',
    internalNotes: 'Internal only',
  }

  const payload = buildEstimateV2SavePayload(
    minimalJobSettings(),
    [minimalRoom()],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [otherItem]
  )

  assert.deepEqual(payload.other, [
    {
      id: 'other-1',
      room_id: 'R001',
      position: 0,
      active: 'Y',
      description: 'Custom niche repair',
      customer_label: 'Niche repair',
      pricing_mode: 'quantity_rate',
      quantity: 2,
      unit_rate: 85,
      labor_hours: null,
      labor_rate: null,
      material_cost: null,
      supply_cost: null,
      fixed_amount: null,
      rollup_target: 'walls',
      customer_visibility: 'rollup',
      internal_notes: 'Internal only',
      client_description: 'Niche repair',
      qty: 2,
      uom: null,
      labor_hrs_each: 0,
      materials_each: 85,
      rollup_scope: 'Walls',
    },
  ])
})

test('row condition selections override matching job-level selections', () => {
  const room = minimalRoom()
  room.conditionSelections = { ROOM_FURNISHED: 'active' }
  const wallScope = minimalWallScope()
  wallScope.conditionSelections = { WALL_TEXTURE: 'major' }
  const ceilingScope = minimalCeilingScope()
  ceilingScope.conditionSelections = { CEIL_TEXTURE: 'minor' }
  const trimScope = minimalTrimScope()
  trimScope.conditionSelections = { TRIM_CAULK: 'major' }

  const payload = buildEstimateV2SavePayload(
    minimalJobSettings({
      conditionSelections: {
        room: { ROOM_FURNISHED: 'minor' },
        wall: { WALL_TEXTURE: 'moderate', WALL_CUT_IN: 'active' },
        ceiling: { CEIL_TEXTURE: 'moderate' },
        trim: { TRIM_CAULK: 'minor', TRIM_OIL_BASED: 'active' },
      },
    }),
    [room],
    [wallScope],
    [],
    [],
    [ceilingScope],
    [],
    [trimScope]
  )

  assert.deepEqual(payload.rooms[0].condition_selections, { ROOM_FURNISHED: 'active' })
  assert.deepEqual(payload.room_wall_scopes[0].condition_selections, {
    WALL_TEXTURE: 'major',
    WALL_CUT_IN: 'active',
  })
  assert.deepEqual(payload.room_ceiling_scopes[0].condition_selections, { CEIL_TEXTURE: 'minor' })
  assert.deepEqual(payload.room_trim_scopes[0].condition_selections, {
    TRIM_CAULK: 'major',
    TRIM_OIL_BASED: 'active',
  })
})
