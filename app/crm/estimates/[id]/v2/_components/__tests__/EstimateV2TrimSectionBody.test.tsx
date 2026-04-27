import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EstimateV2TrimSectionBody } from '../EstimateV2TrimSectionBody'

const styles = {
  button: {},
  input: {},
  textarea: {},
  label: {},
  mono: {},
  panel: {},
  computedBig: {},
  scopePill: {},
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

const trimScope = {
  id: 'trim-1',
  roomId: 'R001',
  position: 0,
  include: 'Y' as const,
  scopeName: 'Baseboard',
  trimTypeId: 'BASE',
  trimFamily: 'baseboard',
  unitType: 'LF' as const,
  measurementMode: 'MANUAL' as const,
  helperSource: '' as const,
  measurementValue: '24',
  helperValue: '',
  baseboardOpeningCount: '',
  colorId: 'COLOR1',
  paintProductId: '',
  primerProductId: '',
  paintEnabled: 'Y' as const,
  primeMode: 'NONE' as const,
  spotPrimePercent: '',
  productionRateId: '',
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
  conditionSelections: {},
}

function makeVm(overrides: Record<string, unknown> = {}) {
  return {
    selectedRoom,
    selectedRoomResolvedMode: 'RECT' as const,
    selectedRoomTrimScopes: [trimScope],
    firstTrimScope: trimScope,
    trimsIncluded: true,
    jobTrimsIncluded: true,
    trimPaintLabel: 'Trim Paint',
    trimPrimerLabel: 'Trim Primer',
    effectiveTrimPaintLabel: 'Trim Paint',
    effectiveTrimPrimerLabel: 'Trim Primer',
    trimPaintOptions: [],
    trimPrimerOptions: [],
    trimTypeOptions: [
      {
        id: 'BASE',
        label: 'Baseboard',
        family: 'baseboard',
        category: 'base',
        unit_type: 'LF',
        helper_allowed: true,
      },
    ],
    trimScopeEffectiveMeasurementById: new Map([['trim-1', 24]]),
    trimScopeEffectiveTotalById: new Map([['trim-1', 100]]),
    selectedTrimSubtotal: 100,
    selectedTrimMeasurement: 24,
    colorCodeOptions: [{ id: 'COLOR1', label: 'Color 1' }],
    addScope: vi.fn(),
    moveScope: vi.fn(),
    deleteScope: vi.fn(),
    updateScope: vi.fn(),
    toggleRoomInclude: vi.fn(),
    updateTrimType: vi.fn(),
    conditionModifiers: [],
    conditionSelections: {},
    setSelectedRoomTrimCondition: vi.fn(),
    ...overrides,
  }
}

describe('EstimateV2TrimSectionBody', () => {
  it('renders trim setup helper metrics and required manual inputs', () => {
    render(
      <EstimateV2TrimSectionBody
        styles={styles}
        trimVm={makeVm() as never}
        openTrimAdvanced={{}}
        setOpenTrimAdvanced={vi.fn()}
        toDisplayNumber={(value) => (value == null ? '--' : String(value))}
      />
    )

    expect(screen.getByText('Trim Setup')).toBeInTheDocument()
    expect(screen.getByText('Base Measurement')).toBeInTheDocument()
    expect(screen.getByText('Helper Value')).toBeInTheDocument()
    expect(screen.getByText('Factor Count')).toBeInTheDocument()
    expect(screen.getByText('Final Measurement')).toBeInTheDocument()

    expect(screen.getByText('Trim Type').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Measurement Mode').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Measurement (LF)').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Primer Mode').nextElementSibling).toHaveClass('required-input-frame')
    expect(screen.getByText('Include').nextElementSibling).toHaveClass('optional-input-frame')
    expect(screen.getByText('Openings').nextElementSibling).toHaveClass('optional-input-frame')
  })

  it('marks room helper measurement value optional when perimeter fallback is available', () => {
    render(
      <EstimateV2TrimSectionBody
        styles={styles}
        trimVm={
          makeVm({
            selectedRoomTrimScopes: [
              {
                ...trimScope,
                measurementMode: 'ROOM_HELPER',
                helperSource: 'ROOM_PERIMETER',
                measurementValue: '',
                helperValue: '',
              },
            ],
          }) as never
        }
        openTrimAdvanced={{}}
        setOpenTrimAdvanced={vi.fn()}
        toDisplayNumber={(value) => (value == null ? '--' : String(value))}
      />
    )

    expect(screen.getByText('Measurement (LF)').nextElementSibling).toHaveClass('optional-input-frame')
  })
})
