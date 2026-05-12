'use client'

import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  EstimateV2EditorLoadState,
} from './estimateV2EditorLoadOrchestration'
import type {
  EstimateV2PreparedSaveState,
  EstimateV2ResolvedSaveState,
} from './estimateV2EditorSaveOrchestration'

export function applyEstimateV2PreparedSaveCollections(
  store: EstimateV2EditorStoreApi,
  prepared: Pick<EstimateV2PreparedSaveState, 'collections'>
) {
  const state = store.getState()
  state.setScopes(prepared.collections.scopes)
  state.setSegments(prepared.collections.segments)
  state.setCeilingScopes(prepared.collections.ceilingScopes)
  state.setCeilingSegments(prepared.collections.ceilingSegments)
  state.setTrimScopes(prepared.collections.trimScopes)
  state.setDoorScopes(prepared.collections.doorScopes ?? [])
  state.setDrywallRepairs(prepared.collections.drywallRepairs ?? [])
  state.setAccessFees(prepared.collections.accessFees ?? [])
  state.setPrejobTrips(prepared.collections.prejobTrips ?? [])
  state.setOtherItems(prepared.collections.otherItems ?? [])
}

export function applyEstimateV2SuccessfulSaveState(
  store: EstimateV2EditorStoreApi,
  responseState: EstimateV2ResolvedSaveState,
  options?: { updateLastSavedSnapshot?: boolean }
) {
  const state = store.getState()
  applyEstimateV2PreparedSaveCollections(store, responseState)
  state.setWallCalculations(responseState.calculations.wallCalculations)
  state.setCeilingCalculations(responseState.calculations.ceilingCalculations)
  state.setTrimCalculations(responseState.calculations.trimCalculations)
  state.setDoorCalculations(responseState.calculations.doorCalculations ?? null)
  state.setDrywallCalculations(responseState.calculations.drywallCalculations ?? null)
  state.setPricingSummary(responseState.calculations.pricingSummary)
  state.setEstimate(responseState.estimate)
  if (options?.updateLastSavedSnapshot !== false) {
    state.setLastSavedSnapshot(responseState.lastSavedSnapshot)
  }
}

export function applyEstimateV2EditorLoadState(
  store: EstimateV2EditorStoreApi,
  nextLoadState: EstimateV2EditorLoadState
) {
  const state = store.getState()
  state.setCollections(nextLoadState.collections)
  state.setMeta((prev) => ({
    ...prev,
    ...nextLoadState.meta,
  }))
  state.setSaveStatus(nextLoadState.saveStatus)
  state.setLoading(false)
}
