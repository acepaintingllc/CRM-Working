import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEstimateV2EditorState } from '../useEstimateV2EditorState'

const roomActions = {
  addRoom: vi.fn(),
  deleteRoom: vi.fn(),
  updateRoom: vi.fn(),
  updateRoomComplexity: vi.fn(),
  toggleFlag: vi.fn(),
  handleRoomDimChange: vi.fn(),
  switchRoomGeometryMode: vi.fn(),
}

const wallActions = {
  addScope: vi.fn(),
  moveScope: vi.fn(),
  deleteScope: vi.fn(),
  updateScope: vi.fn(),
  addSegment: vi.fn(),
  moveSegment: vi.fn(),
  deleteSegment: vi.fn(),
  updateSegment: vi.fn(),
  toggleRoomInclude: vi.fn(),
}

const ceilingActions = {
  updateScope: vi.fn(),
  addScope: vi.fn(),
  deleteScope: vi.fn(),
  moveScope: vi.fn(),
  addSegment: vi.fn(),
  deleteSegment: vi.fn(),
  moveSegment: vi.fn(),
  updateSegment: vi.fn(),
  toggleRoomInclude: vi.fn(),
}

const trimActions = {
  updateScope: vi.fn(),
  addScope: vi.fn(),
  moveScope: vi.fn(),
  deleteScope: vi.fn(),
  toggleRoomInclude: vi.fn(),
  updateTrimType: vi.fn(),
}

const settingsActions = {
  updateJobSettings: vi.fn(),
  updateCustomer: vi.fn(),
  flushCustomerSave: vi.fn(),
}

const saveController = {
  save: vi.fn(async () => true),
}

vi.mock('../useEstimateV2DerivedState', () => ({
  useEstimateV2DerivedState: () => ({
    trimTypeOptions: [{ id: 'TRIM-1', label: 'Baseboard', family: 'BASE', category: 'Base', unit_type: 'LF', helper_allowed: true, default_production_rate_id: null }],
    defaultColorCodeId: 'COLOR1',
    roomModeById: new Map([['R001', 'RECT']]),
    selectedRoom: {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: 'RATE1',
      notes: '',
      position: 0,
    },
    selectedRoomResolvedMode: 'RECT',
    selectedRoomGeometryMode: 'RECT',
    roomTypeOptions: [{ id: 'TYPE1', label: 'Bedroom' }],
    roomScopeByRoomId: new Map([['R001', [{ id: 'scope-1', roomId: 'R001', position: 0, mode: 'RECT', include: 'Y' }]]]),
    roomCeilingScopeByRoomId: new Map([['R001', [{ id: 'ceiling-1', roomId: 'R001', position: 0, mode: 'RECT', include: 'Y' }]]]),
    roomTrimScopeByRoomId: new Map([['R001', [{ id: 'trim-1', roomId: 'R001', position: 0, include: 'Y' }]]]),
    displayedRoomEffectiveAreaByRoomId: new Map([['R001', 220]]),
    selectedRoomEffectiveSqFt: 220,
    activeRoomFlagCount: 1,
    selectedRoomIssueCount: 2,
    selectedRoomScopes: [],
    firstScope: null,
    wallsIncluded: true,
    wallPaintLabel: 'Wall Paint',
    wallPrimerLabel: 'Wall Primer',
    effectiveWallPaintLabel: 'Wall Paint',
    effectiveWallPrimerLabel: 'Wall Primer',
    wallPaintOptions: [],
    wallPrimerOptions: [],
    wallProductionRates: [],
    colorCodeOptions: [{ id: 'COLOR1', label: 'Default' }],
    displayedSegmentEffectiveAreaById: new Map(),
    displayedScopeEffectiveAreaById: new Map(),
    selectedRoomCeilingScopes: [],
    firstCeilingScope: null,
    ceilingsIncluded: true,
    ceilingPaintLabel: 'Ceiling Paint',
    ceilingPrimerLabel: 'Ceiling Primer',
    effectiveCeilingPaintLabel: 'Ceiling Paint',
    effectiveCeilingPrimerLabel: 'Ceiling Primer',
    ceilingPaintOptions: [],
    ceilingPrimerOptions: [],
    selectedCeilingEffectiveSqFt: 144,
    selectedRoomTrimScopes: [{ id: 'trim-1', roomId: 'R001', position: 0, include: 'Y', scopeName: 'Baseboard', trimTypeId: 'TRIM-1', trimFamily: 'BASE', unitType: 'LF', measurementMode: 'MANUAL', helperSource: '', measurementValue: '24', helperValue: '', colorId: 'COLOR1', paintProductId: '', primerProductId: '', paintEnabled: 'Y', primeMode: 'NONE', spotPrimePercent: '', productionRateId: '', prepFactor: '1', heightFactor: '1', profileFactor: '1', roomFlagFactor: '1.1', maskingFactor: '1', stairFactor: '1', difficultFinishFactor: '1', caulkFillFactor: '1', paintCoats: '2', primerCoats: '1', overrideMeasurement: '', overrideHours: '', overrideGallons: '', overrideSupplyCost: '', overrideTotal: '', overrideDescription: '', notes: '' }],
    firstTrimScope: null,
    trimsIncluded: true,
    jobTrimsIncluded: true,
    trimPaintLabel: 'Trim Paint',
    trimPrimerLabel: 'Trim Primer',
    effectiveTrimPaintLabel: 'Trim Paint',
    effectiveTrimPrimerLabel: 'Trim Primer',
    trimPaintOptions: [],
    trimPrimerOptions: [],
    trimScopeEffectiveMeasurementById: new Map([['trim-1', 24]]),
    trimScopeEffectiveTotalById: new Map([['trim-1', 180]]),
    selectedTrimSubtotal: 180,
    selectedTrimMeasurement: 24,
    orgWallPaintLabel: 'Org Wall Paint',
    orgWallPrimerLabel: 'Org Wall Primer',
    orgCeilingPaintLabel: 'Org Ceiling Paint',
    orgCeilingPrimerLabel: 'Org Ceiling Primer',
    orgTrimPaintLabel: 'Org Trim Paint',
    orgTrimPrimerLabel: 'Org Trim Primer',
    dirty: true,
    saveStatusText: 'Unsaved changes',
    saveStatusColor: '#f9e2b7',
    calculationsStale: true,
    useLocalPreviewCalculations: true,
    totalEffectiveAreaSqFt: 364,
    currentSnapshot: '{}',
    roomHeightFactorByRoomId: new Map([['R001', '1.1']]),
  }),
}))

