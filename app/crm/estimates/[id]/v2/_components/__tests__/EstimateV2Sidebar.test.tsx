import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  EstimateV2EditorRoomVm,
  EstimateV2EditorSettingsVm,
} from '../../_state/estimateV2EditorTypes'
import { EstimateV2Sidebar } from '../EstimateV2Sidebar'
import { estimateV2EditorPageStyles } from '../estimateV2EditorPageStyles'

const roomVm = {
  rooms: [],
  selectedRoomId: null,
  roomScopeByRoomId: new Map(),
  roomCeilingScopeByRoomId: new Map(),
  roomTrimScopeByRoomId: new Map(),
  displayedRoomEffectiveAreaByRoomId: new Map(),
  addRoom: vi.fn(),
  setSelectedRoomId: vi.fn(),
} as unknown as EstimateV2EditorRoomVm

function renderSidebar(nextRoomVm: EstimateV2EditorRoomVm = roomVm) {
  return render(
    <EstimateV2Sidebar
      styles={estimateV2EditorPageStyles}
      roomVm={nextRoomVm}
      jobSettingsVm={jobSettingsVm}
      toDisplayNumber={(value) => String(value ?? '--')}
      collapsed={false}
      onCollapse={vi.fn()}
      onExpand={vi.fn()}
    />
  )
}

const jobSettingsVm = {
  jobDefaultsOpen: false,
  setJobDefaultsOpen: vi.fn(),
  jobSettingsDraft: {},
  wallPaintOptions: [],
  wallPrimerOptions: [],
  ceilingPaintOptions: [],
  ceilingPrimerOptions: [],
  trimPaintOptions: [],
  trimPrimerOptions: [],
  orgWallPaintLabel: 'Wall Paint',
  orgWallPrimerLabel: 'Wall Primer',
  orgCeilingPaintLabel: 'Ceiling Paint',
  orgCeilingPrimerLabel: 'Ceiling Primer',
  orgTrimPaintLabel: 'Trim Paint',
  orgTrimPrimerLabel: 'Trim Primer',
  updateJobSettings: vi.fn(),
} as unknown as EstimateV2EditorSettingsVm

describe('EstimateV2Sidebar', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('collapses to an expand-only room navigation rail', () => {
    const onCollapse = vi.fn()
    const onExpand = vi.fn()

    const { rerender } = render(
      <EstimateV2Sidebar
        styles={estimateV2EditorPageStyles}
        roomVm={roomVm}
        jobSettingsVm={jobSettingsVm}
        toDisplayNumber={(value) => String(value ?? '--')}
        collapsed={false}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse estimator room navigation' }))
    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Navigation')).not.toBeInTheDocument()
    expect(screen.getByText('Paint Defaults')).toBeInTheDocument()

    rerender(
      <EstimateV2Sidebar
        styles={estimateV2EditorPageStyles}
        roomVm={roomVm}
        jobSettingsVm={jobSettingsVm}
        toDisplayNumber={(value) => String(value ?? '--')}
        collapsed
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    )

    expect(screen.queryByText('Paint Defaults')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand estimator room navigation' }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('includes doors in room helper text when a room has included door scopes', () => {
    renderSidebar({
      ...roomVm,
      rooms: [{ id: 'room-1', roomId: 'R001', roomName: 'Bedroom', position: 0 }],
      selectedRoomId: 'R001',
      roomScopeByRoomId: new Map([['R001', [{ id: 'wall-1', include: 'Y' }]]]),
      roomCeilingScopeByRoomId: new Map([['R001', [{ id: 'ceiling-1', include: 'N' }]]]),
      roomTrimScopeByRoomId: new Map([['R001', [{ id: 'trim-1', include: 'Y' }]]]),
      roomDoorScopeByRoomId: new Map([['R001', [{ id: 'door-1', include: 'Y' }]]]),
      displayedRoomEffectiveAreaByRoomId: new Map([['R001', 384]]),
    } as unknown as EstimateV2EditorRoomVm)

    expect(screen.getByText('Walls, Trim, Doors')).toBeInTheDocument()
  })
})
