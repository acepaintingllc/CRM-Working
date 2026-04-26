import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2EditorPageContent } from '../EstimateV2EditorPageContent'

const push = vi.fn()
const save = vi.fn(async () => true)
const addRoom = vi.fn()
const mockUseEstimateV2Editor = vi.fn()

vi.mock('../../_state/useEstimateV2Editor', () => ({
  useEstimateV2Editor: (...args: unknown[]) => mockUseEstimateV2Editor(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const baseEditorState = {
  pageVm: {
    loading: false,
    saving: false,
    error: null,
    validationIssues: [],
    emptySelectionMessage: 'Empty',
    roomsCount: 1,
  },
  headerVm: {
    estimateId: 'estimate-1',
    titleText: 'Version A',
    subtitleText: 'Job - Ada - 123 Main',
    workflowText: 'Estimate V2 Editor',
    dirtyStateText: 'Unsaved changes',
    dirty: true,
    saving: false,
    toggleSettings: vi.fn(),
    addRoom,
  },
  summaryVm: {
    roomLabel: 'R001',
    roomName: 'Living Room',
    roomSubtitle: 'Living Room - Walls, Ceilings, Trim',
    includedScopeLabels: 'Walls, Ceilings, Trim',
    scopeToggleLabels: {
      walls: 'Walls included',
      ceilings: 'Ceilings included',
      trim: 'Trim included',
    },
    validationText: 'No open issues',
    validationColor: 'var(--v2-ink-2)',
    calculationStateText: 'Live preview (not saved)',
    calculationStateColor: '#f9e2b7',
    totalEffectiveAreaText: '364 sf',
    runningTotalLabel: 'Running total - 1 room - active scopes',
    saveStatusText: 'Unsaved changes',
    saveStatusColor: '#f9e2b7',
    walls: {
      visible: true,
      title: 'Walls',
      modeLabel: 'RECT',
      primaryValue: '220',
      primaryUnit: 'Sq Ft',
      paintLabel: 'Wall Paint',
      primerLabel: 'Wall Primer',
      chips: [{ label: 'Mode: RECT' }],
    },
    ceilings: {
      visible: true,
      title: 'Ceilings',
      modeLabel: 'RECT',
      primaryValue: '144',
      primaryUnit: 'Sq Ft',
      paintLabel: 'Ceiling Paint',
      primerLabel: 'Ceiling Primer',
      chips: [{ label: 'Mode: RECT' }],
    },
    trim: {
      visible: true,
      title: 'Trim',
      primaryValue: '24',
      primaryUnit: 'LF / EA / SF',
      paintLabel: 'Trim Paint',
      primerLabel: 'Trim Primer',
      secondaryValue: '$180.00',
      secondaryLabel: 'Subtotal',
      chips: [{ label: 'Subtotal: $180.00' }],
    },
  },
  roomVm: {
    rooms: [{ id: 'room-1', roomId: 'R001', roomName: 'Living Room', roomTypeId: '', lengthIn: '120', widthIn: '144', heightIn: '108', wallComplexityId: '', notes: '', position: 0 }],
    selectedRoomId: 'R001',
    setSelectedRoomId: vi.fn(),
    selectedRoom: { id: 'room-1', roomId: 'R001', roomName: 'Living Room', roomTypeId: '', lengthIn: '120', widthIn: '144', heightIn: '108', wallComplexityId: '', notes: '', position: 0 },
    selectedRoomResolvedMode: 'RECT',
    selectedRoomGeometryMode: 'RECT',
    roomTypeOptions: [],
    roomFlags: [],
    roomScopeByRoomId: new Map([['R001', [{ id: 'scope-1', include: 'Y' }]]]),
    roomCeilingScopeByRoomId: new Map([['R001', [{ id: 'ceiling-1', include: 'Y' }]]]),
    roomTrimScopeByRoomId: new Map([['R001', [{ id: 'trim-1', include: 'Y' }]]]),
    displayedRoomEffectiveAreaByRoomId: new Map([['R001', 220]]),
    selectedRoomEffectiveSqFt: 220,
    activeRoomFlagCount: 0,
    selectedRoomIssueCount: 0,
    roomFlagsEnabled: false,
    roomFlagsCatalog: [],
    getFlagMultiplierHint: vi.fn(),
    addRoom,
    deleteRoom: vi.fn(),
    updateRoom: vi.fn(),
    updateRoomComplexity: vi.fn(),
    toggleFlag: vi.fn(),
    handleRoomDimChange: vi.fn(),
    switchRoomGeometryMode: vi.fn(),
    updateSelectedRoom: vi.fn(),
    deleteSelectedRoom: vi.fn(),
    toggleSelectedRoomFlag: vi.fn(),
    updateSelectedRoomDimensions: vi.fn(),
    switchSelectedRoomGeometryMode: vi.fn(),
  },
  wallsVm: {
    selectedRoom: { id: 'room-1', roomId: 'R001', roomName: 'Living Room' },
    selectedRoomGeometryMode: 'RECT',
    selectedRoomScopes: [],
    firstScope: null,
    segments: [],
    wallsIncluded: true,
    wallPaintLabel: 'Wall Paint',
    wallPrimerLabel: 'Wall Primer',
    effectiveWallPaintLabel: 'Wall Paint',
    effectiveWallPrimerLabel: 'Wall Primer',
    wallPaintOptions: [],
    wallPrimerOptions: [],
    wallProductionRates: [],
    colorCodeOptions: [],
    displayedSegmentEffectiveAreaById: new Map(),
    displayedScopeEffectiveAreaById: new Map(),
    addScope: vi.fn(),
    moveScope: vi.fn(),
    deleteScope: vi.fn(),
    updateScope: vi.fn(),
    addSegment: vi.fn(),
    moveSegment: vi.fn(),
    deleteSegment: vi.fn(),
    updateSegment: vi.fn(),
    toggleRoomInclude: vi.fn(),
    updateRoomComplexity: vi.fn(),
  },
  ceilingsVm: {
    catalogs: { ceiling_types: [] },
    selectedRoom: { id: 'room-1', roomId: 'R001', roomName: 'Living Room' },
    selectedRoomGeometryMode: 'RECT',
    selectedRoomCeilingScopes: [],
    firstCeilingScope: null,
    ceilingSegments: [],
    ceilingsIncluded: true,
    ceilingPaintLabel: 'Ceiling Paint',
    ceilingPrimerLabel: 'Ceiling Primer',
    effectiveCeilingPaintLabel: 'Ceiling Paint',
    effectiveCeilingPrimerLabel: 'Ceiling Primer',
    ceilingPaintOptions: [],
    ceilingPrimerOptions: [],
    colorCodeOptions: [],
    selectedCeilingEffectiveSqFt: 144,
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
  trimVm: {
    selectedRoom: { id: 'room-1', roomId: 'R001', roomName: 'Living Room' },
    selectedRoomResolvedMode: 'RECT',
    selectedRoomTrimScopes: [{ id: 'trim-1' }],
    firstTrimScope: null,
    trimsIncluded: true,
    jobTrimsIncluded: true,
    trimPaintLabel: 'Trim Paint',
    trimPrimerLabel: 'Trim Primer',
    effectiveTrimPaintLabel: 'Trim Paint',
    effectiveTrimPrimerLabel: 'Trim Primer',
    trimPaintOptions: [],
    trimPrimerOptions: [],
    trimTypeOptions: [],
    trimScopeEffectiveMeasurementById: new Map(),
    trimScopeEffectiveTotalById: new Map(),
    selectedTrimSubtotal: 180,
    selectedTrimMeasurement: 24,
    colorCodeOptions: [],
    updateScope: vi.fn(),
    addScope: vi.fn(),
    moveScope: vi.fn(),
    deleteScope: vi.fn(),
    toggleRoomInclude: vi.fn(),
    updateTrimType: vi.fn(),
  },
  jobSettingsVm: {
    jobSettingsDraft: { wallPaintProductId: '', wallPrimerProductId: '', ceilingPaintProductId: '', ceilingPrimerProductId: '', trimPaintProductId: '', trimPrimerProductId: '', laborDayEnabled: false, dayhours: 8, roundingIncrementHours: 4, laborRate: 65, jobMinEnabled: false, jobMinAmount: 0 },
    orgJobProductDefaults: { wallPaintProductId: '', wallPrimerProductId: '', ceilingPaintProductId: '', ceilingPrimerProductId: '', trimPaintProductId: '', trimPrimerProductId: '' },
    customerDraft: { customerId: '', name: '', email: '', phone: '', address: '' },
    settingsOpen: false,
    setSettingsOpen: vi.fn(),
    jobDefaultsOpen: false,
    setJobDefaultsOpen: vi.fn(),
    wallPaintOptions: [],
    wallPrimerOptions: [],
    ceilingPaintOptions: [],
    ceilingPrimerOptions: [],
    trimPaintOptions: [],
    trimPrimerOptions: [],
    orgWallPaintLabel: 'Org Wall Paint',
    orgWallPrimerLabel: 'Org Wall Primer',
    orgCeilingPaintLabel: 'Org Ceiling Paint',
    orgCeilingPrimerLabel: 'Org Ceiling Primer',
    orgTrimPaintLabel: 'Org Trim Paint',
    orgTrimPrimerLabel: 'Org Trim Primer',
    effectiveWallPaintLabel: 'Wall Paint',
    effectiveWallPrimerLabel: 'Wall Primer',
    effectiveCeilingPaintLabel: 'Ceiling Paint',
    effectiveCeilingPrimerLabel: 'Ceiling Primer',
    effectiveTrimPaintLabel: 'Trim Paint',
    effectiveTrimPrimerLabel: 'Trim Primer',
    updateJobSettings: vi.fn(),
    updateCustomer: vi.fn(),
    flushCustomerSave: vi.fn(),
  },
  saveVm: {
    dirty: true,
    saveStatus: 'dirty',
    saveStatusText: 'Unsaved changes',
    saveStatusColor: '#f9e2b7',
    calculationsStale: true,
    debugMeta: { dirtySource: 'walls', lastSaveTrigger: null, lastNormalizedDomains: [], usingLocalPreview: true },
    save,
  },
  toDisplayNumber: (value: number | null | undefined) => (value == null ? '--' : String(value)),
}

vi.mock('../EstimateV2WallsSectionBody', () => ({
  EstimateV2WallsSectionBody: () => <div>Walls Body</div>,
}))

vi.mock('../EstimateV2CeilingsSectionBody', () => ({
  EstimateV2CeilingsSectionBody: () => <div>Ceilings Body</div>,
}))

vi.mock('../EstimateV2TrimSectionBody', () => ({
  EstimateV2TrimSectionBody: () => <div>Trim Body</div>,
}))

describe('EstimateV2EditorPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseEstimateV2Editor.mockReturnValue(baseEditorState)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders from grouped VMs and routes header save/navigation actions', async () => {
    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Version A')).toBeInTheDocument()
    expect(screen.getByText('Walls Body')).toBeInTheDocument()
    expect(screen.getByText('Ceilings Body')).toBeInTheDocument()
    expect(screen.getByText('Trim Body')).toBeInTheDocument()
    expect(screen.getAllByText('Living Room').length).toBeGreaterThan(0)
    expect(screen.getAllByText('364 sf').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByText('+ Add room')[0])
    fireEvent.click(screen.getByText('Next: Details & Overrides ->'))

    expect(addRoom).toHaveBeenCalled()
    await waitFor(() => {
      expect(save).toHaveBeenCalled()
      expect(push).toHaveBeenCalledWith('/crm/estimates/estimate-1/v2/details')
    })
  })

  it('lets footer continue navigate even when there are no dirty changes', async () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: false,
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    fireEvent.click(screen.getByText('Save & continue ->'))

    expect(save).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/crm/estimates/estimate-1/v2/details')
    })
  })

  it('exposes accessible loading and error semantics', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        loading: true,
        error: { message: 'Failed to fetch estimate workspace', retryable: true },
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(
      screen.getByRole('status', { name: 'Loading quote workspace' })
    ).toHaveTextContent('Loading workspace...')
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch estimate workspace')
  })

  it('renders a single validation issue', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        validationIssues: ['Room name is required'],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Room name is required')).toBeInTheDocument()
  })

  it('renders multiple validation issues', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        validationIssues: ['Room name is required', 'Wall height is required'],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Room name is required')).toBeInTheDocument()
    expect(screen.getByText('Wall height is required')).toBeInTheDocument()
  })

  it('renders the empty-selection state when no room is selected', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      roomVm: {
        ...baseEditorState.roomVm,
        selectedRoomId: null,
        selectedRoom: null,
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.queryByText('Walls Body')).not.toBeInTheDocument()
  })
})
