'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  estimateV2StoreSelectors,
  useEstimateV2Store,
  type EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import { saveEstimateV2Inputs } from '@/lib/estimates/v2/client'
import { createEstimateV2Error } from '@/lib/estimator/errors'
import {
  createSaveRequestTracker,
  shouldQueueAutosave,
} from '@/lib/estimator/v2WallsAutosave'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import type { EstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import { areEstimateV2DirtySnapshotsEqual } from './estimateV2DirtySnapshot'
import {
  buildEstimateV2EditorApiFailureDiagnostic,
  formatEstimateV2EditorApiFailureLog,
} from '../_lib/estimateV2EditorDiagnostics'
import {
  buildEstimateV2SaveSnapshot,
  collectEstimateV2CalculationMissingInputIssues,
  deriveEstimateV2PreparedSaveValidation,
  hasEstimateV2SaveStateChangedSincePrepared,
  reconcileEstimateV2SaveResponseFromState,
} from './estimateV2EditorSaveOrchestration'
import {
  applyEstimateV2PreparedSaveCollections,
  applyEstimateV2SuccessfulSaveState,
} from './estimateV2EditorStoreMutations'

export const ESTIMATE_V2_AUTO_SAVE_DELAY_MS = 5000

export function useEstimateV2SaveController(params: {
  estimateId?: string
  routeFamily: EstimateRouteFamily
  store: EstimateV2EditorStoreApi
  currentSnapshot: EstimateV2DirtySnapshot
  dirty: boolean
  commitFocusedEditorField?: () => void
  navigateToDetails?: (href: string) => void
  effectiveJobProductDefaults: {
    wallPaintProductId: string
    wallPrimerProductId: string
    ceilingPaintProductId: string
    ceilingPrimerProductId: string
    trimPaintProductId: string
    trimPrimerProductId: string
  }
}) {
  const {
    estimateId,
    routeFamily,
    store,
    currentSnapshot,
    dirty,
    commitFocusedEditorField,
    navigateToDetails,
    effectiveJobProductDefaults,
  } = params
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<(trigger?: 'manual' | 'auto') => Promise<boolean>>(async () => false)
  const saveRequestTrackerRef = useRef(createSaveRequestTracker())
  const lastAutosavedComparisonKeyRef = useRef<string | null>(null)
  const queuedManualSaveRef = useRef(false)

  const save = useCallback(
    async (trigger: 'manual' | 'auto' = 'manual'): Promise<boolean> => {
      const currentState = store.getState()
      if (!estimateId || !currentState.meta.estimate) return false
      if (currentState.meta.saving) {
        if (trigger === 'manual') {
          queuedManualSaveRef.current = true
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current)
            autoSaveTimerRef.current = null
          }
        }
        return false
      }

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }

      const runQueuedManualSave = async (currentResult: boolean) => {
        if (!queuedManualSaveRef.current) return currentResult
        queuedManualSaveRef.current = false
        return saveRef.current('manual')
      }

      const { prepared: preparedSave, issues } = deriveEstimateV2PreparedSaveValidation({
        collections: currentState.collections,
        jobSettingsDraft: currentState.meta.jobSettingsDraft,
        trigger,
      })
      applyEstimateV2PreparedSaveCollections(store, preparedSave)
      if (issues.length > 0) {
        meta.setValidationIssues(issues)
        meta.setAutoSaveHint(issues[0] ?? null)
        meta.setError(null)
        meta.setSaveStatus('blocked')
        meta.setDebugMeta((prev) => ({
          ...prev,
          dirtySource: trigger === 'auto' ? 'save:auto' : 'save:manual',
          lastSaveTrigger: trigger,
          lastNormalizedDomains: preparedSave.normalizedDomains,
        }))
        return false
      }

      meta.setValidationIssues([])
      meta.setAutoSaveHint(null)
      meta.setSaving(true)
      const requestId = saveRequestTrackerRef.current.start()
      if (trigger === 'manual') {
        meta.setError(null)
        meta.setSaveStatus('idle')
      } else {
        meta.setSaveStatus('autosaving')
      }
      meta.setDebugMeta((prev) => ({
        ...prev,
        dirtySource: trigger === 'auto' ? 'save:auto' : 'save:manual',
        lastSaveTrigger: trigger,
        lastNormalizedDomains: preparedSave.normalizedDomains,
      }))

      const saveResult = await saveEstimateV2Inputs({
        endpoint: routeFamily.estimateApiHref(estimateId),
        payload: preparedSave.payloadSnapshot.payload,
        trigger,
      })
      const { response, parsed, payload } = saveResult
      meta.setSaving(false)

      if (!saveRequestTrackerRef.current.isLatest(requestId)) {
        return runQueuedManualSave(false)
      }

      if (!response.ok) {
        const message = saveResult.errorMessage ?? 'Failed to save estimate'
        const diagnostic = buildEstimateV2EditorApiFailureDiagnostic({
          estimateId,
          endpoint: saveResult.endpoint,
          method: saveResult.method,
          operation: 'save',
          trigger,
          response,
          parsed,
          message,
        })
        console.error(
          'Estimate V2 editor save failed',
          formatEstimateV2EditorApiFailureLog(diagnostic),
          diagnostic
        )
        meta.setError(createEstimateV2Error(message, { retryable: true }))
        meta.setSaveStatus('error')
        return runQueuedManualSave(false)
      }

      const latestState = store.getState()
      const latestSnapshot = buildEstimateV2SaveSnapshot({
        collections: latestState.collections,
        jobSettingsDraft: latestState.meta.jobSettingsDraft,
      })
      if (
        hasEstimateV2SaveStateChangedSincePrepared({
          latestSnapshot,
          prepared: preparedSave,
        })
      ) {
        meta.setLastSavedSnapshot(preparedSave.payloadSnapshot)
        meta.setSaveStatus('idle')
        return runQueuedManualSave(false)
      }

      const responseState = reconcileEstimateV2SaveResponseFromState({
        trigger,
        payload,
        meta,
        prepared: preparedSave,
        currentState: latestState,
        effectiveJobProductDefaults,
      })
      applyEstimateV2SuccessfulSaveState(store, responseState, {
        updateLastSavedSnapshot: trigger === 'manual',
      })
      const calculationIssues = collectEstimateV2CalculationMissingInputIssues({
        wallCalculations: responseState.calculations.wallCalculations,
        ceilingCalculations: responseState.calculations.ceilingCalculations,
        trimCalculations: responseState.calculations.trimCalculations,
        doorCalculations: responseState.calculations.doorCalculations,
        drywallCalculations: responseState.calculations.drywallCalculations,
      })
      meta.setValidationIssues(calculationIssues)
      if (calculationIssues.length > 0) {
        meta.setAutoSaveHint(calculationIssues[0] ?? null)
        meta.setSaveStatus('blocked')
        return runQueuedManualSave(false)
      }
      meta.setAutoSaveHint(null)
      if (trigger === 'manual') {
        meta.setSaveStatus('saved')
        lastAutosavedComparisonKeyRef.current = null
      } else {
        lastAutosavedComparisonKeyRef.current = preparedSave.payloadSnapshot.comparisonKey
        meta.setSaveStatus('idle')
      }
      return runQueuedManualSave(true)
    },
    [effectiveJobProductDefaults, estimateId, meta, routeFamily, store]
  )

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const saveDraft = useCallback(() => {
    commitFocusedEditorField?.()
    void saveRef.current('manual')
  }, [commitFocusedEditorField])

  const saveAndContinue = useCallback(() => {
    if (!estimateId) return
    commitFocusedEditorField?.()

    const latestState = store.getState()
    const latestSnapshot = buildEstimateV2SaveSnapshot({
      collections: latestState.collections,
      jobSettingsDraft: latestState.meta.jobSettingsDraft,
    })
    const detailsHref = routeFamily.detailsHref(estimateId)
    if (areEstimateV2DirtySnapshotsEqual(latestSnapshot, latestState.meta.lastSavedSnapshot)) {
      navigateToDetails?.(detailsHref)
      return
    }

    void saveRef.current('manual').then((ok) => {
      if (ok) navigateToDetails?.(detailsHref)
    })
  }, [commitFocusedEditorField, estimateId, navigateToDetails, routeFamily, store])

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    if (!meta.estimate) return
    if (!shouldQueueAutosave({ loading: meta.loading, saving: meta.saving, dirty })) return
    if (lastAutosavedComparisonKeyRef.current === currentSnapshot.comparisonKey) return
    autoSaveTimerRef.current = setTimeout(() => {
      void saveRef.current('auto')
    }, ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [currentSnapshot.comparisonKey, dirty, meta.estimate, meta.loading, meta.saving])

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    },
    []
  )

  return { save, saveDraft, saveAndContinue }
}
