import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EstimateV2EditorRoomVm } from '../../_state/estimateV2EditorTypes'
import { estimateV2EditorPageStyles } from '../estimateV2EditorPageStyles'
import { EstimateV2RoomHeader } from '../EstimateV2RoomHeader'

function makeRoomVm(
  overrides: Partial<EstimateV2EditorRoomVm> = {}
): EstimateV2EditorRoomVm {
  const selectedRoom = {
    id: 'room-1',
    roomId: 'R001',
    roomName: 'Living Room',
    roomTypeId: '',
    lengthIn: '120',
    widthIn: '144',
    heightIn: '108',
    wallComplexityId: '',
    notes: '',
    position: 0,
  }

  return {
    rooms: [selectedRoom],
    selectedRoomId: 'R001',
    setSelectedRoomId: vi.fn(),
    selectedRoom,
    selectedRoomResolvedMode: 'RECT',
    selectedRoomGeometryMode: 'RECT',
    roomTypeOptions: [],
    roomFlags: [],
    roomScopeByRoomId: new Map(),
    roomCeilingScopeByRoomId: new Map(),
    roomTrimScopeByRoomId: new Map(),
    displayedRoomEffectiveAreaByRoomId: new Map(),
    selectedRoomEffectiveSqFt: 240,
    activeRoomFlagCount: 0,
    selectedRoomIssueCount: 0,
    roomFlagsEnabled: true,
    roomFlagsCatalog: [
      {
        id: 'walls',
        label: 'Walls only legacy x1.8',
        wall_factor: 1.2,
        ceil_factor: 1,
        trim_factor: 1,
      },
      {
        id: 'ceilings',
        label: 'Ceiling repair',
        wall_factor: 1,
        ceil_factor: 1.15,
        trim_factor: 1,
      },
      {
        id: 'trim',
        label: 'Trim detail',
        wall_factor: 1,
        ceil_factor: 1,
        trim_factor: 1.1,
      },
      {
        id: 'all',
        label: 'Heavy prep',
        wall_factor: 1.2,
        ceil_factor: 1.15,
        trim_factor: 1.1,
      },
    ],
    addRoom: vi.fn(),
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
    ...overrides,
  }
}

describe('EstimateV2RoomHeader', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps room flag multiplier details in hover titles only', () => {
    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm()}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(screen.getByRole('button', { name: /Walls only legacy/i })).toHaveAttribute(
      'title',
      'Walls x1.2'
    )
    expect(screen.getByRole('button', { name: /Ceiling repair/i })).toHaveAttribute(
      'title',
      'Ceilings x1.15'
    )
    expect(screen.getByRole('button', { name: /Trim detail/i })).toHaveAttribute(
      'title',
      'Trim x1.1'
    )
    expect(screen.getByRole('button', { name: /Heavy prep/i })).toHaveAttribute(
      'title',
      'Walls x1.2, Ceilings x1.15, Trim x1.1'
    )
    expect(screen.queryByText('Walls x1.2')).not.toBeInTheDocument()
  })

  it('renders the furnished room condition as a room-level modifier chip', () => {
    const setSelectedRoomCondition = vi.fn()
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: '',
      notes: '',
      position: 0,
      conditionSelections: { ROOM_FURNISHED: 'active' as const },
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({
          selectedRoom,
          roomFlagsEnabled: false,
          conditionModifiers: [
            {
              id: 'ROOM_FURNISHED',
              label: 'Room is furnished',
              scope: 'room',
              modifier_type: 'binary',
              factor_field: null,
              levels: { active: 1.15 },
            },
          ],
          setSelectedRoomCondition,
        })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    const furnishedButton = screen.getByRole('button', { name: 'Room is furnished' })
    expect(furnishedButton).toHaveAttribute('aria-pressed', 'true')
    expect(furnishedButton).toHaveAttribute('title', 'Room x1.15')

    fireEvent.click(furnishedButton)
    expect(setSelectedRoomCondition).toHaveBeenCalledWith('ROOM_FURNISHED', 'none')
  })

  it('disables the active geometry mode so no-op clicks do not dispatch mode changes', () => {
    const switchSelectedRoomGeometryMode = vi.fn()

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ switchSelectedRoomGeometryMode })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    const rectButton = screen.getByText('Rectangle').closest('button') as HTMLButtonElement
    const segButton = screen.getByRole('button', { name: 'Segments' })

    expect(rectButton).toBeDisabled()
    fireEvent.click(rectButton)
    expect(switchSelectedRoomGeometryMode).not.toHaveBeenCalled()

    fireEvent.click(segButton)
    expect(switchSelectedRoomGeometryMode).toHaveBeenCalledWith('SEG')
  })

  it('renders helper text converting total inches to feet and inches', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(screen.getByText('10 ft')).toBeInTheDocument()
    expect(screen.getByText('12 ft')).toBeInTheDocument()
    expect(screen.getByText('9 ft')).toBeInTheDocument()
  })

  it('renders helper text with inches remainder when inches exceed 12', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '150',
      widthIn: '155',
      heightIn: '96',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(screen.getByText('12 ft 6 in')).toBeInTheDocument()
    expect(screen.getByText('12 ft 11 in')).toBeInTheDocument()
    expect(screen.getByText('8 ft')).toBeInTheDocument()
  })

  it('renders decimal inch helper text without truncating values', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '150.5',
      widthIn: '11.25',
      heightIn: '96',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(screen.getByText('12 ft 6.5 in')).toBeInTheDocument()
    expect(screen.getByText('11.25 in')).toBeInTheDocument()
    expect(screen.getByText('8 ft')).toBeInTheDocument()
  })

  it('disables the room type select and shows Catalog unavailable when options are empty', () => {
    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ roomTypeOptions: [] })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    const select = screen.getByRole('combobox')
    expect(select).toBeDisabled()
    expect(screen.getByText('Catalog unavailable')).toBeInTheDocument()
    expect(screen.getByText('Room type templates could not be loaded')).toBeInTheDocument()
  })

  it('keeps a saved room type value selected when the room type catalog is unavailable', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: 'LIVING',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom, roomTypeOptions: [] })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select).toBeDisabled()
    expect(select.value).toBe('LIVING')
    expect(screen.getByText('Catalog unavailable')).toBeInTheDocument()
  })

  it('renders formula context in rectangle mode from total inches', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom, selectedRoomGeometryMode: 'RECT' })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    // Perimeter = 2 * (120 + 144) = 528 in
    expect(screen.getByText('Perimeter 528 in x Height 108 in')).toBeInTheDocument()
  })

  it('renders formula context from decimal dimensions without truncating values', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '120.5',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom, selectedRoomGeometryMode: 'RECT' })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(screen.getByText('Perimeter 529 in x Height 108 in')).toBeInTheDocument()
  })

  it('shows "From wall segments" formula text in segment mode', () => {
    const selectedRoom = {
      id: 'room-1',
      roomId: 'R001',
      roomName: 'Living Room',
      roomTypeId: '',
      lengthIn: '120',
      widthIn: '144',
      heightIn: '108',
      wallComplexityId: '',
      notes: '',
      position: 0,
    }

    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm({ selectedRoom, selectedRoomGeometryMode: 'SEG' })}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(screen.getByText('From wall segments')).toBeInTheDocument()
  })
})
