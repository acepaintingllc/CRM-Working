import type { YN } from '@/types/estimator/core'
import type { EstimateV2ConditionSelections as EstimateV2LegacyConditionSelections } from '@/lib/estimator/conditionModifiers'
import type { UnsafeRecord } from './v2Meta'
import type { EstimateV2RoomTotal } from './v2Rooms'

// Per-scope types — draft shapes and mode enums for wall, ceiling, trim, door, drywall,
// other, access fee, and prejob scopes; plus wall calculation trace types

export type EstimateV2WallScopeTrace = {
  scope_id: string | null
  area: {
    effective_area_sf: number | null
  }
}

export type EstimateV2WallCalculationsPayload = {
  scopes?: UnsafeRecord[]
  segments?: UnsafeRecord[]
  room_totals?: EstimateV2RoomTotal[]
  scope_traces?: EstimateV2WallScopeTrace[]
}

export type EstimateV2AccessFeeDraft = {
  id: string
  roomId: string
  accessFeeId: string
  qty: string
  actualCostOverride: string
  notes: string
  position: number
}

export type EstimateV2PrejobTripDraft = {
  id: string
  roomId: string
  tripName: string
  tripCount: string
  tripRate: string
  manualAdjustment: string
  notes: string
  position: number
  include: YN
}

export type EstimateV2WallScopeMode = 'RECT' | 'SEG'
export type EstimateV2WallPrimeMode = 'NONE' | 'SPOT' | 'FULL'
export type EstimateV2WallSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'

export type EstimateV2WallScopeDraft = {
  id: string
  roomId: string
  position: number
  mode: EstimateV2WallScopeMode
  include: YN
  scopeName: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: EstimateV2WallPrimeMode
  heightIn: string
  perimeterIn: string
  standardDoorCount: string
  standardWindowCount: string
  heightFactor: string
  complexityFactor: string
  wallFlagFactor: string
  cutInTopFactor: string
  cutInBottomFactor: string
  paintCoats: string
  primerCoats: string
  spotPrimePercent: string
  overrideAreaSqFt: string
  overridePaintHours: string
  overridePrimerHours: string
  overridePaintGallons: string
  overridePrimerGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2WallSegmentDraft = {
  id: string
  wallScopeId: string
  roomId: string
  position: number
  segmentName: string
  include: YN
  shapeType: EstimateV2WallSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  standardDoorCount: string
  standardWindowCount: string
  overrideAreaSqFt: string
  notes: string
}

export type EstimateV2WallSegmentDerived = {
  rawArea: number | null
  deductionArea: number
  deductionAdjustedArea: number | null
  effectiveArea: number | null
}

export type EstimateV2WallScopeDerived = {
  rawArea: number | null
  effectiveArea: number | null
}

export type EstimateV2CeilingScopeMode = 'RECT' | 'SEG'
export type EstimateV2CeilingPrimeMode = 'NONE' | 'SPOT' | 'FULL'
export type EstimateV2CeilingSegmentShape = 'RECTANGLE' | 'TRIANGLE' | 'MANUAL'
export type EstimateV2CeilingGeometryMode = 'FLAT' | 'VAULTED' | 'TRAY' | 'COFFERED' | 'MANUAL'

export type EstimateV2CeilingScopeDraft = {
  id: string
  roomId: string
  position: number
  mode: EstimateV2CeilingScopeMode
  include: YN
  scopeName: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: EstimateV2CeilingPrimeMode
  spotPrimePercent: string
  ceilingTypeId: string
  ceilingGeometryMode?: EstimateV2CeilingGeometryMode
  vaultedAreaFactor?: string
  vaultedRidgeLengthIn?: string
  vaultedSlopeLengthIn?: string
  vaultedPlaneCount?: string
  trayPerimeterIn?: string
  trayStepHeightIn?: string
  trayBandWidthIn?: string
  cofferSectionLengthIn?: string
  cofferSectionWidthIn?: string
  cofferSectionCount?: string
  cofferFaceHeightIn?: string
  cofferBottomWidthIn?: string
  lengthIn: string
  widthIn: string
  areaSf: string
  heightFactor: string
  complexityFactor: string
  ceilingFlagFactor: string
  paintCoats: string
  primerCoats: string
  overrideAreaSqFt: string
  overridePaintHours: string
  overridePrimerHours: string
  overridePaintGallons: string
  overridePrimerGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2CeilingSegmentDraft = {
  id: string
  ceilingScopeId: string
  roomId: string
  position: number
  segmentName: string
  include: YN
  shapeType: EstimateV2CeilingSegmentShape
  quantity: string
  widthIn: string
  heightIn: string
  baseIn: string
  manualAreaSqFt: string
  overrideAreaSqFt: string
  notes: string
}

export type EstimateV2TrimUnitType = 'LF' | 'EA' | 'SF'
export type EstimateV2TrimMeasurementMode = 'MANUAL' | 'ROOM_HELPER'

export type EstimateV2TrimScopeDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  scopeName: string
  trimTypeId: string
  trimFamily: string
  unitType: EstimateV2TrimUnitType
  measurementMode: EstimateV2TrimMeasurementMode
  helperSource: 'ROOM_PERIMETER' | ''
  measurementValue: string
  helperValue: string
  baseboardOpeningCount: string
  colorId: string
  paintProductId: string
  primerProductId: string
  paintEnabled: YN
  primeMode: 'NONE' | 'SPOT' | 'FULL'
  spotPrimePercent: string
  productionRateId: string
  prepFactor: string
  heightFactor: string
  profileFactor: string
  roomFlagFactor: string
  maskingFactor: string
  stairFactor: string
  difficultFinishFactor: string
  caulkFillFactor: string
  paintCoats: string
  primerCoats: string
  overrideMeasurement: string
  overrideHours: string
  overrideGallons: string
  overrideSupplyCost: string
  overrideTotal: string
  overrideDescription: string
  notes: string
  conditionSelections?: EstimateV2LegacyConditionSelections
}

export type EstimateV2DoorScopeDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  scopeName: string
  doorTypeId: string
  quantity: string
  sides: string
  colorId: string
  paintProductId: string
  primerProductId: string
  primeMode: 'NONE' | 'SPOT' | 'FULL'
  spotPrimePercent: string
  paintCoats: string
  primerCoats: string
  conditionFactor: string
  laborRate: string
  materialRate: string
  overridePaintHours: string
  overridePrimerHours: string
  overrideMaterialCost: string
  overrideSupplyCost: string
  overrideTotal: string
  notes: string
}

export type EstimateV2DrywallRepairDraft = {
  id: string
  roomId: string
  position: number
  include?: YN
  active?: YN
  surface: 'wall' | 'ceiling'
  repairType: string
  unit: 'LF' | 'SQFT'
  quantity: string
  overrideTotal: string
}

export type EstimateV2OtherPricingMode = 'fixed' | 'quantity_rate' | 'labor' | 'material_supply'
export type EstimateV2OtherRollupTarget =
  | 'other'
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'room_total'
  | 'job_total'
export type EstimateV2OtherCustomerVisibility = 'standalone' | 'rollup'

export type EstimateV2OtherItemDraft = {
  id: string
  roomId: string
  position: number
  include: YN
  description: string
  customerLabel: string
  pricingMode: EstimateV2OtherPricingMode
  quantity: string
  unitRate: string
  laborHours: string
  laborRate: string
  materialCost: string
  supplyCost: string
  fixedAmount: string
  rollupTarget: EstimateV2OtherRollupTarget
  customerVisibility: EstimateV2OtherCustomerVisibility
  internalNotes: string
}
