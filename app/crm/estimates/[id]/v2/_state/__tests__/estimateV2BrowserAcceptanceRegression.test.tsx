import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { calculateCeilings } from '@/lib/estimator/ceilings'
import { calculateTrim } from '@/lib/estimator/trim'
import { buildEstimateV2SavePayload } from '@/lib/estimator/v2DraftPayload'
import { calculateWalls } from '@/lib/estimator/walls'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  CeilingCalculationScopeRow,
  CeilingCalculationSegmentRow,
} from '@/lib/estimator/ceilingTypes'
import type { TrimCalculationScopeRow } from '@/lib/estimator/trimTypes'
import type {
  WallCalculationScopeRow,
  WallCalculationSegmentRow,
  WallCalculationSettings,
} from '@/lib/estimator/wallsTypes'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2Catalogs,
  EstimateV2JobSettingsDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2'
import { buildEstimateV2EditorLoadState } from '../estimateV2EditorLoadOrchestration'
import {
  deriveEstimateV2PreparedSaveValidation,
  prepareEstimateV2SaveState,
  resolveEstimateV2SaveResponseState,
} from '../estimateV2EditorSaveOrchestration'
import { useEstimateV2EditorDerivedSections } from '../useEstimateV2EditorDerivedSections'
import { useEstimateV2EditorViewModels } from '../useEstimateV2EditorViewModels'
import { useEstimateV2DerivedState } from '../useEstimateV2DerivedState'

const calculationSettings: WallCalculationSettings = {
  labor_rate_per_hour: 75,
  paint_prod_rate_sqft_per_hour: 150,
  primer_prod_rate_sqft_per_hour: 200,
  paint_coverage_sqft_per_gal_per_coat: 350,
  primer_coverage_sqft_per_gal_per_coat: 300,
  paint_coats: 2,
  primer_coats: 1,
  spot_prime_percent: 20,
  area_supply_cost_per_sf: 0.05,
  per_color_supply_cost: 0,
  primer_supply_cost: 0,
  crew_size: 1,
  paint_price_per_gal: 50,
  primer_price_per_gal: 35,
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
  baseboard_opening_deduction_lf: 3,
}

const catalogs: EstimateV2Catalogs = {
  paint_products: [
    {
      id: 'P-WALL',
      label: 'Wall Paint',
      type: 'paint',
      scopes: ['Walls'],
      coverage_sqft_per_gal_per_coat: 350,
    },
    {
      id: 'P-PRIMER',
      label: 'Wall Primer',
      type: 'primer',
      scopes: ['Walls'],
      coverage_sqft_per_gal_per_coat: 300,
    },
    {
      id: 'P-CEILING',
      label: 'Ceiling Paint',
      type: 'paint',
      scopes: ['Ceilings'],
      coverage_sqft_per_gal_per_coat: 350,
    },
    {
      id: 'P-CEILING-PRIMER',
      label: 'Ceiling Primer',
      type: 'primer',
      scopes: ['Ceilings'],
      coverage_sqft_per_gal_per_coat: 300,
    },
    {
      id: 'P-TRIM',
      label: 'Trim Paint',
      type: 'paint',
      scopes: ['Trim'],
      coverage_sqft_per_gal_per_coat: 350,
    },
    {
      id: 'P-TRIM-PRIMER',
      label: 'Trim Primer',
      type: 'primer',
      scopes: ['Trim'],
      coverage_sqft_per_gal_per_coat: 300,
    },
  ],
  color_codes: [{ id: 'COLOR1', label: 'Warm White' }],
  production_rates: [
    {
      id: 'RATE-WALL',
      label: 'Standard Walls',
      scope_id: 'WALLS',
      surface_type: 'Walls',
      condition: 'Standard',
      prep_sqft_per_hr: 120,
      sqft_per_hr: 150,
      primer_sqft_per_hr: 200,
    },
    {
      id: 'TRIM-BASE',
      label: 'Baseboard',
      scope_id: 'TRIM-BASE',
      surface_type: 'BASE',
      condition: 'Standard',
      prep_sqft_per_hr: null,
      sqft_per_hr: 50,
      primer_sqft_per_hr: 80,
    },
  ],
  height_factors: [
    { id: 'HEIGHT-STD', label: '0-10 ft', min_height_ft: 0, max_height_ft: 10, labor_multiplier: 1 },
  ],
  room_types: [{ id: 'ROOM', label: 'Room' }],
  room_flags: [],
  ceiling_types: [{ id: 'FLAT', label: 'Flat', labor_mult: 1 }],
  trim_items: [
    {
      id: 'TRIM-BASE',
      label: 'Baseboard',
      family: 'BASE',
      category: 'Baseboard',
      unit_type: 'LF',
      helper_allowed: true,
      default_production_rate_id: 'TRIM-BASE',
    },
  ],
}

const jobSettingsDraft: EstimateV2JobSettingsDraft = {
  laborDayEnabled: false,
  dayhours: 8,
  roundingIncrementHours: 4,
  laborRate: 75,
  jobMinEnabled: false,
  jobMinAmount: 0,
  crewSize: 1,
  wallPaintProductId: 'P-WALL',
  wallPrimerProductId: 'P-PRIMER',
  ceilingPaintProductId: 'P-CEILING',
  ceilingPrimerProductId: 'P-CEILING-PRIMER',
  trimPaintProductId: 'P-TRIM',
  trimPrimerProductId: 'P-TRIM-PRIMER',
  standardDoorDeductionSf: 21,
  standardWindowDeductionSf: 15,
  baseboardOpeningDeductionLf: 3,
}

