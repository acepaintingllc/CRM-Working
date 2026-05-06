import type { EstimateV2EditorStoreState } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  EstimateV2AccessFeeDraft,
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DrywallRepairDraft,
  EstimateV2JobSettingsDraft,
  EstimateV2RoomDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '@/types/estimator/v2'

export type EstimateV2CanonicalFixture = {
  scenarioName: string
  scenarioDescription: string
  editorState: EstimateV2EditorStoreState
  expectedTotals: EstimateV2CanonicalExpectedTotals
}

export type EstimateV2CanonicalExpectedTotals = {
  finalTotal: number
  rooms: EstimateV2CanonicalRoomTotal[]
  scopeTotals: {
    walls: EstimateV2CanonicalScopeTotal[]
    ceilings: EstimateV2CanonicalScopeTotal[]
    trim: EstimateV2CanonicalScopeTotal[]
    doors: EstimateV2CanonicalScopeTotal[]
    drywall: EstimateV2CanonicalScopeTotal[]
    accessFees: EstimateV2CanonicalScopeTotal[]
  }
}

export type EstimateV2CanonicalRoomTotal = {
  roomId: string
  total: number
}

export type EstimateV2CanonicalScopeTotal = {
  scopeId: string
  roomId: string
  total: number
}

export const CANONICAL_IDS = {
  products: {
    wallPaint: 'prod-wall-satin',
    wallPrimer: 'prod-wall-primer',
    ceilingPaint: 'prod-ceiling-flat',
    ceilingPrimer: 'prod-ceiling-primer',
    trimPaint: 'prod-trim-enamel',
    trimPrimer: 'prod-trim-primer',
  },
  colors: {
    wallWhite: 'color-wall-white',
    ceilingWhite: 'color-ceiling-white',
    trimWhite: 'color-trim-white',
  },
  rooms: {
    livingRoom: 'R001',
    diningRoom: 'R002',
    bedroom: 'R003',
  },
  rates: {
    wallsStandard: 'rate-walls-standard',
    ceilingsStandard: 'rate-ceilings-standard',
    trimBaseStandard: 'rate-trim-base-standard',
  },
  trimTypes: {
    baseboard: 'trim-baseboard-standard',
  },
  doorTypes: {
    panelDoor: 'door-panel-standard',
  },
  drywallRates: {
    wallPatch: 'patch_opening_repair',
    ceilingPatch: 'ceiling_crack',
  },
  accessFees: {
    ladderSetup: 'access-ladder-setup',
  },
} as const

export function buildCanonicalJobSettings(
  overrides: Partial<EstimateV2JobSettingsDraft> = {}
): EstimateV2JobSettingsDraft {
  return {
    laborDayEnabled: false,
    dayhours: 8,
    roundingIncrementHours: 4,
    laborRate: 60,
    jobMinEnabled: false,
    jobMinAmount: 0,
    crewSize: 1,
    wallPaintProductId: CANONICAL_IDS.products.wallPaint,
    wallPrimerProductId: CANONICAL_IDS.products.wallPrimer,
    ceilingPaintProductId: CANONICAL_IDS.products.ceilingPaint,
    ceilingPrimerProductId: CANONICAL_IDS.products.ceilingPrimer,
    trimPaintProductId: CANONICAL_IDS.products.trimPaint,
    trimPrimerProductId: CANONICAL_IDS.products.trimPrimer,
    standardDoorDeductionSf: 20,
    standardWindowDeductionSf: 10,
    baseboardOpeningDeductionLf: 3,
    ...overrides,
  }
}

