import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2EditorPageContent } from '../EstimateV2EditorPageContent'

const push = vi.fn()
const save = vi.fn(async () => true)
const saveDraft = vi.fn(() => {
  void save()
})
const saveAndContinue = vi.fn()
const addRoom = vi.fn()
const requestBackNavigation = vi.fn()
const onStay = vi.fn()
const onSave = vi.fn()
const onLeave = vi.fn()
const mockUseEstimateV2Editor = vi.fn()

vi.mock('../../_state/useEstimateV2Editor', () => ({
  useEstimateV2Editor: (...args: unknown[]) => mockUseEstimateV2Editor(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => window.location.pathname,
}))

vi.mock('next/image', () => ({
  default: ({
    alt,
  }: {
    alt: string
    src: string
    width: number
    height: number
    unoptimized?: boolean
    style?: React.CSSProperties
    onError?: () => void
  }) => <span aria-label={alt} />,
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({}),
  })),
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
    resumeRecord: {
      estimate: null,
      job: null,
    },
    titleText: 'Version A',
    subtitleText: 'Job - Ada - 123 Main',
    workflowText: 'Estimate V2 Editor',
    dirtyStateText: 'Unsaved changes',
    dirtyStateColor: '#f9e2b7',
    dirty: true,
    saving: false,
    settingsOpen: false,
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
      doors: 'Doors included',
    },
    validationText: 'No open issues',
    validationColor: 'var(--v2-ink-2)',
    calculationStateText: 'Live preview (not saved)',
    calculationStateColor: '#f9e2b7',
    runningTotalLabel: 'Active scope totals - 1 room',
    activeScopeTotals: [
      { key: 'walls', label: 'Walls', value: '220 sf' },
      { key: 'ceilings', label: 'Ceilings', value: '144 sf' },
      { key: 'trim', label: 'Trim', value: '24 LF' },
      { key: 'doors', label: 'Doors', value: '2 sides', detail: '1 count' },
    ],
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
    roomTypeCatalogStatus: 'empty',
    roomFlags: [],
    roomScopeByRoomId: new Map([['R001', [{ id: 'scope-1', include: 'Y' }]]]),
    roomCeilingScopeByRoomId: new Map([['R001', [{ id: 'ceiling-1', include: 'Y' }]]]),
    roomTrimScopeByRoomId: new Map([['R001', [{ id: 'trim-1', include: 'Y' }]]]),
    roomDoorScopeByRoomId: new Map([['R001', [{ id: 'door-1', include: 'Y' }]]]),
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
  doorsVm: {
    selectedRoom: { id: 'room-1', roomId: 'R001', roomName: 'Living Room' },
    selectedRoomDoorScopes: [{ id: 'door-1' }],
    firstDoorScope: null,
    doorsIncluded: true,
    jobDoorsIncluded: true,
    doorPaintLabel: 'Trim Paint',
    doorPrimerLabel: 'Trim Primer',
    effectiveDoorPaintLabel: 'Trim Paint',
    effectiveDoorPrimerLabel: 'Trim Primer',
    doorPaintOptions: [],
    doorPrimerOptions: [],
    doorTypeOptions: [],
    doorScopeEffectiveUnitsById: new Map(),
    doorScopeEffectiveTotalById: new Map(),
    selectedDoorSubtotal: null,
    selectedDoorUnits: null,
    colorCodeOptions: [],
    updateScope: vi.fn(),
    addScope: vi.fn(),
    moveScope: vi.fn(),
    deleteScope: vi.fn(),
    toggleRoomInclude: vi.fn(),
    updateDoorType: vi.fn(),
  },
  jobSettingsVm: {
    jobSettingsDraft: { wallPaintProductId: '', wallPrimerProductId: '', ceilingPaintProductId: '', ceilingPrimerProductId: '', trimPaintProductId: '', trimPrimerProductId: '', laborDayEnabled: false, dayhours: 8, roundingIncrementHours: 4, laborRate: 65, jobMinEnabled: false, jobMinAmount: 0, crewSize: 1 },
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
    canManualSave: true,
    canSaveAndContinue: true,
    saveStatus: 'idle',
    saveStatusText: 'Unsaved changes',
    saveStatusColor: '#f9e2b7',
    blockedReason: null,
    blockingIssues: [],
    calculationsStale: true,
    debugMeta: { dirtySource: 'walls', lastSaveTrigger: null, lastNormalizedDomains: [], usingLocalPreview: true },
    save,
    saveDraft,
    saveAndContinue,
  },
  navigationVm: {
    unsavedDialogProps: {
      isOpen: false,
      canSave: true,
      onStay,
      onSave,
      onLeave,
    },
  },
  navigationActions: {
    requestBackNavigation,
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

vi.mock('../EstimateV2DoorsSectionBody', () => ({
  EstimateV2DoorsSectionBody: () => <div>Doors Body</div>,
}))

describe('EstimateV2EditorPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    window.history.replaceState(null, '', '/crm/quotes/estimate-1')
    mockUseEstimateV2Editor.mockReturnValue(baseEditorState)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders from grouped VMs without duplicate header workflow actions', () => {
    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Version A')).toBeInTheDocument()
    expect(screen.getByText('Walls Body')).toBeInTheDocument()
    expect(screen.getByText('Ceilings Body')).toBeInTheDocument()
    expect(screen.getByText('Trim Body')).toBeInTheDocument()
    expect(screen.getByText('Doors Body')).toBeInTheDocument()
    expect(screen.getAllByText('Living Room').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Walls: 220 sf|220 sf/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Ceilings: 144 sf|144 sf/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Trim: 24 LF|24 LF/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Next: Details & Overrides ->')).not.toBeInTheDocument()
  })

  it('exposes stable layout regions for narrow viewport responsive rules', () => {
    const { container } = render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    const shell = container.querySelector('.ace-v2-rooms-layout')

    expect(shell).toBeInTheDocument()
    expect(shell?.querySelector('.estimate-v2-sidebar')).toBeInTheDocument()
    expect(shell?.querySelector('.estimate-v2-workspace-main')).toBeInTheDocument()
    expect(shell?.querySelector('.room-workspace')).toBeInTheDocument()
    expect(shell?.querySelector('.room-side-col')).toBeInTheDocument()
    expect(container.querySelector('.estimate-v2-footer')).toBeInTheDocument()
  })

  it('lets footer continue delegate even when there are no dirty changes', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: false,
        canManualSave: false,
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()

    fireEvent.click(screen.getByText('Save & continue ->'))

    expect(save).not.toHaveBeenCalled()
    expect(saveAndContinue).toHaveBeenCalledTimes(1)
  })

  it('routes header back through the editor navigation actions', () => {
    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    fireEvent.click(screen.getByRole('button', { name: '<- Back' }))

    expect(requestBackNavigation).toHaveBeenCalledTimes(1)
  })

  it('renders the editor navigation confirmation VM', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      navigationVm: {
        unsavedDialogProps: {
          isOpen: true,
          canSave: true,
          onStay,
          onSave,
          onLeave,
        },
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByRole('dialog', { name: 'Leave with unsaved changes?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save and leave' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes and leave quote editor' }))

    expect(onStay).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('enables Save draft when valid dirty edits are ready and no save is active', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        saving: false,
        validationIssues: [],
      },
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: true,
        canManualSave: true,
        saveStatusText: 'Unsaved changes - ready to save',
        blockedReason: null,
        blockingIssues: [],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Unsaved changes - ready to save')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
  })

  it('uses Save draft to trigger the canonical save while dirty edits are ready', async () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        saving: false,
        validationIssues: [],
      },
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: true,
        canManualSave: true,
        saveStatusText: 'Unsaved changes - ready to save',
        blockedReason: null,
        blockingIssues: [],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith()
    })
  })

  it('keeps the footer save action delegated while the settings drawer is focused', async () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      headerVm: {
        ...baseEditorState.headerVm,
        settingsOpen: true,
      },
      jobSettingsVm: {
        ...baseEditorState.jobSettingsVm,
        settingsOpen: true,
      },
      pageVm: {
        ...baseEditorState.pageVm,
        saving: false,
        validationIssues: [],
      },
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: true,
        canManualSave: true,
        saveStatusText: 'Unsaved changes - ready to save',
        blockedReason: null,
        blockingIssues: [],
      },
    })

    const { container } = render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    const laborRateInput = screen.getByLabelText('Labor rate ($/hr)')
    laborRateInput.focus()
    expect(laborRateInput).toHaveFocus()

    fireEvent.change(laborRateInput, { target: { value: '90' } })
    const saveDraftButton = screen.getByRole('button', { name: 'Save draft' })
    fireEvent.click(saveDraftButton)

    expect(laborRateInput).toHaveFocus()
    expect(saveDraft).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith()
    })
    expect(container.querySelector<HTMLElement>('.estimate-v2-footer')?.style.zIndex).toBe('60')
  })

  it('keeps Save draft disabled while a save is active', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        saving: true,
        validationIssues: [],
      },
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: true,
        canManualSave: true,
        saveStatusText: 'Unsaved changes - ready to save',
        blockedReason: null,
        blockingIssues: [],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getByText('Unsaved changes - ready to save')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
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

  it('renders a fatal load error without mounting the editor workspace controls', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        loading: false,
        error: { message: 'Quote not found', retryable: true },
        roomsCount: 0,
      },
      headerVm: {
        ...baseEditorState.headerVm,
        resumeRecord: {
          estimate: null,
          job: null,
        },
        dirty: false,
        dirtyStateText: '',
      },
      roomVm: {
        ...baseEditorState.roomVm,
        rooms: [],
        selectedRoomId: '',
        selectedRoom: null,
      },
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: false,
        canManualSave: false,
      },
    })

    const { container } = render(<EstimateV2EditorPageContent estimateId="missing-estimate" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Quote not found')
    expect(container.querySelector('.ace-v2-rooms-layout')).not.toBeInTheDocument()
    expect(container.querySelector('.estimate-v2-footer')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
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

  it('renders the editor settings drawer from the canonical settings VM state', () => {
    const setSettingsOpen = vi.fn()
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      headerVm: {
        ...baseEditorState.headerVm,
        settingsOpen: true,
      },
      jobSettingsVm: {
        ...baseEditorState.jobSettingsVm,
        settingsOpen: true,
        setSettingsOpen,
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(
      screen.getByRole('dialog', { name: 'Estimate Settings' })
    ).toBeInTheDocument()
    expect(screen.getByText('Customer Info')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close estimate settings' }))

    expect(setSettingsOpen).toHaveBeenCalledWith(false)
  })

  it('routes the header Settings button to the editor-level settings action', () => {
    const toggleSettings = vi.fn()
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      headerVm: {
        ...baseEditorState.headerVm,
        toggleSettings,
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(toggleSettings).toHaveBeenCalledTimes(1)
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

  it('disables save actions and surfaces the blocked reason when dirty edits are invalid', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      headerVm: {
        ...baseEditorState.headerVm,
        dirtyStateText:
          'Unsaved changes - save blocked: R001: height is required for RECT wall mode',
      },
      pageVm: {
        ...baseEditorState.pageVm,
        validationIssues: ['R001: height is required for RECT wall mode'],
      },
      saveVm: {
        ...baseEditorState.saveVm,
        canManualSave: false,
        canSaveAndContinue: false,
        saveStatus: 'blocked',
        saveStatusText:
          'Unsaved changes - save blocked: R001: height is required for RECT wall mode',
        blockedReason: 'R001: height is required for RECT wall mode',
        blockingIssues: ['R001: height is required for RECT wall mode'],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(
      screen.getByText(
        'Unsaved changes - save blocked: R001: height is required for RECT wall mode'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('R001: height is required for RECT wall mode')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save & continue ->' })).toBeDisabled()
  })

  it('keeps invalid trim and door drafts visibly blocked instead of showing a stale saved footer', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      headerVm: {
        ...baseEditorState.headerVm,
        dirty: true,
        dirtyStateText: 'Unsaved changes - save blocked: R001: trim type is required',
      },
      pageVm: {
        ...baseEditorState.pageVm,
        validationIssues: [
          'R001: trim type is required',
          'Doors: Door scope 1: door type is required',
        ],
      },
      summaryVm: {
        ...baseEditorState.summaryVm,
        saveStatusText: 'Unsaved changes - save blocked: R001: trim type is required',
      },
      saveVm: {
        ...baseEditorState.saveVm,
        dirty: true,
        canManualSave: false,
        canSaveAndContinue: false,
        saveStatus: 'blocked',
        saveStatusText: 'Unsaved changes - save blocked: R001: trim type is required',
        blockedReason: 'R001: trim type is required',
        blockingIssues: [
          'R001: trim type is required',
          'Doors: Door scope 1: door type is required',
        ],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(screen.getAllByText('Unsaved changes - save blocked: R001: trim type is required').length).toBeGreaterThan(0)
    expect(screen.queryByText('Saved Apr 21, 2:00 PM')).not.toBeInTheDocument()
    expect(screen.getByText('R001: trim type is required')).toBeInTheDocument()
    expect(screen.getByText('Doors: Door scope 1: door type is required')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save draft' })).toHaveAttribute(
      'title',
      'R001: trim type is required'
    )
    expect(screen.getByRole('button', { name: 'Save & continue ->' })).toBeDisabled()
  })

  it('renders validation issues directly from the page VM', () => {
    mockUseEstimateV2Editor.mockReturnValue({
      ...baseEditorState,
      pageVm: {
        ...baseEditorState.pageVm,
        validationIssues: [
          'Walls: Scope 1: paint_prod_rate_sqft_per_hour is required',
          'Walls: Scope 1: paint_prod_rate_sqft_per_hour is required',
          'R001: height is required for RECT wall mode',
        ],
      },
    })

    render(<EstimateV2EditorPageContent estimateId="estimate-1" />)

    expect(
      screen.getAllByText('Walls: Scope 1: paint_prod_rate_sqft_per_hour is required')
    ).toHaveLength(2)
    expect(screen.getByText('R001: height is required for RECT wall mode')).toBeInTheDocument()
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
