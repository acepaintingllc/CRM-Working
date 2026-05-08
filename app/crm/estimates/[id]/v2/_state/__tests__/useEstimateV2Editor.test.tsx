import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEstimateV2Editor } from '../useEstimateV2Editor'

const reloadWorkspace = vi.fn()
const reloadCatalogs = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const editorContract = {
  pageVm: { loading: true, catalogsError: null, catalogsReloading: false },
  headerVm: { estimateId: 'estimate-1' },
  summaryVm: { roomLabel: 'R001' },
  roomVm: { updateSelectedRoom: vi.fn() },
  wallsVm: { updateScope: vi.fn() },
  ceilingsVm: { updateScope: vi.fn() },
  trimVm: { updateScope: vi.fn() },
  doorsVm: { updateScope: vi.fn() },
  jobSettingsVm: { updateJobSettings: vi.fn() },
  saveVm: { save: vi.fn(), dirty: true },
  navigationVm: {
    unsavedDialogProps: {
      isOpen: false,
      canSave: true,
      onStay: vi.fn(),
      onSave: vi.fn(),
      onLeave: vi.fn(),
    },
  },
  navigationActions: { requestBackNavigation: vi.fn() },
  destructiveConfirmVm: {
    isOpen: false,
    labelledBy: 'estimate-v2-destructive-confirm-title',
    title: '',
    description: '',
    closeLabel: 'Close destructive confirmation',
    warning: '',
    info: null,
    confirmLabel: 'Confirm',
    confirmAriaLabel: 'Confirm destructive change',
  },
  destructiveConfirmActions: {
    request: expect.any(Function),
    confirm: expect.any(Function),
    cancel: expect.any(Function),
  },
  toDisplayNumber: vi.fn(),
}

vi.mock('../useEstimateV2EditorLoader', () => ({
  useEstimateV2EditorLoader: () => ({
    catalogsReloading: false,
    reloadCatalogs,
    reloadWorkspace,
  }),
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
  useEstimateV2SaveController: () => ({
    save: vi.fn(async () => true),
    saveDraft: vi.fn(),
    saveAndContinue: vi.fn(),
  }),
}))

vi.mock('../useEstimateV2GuardedNavigation', () => ({
  useEstimateV2GuardedNavigation: () => ({
    navigationVm: editorContract.navigationVm,
    navigationActions: editorContract.navigationActions,
  }),
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
      'doorsVm',
      'jobSettingsVm',
      'saveVm',
      'navigationVm',
      'navigationActions',
      'destructiveConfirmVm',
      'destructiveConfirmActions',
      'toDisplayNumber',
      'reloadCatalogs',
      'reloadWorkspace',
    ])
  })

  it('exposes the loader retry action through the editor contract', () => {
    const { result } = renderHook(() => useEstimateV2Editor({ estimateId: 'estimate-1' }))

    result.current.reloadWorkspace()

    expect(reloadWorkspace).toHaveBeenCalledTimes(1)
  })

  it('exposes the catalog retry action through the editor contract', () => {
    const { result } = renderHook(() => useEstimateV2Editor({ estimateId: 'estimate-1' }))

    result.current.reloadCatalogs()

    expect(reloadCatalogs).toHaveBeenCalledTimes(1)
  })

  it('owns destructive confirmation state locally and runs deferred actions on confirm', () => {
    const run = vi.fn()
    const { result } = renderHook(() => useEstimateV2Editor({ estimateId: 'estimate-1' }))

    act(() => {
      result.current.destructiveConfirmActions.request({
        kind: 'trim-delete',
        roomId: 'R001',
        roomLabel: 'Living Room (R001)',
        scopeId: 'trim-1',
        scopeLabel: 'Baseboards',
        run,
      })
    })

    expect(result.current.destructiveConfirmVm.isOpen).toBe(true)
    expect(result.current.destructiveConfirmVm.title).toBe('Delete Baseboards?')

    act(() => {
      expect(result.current.destructiveConfirmActions.confirm()).toBe(true)
    })

    expect(run).toHaveBeenCalledTimes(1)
    expect(result.current.destructiveConfirmVm.isOpen).toBe(false)
  })

  it('clears a pending destructive intent on cancel', () => {
    const { result } = renderHook(() => useEstimateV2Editor({ estimateId: 'estimate-1' }))

    act(() => {
      result.current.destructiveConfirmActions.request({
        kind: 'door-delete',
        roomId: 'R001',
        roomLabel: 'Living Room (R001)',
        scopeId: 'door-1',
        scopeLabel: 'Front Door',
        run: vi.fn(),
      })
    })

    expect(result.current.destructiveConfirmVm.isOpen).toBe(true)

    act(() => {
      result.current.destructiveConfirmActions.cancel()
    })

    expect(result.current.destructiveConfirmVm.isOpen).toBe(false)
  })
})
