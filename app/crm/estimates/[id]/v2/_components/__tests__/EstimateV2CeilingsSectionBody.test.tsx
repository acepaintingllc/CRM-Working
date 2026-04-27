import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EstimateV2CeilingsSectionBody } from '../EstimateV2CeilingsSectionBody'

const styles = {
  button: {},
  input: {},
  textarea: {},
  label: {},
  mono: {},
  panel: {},
  computedBig: {},
}

const room = {
  id: 'room-1',
  roomId: 'R001',
  roomName: 'Living Room',
  roomTypeId: '',
  lengthIn: '120',
  widthIn: '144',
  heightIn: '96',
  wallComplexityId: '',
  notes: '',
  position: 0,
}

const flatCeilingScope = {
  id: 'ceiling-1',
  roomId: 'R001',
  position: 0,
  mode: 'SEG' as const,
  include: 'Y' as const,
  scopeName: '',
  colorId: 'COLOR1',
  paintProductId: '',
  primerProductId: '',
  primeMode: 'NONE' as const,
  spotPrimePercent: '',
  ceilingTypeId: 'FLAT',
  ceilingGeometryMode: 'FLAT',
  vaultedAreaFactor: '',
  vaultedRidgeLengthIn: '',
  vaultedSlopeLengthIn: '',
  vaultedPlaneCount: '2',
  trayPerimeterIn: '',
  trayStepHeightIn: '',
  trayBandWidthIn: '',
  cofferSectionLengthIn: '',
  cofferSectionWidthIn: '',
  cofferSectionCount: '',
  cofferFaceHeightIn: '',
  cofferBottomWidthIn: '',
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
  conditionSelections: {},
}

function makeVm(overrides: Record<string, unknown> = {}) {
  return {
    catalogs: { ceiling_types: [{ id: 'COFFERED', label: 'Coffered', labor_mult: 1.45, area_factor: 1 }] },
    selectedRoom: room,
    selectedRoomGeometryMode: 'SEG' as const,
    selectedRoomCeilingScopes: [flatCeilingScope],
    firstCeilingScope: flatCeilingScope,
    ceilingSegments: [
      {
        id: 'ceiling-segment-1',
        ceilingScopeId: 'ceiling-1',
        roomId: 'R001',
        position: 0,
        segmentName: 'Main',
        include: 'Y' as const,
        shapeType: 'RECTANGLE' as const,
        quantity: '1',
        widthIn: '120',
        heightIn: '144',
        baseIn: '',
        manualAreaSqFt: '',
        overrideAreaSqFt: '',
        notes: '',
      },
    ],
    ceilingsIncluded: true,
    ceilingPaintLabel: 'Ceiling Paint',
    ceilingPrimerLabel: 'Ceiling Primer',
    effectiveCeilingPaintLabel: 'Ceiling Paint',
    effectiveCeilingPrimerLabel: 'Ceiling Primer',
    ceilingPaintOptions: [],
    ceilingPrimerOptions: [],
    colorCodeOptions: [{ id: 'COLOR1', label: 'Color 1' }],
    selectedCeilingEffectiveSqFt: 120,
    updateScope: vi.fn(),
    addScope: vi.fn(),
    deleteScope: vi.fn(),
    moveScope: vi.fn(),
    addSegment: vi.fn(),
    deleteSegment: vi.fn(),
    moveSegment: vi.fn(),
    updateSegment: vi.fn(),
    toggleRoomInclude: vi.fn(),
    conditionModifiers: [],
    conditionSelections: {},
    setSelectedRoomCeilingCondition: vi.fn(),
    ...overrides,
  }
}

describe('EstimateV2CeilingsSectionBody', () => {
  it('keeps SEG ceilings focused on segments and exposes primer mode', () => {
    const updateScope = vi.fn()
    const addSegment = vi.fn()
    const ceilingsVm = makeVm({ updateScope, addSegment })

    render(
      <EstimateV2CeilingsSectionBody
        styles={styles}
        ceilingsVm={ceilingsVm as never}
        openCeilingAdvanced={{}}
        setOpenCeilingAdvanced={vi.fn()}
        switchRoomGeometryMode={vi.fn()}
        toDisplayNumber={(value) => (value == null ? '--' : String(value))}
      />
    )

    expect(screen.queryByText('Ceiling Scopes')).not.toBeInTheDocument()
    expect(screen.queryByText('+ Add scope')).not.toBeInTheDocument()
    expect(screen.getByText('Primer Mode')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Full'))
    expect(updateScope).toHaveBeenCalledWith('ceiling-1', {
      primeMode: 'FULL',
      primerProductId: '',
    })
    fireEvent.click(screen.getByText('+ Add segment'))
    expect(addSegment).toHaveBeenCalledWith('R001', 'ceiling-1')
  })

  it('renders optional coffered fields outside the shaded required coffered group', () => {
    const cofferedScope = {
      ...flatCeilingScope,
      mode: 'RECT' as const,
      ceilingTypeId: 'COFFERED',
      ceilingGeometryMode: 'COFFERED',
    }
    const ceilingsVm = makeVm({
      selectedRoomGeometryMode: 'RECT',
      selectedRoomCeilingScopes: [cofferedScope],
      firstCeilingScope: cofferedScope,
      ceilingSegments: [],
    })

    render(
      <EstimateV2CeilingsSectionBody
        styles={styles}
        ceilingsVm={ceilingsVm as never}
        openCeilingAdvanced={{}}
        setOpenCeilingAdvanced={vi.fn()}
        switchRoomGeometryMode={vi.fn()}
        toDisplayNumber={(value) => (value == null ? '--' : String(value))}
      />
    )

    const requiredGroup = screen.getByText('Section Length (in)').closest('.paint-setup-grid')
    expect(requiredGroup).not.toBeNull()
    expect(within(requiredGroup as HTMLElement).queryByText('Recess Depth Optional (in)')).not.toBeInTheDocument()
    expect(screen.getByText('Recess Depth Optional (in)')).toBeInTheDocument()
    expect(screen.getByText('Beam Width Optional (in)')).toBeInTheDocument()
  })
})