vi.mock('../useEstimateV2EditorLoader', () => ({
  useEstimateV2EditorLoader: () => undefined,
}))

vi.mock('../useEstimateV2RoomActions', () => ({
  useEstimateV2RoomActions: () => roomActions,
}))

vi.mock('../useEstimateV2WallActions', () => ({
  useEstimateV2WallActions: () => wallActions,
}))

vi.mock('../useEstimateV2CeilingActions', () => ({
  useEstimateV2CeilingActions: () => ceilingActions,
}))

vi.mock('../useEstimateV2TrimActions', () => ({
  useEstimateV2TrimActions: () => trimActions,
}))

vi.mock('../useEstimateV2SettingsActions', () => ({
  useEstimateV2SettingsActions: () => settingsActions,
}))

vi.mock('../useEstimateV2SaveController', () => ({
  useEstimateV2SaveController: () => saveController,
}))

describe('useEstimateV2EditorState', () => {
  it('returns grouped page/header/summary contracts without compatibility exports', () => {
    const { result } = renderHook(() => useEstimateV2EditorState({ estimateId: 'estimate-1' }))

    expect(result.current.pageVm.loading).toBe(true)
    expect(result.current.headerVm.estimateId).toBe('estimate-1')
    expect(result.current.summaryVm.roomLabel).toBe('R001')
    expect(result.current.summaryVm.walls.primaryValue).toBe('220')
    expect(result.current.summaryVm.trim.secondaryValue).toBe('$180.00')
    expect(result.current.roomVm.updateSelectedRoom).toBeTypeOf('function')
    expect(result.current.saveVm.debugMeta.usingLocalPreview).toBe(true)
    expect('loading' in (result.current as Record<string, unknown>)).toBe(false)
    expect('save' in (result.current as Record<string, unknown>)).toBe(false)
    expect('rooms' in (result.current as Record<string, unknown>)).toBe(false)
  })
})