export function buildCanonicalEditorState(params: {
  scenarioId: string
  scenarioName: string
  rooms: EstimateV2RoomDraft[]
  wallScopes?: EstimateV2WallScopeDraft[]
  wallSegments?: EstimateV2WallSegmentDraft[]
  ceilingScopes?: EstimateV2CeilingScopeDraft[]
  ceilingSegments?: EstimateV2CeilingSegmentDraft[]
  trimScopes?: EstimateV2TrimScopeDraft[]
  doorScopes?: EstimateV2DoorScopeDraft[]
  drywallRepairs?: EstimateV2DrywallRepairDraft[]
  accessFees?: EstimateV2AccessFeeDraft[]
  jobSettingsDraft?: EstimateV2JobSettingsDraft
}): EstimateV2EditorStoreState {
  return {
    collections: {
      rooms: params.rooms,
      scopes: params.wallScopes ?? [],
      segments: params.wallSegments ?? [],
      roomFlags: [],
      ceilingScopes: params.ceilingScopes ?? [],
      ceilingSegments: params.ceilingSegments ?? [],
      trimScopes: params.trimScopes ?? [],
      doorScopes: params.doorScopes ?? [],
      drywallRepairs: params.drywallRepairs ?? [],
      rollers: [],
      accessFees: params.accessFees ?? [],
      otherItems: [],
    },
    meta: {
      loading: false,
      saving: false,
      estimate: {
        id: `estimate-canonical-${params.scenarioId}`,
        org_id: 'org-canonical',
        job_id: `job-canonical-${params.scenarioId}`,
        version_name: params.scenarioName,
        version_state: 'draft',
        version_kind: 'quote',
        updated_at: '2026-05-05T12:00:00.000Z',
      },
      job: {
        id: `job-canonical-${params.scenarioId}`,
        title: params.scenarioName,
        status: 'open',
        customer_id: 'customer-canonical',
        customer_name: 'Canonical Customer',
        customer_address: '100 Fixture Ave',
        customer_email: 'fixture@example.com',
        customer_phone: '555-0100',
      },
      catalogs: {
        paint_products: [
          {
            id: CANONICAL_IDS.products.wallPaint,
            label: 'Canonical Wall Satin',
            type: 'paint',
            scopes: ['Walls'],
            price_per_gal: 50,
            coverage_sqft_per_gal_per_coat: 400,
          },
          {
            id: CANONICAL_IDS.products.wallPrimer,
            label: 'Canonical Wall Primer',
            type: 'primer',
            scopes: ['Walls'],
            price_per_gal: 16.4,
            coverage_sqft_per_gal_per_coat: 300,
          },
          {
            id: CANONICAL_IDS.products.ceilingPaint,
            label: 'Canonical Ceiling Flat',
            type: 'paint',
            scopes: ['Ceilings'],
            price_per_gal: 48,
            coverage_sqft_per_gal_per_coat: 400,
          },
          {
            id: CANONICAL_IDS.products.ceilingPrimer,
            label: 'Canonical Ceiling Primer',
            type: 'primer',
            scopes: ['Ceilings'],
            price_per_gal: 20,
            coverage_sqft_per_gal_per_coat: 300,
          },
          {
            id: CANONICAL_IDS.products.trimPaint,
            label: 'Canonical Trim Enamel',
            type: 'paint',
            scopes: ['Trim'],
            price_per_gal: 31.32,
            coverage_sqft_per_gal_per_coat: 350,
          },
          {
            id: CANONICAL_IDS.products.trimPrimer,
            label: 'Canonical Trim Primer',
            type: 'primer',
            scopes: ['Trim'],
            price_per_gal: 36.07,
            coverage_sqft_per_gal_per_coat: 300,
          },
        ],
        color_codes: [
          { id: CANONICAL_IDS.colors.wallWhite, label: 'Wall White' },
          { id: CANONICAL_IDS.colors.ceilingWhite, label: 'Ceiling White' },
          { id: CANONICAL_IDS.colors.trimWhite, label: 'Trim White' },
        ],
        production_rates: [
          {
            id: CANONICAL_IDS.rates.wallsStandard,
            label: 'Standard Walls',
            scope_id: 'WALLS',
            surface_type: 'Walls',
            condition: 'Standard',
            prep_sqft_per_hr: null,
            sqft_per_hr: 160,
            primer_sqft_per_hr: 240,
          },
          {
            id: CANONICAL_IDS.rates.ceilingsStandard,
            label: 'Standard Ceilings',
            scope_id: 'CEILINGS',
            surface_type: 'Ceilings',
            condition: 'Standard',
            prep_sqft_per_hr: null,
            sqft_per_hr: 120,
            primer_sqft_per_hr: 240,
          },
          {
            id: 'CEIL_STD',
            label: 'Standard Ceilings Base',
            scope_id: 'CEILINGS',
            surface_type: 'Ceilings',
            condition: 'Standard',
            prep_sqft_per_hr: null,
            sqft_per_hr: 120,
            primer_sqft_per_hr: 240,
          },
          {
            id: CANONICAL_IDS.rates.trimBaseStandard,
            label: 'Standard Baseboard',
            scope_id: CANONICAL_IDS.trimTypes.baseboard,
            surface_type: 'Trim',
            condition: 'Standard',
            prep_sqft_per_hr: null,
            sqft_per_hr: 82,
            primer_sqft_per_hr: 164,
          },
        ],
        height_factors: [],
        room_types: [{ id: 'room-type-living', label: 'Living Room' }],
        room_flags: [],
        supplies_rates: [
          {
            key: 'canonical-walls-area-supplies',
            supply_group: 'area_based',
            scope: 'Walls',
            unit: 'sqft',
            value: 0.08,
            crew_multiplier: 'N',
          },
          {
            key: 'canonical-ceilings-area-supplies',
            supply_group: 'area_based',
            scope: 'Ceilings',
            unit: 'sqft',
            value: 0.15,
            crew_multiplier: 'N',
          },
        ],
        ceiling_types: [{ id: 'ceiling-flat', label: 'Flat', labor_mult: 1, area_factor: 1 }],
        trim_items: [
          {
            id: CANONICAL_IDS.trimTypes.baseboard,
            label: 'Standard Baseboard',
            family: 'BASEBOARD',
            category: 'base',
            unit_type: 'LF',
            helper_allowed: true,
            default_production_rate_id: CANONICAL_IDS.rates.trimBaseStandard,
            trim_category: 'base',
            measurement_class: 'linear',
            picker_group: 'Baseboards',
          },
        ],
        door_types: [
          {
            id: CANONICAL_IDS.doorTypes.panelDoor,
            label: 'Panel Door',
            unit_rate_type: 'interior_panel',
            unit: 'door side',
            default_qty: 1,
            labor_rate: 0.5,
            material_rate: 5,
            amount: 0,
          },
        ],
        drywall_rates: [
          {
            id: CANONICAL_IDS.drywallRates.wallPatch,
            label: 'Wall Patch',
            unit_rate_type: 'patch_opening_repair',
            unit: 'SQFT',
            amount: 12,
            ceiling_multiplier: 1,
          },
          {
            id: CANONICAL_IDS.drywallRates.ceilingPatch,
            label: 'Ceiling Patch',
            unit_rate_type: 'ceiling_crack',
            unit: 'SQFT',
            amount: 15,
            ceiling_multiplier: 1.25,
          },
        ],
        access_fees: [
          {
            id: CANONICAL_IDS.accessFees.ladderSetup,
            label: 'Ladder Setup',
            access_group: 'ladders',
            fee_type: 'flat',
            amount: 75,
            unit: 'EA',
            notes: null,
          },
        ],
        condition_modifiers: [],
      },
      wallCalculations: null,
      ceilingCalculations: null,
      trimCalculations: null,
      doorCalculations: null,
      drywallCalculations: null,
      pricingSummary: null,
      selectedRoomId: params.rooms[0]?.roomId ?? '',
      catalogsError: null,
      error: null,
      validationIssues: [],
      lastSavedSnapshot: null,
      saveStatus: 'idle',
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: false,
      jobSettingsDraft: params.jobSettingsDraft ?? buildCanonicalJobSettings(),
      orgJobProductDefaults: {
        wallPaintProductId: CANONICAL_IDS.products.wallPaint,
        wallPrimerProductId: CANONICAL_IDS.products.wallPrimer,
        ceilingPaintProductId: CANONICAL_IDS.products.ceilingPaint,
        ceilingPrimerProductId: CANONICAL_IDS.products.ceilingPrimer,
        trimPaintProductId: CANONICAL_IDS.products.trimPaint,
        trimPrimerProductId: CANONICAL_IDS.products.trimPrimer,
      },
      customerDraft: {
        customerId: 'customer-canonical',
        name: 'Canonical Customer',
        email: 'fixture@example.com',
        phone: '555-0100',
        address: '100 Fixture Ave',
      },
      debugMeta: {
        dirtySource: null,
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
    },
  }
}

export function room(overrides: Partial<EstimateV2RoomDraft>): EstimateV2RoomDraft {
  return {
    id: `room-${overrides.roomId ?? CANONICAL_IDS.rooms.livingRoom}`,
    roomId: CANONICAL_IDS.rooms.livingRoom,
    roomName: 'Living Room',
    roomTypeId: 'room-type-living',
    lengthIn: '144',
    widthIn: '120',
    heightIn: '108',
    wallComplexityId: CANONICAL_IDS.rates.wallsStandard,
    notes: '',
    position: 0,
    ...overrides,
  }
}

export function wallScope(overrides: Partial<EstimateV2WallScopeDraft>): EstimateV2WallScopeDraft {
  return {
    id: 'wall-scope',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: 'Walls',
    colorId: CANONICAL_IDS.colors.wallWhite,
    paintProductId: CANONICAL_IDS.products.wallPaint,
    primerProductId: CANONICAL_IDS.products.wallPrimer,
    primeMode: 'NONE',
    heightIn: '108',
    perimeterIn: '528',
    standardDoorCount: '1',
    standardWindowCount: '2',
    heightFactor: '1',
    complexityFactor: '1',
    wallFlagFactor: '1',
    cutInTopFactor: '1',
    cutInBottomFactor: '1',
    paintCoats: '2',
    primerCoats: '0',
    spotPrimePercent: '',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...overrides,
  }
}

export function wallSegment(overrides: Partial<EstimateV2WallSegmentDraft>): EstimateV2WallSegmentDraft {
  return {
    id: 'wall-segment',
    wallScopeId: 'wall-scope',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    segmentName: 'Wall segment',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '144',
    heightIn: '108',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '0',
    standardWindowCount: '0',
    overrideAreaSqFt: '',
    notes: '',
    ...overrides,
  }
}

export function ceilingScope(overrides: Partial<EstimateV2CeilingScopeDraft>): EstimateV2CeilingScopeDraft {
  return {
    id: 'ceiling-scope',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: 'Ceiling',
    colorId: CANONICAL_IDS.colors.ceilingWhite,
    paintProductId: CANONICAL_IDS.products.ceilingPaint,
    primerProductId: CANONICAL_IDS.products.ceilingPrimer,
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: 'ceiling-flat',
    ceilingGeometryMode: 'FLAT',
    lengthIn: '144',
    widthIn: '120',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '0',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...overrides,
  }
}

export function ceilingSegment(overrides: Partial<EstimateV2CeilingSegmentDraft>): EstimateV2CeilingSegmentDraft {
  return {
    id: 'ceiling-segment',
    ceilingScopeId: 'ceiling-scope',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    segmentName: 'Ceiling segment',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '144',
    heightIn: '120',
    baseIn: '',
    manualAreaSqFt: '',
    overrideAreaSqFt: '',
    notes: '',
    ...overrides,
  }
}

export function trimScope(overrides: Partial<EstimateV2TrimScopeDraft>): EstimateV2TrimScopeDraft {
  return {
    id: 'trim-scope',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    include: 'Y',
    scopeName: 'Baseboards',
    trimTypeId: CANONICAL_IDS.trimTypes.baseboard,
    trimFamily: 'BASEBOARD',
    unitType: 'LF',
    measurementMode: 'ROOM_HELPER',
    helperSource: 'ROOM_PERIMETER',
    measurementValue: '',
    helperValue: '44',
    baseboardOpeningCount: '1',
    colorId: CANONICAL_IDS.colors.trimWhite,
    paintProductId: CANONICAL_IDS.products.trimPaint,
    primerProductId: CANONICAL_IDS.products.trimPrimer,
    paintEnabled: 'Y',
    primeMode: 'NONE',
    spotPrimePercent: '',
    productionRateId: CANONICAL_IDS.rates.trimBaseStandard,
    prepFactor: '1',
    heightFactor: '1',
    profileFactor: '1',
    roomFlagFactor: '1',
    maskingFactor: '1',
    stairFactor: '1',
    difficultFinishFactor: '1',
    caulkFillFactor: '1',
    paintCoats: '2',
    primerCoats: '0',
    overrideMeasurement: '',
    overrideHours: '',
    overrideGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    overrideDescription: '',
    notes: '',
    ...overrides,
  }
}

export function doorScope(overrides: Partial<EstimateV2DoorScopeDraft>): EstimateV2DoorScopeDraft {
  return {
    id: 'door-scope',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    include: 'Y',
    scopeName: 'Panel Door',
    doorTypeId: CANONICAL_IDS.doorTypes.panelDoor,
    quantity: '1',
    sides: '2',
    colorId: CANONICAL_IDS.colors.trimWhite,
    paintProductId: CANONICAL_IDS.products.trimPaint,
    primerProductId: CANONICAL_IDS.products.trimPrimer,
    primeMode: 'NONE',
    spotPrimePercent: '',
    paintCoats: '2',
    primerCoats: '0',
    conditionFactor: '1',
    laborRate: '',
    materialRate: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overrideMaterialCost: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...overrides,
  }
}

export function drywallRepair(overrides: Partial<EstimateV2DrywallRepairDraft>): EstimateV2DrywallRepairDraft {
  return {
    id: 'drywall-repair',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    position: 0,
    surface: 'wall',
    repairType: CANONICAL_IDS.drywallRates.wallPatch,
    unit: 'SQFT',
    quantity: '1',
    overrideTotal: '',
    ...overrides,
  }
}

export function accessFee(overrides: Partial<EstimateV2AccessFeeDraft>): EstimateV2AccessFeeDraft {
  return {
    id: 'access-fee',
    roomId: CANONICAL_IDS.rooms.livingRoom,
    accessFeeId: CANONICAL_IDS.accessFees.ladderSetup,
    qty: '1',
    actualCostOverride: '',
    notes: '',
    position: 0,
    ...overrides,
  }
}
