import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2WallsSectionBody } from '../EstimateV2WallsSectionBody'

const styles = {
  button: {},
  input: {},
  textarea: {},
  label: {},
  mono: {},
  panel: {},
  computedBig: {},
  stepper: {},
  stepperBtn: {},
  stepperVal: {},
}

afterEach(() => cleanup())

const selectedRoom = {
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

const firstScope = {
  id: 'wall-1',
  roomId: 'R001',
  position: 0,
  mode: 'RECT' as const,
  include: 'Y' as const,
  scopeName: 'Walls',
  colorId: 'COLOR1',
  paintProductId: '',
  primerProductId: '',
  primeMode: 'NONE' as const,
  heightIn: '',
  perimeterIn: '',
  standardDoorCount: '1',
  standardWindowCount: '2',
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
  conditionSelections: {},
}

function makeVm(overrides: Record<string, unknown> = {}) {
  return {
    selectedRoom,
    selectedRoomGeometryMode: 'RECT' as const,
    selectedRoomScopes: [firstScope],
    firstScope,
    segments: [],
    wallsIncluded: true,
    wallPaintLabel: 'Wall Paint',
    wallPrimerLabel: 'Wall Primer',
    effectiveWallPaintLabel: 'Wall Paint',
    effectiveWallPrimerLabel: 'Wall Primer',
    wallPaintOptions: [],
    wallPrimerOptions: [],
    wallProductionRates: [{ id: 'WALL_STD', label: 'Standard repaint' }],
    colorCodeOptions: [{ id: 'COLOR1', label: 'Color 1' }],
    displayedSegmentEffectiveAreaById: new Map(),
    displayedScopeEffectiveAreaById: new Map([['wall-1', 155]]),
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
    conditionModifiers: [],
    conditionSelections: {},
    setSelectedRoomWallCondition: vi.fn(),
    ...overrides,
  }
}

describe('EstimateV2WallsSectionBody', () => {
  it('renders RECT wall setup helper metrics and required outlines', () => {
    render(
      <EstimateV2WallsSectionBody
        styles={styles}
        wallsVm={makeVm() as never}
        openAdvanced={{}}
        setOpenAdvanced={vi.fn()}
        toDisplayNumber={(value) => (value == null ? '--' : String(value))}
      />
    )

    expect(screen.getByText('Wall Setup')).toBeInTheDocument()
    expect(screen.getByText('Base Sq Ft')).toBeInTheDocument()
    expect(screen.getByText('Opening Deduct')).toBeInTheDocument()
    expect(screen.getByText('Area Factor')).toBeInTheDocument()
    expect(screen.getByText('Final Sq Ft')).toBeInTheDocument()

    expect(screen.getByText('Wall Condition / Rate').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Coats').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Primer Mode').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Doors').nextElementSibling).toHaveClass('optional-input-frame')
    expect(screen.getByText('Windows').nextElementSibling).toHaveClass('optional-input-frame')
  })

  it('marks active SEG geometry fields required and optional fields unoutlined', () => {
    const segment = {
      id: 'segment-1',
      wallScopeId: 'wall-1',
      roomId: 'R001',
      position: 0,
      segmentName: 'Main',
      include: 'Y' as const,
      shapeType: 'RECTANGLE' as const,
      quantity: '1',
      widthIn: '120',
      heightIn: '96',
      baseIn: '',
      manualAreaSqFt: '',
      standardDoorCount: '',
      standardWindowCount: '',
      overrideAreaSqFt: '',
      notes: '',
    }

    render(
      <EstimateV2WallsSectionBody
        styles={styles}
        wallsVm={
          makeVm({
            selectedRoomGeometryMode: 'SEG',
            selectedRoomScopes: [{ ...firstScope, mode: 'SEG' }],
            firstScope: { ...firstScope, mode: 'SEG' },
            segments: [segment],
            displayedSegmentEffectiveAreaById: new Map([['segment-1', 80]]),
            displayedScopeEffectiveAreaById: new Map([['wall-1', 80]]),
          }) as never
        }
        openAdvanced={{}}
        setOpenAdvanced={vi.fn()}
        toDisplayNumber={(value) => (value == null ? '--' : String(value))}
      />
    )

    expect(screen.getByText('Shape').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Width (in)').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Doors').nextElementSibling).toHaveClass('optional-input-frame')
    expect(screen.getByText('Area Override (sf)').nextElementSibling).toHaveClass('optional-input-frame')
    expect(screen.queryByText('SEG Mode Scopes')).not.toBeInTheDocument()
    expect(screen.queryByText('+ Add scope')).not.toBeInTheDocument()
    expect(screen.getByText('Base Sq Ft').compareDocumentPosition(screen.getByText('+ Add segment'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})