const calculatorPaintProducts = catalogs.paint_products.map((product) => ({
  id: product.id,
  type: product.type,
  label: product.label,
  price_per_gal: null,
  coverage_sqft_per_gal_per_coat: product.coverage_sqft_per_gal_per_coat ?? null,
}))

const rooms: EstimateV2RoomDraft[] = [
  {
    id: 'room-1',
    roomId: 'R001',
    roomName: 'Room 1',
    roomTypeId: 'ROOM',
    lengthIn: '180',
    widthIn: '144',
    heightIn: '96',
    wallComplexityId: 'RATE-WALL',
    notes: '',
    position: 0,
  },
  {
    id: 'room-2',
    roomId: 'R002',
    roomName: 'Room 2',
    roomTypeId: 'ROOM',
    lengthIn: '',
    widthIn: '',
    heightIn: '96',
    wallComplexityId: 'RATE-WALL',
    notes: '',
    position: 1,
  },
  {
    id: 'room-3',
    roomId: 'R003',
    roomName: 'Room 3',
    roomTypeId: 'ROOM',
    lengthIn: '',
    widthIn: '',
    heightIn: '',
    wallComplexityId: '',
    notes: '',
    position: 2,
  },
]

const wallScopes: EstimateV2WallScopeDraft[] = [
  {
    id: 'wall-r1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: 'Room 1 walls',
    colorId: 'COLOR1',
    paintProductId: 'P-WALL',
    primerProductId: 'P-PRIMER',
    primeMode: 'FULL',
    heightIn: '96',
    perimeterIn: '648',
    standardDoorCount: '0',
    standardWindowCount: '0',
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
  },
  {
    id: 'wall-r2',
    roomId: 'R002',
    position: 0,
    mode: 'SEG',
    include: 'Y',
    scopeName: 'Room 2 walls',
    colorId: 'COLOR1',
    paintProductId: 'P-WALL',
    primerProductId: 'P-PRIMER',
    primeMode: 'NONE',
    heightIn: '96',
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
  },
  {
    id: 'wall-r3-excluded',
    roomId: 'R003',
    position: 0,
    mode: 'RECT',
    include: 'N',
    scopeName: 'Room 3 excluded walls',
    colorId: 'COLOR1',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'FULL',
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
  },
]

const wallSegments: EstimateV2WallSegmentDraft[] = [
  {
    id: 'wall-r2-north',
    wallScopeId: 'wall-r2',
    roomId: 'R002',
    position: 0,
    segmentName: 'North wall',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '120',
    heightIn: '96',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '0',
    standardWindowCount: '0',
    overrideAreaSqFt: '',
    notes: '',
  },
  {
    id: 'wall-r2-east',
    wallScopeId: 'wall-r2',
    roomId: 'R002',
    position: 1,
    segmentName: 'East wall',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '84',
    heightIn: '96',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '0',
    standardWindowCount: '0',
    overrideAreaSqFt: '',
    notes: '',
  },
]

const ceilingScopes: EstimateV2CeilingScopeDraft[] = [
  {
    id: 'ceiling-r1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: 'Room 1 ceiling',
    colorId: 'COLOR1',
    paintProductId: 'P-CEILING',
    primerProductId: 'P-CEILING-PRIMER',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: 'FLAT',
    ceilingGeometryMode: 'FLAT',
    lengthIn: '180',
    widthIn: '144',
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
  },
  {
    id: 'ceiling-r2',
    roomId: 'R002',
    position: 0,
    mode: 'SEG',
    include: 'Y',
    scopeName: 'Room 2 ceiling',
    colorId: 'COLOR1',
    paintProductId: 'P-CEILING',
    primerProductId: 'P-CEILING-PRIMER',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: 'FLAT',
    ceilingGeometryMode: 'FLAT',
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
  },
  {
    id: 'ceiling-r3-excluded',
    roomId: 'R003',
    position: 0,
    mode: 'RECT',
    include: 'N',
    scopeName: 'Room 3 excluded ceiling',
    colorId: 'COLOR1',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'FULL',
    spotPrimePercent: '',
    ceilingTypeId: 'FLAT',
    ceilingGeometryMode: 'FLAT',
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
  },
]

const ceilingSegments: EstimateV2CeilingSegmentDraft[] = [
  {
    id: 'ceiling-r2-main',
    ceilingScopeId: 'ceiling-r2',
    roomId: 'R002',
    position: 0,
    segmentName: 'Main ceiling plane',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '120',
    heightIn: '84',
    baseIn: '',
    manualAreaSqFt: '',
    overrideAreaSqFt: '',
    notes: '',
  },
]

