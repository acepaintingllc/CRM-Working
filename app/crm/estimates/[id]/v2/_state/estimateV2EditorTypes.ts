import type { EstimateV2Error } from '@/lib/estimator/errors'
import type { ScopeKind } from '@/lib/estimator/scopeKinds'
import type {
  EstimateV2ConditionLevel,
  EstimateV2ConditionModifier,
  EstimateV2ConditionSelections,
} from '@/lib/estimator/conditionModifiers'
import type {
  EstimateV2CatalogOption,
  EstimateV2CatalogsPayload,
  EstimateV2AccessFeeDraft,
  EstimateV2CeilingScopeDraft,
  EstimateV2CeilingSegmentDraft,
  EstimateV2CustomerDraft,
  EstimateV2DoorScopeDraft,
  EstimateV2DoorTypeOption,
  EstimateV2DrywallRateOption,
  EstimateV2DrywallRepairDraft,
  EstimateV2EstimateMeta,
  EstimateV2JobDefaultProducts,
  EstimateV2JobMeta,
  EstimateV2JobSettingsDraft,
  EstimateV2OtherItemDraft,
  EstimateV2PaintProductOption,
  EstimateV2PricingSummary,
  EstimateV2ProductionRateOption,
  EstimateV2RoomDraft,
  EstimateV2RoomFlagDraft,
  EstimateV2RoomFlagOption,
  EstimateV2RollerDraft,
  EstimateV2TrimScopeDraft,
  EstimateV2TrimTypeOption,
  EstimateV2WallCalculationsPayload,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
  UnsafeRecord,
} from '@/types/estimator/v2'
import type { SaveStatus } from '@/lib/estimator/v2WallsAutosave'
import type { EstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'

export type Unsafe = UnsafeRecord

export type EstimateV2StateUpdater<T> = T | ((prev: T) => T)
export type EstimateV2StateSetter<T> = (value: EstimateV2StateUpdater<T>) => void

export type DirtySource =
  | 'load'
  | 'room'
  | 'room-flags'
  | 'walls'
  | 'ceilings'
  | 'trim'
  | 'doors'
  | 'drywall'
  | 'access-fees'
  | 'other'
  | 'details-overrides'
  | 'job-settings'
  | 'customer'
  | 'save:auto'
  | 'save:manual'

export type NormalizedDomain = ScopeKind

export type EstimateV2EditorDebugMeta = {
  dirtySource: DirtySource | null
  lastSaveTrigger: 'manual' | 'auto' | null
  lastNormalizedDomains: NormalizedDomain[]
}

export type EstimateV2EditorCollections = {
  rooms: EstimateV2RoomDraft[]
  setRooms: EstimateV2StateSetter<EstimateV2RoomDraft[]>
  scopes: EstimateV2WallScopeDraft[]
  setScopes: EstimateV2StateSetter<EstimateV2WallScopeDraft[]>
  segments: EstimateV2WallSegmentDraft[]
  setSegments: EstimateV2StateSetter<EstimateV2WallSegmentDraft[]>
  roomFlags: EstimateV2RoomFlagDraft[]
  setRoomFlags: EstimateV2StateSetter<EstimateV2RoomFlagDraft[]>
  ceilingScopes: EstimateV2CeilingScopeDraft[]
  setCeilingScopes: EstimateV2StateSetter<EstimateV2CeilingScopeDraft[]>
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  setCeilingSegments: EstimateV2StateSetter<EstimateV2CeilingSegmentDraft[]>
  trimScopes: EstimateV2TrimScopeDraft[]
  setTrimScopes: EstimateV2StateSetter<EstimateV2TrimScopeDraft[]>
  doorScopes: EstimateV2DoorScopeDraft[]
  setDoorScopes: EstimateV2StateSetter<EstimateV2DoorScopeDraft[]>
  drywallRepairs: EstimateV2DrywallRepairDraft[]
  setDrywallRepairs: EstimateV2StateSetter<EstimateV2DrywallRepairDraft[]>
  rollers: EstimateV2RollerDraft[]
  setRollers: EstimateV2StateSetter<EstimateV2RollerDraft[]>
  accessFees: EstimateV2AccessFeeDraft[]
  setAccessFees: EstimateV2StateSetter<EstimateV2AccessFeeDraft[]>
  otherItems: EstimateV2OtherItemDraft[]
  setOtherItems: EstimateV2StateSetter<EstimateV2OtherItemDraft[]>
}

export type EstimateV2EditorMetaState = {
  loading: boolean
  setLoading: EstimateV2StateSetter<boolean>
  saving: boolean
  setSaving: EstimateV2StateSetter<boolean>
  estimate: EstimateV2EstimateMeta | null
  setEstimate: EstimateV2StateSetter<EstimateV2EstimateMeta | null>
  job: EstimateV2JobMeta | null
  setJob: EstimateV2StateSetter<EstimateV2JobMeta | null>
  catalogs: EstimateV2CatalogsPayload['catalogs']
  setCatalogs: EstimateV2StateSetter<EstimateV2CatalogsPayload['catalogs']>
  wallCalculations: EstimateV2WallCalculationsPayload | null
  setWallCalculations: EstimateV2StateSetter<EstimateV2WallCalculationsPayload | null>
  ceilingCalculations: Unsafe | null
  setCeilingCalculations: EstimateV2StateSetter<Unsafe | null>
  trimCalculations: Unsafe | null
  setTrimCalculations: EstimateV2StateSetter<Unsafe | null>
  doorCalculations: Unsafe | null
  setDoorCalculations: EstimateV2StateSetter<Unsafe | null>
  drywallCalculations: Unsafe | null
  setDrywallCalculations: EstimateV2StateSetter<Unsafe | null>
  pricingSummary: EstimateV2PricingSummary | null
  setPricingSummary: EstimateV2StateSetter<EstimateV2PricingSummary | null>
  selectedRoomId: string
  setSelectedRoomId: EstimateV2StateSetter<string>
  catalogsError: EstimateV2Error | null
  setCatalogsError: EstimateV2StateSetter<EstimateV2Error | null>
  error: EstimateV2Error | null
  setError: EstimateV2StateSetter<EstimateV2Error | null>
  validationIssues: string[]
  setValidationIssues: EstimateV2StateSetter<string[]>
  lastSavedSnapshot: EstimateV2DirtySnapshot | null
  setLastSavedSnapshot: EstimateV2StateSetter<EstimateV2DirtySnapshot | null>
  saveStatus: SaveStatus
  setSaveStatus: EstimateV2StateSetter<SaveStatus>
  autoSaveHint: string | null
  setAutoSaveHint: EstimateV2StateSetter<string | null>
  settingsOpen: boolean
  setSettingsOpen: EstimateV2StateSetter<boolean>
  jobDefaultsOpen: boolean
  setJobDefaultsOpen: EstimateV2StateSetter<boolean>
  jobSettingsDraft: EstimateV2JobSettingsDraft
  setJobSettingsDraft: EstimateV2StateSetter<EstimateV2JobSettingsDraft>
  orgJobProductDefaults: EstimateV2JobDefaultProducts
  setOrgJobProductDefaults: EstimateV2StateSetter<EstimateV2JobDefaultProducts>
  customerDraft: EstimateV2CustomerDraft
  setCustomerDraft: EstimateV2StateSetter<EstimateV2CustomerDraft>
  debugMeta: EstimateV2EditorDebugMeta
  setDebugMeta: EstimateV2StateSetter<EstimateV2EditorDebugMeta>
}

export type EstimateV2EditorSettingsVm = {
  jobSettingsDraft: EstimateV2JobSettingsDraft
  orgJobProductDefaults: EstimateV2JobDefaultProducts
  customerDraft: EstimateV2CustomerDraft
  settingsOpen: boolean
  setSettingsOpen: EstimateV2StateSetter<boolean>
  jobDefaultsOpen: boolean
  setJobDefaultsOpen: EstimateV2StateSetter<boolean>
  wallPaintOptions: EstimateV2PaintProductOption[]
  wallPrimerOptions: EstimateV2PaintProductOption[]
  ceilingPaintOptions: EstimateV2PaintProductOption[]
  ceilingPrimerOptions: EstimateV2PaintProductOption[]
  trimPaintOptions: EstimateV2PaintProductOption[]
  trimPrimerOptions: EstimateV2PaintProductOption[]
  orgWallPaintLabel: string
  orgWallPrimerLabel: string
  orgCeilingPaintLabel: string
  orgCeilingPrimerLabel: string
  orgTrimPaintLabel: string
  orgTrimPrimerLabel: string
  effectiveWallPaintLabel: string
  effectiveWallPrimerLabel: string
  effectiveCeilingPaintLabel: string
  effectiveCeilingPrimerLabel: string
  effectiveTrimPaintLabel: string
  effectiveTrimPrimerLabel: string
  updateJobSettings: (patch: Partial<EstimateV2JobSettingsDraft>) => void
  updateCustomer: (patch: Partial<EstimateV2CustomerDraft>) => void
  flushCustomerSave: () => void
}

export type EstimateV2EditorSaveVm = {
  dirty: boolean
  canManualSave: boolean
  saveStatus: SaveStatus
  saveStatusText: string
  saveStatusColor: string
  blockedReason: string | null
  blockingIssues: string[]
  calculationsStale: boolean
  debugMeta: EstimateV2EditorDebugMeta & { usingLocalPreview: boolean }
  save: (trigger?: 'manual' | 'auto') => Promise<boolean>
}

export type EstimateV2EditorRoomVm = {
  rooms: EstimateV2RoomDraft[]
  selectedRoomId: string
  setSelectedRoomId: EstimateV2StateSetter<string>
  selectedRoom: EstimateV2RoomDraft | null
  selectedRoomResolvedMode: 'RECT' | 'SEG'
  selectedRoomGeometryMode: 'RECT' | 'SEG'
  roomTypeOptions: EstimateV2CatalogOption[]
  roomTypeCatalogStatus: 'ready' | 'empty' | 'error'
  roomFlags: EstimateV2RoomFlagDraft[]
  roomScopeByRoomId: Map<string, EstimateV2WallScopeDraft[]>
  roomCeilingScopeByRoomId: Map<string, EstimateV2CeilingScopeDraft[]>
  roomTrimScopeByRoomId: Map<string, EstimateV2TrimScopeDraft[]>
  roomDoorScopeByRoomId?: Map<string, EstimateV2DoorScopeDraft[]>
  displayedRoomEffectiveAreaByRoomId: Map<string, number | null>
  selectedRoomEffectiveSqFt: number | null
  activeRoomFlagCount: number
  selectedRoomIssueCount: number
  roomFlagsEnabled: boolean
  roomFlagsCatalog: EstimateV2RoomFlagOption[]
  conditionModifiers?: EstimateV2ConditionModifier[]
  addRoom: () => void
  deleteRoom: (roomId: string) => void
  updateRoom: (roomId: string, patch: Partial<EstimateV2RoomDraft>) => void
  updateRoomComplexity: (roomId: string, wallComplexityId: string) => void
  toggleFlag: (roomId: string, flagId: string) => void
  handleRoomDimChange: (roomId: string, field: 'lengthIn' | 'widthIn' | 'heightIn', value: string) => void
  switchRoomGeometryMode: (roomId: string, nextMode: 'RECT' | 'SEG') => void
  updateSelectedRoom: (patch: Partial<EstimateV2RoomDraft>) => void
  deleteSelectedRoom: () => void
  toggleSelectedRoomFlag: (flagId: string) => void
  updateSelectedRoomDimensions: (field: 'lengthIn' | 'widthIn' | 'heightIn', value: string) => void
  switchSelectedRoomGeometryMode: (nextMode: 'RECT' | 'SEG') => void
  setSelectedRoomCondition?: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => void
}

export type EstimateV2EditorWallsVm = {
  selectedRoom: EstimateV2RoomDraft | null
  selectedRoomGeometryMode: 'RECT' | 'SEG'
  selectedRoomScopes: EstimateV2WallScopeDraft[]
  firstScope: EstimateV2WallScopeDraft | null
  segments: EstimateV2WallSegmentDraft[]
  wallsIncluded: boolean
  wallPaintLabel: string
  wallPrimerLabel: string
  effectiveWallPaintLabel: string
  effectiveWallPrimerLabel: string
  wallPaintOptions: EstimateV2PaintProductOption[]
  wallPrimerOptions: EstimateV2PaintProductOption[]
  wallProductionRates: EstimateV2ProductionRateOption[]
  colorCodeOptions: EstimateV2CatalogOption[]
  displayedSegmentEffectiveAreaById: Map<string, number | null>
  displayedScopeEffectiveAreaById: Map<string, number | null>
  wallScopeEffectiveTotalById: Map<string, number | null>
  selectedRoomWallDrywallRepairs: EstimateV2DrywallRepairDraft[]
  drywallRateOptions: EstimateV2DrywallRateOption[]
  drywallRepairEffectiveQuantityById: Map<string, number | null>
  drywallRepairEffectiveTotalById: Map<string, number | null>
  selectedWallDrywallSubtotal: number | null
  addDrywallRepair: (roomId: string, surface: 'wall' | 'ceiling', repairType: string) => void
  updateDrywallRepair: (repairId: string, patch: Partial<EstimateV2DrywallRepairDraft>) => void
  deleteDrywallRepair: (roomId: string, repairId: string) => void
  addScope: (roomId: string) => void
  moveScope: (roomId: string, scopeId: string, direction: -1 | 1) => void
  deleteScope: (roomId: string, scopeId: string) => void
  updateScope: (scopeId: string, patch: Partial<EstimateV2WallScopeDraft>) => void
  addSegment: (roomId: string, wallScopeId: string) => void
  moveSegment: (wallScopeId: string, segmentId: string, direction: -1 | 1) => void
  deleteSegment: (wallScopeId: string, segmentId: string) => void
  updateSegment: (segmentId: string, patch: Partial<EstimateV2WallSegmentDraft>) => void
  toggleRoomInclude: (roomId: string) => void
  updateRoomComplexity: (roomId: string, wallComplexityId: string) => void
  conditionModifiers?: EstimateV2ConditionModifier[]
  conditionSelections: EstimateV2ConditionSelections
  setSelectedRoomWallCondition?: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => void
}

export type EstimateV2EditorCeilingsVm = {
  catalogs: EstimateV2CatalogsPayload['catalogs']
  selectedRoom: EstimateV2RoomDraft | null
  selectedRoomGeometryMode: 'RECT' | 'SEG'
  selectedRoomCeilingScopes: EstimateV2CeilingScopeDraft[]
  firstCeilingScope: EstimateV2CeilingScopeDraft | null
  ceilingSegments: EstimateV2CeilingSegmentDraft[]
  ceilingsIncluded: boolean
  ceilingPaintLabel: string
  ceilingPrimerLabel: string
  effectiveCeilingPaintLabel: string
  effectiveCeilingPrimerLabel: string
  ceilingPaintOptions: EstimateV2PaintProductOption[]
  ceilingPrimerOptions: EstimateV2PaintProductOption[]
  colorCodeOptions: EstimateV2CatalogOption[]
  selectedCeilingEffectiveSqFt: number | null
  ceilingScopeEffectiveTotalById: Map<string, number | null>
  selectedRoomCeilingDrywallRepairs: EstimateV2DrywallRepairDraft[]
  drywallRateOptions: EstimateV2DrywallRateOption[]
  drywallRepairEffectiveQuantityById: Map<string, number | null>
  drywallRepairEffectiveTotalById: Map<string, number | null>
  selectedCeilingDrywallSubtotal: number | null
  addDrywallRepair: (roomId: string, surface: 'wall' | 'ceiling', repairType: string) => void
  updateDrywallRepair: (repairId: string, patch: Partial<EstimateV2DrywallRepairDraft>) => void
  deleteDrywallRepair: (roomId: string, repairId: string) => void
  updateScope: (scopeId: string, patch: Partial<EstimateV2CeilingScopeDraft>) => void
  addScope: (roomId: string) => void
  deleteScope: (roomId: string, scopeId: string) => void
  moveScope: (roomId: string, scopeId: string, direction: -1 | 1) => void
  addSegment: (roomId: string, ceilingScopeId: string) => void
  deleteSegment: (ceilingScopeId: string, segmentId: string) => void
  moveSegment: (ceilingScopeId: string, segmentId: string, direction: -1 | 1) => void
  updateSegment: (segmentId: string, patch: Partial<EstimateV2CeilingSegmentDraft>) => void
  toggleRoomInclude: (roomId: string) => void
  conditionModifiers?: EstimateV2ConditionModifier[]
  conditionSelections: EstimateV2ConditionSelections
  setSelectedRoomCeilingCondition?: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => void
}

export type EstimateV2EditorTrimVm = {
  selectedRoom: EstimateV2RoomDraft | null
  selectedRoomResolvedMode: 'RECT' | 'SEG'
  selectedRoomTrimScopes: EstimateV2TrimScopeDraft[]
  firstTrimScope: EstimateV2TrimScopeDraft | null
  trimsIncluded: boolean
  jobTrimsIncluded: boolean
  trimPaintLabel: string
  trimPrimerLabel: string
  effectiveTrimPaintLabel: string
  effectiveTrimPrimerLabel: string
  trimPaintOptions: EstimateV2PaintProductOption[]
  trimPrimerOptions: EstimateV2PaintProductOption[]
  trimTypeOptions: EstimateV2TrimTypeOption[]
  trimScopeEffectiveMeasurementById: Map<string, number | null>
  trimScopeEffectiveTotalById: Map<string, number | null>
  selectedTrimSubtotal: number | null
  selectedTrimMeasurement: number | null
  colorCodeOptions: EstimateV2CatalogOption[]
  updateScope: (scopeId: string, patch: Partial<EstimateV2TrimScopeDraft>) => void
  addScope: (roomId: string) => void
  moveScope: (roomId: string, scopeId: string, direction: -1 | 1) => void
  deleteScope: (roomId: string, scopeId: string) => void
  toggleRoomInclude: (roomId: string) => void
  updateTrimType: (scopeId: string, trimTypeId: string) => void
  conditionModifiers?: EstimateV2ConditionModifier[]
  conditionSelections: EstimateV2ConditionSelections
  setSelectedRoomTrimCondition?: (conditionId: string, level: EstimateV2ConditionLevel | 'none') => void
}

export type EstimateV2EditorDoorsVm = {
  selectedRoom: EstimateV2RoomDraft | null
  selectedRoomDoorScopes: EstimateV2DoorScopeDraft[]
  firstDoorScope: EstimateV2DoorScopeDraft | null
  doorsIncluded: boolean
  jobDoorsIncluded: boolean
  doorPaintLabel: string
  doorPrimerLabel: string
  effectiveDoorPaintLabel: string
  effectiveDoorPrimerLabel: string
  doorPaintOptions: EstimateV2PaintProductOption[]
  doorPrimerOptions: EstimateV2PaintProductOption[]
  doorTypeOptions: EstimateV2DoorTypeOption[]
  doorScopeEffectiveUnitsById: Map<string, number | null>
  doorScopeEffectiveTotalById: Map<string, number | null>
  selectedDoorSubtotal: number | null
  selectedDoorUnits: number | null
  colorCodeOptions: EstimateV2CatalogOption[]
  updateScope: (scopeId: string, patch: Partial<EstimateV2DoorScopeDraft>) => void
  addScope: (roomId: string) => void
  moveScope: (roomId: string, scopeId: string, direction: -1 | 1) => void
  deleteScope: (roomId: string, scopeId: string) => void
  toggleRoomInclude: (roomId: string) => void
  updateDoorType: (scopeId: string, doorTypeId: string) => void
}

export type EstimateV2EditorOtherVm = {
  selectedRoom: EstimateV2RoomDraft | null
  selectedRoomItems: EstimateV2OtherItemDraft[]
  jobLevelItems: EstimateV2OtherItemDraft[]
  allItems: EstimateV2OtherItemDraft[]
  selectedRoomSubtotal: number | null
  addItem: (roomId?: string) => void
  updateItem: (itemId: string, patch: Partial<EstimateV2OtherItemDraft>) => void
  duplicateItem: (itemId: string) => void
  deleteItem: (itemId: string) => void
  moveItem: (itemId: string, direction: -1 | 1) => void
}

export type EstimateV2EditorPageVm = {
  loading: boolean
  saving: boolean
  error: EstimateV2Error | null
  validationIssues: string[]
  emptySelectionMessage: string
  roomsCount: number
}

export type EstimateV2EditorHeaderVm = {
  estimateId?: string
  resumeRecord: {
    estimate: EstimateV2EstimateMeta | null
    job: EstimateV2JobMeta | null
  }
  titleText: string
  subtitleText: string
  workflowText: string
  dirtyStateText: string | null
  dirtyStateColor: string | null
  dirty: boolean
  saving: boolean
  settingsOpen: boolean
  toggleSettings: () => void
  addRoom: () => void
}

export type EstimateV2EditorSectionChipVm = {
  label: string
  tone?: 'default' | 'warning'
}

export type EstimateV2EditorSectionSummaryVm = {
  visible: boolean
  title: string
  modeLabel?: string
  primaryValue: string
  primaryUnit: string
  paintLabel: string
  primerLabel: string
  showPrimer?: boolean
  secondaryValue?: string
  secondaryLabel?: string
  chips: EstimateV2EditorSectionChipVm[]
}

export type EstimateV2EditorSummaryVm = {
  roomLabel: string
  roomName: string
  roomSubtitle: string
  includedScopeLabels: string
  scopeToggleLabels: {
    walls: string
    ceilings: string
    trim: string
    doors?: string
  }
  validationText: string
  validationColor: string
  calculationStateText: string
  calculationStateColor: string
  totalEffectiveAreaText: string
  runningTotalLabel: string
  saveStatusText: string
  saveStatusColor: string
  walls: EstimateV2EditorSectionSummaryVm
  ceilings: EstimateV2EditorSectionSummaryVm
  trim: EstimateV2EditorSectionSummaryVm
  doors?: EstimateV2EditorSectionSummaryVm
}
