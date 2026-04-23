import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEstimateV2Editor } from '../useEstimateV2Editor'

const editorContract = {
  pageVm: { loading: true },
  headerVm: { estimateId: 'estimate-1' },
  summaryVm: { roomLabel: 'R001' },
  roomVm: { updateSelectedRoom: vi.fn() },
  wallsVm: { updateScope: vi.fn() },
  ceilingsVm: { updateScope: vi.fn() },
  trimVm: { updateScope: vi.fn() },
  jobSettingsVm: { updateJobSettings: vi.fn() },
  saveVm: { save: vi.fn(), dirty: true },
  toDisplayNumber: vi.fn(),
}

vi.mock('../useEstimateV2EditorLoader', () => ({
  useEstimateV2EditorLoader: () => undefined,
}))

vi.mock('../useEstimateV2BeforeUnload', () => ({
  useEstimateV2BeforeUnload: () => undefined,
}))

vi.mock('../useEstimateV2DerivedState', () => ({
  useEstimateV2DerivedState: () => ({
    dirty: true,
    sections: {
      catalog: {
        trimTypeOptions: [],
        defaultColorCodeId: 'COLOR1',
      },
      room: {
        roomModeById: new Map([['R001', 'RECT']]),
        roomHeightFactorByRoomId: new Map([['R001', '1']]),
      },
      calculation: {
        dirty: true,
        currentSnapshot: { payload: {} as never, comparisonKey: '{}' },
      },
    },
  }),
}))

vi.mock('../useEstimateV2RoomActions', () => ({
  useEstimateV2RoomActions: () => ({ addRoom: vi.fn() }),
}))

vi.mock('../useEstimateV2WallActions', () => ({
  useEstimateV2WallActions: () => ({ updateScope: vi.fn() }),
}))

vi.mock('../useEstimateV2CeilingActions', () => ({
  useEstimateV2CeilingActions: () => ({ updateScope: vi.fn() }),
}))

vi.mock('../useEstimateV2TrimActions', () => ({
  useEstimateV2TrimActions: () => ({ updateScope: vi.fn() }),
}))

vi.mock('../useEstimateV2SettingsActions', () => ({
  useEstimateV2SettingsActions: () => ({ updateJobSettings: vi.fn() }),
}))

vi.mock('../useEstimateV2SaveController', () => ({
  useEstimateV2SaveController: () => ({ save: vi.fn(async () => true) }),
}))

vi.mock('../useEstimateV2EditorViewModels', () => ({
  useEstimateV2EditorViewModels: () => editorContract,
}))

describe('useEstimateV2Editor', () => {
  it('returns the stable page contract shape', () => {
    const { result } = renderHook(() => useEstimateV2Editor({ estimateId: 'estimate-1' }))

    expect(result.current).toMatchObject(editorContract)
    expect(Object.keys(result.current)).toEqual([
      'pageVm',
      'headerVm',
      'summaryVm',
      'roomVm',
      'wallsVm',
      'ceilingsVm',
      'trimVm',
      'jobSettingsVm',
      'saveVm',
      'toDisplayNumber',
    ])
  })
})