const trimScopes: EstimateV2TrimScopeDraft[] = [
  {
    id: 'trim-r1',
    roomId: 'R001',
    position: 0,
    include: 'Y',
    scopeName: 'Room 1 trim',
    trimTypeId: 'TRIM-BASE',
    trimFamily: 'BASE',
    unitType: 'LF',
    measurementMode: 'ROOM_HELPER',
    helperSource: 'ROOM_PERIMETER',
    measurementValue: '',
    helperValue: '54',
    baseboardOpeningCount: '',
    colorId: 'COLOR1',
    paintProductId: 'P-TRIM',
    primerProductId: 'P-TRIM-PRIMER',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: 'TRIM-BASE',
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
  },
  {
    id: 'trim-r2',
    roomId: 'R002',
    position: 0,
    include: 'Y',
    scopeName: 'Room 2 trim',
    trimTypeId: 'TRIM-BASE',
    trimFamily: 'BASE',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '42',
    helperValue: '',
    baseboardOpeningCount: '',
    colorId: 'COLOR1',
    paintProductId: 'P-TRIM',
    primerProductId: 'P-TRIM-PRIMER',
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: 'TRIM-BASE',
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
  },
  {
    id: 'trim-r3-excluded',
    roomId: 'R003',
    position: 0,
    include: 'N',
    scopeName: 'Room 3 excluded trim',
    trimTypeId: 'TRIM-BASE',
    trimFamily: 'BASE',
    unitType: 'LF',
    measurementMode: 'MANUAL',
    helperSource: '',
    measurementValue: '',
    helperValue: '',
    baseboardOpeningCount: '',
    colorId: 'COLOR1',
    paintProductId: '',
    primerProductId: '',
    paintEnabled: 'Y',
    primeMode: 'FULL',
    spotPrimePercent: '',
    productionRateId: 'TRIM-BASE',
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
  },
]

function buildAcceptancePayload() {
  return buildEstimateV2SavePayload(
    jobSettingsDraft,
    rooms,
    wallScopes,
    wallSegments,
    [],
    ceilingScopes,
    ceilingSegments,
    trimScopes
  )
}

function calculateAcceptancePayload(payload: ReturnType<typeof buildEstimateV2SavePayload>) {
  const wallCalculations = calculateWalls({
    scopes: payload.room_wall_scopes as unknown as WallCalculationScopeRow[],
    segments: payload.wall_segments as unknown as WallCalculationSegmentRow[],
    settings: calculationSettings,
    catalogs: {
      paint_products: calculatorPaintProducts,
    },
  })
  const ceilingCalculations = calculateCeilings({
    scopes: payload.room_ceiling_scopes as unknown as CeilingCalculationScopeRow[],
    segments: payload.ceiling_scope_segments as unknown as CeilingCalculationSegmentRow[],
    settings: calculationSettings,
    catalogs: {
      paint_products: calculatorPaintProducts,
      ceiling_types: catalogs.ceiling_types,
    },
  })
  const trimCalculations = calculateTrim({
    rooms: payload.rooms.map((room) => ({
      room_id: room.room_id,
      length_in: room.length_in,
      width_in: room.width_in,
      mode:
        payload.room_wall_scopes.find((scope) => scope.room_id === room.room_id)?.mode === 'SEG'
          ? 'SEG'
          : 'RECT',
    })),
    scopes: payload.room_trim_scopes as unknown as TrimCalculationScopeRow[],
    settings: calculationSettings,
    catalogs: {
      paint_products: calculatorPaintProducts,
      trim_items: [
        {
          id: 'TRIM-BASE',
          family: 'BASE',
          default_unit_type: 'LF',
          helper_allowed: true,
          default_production_rate_id: 'TRIM-BASE',
        },
      ],
      production_rates: [
        {
          id: 'TRIM-BASE',
          scope_id: 'TRIM-BASE',
          units_per_hour: 50,
          prep_units_per_hour: null,
          primer_units_per_hour: 80,
        },
      ],
    },
  })

  return {
    wallCalculations,
    ceilingCalculations,
    trimCalculations,
  }
}

function createLoadedStore(params: {
  wallCalculations: ReturnType<typeof calculateWalls> | null
  ceilingCalculations: ReturnType<typeof calculateCeilings> | null
  trimCalculations: ReturnType<typeof calculateTrim> | null
}) {
  const payload = buildAcceptancePayload()
  const store = createEstimateV2Store()
  const loadState = buildEstimateV2EditorLoadState({
    store,
    estimatePayload: {
      estimate: {
        id: 'estimate-browser-acceptance',
        job_id: 'job-browser-acceptance',
        version_name: 'Browser Acceptance',
        version_state: 'Draft',
        updated_at: '2026-05-04T12:00:00.000Z',
      },
      inputs: {
        jobsettings: payload.jobsettings,
        org_defaults: null,
        paint_products: catalogs.paint_products,
        rooms: payload.rooms,
        room_wall_scopes: payload.room_wall_scopes,
        wall_segments: payload.wall_segments,
        room_ceiling_scopes: payload.room_ceiling_scopes,
        ceiling_scope_segments: payload.ceiling_scope_segments,
        room_trim_scopes: payload.room_trim_scopes,
        room_door_scopes: [],
        drywall_repairs: [],
        rollers: [],
        prejob: [],
        trim_items: catalogs.trim_items,
        job_colors: catalogs.color_codes,
        room_flags: [],
        access_fees: [],
        other: [],
      },
      wall_calculations: params.wallCalculations,
      ceiling_calculations: params.ceilingCalculations,
      trim_calculations: params.trimCalculations,
      door_calculations: null,
      drywall_calculations: null,
      trim_paint: null,
      pricing_summary: null,
    },
    catalogsPayload: { catalogs },
    catalogsOk: true,
    catalogsErrorMessage: null,
    job: {
      id: 'job-browser-acceptance',
      title: 'Browser Acceptance',
      status: 'open',
      customer_id: 'customer-1',
      customer_name: 'Browser Tester',
      customer_address: null,
      customer_email: null,
      customer_phone: null,
    },
  })

  return createEstimateV2Store({
    collections: loadState.collections,
    meta: {
      loading: false,
      saving: false,
      estimate: loadState.meta.estimate,
      job: loadState.meta.job,
      catalogs: loadState.meta.catalogs,
      wallCalculations: loadState.meta.wallCalculations,
      ceilingCalculations: loadState.meta.ceilingCalculations,
      trimCalculations: loadState.meta.trimCalculations,
      doorCalculations: loadState.meta.doorCalculations,
      drywallCalculations: loadState.meta.drywallCalculations,
      selectedRoomId: 'R001',
      catalogsError: null,
      error: null,
      validationIssues: loadState.meta.validationIssues,
      lastSavedSnapshot: loadState.meta.lastSavedSnapshot,
      saveStatus: loadState.saveStatus,
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: false,
      jobSettingsDraft: loadState.meta.jobSettingsDraft,
      orgJobProductDefaults: loadState.meta.orgJobProductDefaults,
      customerDraft: loadState.meta.customerDraft,
      debugMeta: loadState.meta.debugMeta,
    },
  })
}

