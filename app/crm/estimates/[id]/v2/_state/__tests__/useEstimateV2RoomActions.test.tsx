import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { useEstimateV2RoomActions } from '../useEstimateV2RoomActions'

function createRoomActionsHarness() {
  const fixture = createMixedEstimateV2Fixture()
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
    })
  )

  return { fixture, store, hook }
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
})
