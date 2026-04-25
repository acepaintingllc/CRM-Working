import { buildEstimateV2SavePayload } from '../v2DraftPayload.ts'
import { createEstimateV2DirtySnapshot, type EstimateV2DirtySnapshot } from '../../../app/crm/estimates/[id]/v2/_state/estimateV2DirtySnapshot'
import type {
  EstimateV2Catalogs,
  EstimateV2EstimateMeta,
  EstimateV2JobDefaultProducts,
  EstimateV2JobMeta,
  EstimateV2JobSettingsDraft,
  EstimateV2PricingSummary,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2RollerDraft,
  EstimateV2SummaryPageData,
  EstimateV2TrimPaint,
  EstimateV2TrimScopeDraft,
  EstimateV2WallCalculationsPayload,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
} from '../../../types/estimator/v2.ts'

type MixedEstimateFixture = {
  estimate: EstimateV2EstimateMeta
  job: EstimateV2JobMeta
  catalogs: EstimateV2Catalogs
  jobSettingsDraft: EstimateV2JobSettingsDraft
  orgJobProductDefaults: EstimateV2JobDefaultProducts
  rooms: EstimateV2RoomDraft[]
  roomFlags: EstimateV2RoomFlagDraft[]
  rollers: EstimateV2RollerDraft[]
  scopes: EstimateV2WallScopeDraft[]
  segments: EstimateV2WallSegmentDraft[]
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  trimScopes: EstimateV2TrimScopeDraft[]
  wallCalculations: EstimateV2WallCalculationsPayload
  ceilingCalculations: Record<string, unknown>
  trimCalculations: Record<string, unknown>
  pricingSummary: EstimateV2PricingSummary
  trimPaint: EstimateV2TrimPaint
  summaryData: EstimateV2SummaryPageData
  currentSnapshot: EstimateV2DirtySnapshot
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createMixedEstimateV2Fixture(): MixedEstimateFixture {
  const estimate: EstimateV2EstimateMeta = {
    id: 'estimate-v2-mixed',
    job_id: 'job-1',
    version_name: 'Mixed Estimate',
    version_state: 'Draft',
    updated_at: '2026-04-21T14:00:00.000Z',
  }

  const job: EstimateV2JobMeta = {
    id: 'job-1',
    title: 'Interior Refresh',
    status: 'open',
    customer_id: 'customer-1',
    customer_name: 'Ada Lovelace',
    customer_address: '123 Main St',
    customer_email: 'ada@example.com',
    customer_phone: '555-0100',
  }

  const catalogs: EstimateV2Catalogs = {
    paint_products: [
      { id: 'P-WALL', label: 'Wall Satin', type: 'paint', scopes: ['Walls'] },
      { id: 'P-PRIMER', label: 'Wall Primer', type: 'primer', scopes: ['Walls'] },
      { id: 'P-CEIL', label: 'Ceiling Flat', type: 'paint', scopes: ['Ceilings'] },
      { id: 'P-CEIL-PRIMER', label: 'Ceiling Primer', type: 'primer', scopes: ['Ceilings'] },
      { id: 'P-TRIM', label: 'Trim Enamel', type: 'paint', scopes: ['Trim'] },
      { id: 'P-TRIM-PRIMER', label: 'Trim Primer', type: 'primer', scopes: ['Trim'] },
    ],
    color_codes: [
      { id: 'COLOR1', label: 'Warm White' },
      { id: 'COLOR2', label: 'Graphite' },
      { id: 'COLOR3', label: 'Trim White' },
    ],
    production_rates: [
      {
        id: 'RATE-STD',
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
        scope_id: 'TRIM',
        surface_type: 'BASE',
        condition: 'Baseboard',
        prep_sqft_per_hr: null,
        sqft_per_hr: 50,
        primer_sqft_per_hr: 80,
      },
    ],
    height_factors: [
      {
        id: 'HEIGHT-STD',
        label: '0-10 ft',
        min_height_ft: 0,
        max_height_ft: 10,
        labor_multiplier: 1,
      },
      {
        id: 'HEIGHT-TALL',
        label: '10+ ft',
        min_height_ft: 10,
        max_height_ft: null,
        labor_multiplier: 1.15,
      },
    ],
    room_types: [
      { id: 'BEDROOM', label: 'Bedroom' },
      { id: 'KITCHEN', label: 'Kitchen' },
    ],
    room_flags: [{ id: 'FLAG-HIGH', label: 'High traffic', wall_factor: 1.1, ceil_factor: 1, trim_factor: 1.05 }],
    ceiling_types: [{ id: 'CEIL-FLAT', label: 'Flat ceiling', labor_mult: 1 }],
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
    laborDayEnabled: true,
    dayhours: 8,
    roundingIncrementHours: 4,
    laborRate: 62.5,
    jobMinEnabled: true,
    jobMinAmount: 400,
    wallPaintProductId: 'P-WALL',
    wallPrimerProductId: 'P-PRIMER',
    ceilingPaintProductId: 'P-CEIL',
    ceilingPrimerProductId: 'P-CEIL-PRIMER',
    trimPaintProductId: 'P-TRIM',
    trimPrimerProductId: 'P-TRIM-PRIMER',
  }

  const orgJobProductDefaults: EstimateV2JobDefaultProducts = {
    wallPaintProductId: 'P-WALL',
    wallPrimerProductId: 'P-PRIMER',
    ceilingPaintProductId: 'P-CEIL',
    ceilingPrimerProductId: 'P-CEIL-PRIMER',
    trimPaintProductId: 'P-TRIM',
    trimPrimerProductId: 'P-TRIM-PRIMER',
  }

  const rooms: EstimateV2RoomDraft[] = [
    {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: 'BEDROOM',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: 'RATE-STD',
      notes: '',
      position: 0,
    },
    {
      id: 'room-2',
      roomId: 'R002',
      roomName: 'Kitchen',
      roomTypeId: 'KITCHEN',
      lengthIn: '96',
      widthIn: '120',
      heightIn: '96',
      wallComplexityId: 'RATE-STD',
      notes: '',
      position: 1,
    },
  ]

  const roomFlags: EstimateV2RoomFlagDraft[] = [
    { id: 'room-flag-1', roomId: 'R002', flagId: 'FLAG-HIGH', position: 0 },
  ]

  const rollers: EstimateV2RollerDraft[] = [
    {
      id: 'roller-wall-color-1',
      scope: 'Wall',
      wallColorId: 'COLOR1',
      rollerSizeIn: '9',
      coversQty: '2',
      notes: 'Main wall roller',
      position: 0,
    },
  ]

  const scopes: EstimateV2WallScopeDraft[] = [
    {
      id: 'wall-r001-main',
      roomId: 'R001',
      position: 0,
      mode: 'RECT',
      include: 'Y',
      scopeName: 'Living Room Walls',
      colorId: 'COLOR1',
      paintProductId: 'P-WALL',
      primerProductId: 'P-PRIMER',
      primeMode: 'FULL',
      heightIn: '108',
      perimeterIn: '528',
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
      id: 'wall-r002-main',
      roomId: 'R002',
      position: 0,
      mode: 'SEG',
      include: 'Y',
      scopeName: 'Kitchen Angles',
      colorId: 'COLOR2',
      paintProductId: '',
      primerProductId: '',
      primeMode: 'NONE',
      heightIn: '96',
      perimeterIn: '',
      standardDoorCount: '',
      standardWindowCount: '',
      heightFactor: '1',
      complexityFactor: '1',
      wallFlagFactor: '1.1',
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
      id: 'wall-r002-excluded',
      roomId: 'R002',
      position: 1,
      mode: 'SEG',
      include: 'N',
      scopeName: 'Back Wall',
      colorId: 'COLOR2',
      paintProductId: 'P-WALL',
      primerProductId: '',
      primeMode: 'NONE',
      heightIn: '96',
      perimeterIn: '',
      standardDoorCount: '',
      standardWindowCount: '',
      heightFactor: '1',
      complexityFactor: '1',
      wallFlagFactor: '1.1',
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

  const segments: EstimateV2WallSegmentDraft[] = [
    {
      id: 'wall-seg-r002-1',
      wallScopeId: 'wall-r002-main',
      roomId: 'R002',
      position: 0,
      segmentName: 'North rectangle',
      include: 'Y',
      shapeType: 'RECTANGLE',
      quantity: '1',
      widthIn: '96',
      heightIn: '96',
      baseIn: '',
      manualAreaSqFt: '',
      standardDoorCount: '0',
      standardWindowCount: '0',
      overrideAreaSqFt: '',
      notes: '',
    },
    {
      id: 'wall-seg-r002-2',
      wallScopeId: 'wall-r002-main',
      roomId: 'R002',
      position: 1,
      segmentName: 'Soffit triangle',
      include: 'Y',
      shapeType: 'TRIANGLE',
      quantity: '1',
      widthIn: '',
      heightIn: '96',
      baseIn: '48',
      manualAreaSqFt: '',
      standardDoorCount: '0',
      standardWindowCount: '0',
      overrideAreaSqFt: '',
      notes: '',
    },
    {
      id: 'wall-seg-r002-3',
      wallScopeId: 'wall-r002-excluded',
      roomId: 'R002',
      position: 0,
      segmentName: 'Excluded manual wall',
      include: 'Y',
      shapeType: 'MANUAL',
      quantity: '1',
      widthIn: '',
      heightIn: '',
      baseIn: '',
      manualAreaSqFt: '40',
      standardDoorCount: '0',
      standardWindowCount: '0',
      overrideAreaSqFt: '',
      notes: '',
    },
  ]

  const ceilingScopes: EstimateV2CeilingScopeDraft[] = [
    {
      id: 'ceiling-r001-main',
      roomId: 'R001',
      position: 0,
      mode: 'RECT',
      include: 'Y',
      scopeName: 'Living Ceiling',
      colorId: 'COLOR1',
      paintProductId: 'P-CEIL',
      primerProductId: 'P-CEIL-PRIMER',
      primeMode: 'NONE',
      spotPrimePercent: '',
      ceilingTypeId: 'CEIL-FLAT',
      lengthIn: '120',
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
      id: 'ceiling-r002-main',
      roomId: 'R002',
      position: 0,
      mode: 'SEG',
      include: 'Y',
      scopeName: 'Kitchen Tray',
      colorId: 'COLOR2',
      paintProductId: '',
      primerProductId: '',
      primeMode: 'SPOT',
      spotPrimePercent: '20',
      ceilingTypeId: 'CEIL-FLAT',
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
      id: 'ceiling-seg-r002-1',
      ceilingScopeId: 'ceiling-r002-main',
      roomId: 'R002',
      position: 0,
      segmentName: 'Manual tray',
      include: 'Y',
      shapeType: 'MANUAL',
      quantity: '1',
      widthIn: '',
      heightIn: '',
      baseIn: '',
      manualAreaSqFt: '60',
      overrideAreaSqFt: '',
      notes: '',
    },
  ]

  const trimScopes: EstimateV2TrimScopeDraft[] = [
    {
      id: 'trim-r001-main',
      roomId: 'R001',
      position: 0,
      include: 'Y',
      scopeName: 'Baseboards',
      trimTypeId: 'TRIM-BASE',
      trimFamily: 'BASE',
      unitType: 'LF',
      measurementMode: 'ROOM_HELPER',
      helperSource: 'ROOM_PERIMETER',
      measurementValue: '',
      helperValue: '44',
      colorId: 'COLOR3',
      paintProductId: 'P-TRIM',
      primerProductId: 'P-TRIM-PRIMER',
      paintEnabled: 'Y',
      primeMode: 'SPOT',
      spotPrimePercent: '20',
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
      overrideHours: '2',
      overrideGallons: '',
      overrideSupplyCost: '',
      overrideTotal: '210',
      overrideDescription: 'Manual trim adjustment',
      notes: '',
    },
    {
      id: 'trim-r002-excluded',
      roomId: 'R002',
      position: 0,
      include: 'N',
      scopeName: 'Window Trim',
      trimTypeId: 'TRIM-BASE',
      trimFamily: 'BASE',
      unitType: 'LF',
      measurementMode: 'MANUAL',
      helperSource: '',
      measurementValue: '12',
      helperValue: '',
      colorId: 'COLOR3',
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
  ]

  const payload = buildEstimateV2SavePayload(
    rooms,
    scopes,
    segments,
    roomFlags,
    rollers,
    ceilingScopes,
    ceilingSegments,
    trimScopes
  )

  const wallCalculations: EstimateV2WallCalculationsPayload = {
    scopes: payload.room_wall_scopes.map((scope) => {
      const id = String(scope.id)
      if (id === 'wall-r001-main') {
        return {
          ...scope,
          effective_area_sf: 396,
          effective_paint_hours: 5,
          effective_primer_hours: 2,
          effective_supply_cost: 50,
          effective_total: 700,
          paint_product_label: 'Wall Satin',
        }
      }
      if (id === 'wall-r002-main') {
        return {
          ...scope,
          effective_area_sf: 80,
          effective_paint_hours: 2,
          effective_primer_hours: 0,
          effective_supply_cost: 20,
          effective_total: 220,
          paint_product_id: null,
          paint_product_label: null,
        }
      }
      return {
        ...scope,
        effective_area_sf: 40,
        effective_paint_hours: 0.5,
        effective_primer_hours: 0,
        effective_supply_cost: 10,
        effective_total: 80,
      }
    }),
    segments: payload.wall_segments.map((segment) => {
      const id = String(segment.id)
      return {
        ...segment,
        effective_area_sf:
          id === 'wall-seg-r002-1' ? 64 : id === 'wall-seg-r002-2' ? 16 : 40,
      }
    }),
    room_totals: [
      { room_id: 'R001', effective_area_sf: 396, effective_total: 700 },
      { room_id: 'R002', effective_area_sf: 80, effective_total: 220 },
    ],
    scope_traces: [
      { scope_id: 'wall-r001-main', area: { effective_area_sf: 396 } },
      { scope_id: 'wall-r002-main', area: { effective_area_sf: 80 } },
      { scope_id: 'wall-r002-excluded', area: { effective_area_sf: 40 } },
    ],
  }

  const ceilingCalculations = {
    scopes: [
      {
        ...payload.room_ceiling_scopes[0],
        effective_area_sf: 120,
        effective_paint_hours: 1.5,
        effective_primer_hours: 0.5,
        effective_supply_cost: 20,
        effective_total: 180,
        paint_product_label: 'Ceiling Flat',
      },
      {
        ...payload.room_ceiling_scopes[1],
        effective_area_sf: 60,
        effective_paint_hours: 1,
        effective_primer_hours: 0,
        effective_supply_cost: 10,
        effective_total: 90,
        paint_product_id: null,
        paint_product_label: 'Ceiling White',
      },
    ],
    segments: [
      {
        ...payload.ceiling_scope_segments[0],
        effective_area_sf: 60,
      },
    ],
    room_totals: [
      { room_id: 'R001', effective_area_sf: 120, effective_total: 180 },
      { room_id: 'R002', effective_area_sf: 60, effective_total: 90 },
    ],
  }

  const trimCalculations = {
    scopes: [
      {
        ...payload.room_trim_scopes[0],
        effective_measurement: 44,
        effective_paint_hours: 2,
        effective_primer_hours: 0.5,
        effective_supply_cost: 20,
        effective_total: 210,
        paint_product_label: 'Trim Enamel',
      },
      {
        ...payload.room_trim_scopes[1],
        effective_measurement: 12,
        effective_paint_hours: 0.5,
        effective_primer_hours: 0,
        effective_supply_cost: 6,
        effective_total: 60,
      },
    ],
    room_totals: [
      { room_id: 'R001', effective_area_sf: 44, effective_total: 210 },
      { room_id: 'R002', effective_area_sf: 12, effective_total: 60 },
    ],
  }

  const trimPaint: EstimateV2TrimPaint = {
    paint_product_id: 'P-TRIM',
    paint_product_label: 'Trim Enamel',
    gallons: 2,
    quarts: 0,
    normalized_gallons: 2,
    paint_cost: 40,
  }

  const pricingSummary: EstimateV2PricingSummary = {
    rawLaborHours: 12.5,
    rawLaborDays: 1.56,
    effectiveLaborDays: 1.75,
    effectiveLaborHours: 14,
    laborCost: 700,
    wallPaintMaterialCost: 150,
    ceilingPaintMaterialCost: 50,
    trimPaintMaterialCost: 40,
    paintMaterialCost: 240,
    primerMaterialCost: 60,
    supplyCost: 50,
    prePolicyTotal: 1365,
    postLaborPolicyTotal: 1380,
    minimumAdjustmentAmount: 20,
    finalTotal: 1400,
    rooms: [
      { room_id: 'R001', baseTotal: 1080, allocatedMinimumAdjustment: 10, finalTotal: 1090 },
      { room_id: 'R002', baseTotal: 300, allocatedMinimumAdjustment: 10, finalTotal: 310 },
    ],
    trimPaint,
  }

  const summaryData: EstimateV2SummaryPageData = {
    estimate,
    inputs: {
      rooms: payload.rooms,
      room_flags: payload.room_flags,
      room_wall_scopes: payload.room_wall_scopes,
      room_ceiling_scopes: payload.room_ceiling_scopes,
      room_trim_scopes: payload.room_trim_scopes,
      paint_products: catalogs.paint_products,
      jobsettings: { override_labor_rate: null },
      org_defaults: null,
    },
    wall_calculations: {
      scopes: clone(wallCalculations.scopes ?? []),
      room_totals: clone(wallCalculations.room_totals ?? []),
    },
    ceiling_calculations: clone(ceilingCalculations),
    trim_calculations: clone(trimCalculations),
    trim_paint: clone(trimPaint),
    pricing_summary: clone(pricingSummary),
  }

  const currentSnapshot = createEstimateV2DirtySnapshot(payload)

  return {
    estimate: clone(estimate),
    job: clone(job),
    catalogs: clone(catalogs),
    jobSettingsDraft: clone(jobSettingsDraft),
    orgJobProductDefaults: clone(orgJobProductDefaults),
    rooms: clone(rooms),
    roomFlags: clone(roomFlags),
    rollers: clone(rollers),
    scopes: clone(scopes),
    segments: clone(segments),
    ceilingScopes: clone(ceilingScopes),
    ceilingSegments: clone(ceilingSegments),
    trimScopes: clone(trimScopes),
    wallCalculations: clone(wallCalculations),
    ceilingCalculations: clone(ceilingCalculations),
    trimCalculations: clone(trimCalculations),
    pricingSummary: clone(pricingSummary),
    trimPaint: clone(trimPaint),
    summaryData: clone(summaryData),
    currentSnapshot,
  }
}
