import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

  it('renders room flag chip hints from scoped wall, ceiling, and trim factors', () => {
    render(
      <EstimateV2RoomHeader
        styles={estimateV2EditorPageStyles}
        roomVm={makeRoomVm()}
        toDisplayNumber={(value) => String(value ?? '--')}
      />
    )

    expect(
      within(screen.getByRole('button', { name: /Walls only legacy/i })).getByText('Walls x1.2')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('button', { name: /Ceiling repair/i })).getByText('Ceilings x1.15')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('button', { name: /Trim detail/i })).getByText('Trim x1.1')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('button', { name: /Heavy prep/i })).getByText(
        'Walls x1.2, Ceilings x1.15, Trim x1.1'
      )
    ).toBeInTheDocument()
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

    const rectButton = screen.getByText('RECT').closest('button') as HTMLButtonElement
    const segButton = screen.getByRole('button', { name: 'SEG' })

    expect(rectButton).toBeDisabled()
    fireEvent.click(rectButton)
    expect(switchSelectedRoomGeometryMode).not.toHaveBeenCalled()

    fireEvent.click(segButton)
    expect(switchSelectedRoomGeometryMode).toHaveBeenCalledWith('SEG')
  })
})
