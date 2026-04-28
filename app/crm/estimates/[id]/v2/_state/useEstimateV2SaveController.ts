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
  prepareEstimateV2SaveState,
  resolveEstimateV2SaveResponseState,
  validateEstimateV2PreparedSave,
} from './estimateV2EditorSaveOrchestration'
import {
  applyEstimateV2PreparedSaveCollections,
  applyEstimateV2SuccessfulSaveState,
} from './estimateV2EditorStoreMutations'

const AUTO_SAVE_DELAY_MS = 900

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

      const preparedSave = prepareEstimateV2SaveState(currentState)
      applyEstimateV2PreparedSaveCollections(store, preparedSave)

      const issues = validateEstimateV2PreparedSave({
        currentState,
        prepared: preparedSave,
        trigger,
      })
      if (issues.length > 0) {
        if (trigger === 'manual') {
          meta.setValidationIssues(issues)
          console.error('Estimate V2 editor save blocked by validation', {
            estimateId,
            operation: 'save',
            trigger,
            message: issues[0],
          })
          meta.setError(createEstimateV2Error(issues[0], { code: 'VALIDATION', retryable: false }))
          meta.setSaveStatus('error')
        } else {
          meta.setSaveStatus('blocked')
          meta.setAutoSaveHint(issues[0])
        }
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
        console.error('Estimate V2 editor save failed', {
          estimateId,
          operation: 'save',
          trigger,
          status: response.status,
          message,
        })
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
        rollers: latestState.collections.rollers,
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
    }, AUTO_SAVE_DELAY_MS)
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