function noOpActions() {
  return {
    roomActions: {
      addRoom: vi.fn(),
      deleteRoom: vi.fn(),
      updateRoom: vi.fn(),
      updateRoomComplexity: vi.fn(),
      toggleFlag: vi.fn(),
      handleRoomDimChange: vi.fn(),
      switchRoomGeometryMode: vi.fn(),
    },
    wallActions: {
      addScope: vi.fn(),
      moveScope: vi.fn(),
      deleteScope: vi.fn(),
      updateScope: vi.fn(),
      addSegment: vi.fn(),
      moveSegment: vi.fn(),
      deleteSegment: vi.fn(),
      updateSegment: vi.fn(),
      toggleRoomInclude: vi.fn(),
    },
    ceilingActions: {
      updateScope: vi.fn(),
      addScope: vi.fn(),
      deleteScope: vi.fn(),
      moveScope: vi.fn(),
      addSegment: vi.fn(),
      deleteSegment: vi.fn(),
      moveSegment: vi.fn(),
      updateSegment: vi.fn(),
      toggleRoomInclude: vi.fn(),
    },
    trimActions: {
      updateScope: vi.fn(),
      addScope: vi.fn(),
      moveScope: vi.fn(),
      deleteScope: vi.fn(),
      toggleRoomInclude: vi.fn(),
      updateTrimType: vi.fn(),
    },
    doorActions: {
      updateScope: vi.fn(),
      addScope: vi.fn(),
      moveScope: vi.fn(),
      deleteScope: vi.fn(),
      toggleRoomInclude: vi.fn(),
      updateDoorType: vi.fn(),
    },
    settingsActions: {
      updateJobSettings: vi.fn(),
      updateCustomer: vi.fn(),
      flushCustomerSave: vi.fn(),
    },
  }
}

