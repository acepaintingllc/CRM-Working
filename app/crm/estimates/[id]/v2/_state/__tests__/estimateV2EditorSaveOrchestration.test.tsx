import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import {
  prepareEstimateV2SaveState,
  resolveEstimateV2SaveResponseState,
  validateEstimateV2PreparedSave,
} from '../estimateV2EditorSaveOrchestration'

function createCurrentState() {
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
      saveStatus: 'idle',
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

  return { fixture, currentState: store.getState() }
}

describe('estimateV2EditorSaveOrchestration', () => {
  it('prepares canonical save collections with room-mode-aware validation inputs', () => {
    const { currentState } = createCurrentState()
    currentState.setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r002-excluded'
          ? {
              ...scope,
              include: 'Y',
              measurementMode: 'ROOM_HELPER',
              helperSource: 'ROOM_PERIMETER',
              helperValue: '12',
              measurementValue: '12',
            }
          : scope
      )
    )

    const prepared = prepareEstimateV2SaveState(currentState)
    const issues = validateEstimateV2PreparedSave({ currentState, prepared })

    expect(prepared.payloadSnapshot.payload.room_trim_scopes).toHaveLength(2)
    expect(issues).toEqual([])
    expect(prepared.roomModeById.get('R002')).toBe('SEG')
  })

  it('reconciles manual save responses back to canonical collections without duplicating job defaults', () => {
    const { fixture, currentState } = createCurrentState()
    const prepared = prepareEstimateV2SaveState(currentState)

    const result = resolveEstimateV2SaveResponseState({
      trigger: 'manual',
      payload: fixture.summaryData,
      meta: currentState.meta,
      prepared,
      currentState,
      effectiveJobProductDefaults: fixture.orgJobProductDefaults,
    })

    expect(
      result.collections.scopes.find((scope) => scope.id === 'wall-r001-main')?.paintProductId
    ).toBe('')
    expect(
      result.collections.ceilingScopes.find((scope) => scope.id === 'ceiling-r001-main')
        ?.primerProductId
    ).toBe('')
    expect(result.calculations.wallCalculations?.scopes).toHaveLength(
      fixture.wallCalculations.scopes?.length ?? 0
    )
    expect(result.lastSavedSnapshot.comparisonKey).toBeTruthy()
  })
})
