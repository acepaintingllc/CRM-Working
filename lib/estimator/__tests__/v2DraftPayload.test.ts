import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildEstimateV2SavePayload,
  deriveEstimateV2Scope,
  deriveEstimateV2Segment,
  sortByPosition,
} from '../v2DraftPayload.ts'

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
        lengthIn: '',
        widthIn: '',
        areaSf: '120',
        heightFactor: '1',
        complexityFactor: '1',
        ceilingFlagFactor: '1',
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
    ]
  )

  assert.equal(payload.jobsettings.crew_size, 2)

  assert.equal(payload.rooms.length, 1)
  assert.equal(payload.room_wall_scopes.length, 1)
  assert.equal(payload.room_flags.length, 1)
  assert.equal(payload.room_ceiling_scopes.length, 1)
  assert.equal(payload.room_trim_scopes.length, 1)
  assert.equal(payload.rooms[0].room_id, 'R001')
  assert.equal(payload.room_wall_scopes[0].room_id, 'R001')
  assert.equal(payload.room_ceiling_scopes[0].color_id, 'COLOR0')
  assert.equal(payload.room_trim_scopes[0].trim_type_id, 'BASE_STD')
  assert.equal(payload.room_trim_scopes[0].baseboard_opening_count, 1.5)
  assert.equal(payload.room_trim_scopes[0].override_measurement, null)
  assert.equal(payload.room_trim_scopes[0].override_total, null)
  assert.equal(payload.room_trim_scopes[0].override_description, null)
})