describe('Estimate V2 browser acceptance regression', () => {
  it('keeps checklist scope totals stable through immediate edits, manual save reconciliation, and reload normalization', () => {
    const store = createLoadedStore({
      wallCalculations: null,
      ceilingCalculations: null,
      trimCalculations: null,
    })
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setRooms([
        { ...rooms[0], lengthIn: '180', widthIn: '148', heightIn: '96' },
      ])
      store.getState().setScopes([
        {
          ...wallScopes[0],
          perimeterIn: '656',
          heightIn: '96',
          primeMode: 'FULL',
          primerProductId: 'P-PRIMER',
        },
      ])
      store.getState().setSegments([])
      store.getState().setCeilingScopes([])
      store.getState().setCeilingSegments([])
      store.getState().setTrimScopes([])
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 437.33,
      ceilingsSqFt: 0,
      trimMeasurement: 0,
    })

    act(() => {
      store.getState().setRooms((prev) => [
        ...prev,
        { ...rooms[1], lengthIn: '', widthIn: '', heightIn: '96' },
      ])
      store.getState().setScopes((prev) => [
        ...prev,
        {
          ...wallScopes[1],
          mode: 'SEG',
          primeMode: 'NONE',
          primerProductId: '',
          heightIn: '96',
        },
      ])
      store.getState().setSegments([
        { ...wallSegments[0], widthIn: '120', heightIn: '96' },
        { ...wallSegments[1], widthIn: '96', heightIn: '96' },
      ])
    })

    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 0,
      trimMeasurement: 0,
    })
    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r1')).toBeCloseTo(437.3333, 4)
    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r2')).toBe(144)

    act(() => {
      store.getState().setCeilingScopes([
        { ...ceilingScopes[0], lengthIn: '180', widthIn: '148', primeMode: 'NONE' },
      ])
    })

    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 185,
      trimMeasurement: 0,
    })

    act(() => {
      store.getState().setCeilingScopes((prev) => [
        ...prev,
        { ...ceilingScopes[1], mode: 'SEG', primeMode: 'NONE' },
      ])
      store.getState().setCeilingSegments([
        {
          ...ceilingSegments[0],
          shapeType: 'MANUAL',
          widthIn: '',
          heightIn: '',
          manualAreaSqFt: '78.28',
        },
      ])
    })

    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 263.28,
      trimMeasurement: 0,
    })

    act(() => {
      store.getState().setTrimScopes([
        {
          ...trimScopes[1],
          id: 'trim-manual',
          roomId: 'R002',
          measurementMode: 'MANUAL',
          measurementValue: '44',
        },
      ])
    })

    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 263.28,
      trimMeasurement: 44,
    })

    act(() => {
      store.getState().setTrimScopes((prev) => [
        ...prev,
        {
          ...trimScopes[0],
          id: 'trim-helper',
          roomId: 'R001',
          measurementMode: 'ROOM_HELPER',
          helperSource: 'ROOM_PERIMETER',
          helperValue: '',
          measurementValue: '',
        },
      ])
    })

    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-helper')).toBe(54.6667)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 263.28,
      trimMeasurement: 98.6667,
      trimUnit: 'LF',
    })

    act(() => {
      store.getState().setRooms((prev) => [
        ...prev,
        { ...rooms[2], roomId: 'R003', roomName: 'Excluded Room' },
      ])
      store.getState().setScopes((prev) => [...prev, wallScopes[2]])
      store.getState().setCeilingScopes((prev) => [...prev, ceilingScopes[2]])
      store.getState().setTrimScopes((prev) => [...prev, trimScopes[2]])
    })

    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r3-excluded')).toBeNull()
    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-r3-excluded')).toBe(0)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 263.28,
      trimMeasurement: 98.6667,
    })

    const prepared = prepareEstimateV2SaveState(store.getState())
    expect(prepared.payloadSnapshot.payload.room_wall_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wall-r1', include: 'Y', prime_mode: 'FULL' }),
        expect.objectContaining({ id: 'wall-r2', include: 'Y', mode: 'SEG' }),
        expect.objectContaining({ id: 'wall-r3-excluded', include: 'N' }),
      ])
    )
    expect(prepared.payloadSnapshot.payload.room_ceiling_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ceiling-r1', include: 'Y', mode: 'RECT' }),
        expect.objectContaining({ id: 'ceiling-r3-excluded', include: 'N' }),
      ])
    )
    expect(prepared.payloadSnapshot.payload.ceiling_scope_segments).toEqual([
      expect.objectContaining({
        ceiling_scope_id: expect.any(String),
        shape_type: 'MANUAL',
        manual_area_sf: 78.28,
      }),
    ])
    expect(prepared.payloadSnapshot.payload.room_trim_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trim-manual', include: 'Y', measurement_value: 44 }),
        expect.objectContaining({
          id: 'trim-helper',
          include: 'Y',
          measurement_mode: 'ROOM_HELPER',
          helper_source: 'ROOM_PERIMETER',
          helper_value: null,
        }),
        expect.objectContaining({ id: 'trim-r3-excluded', include: 'N' }),
      ])
    )

    const calculations = calculateAcceptancePayload(prepared.payloadSnapshot.payload)
    const reconciled = resolveEstimateV2SaveResponseState({
      trigger: 'manual',
      payload: {
        estimate: { updated_at: '2026-05-04T12:05:00.000Z' },
        wall_calculations: calculations.wallCalculations,
        ceiling_calculations: calculations.ceilingCalculations,
        trim_calculations: calculations.trimCalculations,
        pricing_summary: null,
      },
      meta: store.getState().meta,
      prepared,
      currentState: store.getState(),
      effectiveJobProductDefaults: {
        wallPaintProductId: jobSettingsDraft.wallPaintProductId,
        wallPrimerProductId: jobSettingsDraft.wallPrimerProductId,
        ceilingPaintProductId: jobSettingsDraft.ceilingPaintProductId,
        ceilingPrimerProductId: jobSettingsDraft.ceilingPrimerProductId,
        trimPaintProductId: jobSettingsDraft.trimPaintProductId,
        trimPrimerProductId: jobSettingsDraft.trimPrimerProductId,
      },
    })

    act(() => {
      store.getState().setCollections((prev) => ({
        ...prev,
        scopes: reconciled.collections.scopes,
        segments: reconciled.collections.segments,
        ceilingScopes: reconciled.collections.ceilingScopes,
        ceilingSegments: reconciled.collections.ceilingSegments,
        trimScopes: reconciled.collections.trimScopes,
      }))
      store.getState().setMeta((prev) => ({
        ...prev,
        wallCalculations: reconciled.calculations.wallCalculations,
        ceilingCalculations: reconciled.calculations.ceilingCalculations,
        trimCalculations: reconciled.calculations.trimCalculations,
        pricingSummary: reconciled.calculations.pricingSummary,
        estimate: reconciled.estimate,
        lastSavedSnapshot: reconciled.lastSavedSnapshot,
        saveStatus: 'saved',
      }))
    })

    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 263.28,
      trimMeasurement: 98.6667,
      trimUnit: 'LF',
    })
    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-helper')).toBe(54.6667)

    const reloadState = buildEstimateV2EditorLoadState({
      store,
      estimatePayload: {
        estimate: {
          id: 'estimate-browser-acceptance',
          job_id: 'job-browser-acceptance',
          version_name: 'Browser Acceptance',
          version_state: 'Draft',
          updated_at: '2026-05-04T12:05:00.000Z',
        },
        inputs: {
          jobsettings: prepared.payloadSnapshot.payload.jobsettings,
          org_defaults: null,
          paint_products: catalogs.paint_products,
          rooms: prepared.payloadSnapshot.payload.rooms,
          room_wall_scopes: prepared.payloadSnapshot.payload.room_wall_scopes,
          wall_segments: prepared.payloadSnapshot.payload.wall_segments,
          room_ceiling_scopes: prepared.payloadSnapshot.payload.room_ceiling_scopes,
          ceiling_scope_segments: prepared.payloadSnapshot.payload.ceiling_scope_segments,
          room_trim_scopes: prepared.payloadSnapshot.payload.room_trim_scopes,
          room_door_scopes: [],
          drywall_repairs: [],
          rollers: [],
          prejob: [],
          trim_items: catalogs.trim_items,
          job_colors: catalogs.color_codes,
          room_flags: [],
          access_fees: [],
          other: [],
        },
        wall_calculations: calculations.wallCalculations,
        ceiling_calculations: calculations.ceilingCalculations,
        trim_calculations: calculations.trimCalculations,
        door_calculations: null,
        drywall_calculations: null,
        trim_paint: null,
        pricing_summary: null,
      },
      catalogsPayload: { catalogs },
      catalogsOk: true,
      catalogsErrorMessage: null,
      job: {
        id: 'job-browser-acceptance',
        title: 'Browser Acceptance',
        status: 'open',
        customer_id: 'customer-1',
        customer_name: 'Browser Tester',
        customer_address: null,
        customer_email: null,
        customer_phone: null,
      },
    })
    const reloadedStore = createEstimateV2Store({
      collections: reloadState.collections,
      meta: {
        loading: false,
        saving: false,
        estimate: reloadState.meta.estimate,
        job: reloadState.meta.job,
        catalogs: reloadState.meta.catalogs,
        wallCalculations: reloadState.meta.wallCalculations,
        ceilingCalculations: reloadState.meta.ceilingCalculations,
        trimCalculations: reloadState.meta.trimCalculations,
        doorCalculations: null,
        drywallCalculations: null,
        pricingSummary: null,
        selectedRoomId: 'R001',
        catalogsError: null,
        error: null,
        validationIssues: reloadState.meta.validationIssues,
        lastSavedSnapshot: reloadState.meta.lastSavedSnapshot,
        saveStatus: reloadState.saveStatus,
        autoSaveHint: null,
        settingsOpen: false,
        jobDefaultsOpen: false,
        jobSettingsDraft: reloadState.meta.jobSettingsDraft,
        orgJobProductDefaults: reloadState.meta.orgJobProductDefaults,
        customerDraft: reloadState.meta.customerDraft,
        debugMeta: reloadState.meta.debugMeta,
      },
    })
    const { result: reloadResult } = renderHook(() => useEstimateV2DerivedState({ store: reloadedStore }))

    expect(reloadResult.current.useLocalPreviewCalculations).toBe(false)
    expect(reloadResult.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 581.33,
      ceilingsSqFt: 263.28,
      trimMeasurement: 98.6667,
      trimUnit: 'LF',
    })
    expect(reloadResult.current.displayedScopeEffectiveAreaById.get('wall-r1')).toBeCloseTo(437.3333, 4)
    expect(reloadResult.current.displayedScopeEffectiveAreaById.get('wall-r2')).toBe(144)
    expect(reloadResult.current.trimScopeEffectiveMeasurementById.get('trim-manual')).toBe(44)
    expect(reloadResult.current.trimScopeEffectiveMeasurementById.get('trim-helper')).toBe(54.6667)
    expect(reloadResult.current.currentPayload.room_trim_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trim-manual', measurement_value: 44 }),
        expect.objectContaining({ id: 'trim-helper', helper_source: 'ROOM_PERIMETER' }),
      ])
    )
  })

  it('persists a 126 x 90 SEG room ceiling segment through manual save and reload normalization', () => {
    const store = createLoadedStore({
      wallCalculations: null,
      ceilingCalculations: null,
      trimCalculations: null,
    })
    const localCeilingScopeId = 'ceiling-r2-local'
    const localCeilingSegmentId = 'ceiling-r2-local-main'
    store.getState().setCeilingScopes([
      {
        ...ceilingScopes[1],
        id: localCeilingScopeId,
        mode: 'SEG',
        include: 'Y',
        lengthIn: '',
        widthIn: '',
      },
    ])
    store.getState().setCeilingSegments([
      {
        ...ceilingSegments[0],
        id: localCeilingSegmentId,
        ceilingScopeId: localCeilingScopeId,
        widthIn: '126',
        heightIn: '90',
        include: 'Y',
      },
    ])

    const prepared = prepareEstimateV2SaveState(store.getState())
    const savePayload = prepared.payloadSnapshot.payload
    const savedScopeId = savePayload.room_ceiling_scopes[0]?.id

    expect(savedScopeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    expect(savePayload.ceiling_scope_segments).toEqual([
      expect.objectContaining({
        ceiling_scope_id: savedScopeId,
        include: 'Y',
        width_in: 126,
        height_in: 90,
      }),
    ])

    const reloadState = buildEstimateV2EditorLoadState({
      store,
      estimatePayload: {
        estimate: {
          id: 'estimate-browser-acceptance',
          job_id: 'job-browser-acceptance',
          version_name: 'Browser Acceptance',
          version_state: 'Draft',
          updated_at: '2026-05-04T12:00:00.000Z',
        },
        inputs: {
          jobsettings: savePayload.jobsettings,
          org_defaults: null,
          paint_products: catalogs.paint_products,
          rooms: savePayload.rooms,
          room_wall_scopes: [],
          wall_segments: [],
          room_ceiling_scopes: savePayload.room_ceiling_scopes,
          ceiling_scope_segments: savePayload.ceiling_scope_segments,
          room_trim_scopes: [],
          room_door_scopes: [],
          drywall_repairs: [],
          rollers: [],
          prejob: [],
          trim_items: catalogs.trim_items,
          job_colors: catalogs.color_codes,
          room_flags: [],
          access_fees: [],
          other: [],
        },
        wall_calculations: null,
        ceiling_calculations: null,
        trim_calculations: null,
        door_calculations: null,
        drywall_calculations: null,
        trim_paint: null,
        pricing_summary: null,
      },
      catalogsPayload: { catalogs },
      catalogsOk: true,
      catalogsErrorMessage: null,
      job: {
        id: 'job-browser-acceptance',
        title: 'Browser Acceptance',
        status: 'open',
        customer_id: 'customer-1',
        customer_name: 'Browser Tester',
        customer_address: null,
        customer_email: null,
        customer_phone: null,
      },
    })

    expect(reloadState.collections.ceilingScopes).toEqual([
      expect.objectContaining({
        id: savedScopeId,
        mode: 'SEG',
        include: 'Y',
      }),
    ])
    expect(reloadState.collections.ceilingSegments).toEqual([
      expect.objectContaining({
        ceilingScopeId: savedScopeId,
        include: 'Y',
        widthIn: '126',
        heightIn: '90',
      }),
    ])

    const reloadedPayload = prepareEstimateV2SaveState({
      ...store.getState(),
      collections: {
        ...store.getState().collections,
        ...reloadState.collections,
      },
    }).payloadSnapshot.payload
    expect(
      reloadedPayload.ceiling_scope_segments.filter(
        (segment) => segment.ceiling_scope_id === savedScopeId && segment.include === 'Y'
      )
    ).toHaveLength(1)
  })

  it('covers validation, excluded calculator inputs, reload normalization, and summary rail active totals', () => {
    const payload = buildAcceptancePayload()
    const saveValidation = deriveEstimateV2PreparedSaveValidation({
      collections: {
        rooms,
        scopes: wallScopes,
        segments: wallSegments,
        roomFlags: [],
        rollers: [],
        ceilingScopes,
        ceilingSegments,
        trimScopes,
        doorScopes: [],
        drywallRepairs: [],
        accessFees: [],
        otherItems: [],
      },
      jobSettingsDraft,
      trigger: 'manual',
    })
    expect(saveValidation.issues).toEqual([])

    const wallCalculations = calculateWalls({
      scopes: payload.room_wall_scopes as unknown as WallCalculationScopeRow[],
      segments: payload.wall_segments as unknown as WallCalculationSegmentRow[],
      settings: calculationSettings,
      catalogs: {
        paint_products: calculatorPaintProducts,
      },
    })
    const ceilingCalculations = calculateCeilings({
      scopes: payload.room_ceiling_scopes as unknown as CeilingCalculationScopeRow[],
      segments: payload.ceiling_scope_segments as unknown as CeilingCalculationSegmentRow[],
      settings: calculationSettings,
      catalogs: {
        paint_products: calculatorPaintProducts,
        ceiling_types: catalogs.ceiling_types,
      },
    })
    const trimCalculations = calculateTrim({
      rooms: payload.rooms.map((room) => ({
        room_id: room.room_id,
        length_in: room.length_in,
        width_in: room.width_in,
        mode:
          payload.room_wall_scopes.find((scope) => scope.room_id === room.room_id)?.mode === 'SEG'
            ? 'SEG'
            : 'RECT',
      })),
      scopes: payload.room_trim_scopes as unknown as TrimCalculationScopeRow[],
      settings: calculationSettings,
      catalogs: {
        paint_products: calculatorPaintProducts,
        trim_items: [
          {
            id: 'TRIM-BASE',
            family: 'BASE',
            default_unit_type: 'LF',
            helper_allowed: true,
            default_production_rate_id: 'TRIM-BASE',
          },
        ],
        production_rates: [
          {
            id: 'TRIM-BASE',
            scope_id: 'TRIM-BASE',
            units_per_hour: 50,
            prep_units_per_hour: null,
            primer_units_per_hour: 80,
          },
        ],
      },
    })

    expect(wallCalculations.missing_inputs).toEqual([])
    expect(ceilingCalculations.missing_inputs).toEqual([])
    expect(trimCalculations.missing_inputs).toEqual([])
    expect(wallCalculations.scopes.find((scope) => scope.id === 'wall-r3-excluded')).toMatchObject({
      include: 'N',
      effective_area_sf: 0,
      effective_total: 0,
    })
    expect(
      ceilingCalculations.scopes.find((scope) => scope.id === 'ceiling-r3-excluded')
    ).toMatchObject({
      include: 'N',
      effective_area_sf: 0,
      effective_total: 0,
    })
    expect(trimCalculations.scopes.find((scope) => scope.id === 'trim-r3-excluded')).toMatchObject({
      include: 'N',
      effective_measurement: 0,
      effective_total: 0,
    })

    const loadedStore = createLoadedStore({
      wallCalculations,
      ceilingCalculations,
      trimCalculations,
    })
    const loadedState = loadedStore.getState()

    expect(
      loadedState.collections.rooms.map((room) => ({
        roomId: room.roomId,
        lengthIn: room.lengthIn,
        widthIn: room.widthIn,
        heightIn: room.heightIn,
      }))
    ).toEqual([
      { roomId: 'R001', lengthIn: '180', widthIn: '144', heightIn: '96' },
      { roomId: 'R002', lengthIn: '', widthIn: '', heightIn: '96' },
      { roomId: 'R003', lengthIn: '', widthIn: '', heightIn: '' },
    ])
    expect(
      loadedState.collections.scopes.map((scope) => ({
        id: scope.id,
        include: scope.include,
        primeMode: scope.primeMode,
        heightIn: scope.heightIn,
        perimeterIn: scope.perimeterIn,
      }))
    ).toEqual([
      { id: 'wall-r1', include: 'Y', primeMode: 'FULL', heightIn: '96', perimeterIn: '648' },
      { id: 'wall-r2', include: 'Y', primeMode: 'NONE', heightIn: '96', perimeterIn: '' },
      { id: 'wall-r3-excluded', include: 'N', primeMode: 'FULL', heightIn: '', perimeterIn: '' },
    ])
    expect(
      loadedState.collections.segments.map((segment) => ({
        id: segment.id,
        include: segment.include,
        widthIn: segment.widthIn,
        heightIn: segment.heightIn,
      }))
    ).toEqual([
      { id: 'wall-r2-north', include: 'Y', widthIn: '120', heightIn: '96' },
      { id: 'wall-r2-east', include: 'Y', widthIn: '84', heightIn: '96' },
    ])
    expect(
      loadedState.collections.ceilingScopes.map((scope) => ({
        id: scope.id,
        include: scope.include,
        primeMode: scope.primeMode,
        lengthIn: scope.lengthIn,
        widthIn: scope.widthIn,
      }))
    ).toEqual([
      { id: 'ceiling-r1', include: 'Y', primeMode: 'NONE', lengthIn: '180', widthIn: '144' },
      { id: 'ceiling-r2', include: 'Y', primeMode: 'NONE', lengthIn: '', widthIn: '' },
      { id: 'ceiling-r3-excluded', include: 'N', primeMode: 'FULL', lengthIn: '', widthIn: '' },
    ])
    expect(
      loadedState.collections.ceilingSegments.map((segment) => ({
        id: segment.id,
        include: segment.include,
        widthIn: segment.widthIn,
        heightIn: segment.heightIn,
      }))
    ).toEqual([{ id: 'ceiling-r2-main', include: 'Y', widthIn: '120', heightIn: '84' }])
    expect(
      loadedState.collections.trimScopes.map((scope) => ({
        id: scope.id,
        include: scope.include,
        primeMode: scope.primeMode,
        measurementMode: scope.measurementMode,
        helperValue: scope.helperValue,
        measurementValue: scope.measurementValue,
      }))
    ).toEqual([
      {
        id: 'trim-r1',
        include: 'Y',
        primeMode: 'NONE',
        measurementMode: 'ROOM_HELPER',
        helperValue: '54',
        measurementValue: '',
      },
      {
        id: 'trim-r2',
        include: 'Y',
        primeMode: 'NONE',
        measurementMode: 'MANUAL',
        helperValue: '',
        measurementValue: '42',
      },
      {
        id: 'trim-r3-excluded',
        include: 'N',
        primeMode: 'FULL',
        measurementMode: 'MANUAL',
        helperValue: '',
        measurementValue: '',
      },
    ])

    const immediateStore = createLoadedStore({
      wallCalculations: null,
      ceilingCalculations: null,
      trimCalculations: null,
    })
    const actions = noOpActions()
    const { result } = renderHook(() => {
      const derived = useEstimateV2EditorDerivedSections({ store: immediateStore })
      return useEstimateV2EditorViewModels({
        estimateId: 'estimate-browser-acceptance',
        store: immediateStore,
        derived,
        ...actions,
        save: vi.fn(async () => true),
        saveDraft: vi.fn(),
        saveAndContinue: vi.fn(),
      })
    })

    expect(result.current.summaryVm.activeScopeTotals).toEqual([
      { key: 'walls', label: 'Walls', value: '568 sf' },
      { key: 'ceilings', label: 'Ceilings', value: '250 sf' },
      { key: 'trim', label: 'Trim', value: '96 LF' },
    ])
    expect(result.current.summaryVm.walls).toMatchObject({
      visible: true,
      primaryValue: '432',
      primaryUnit: 'Sq Ft',
      showPrimer: true,
    })
    expect(result.current.summaryVm.ceilings).toMatchObject({
      visible: true,
      primaryValue: '180',
      primaryUnit: 'Sq Ft',
    })
    expect(result.current.summaryVm.trim).toMatchObject({
      visible: true,
      primaryValue: '54',
      primaryUnit: 'LF / EA / SF',
    })
    expect(result.current.saveVm.blockingIssues).toEqual([])
  })
})
