'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  estimateV2StoreSelectors,
  useEstimateV2Store,
  type EstimateV2EditorStoreApi,
} from '@/lib/estimates/v2/store/estimateV2Store'
import { authedFetch } from '@/lib/auth/authedFetch'
import { getApiErrorMessage, getApiPayloadData, parseApiResponse } from '@/lib/client/api'
import { createEstimateV2Error } from '@/lib/estimator/errors'
import {
  createSaveRequestTracker,
  shouldQueueAutosave,
} from '@/lib/estimator/v2WallsAutosave'
import type { EstimateRouteFamily } from '../../estimateRouteFamily'
import type { EstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import { buildEstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import {
  buildEstimateV2EditorApiFailureDiagnostic,
  formatEstimateV2EditorApiFailureLog,
} from '../_lib/estimateV2EditorDiagnostics'
import {
  collectEstimateV2CalculationMissingInputIssues,
  deriveEstimateV2PreparedSaveValidation,
  resolveEstimateV2SaveResponseState,
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
  effectiveJobProductDefaults: {
    wallPaintProductId: string
    wallPrimerProductId: string
    ceilingPaintProductId: string
    ceilingPrimerProductId: string
    trimPaintProductId: string
    trimPrimerProductId: string
  }
}) {
  const { estimateId, routeFamily, store, currentSnapshot, dirty, effectiveJobProductDefaults } =
    params
  const meta = useEstimateV2Store(store, estimateV2StoreSelectors.meta)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<(trigger?: 'manual' | 'auto') => Promise<boolean>>(async () => false)
  const saveRequestTrackerRef = useRef(createSaveRequestTracker())

  const save = useCallback(
    async (trigger: 'manual' | 'auto' = 'manual'): Promise<boolean> => {
      const currentState = store.getState()
      if (!estimateId || currentState.meta.saving) return false

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
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

      const response = await authedFetch(routeFamily.estimateApiHref(estimateId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(trigger === 'auto' ? { 'X-Estimate-Save-Mode': 'auto' } : {}),
        body: JSON.stringify(preparedSave.payloadSnapshot.payload),
      })
      const parsed = await parseApiResponse(response)
      const payload = getApiPayloadData<unknown>(parsed.json)
      meta.setSaving(false)

      if (!saveRequestTrackerRef.current.isLatest(requestId)) {
        return false
      }

      if (!response.ok) {
        const message = getApiErrorMessage(response, parsed, 'Failed to save estimate')
        const diagnostic = buildEstimateV2EditorApiFailureDiagnostic({
          estimateId,
          endpoint: routeFamily.estimateApiHref(estimateId),
          method: 'PUT',
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
        return false
      }

      const latestState = store.getState()
      const latestSnapshot = buildEstimateV2DirtySnapshot({
        jobSettingsDraft: latestState.meta.jobSettingsDraft,
        rooms: latestState.collections.rooms,
        scopes: latestState.collections.scopes,
        segments: latestState.collections.segments,
        roomFlags: latestState.collections.roomFlags,
        ceilingScopes: latestState.collections.ceilingScopes,
        ceilingSegments: latestState.collections.ceilingSegments,
        trimScopes: latestState.collections.trimScopes,
        doorScopes: latestState.collections.doorScopes,
        drywallRepairs: latestState.collections.drywallRepairs,
        rollers: latestState.collections.rollers,
        accessFees: latestState.collections.accessFees,
        otherItems: latestState.collections.otherItems,
      })
      if (latestSnapshot.comparisonKey !== preparedSave.payloadSnapshot.comparisonKey) {
        meta.setSaveStatus('idle')
        return false
      }

      const responseState = resolveEstimateV2SaveResponseState({
        trigger,
        payload,
        meta,
        prepared: preparedSave,
        currentState: store.getState(),
        effectiveJobProductDefaults,
      })
      applyEstimateV2SuccessfulSaveState(store, responseState)
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
        return false
      }
      meta.setAutoSaveHint(null)
      meta.setSaveStatus('saved')
      return true
    },
    [effectiveJobProductDefaults, estimateId, meta, routeFamily, store]
  )

  useEffect(() => {
    saveRef.current = save
  }, [save])

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    if (!shouldQueueAutosave({ loading: meta.loading, saving: meta.saving, dirty })) return
    autoSaveTimerRef.current = setTimeout(() => {
      void saveRef.current('auto')
    }, ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [currentSnapshot.comparisonKey, dirty, meta.loading, meta.saving])

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    },
    []
  )

  return { save }
}
