import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { useEstimateV2RoomActions } from '../useEstimateV2RoomActions'

function createRoomActionsHarness() {
  const fixture = createMixedEstimateV2Fixture()
  const requestDestructiveConfirm = vi.fn()
  const store = createEstimateV2Store({
    collections: {
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
      doorScopes: fixture.doorScopes,
      drywallRepairs: fixture.drywallRepairs,
    },
    meta: {
      loading: false,
      saving: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: fixture.catalogs,
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      selectedRoomId: 'R001',
      error: null,
      validationIssues: [],
      lastSavedSnapshot: fixture.currentSnapshot,
      saveStatus: 'saved',
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: false,
      jobSettingsDraft: fixture.jobSettingsDraft,
      orgJobProductDefaults: fixture.orgJobProductDefaults,
      customerDraft: {
        customerId: fixture.job.customer_id ?? '',
        name: fixture.job.customer_name ?? '',
        email: fixture.job.customer_email ?? '',
        phone: fixture.job.customer_phone ?? '',
        address: fixture.job.customer_address ?? '',
      },
      debugMeta: {
        dirtySource: null,
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
    },
  })

  const hook = renderHook(() =>
    useEstimateV2RoomActions({
      store,
      roomModeById: new Map([
        ['R001', 'RECT'],
        ['R002', 'SEG'],
      ]),
      trimTypeOptions: fixture.catalogs.trim_items,
      requestDestructiveConfirm,
    })
  )

  return { fixture, store, hook, requestDestructiveConfirm }
}

describe('useEstimateV2RoomActions', () => {
  it('orchestrates room dimension edits through wall and ceiling scope store updates', () => {
    const { store, hook } = createRoomActionsHarness()

    act(() => {
      hook.result.current.handleRoomDimChange('R001', 'widthIn', '156')
    })

    const state = store.getState()
    const room = state.collections.rooms.find((entry) => entry.roomId === 'R001')
    const wallScope = state.collections.scopes.find((scope) => scope.id === 'wall-r001-main')
    const ceilingScope = state.collections.ceilingScopes.find((scope) => scope.id === 'ceiling-r001-main')

    expect(room?.widthIn).toBe('156')
    expect(wallScope?.perimeterIn).toBe('552')
    expect(ceilingScope?.lengthIn).toBe('120')
    expect(ceilingScope?.widthIn).toBe('156')
    expect(state.meta.debugMeta.dirtySource).toBe('room')
  })

  it('queues a local room delete intent instead of deleting immediately', () => {
    const { hook, requestDestructiveConfirm, store } = createRoomActionsHarness()

    act(() => {
      hook.result.current.deleteRoom('R001')
    })

    expect(requestDestructiveConfirm).toHaveBeenCalledTimes(1)
    expect(store.getState().collections.rooms.some((room) => room.roomId === 'R001')).toBe(true)

    const [intent] = requestDestructiveConfirm.mock.calls[0] as [
      { kind: string; roomLabel: string; hasNestedData: boolean; run: () => void },
    ]
    expect(intent.kind).toBe('room-delete')
    expect(intent.roomLabel).toContain('R001')
    expect(intent.hasNestedData).toBe(true)

    act(() => {
      intent.run()
    })

    expect(store.getState().collections.rooms.some((room) => room.roomId === 'R001')).toBe(false)
    expect(store.getState().meta.debugMeta.dirtySource).toBe('room')
  })

  it('queues a geometry reset intent when switching a segmented room back to RECT', () => {
    const { hook, requestDestructiveConfirm, store } = createRoomActionsHarness()

    act(() => {
      hook.result.current.switchRoomGeometryMode('R002', 'RECT')
    })

    expect(requestDestructiveConfirm).toHaveBeenCalledTimes(1)
    const segmentCountBefore = store.getState().collections.segments.filter((segment) => segment.roomId === 'R002').length
    expect(segmentCountBefore).toBeGreaterThan(0)

    const [intent] = requestDestructiveConfirm.mock.calls[0] as [
      { kind: string; nextMode: string; run: () => void },
    ]
    expect(intent.kind).toBe('room-geometry-reset')
    expect(intent.nextMode).toBe('RECT')

    act(() => {
      intent.run()
    })

    const segmentCountAfter = store.getState().collections.segments.filter((segment) => segment.roomId === 'R002').length
    expect(segmentCountAfter).toBe(0)
    expect(store.getState().meta.debugMeta.dirtySource).toBe('room')
  })
})
