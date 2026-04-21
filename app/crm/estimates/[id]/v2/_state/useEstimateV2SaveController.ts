'use client'

import { useCallback, useEffect, useRef } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { createEstimateV2Error } from '@/lib/estimator/errors'
import {
  createSaveRequestTracker,
  shouldQueueAutosave,
} from '@/lib/estimator/v2WallsAutosave'
import { buildEstimateV2SavePayload, sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import { validateV2WallsBeforeSave } from '@/lib/estimator/v2WallsValidation'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { validateV2CeilingsBeforeSave } from '@/lib/estimator/v2CeilingsValidation'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { validateV2TrimBeforeSave } from '@/lib/estimator/v2TrimValidation'
import {
  normalizeCeilingScope,
  normalizeCeilingSegment,
  normalizeScope,
  normalizeSegment,
  normalizeTrimScope,
  resolveRoomModeById,
} from '../_lib/estimateV2EditorNormalize'
import type { EstimateV2WallCalculationsPayload } from '@/types/estimator/v2'
import type {
  EstimateV2EditorCollections,
  EstimateV2EditorMetaState,
  NormalizedDomain,
  Unsafe,
} from './estimateV2EditorTypes'

const AUTO_SAVE_DELAY_MS = 900

export function useEstimateV2SaveController(params: {
  estimateId?: string
  collections: EstimateV2EditorCollections
  meta: EstimateV2EditorMetaState
  currentSnapshot: string
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
  const { estimateId, collections, meta, currentSnapshot, dirty, effectiveJobProductDefaults } = params
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef<(trigger?: 'manual' | 'auto') => Promise<boolean>>(async () => false)
  const saveRequestTrackerRef = useRef(createSaveRequestTracker())

  const normalizeJobDefaultProductOverride = useCallback((productId: string, defaultProductId: string) => {
    return !productId || productId === defaultProductId ? '' : productId
  }, [])

  const save = useCallback(
    async (trigger: 'manual' | 'auto' = 'manual'): Promise<boolean> => {
      if (!estimateId || meta.saving) return false
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }

      const normalizedDomains: NormalizedDomain[] = []
      const sanitizedWalls = sanitizeV2WallsDrafts({
        rooms: collections.rooms,
        scopes: collections.scopes,
        segments: collections.segments,
      })
      const scopeRowsForSave = sanitizedWalls.scopes
      const segmentRowsForSave = sanitizedWalls.segments
      if (sanitizedWalls.changed) normalizedDomains.push('walls')

      const sanitizedCeilings = sanitizeV2CeilingsDrafts({
        rooms: collections.rooms.map((room) => ({
          roomId: room.roomId,
          lengthIn: room.lengthIn,
          widthIn: room.widthIn,
          position: room.position,
        })),
        ceilingScopes: collections.ceilingScopes,
        ceilingSegments: collections.ceilingSegments,
      })
      const ceilingScopesForSave = sanitizedCeilings.ceilingScopes
      const ceilingSegmentsForSave = sanitizedCeilings.ceilingSegments
      if (sanitizedCeilings.changed) {
        normalizedDomains.push('ceilings')
        collections.setCeilingScopes(ceilingScopesForSave)
        collections.setCeilingSegments(ceilingSegmentsForSave)
      }

      const saveRoomModeById = resolveRoomModeById({
        rooms: collections.rooms,
        wallScopes: scopeRowsForSave,
        ceilingScopes: ceilingScopesForSave,
      })
      const sanitizedTrim = sanitizeV2TrimDrafts({
        rooms: collections.rooms.map((room) => ({
          roomId: room.roomId,
          mode: saveRoomModeById.get(room.roomId) ?? 'RECT',
          position: room.position,
        })),
        trimScopes: collections.trimScopes,
      })
      const trimScopesForSave = sanitizedTrim.trimScopes
      if (sanitizedTrim.changed) {
        normalizedDomains.push('trim')
        collections.setTrimScopes(trimScopesForSave)
      }

      const payloadForSave = buildEstimateV2SavePayload(
        collections.rooms,
        scopeRowsForSave,
        segmentRowsForSave,
        collections.roomFlags,
        ceilingScopesForSave,
        ceilingSegmentsForSave,
        trimScopesForSave
      )

      if (sanitizedWalls.changed) {
        collections.setScopes(scopeRowsForSave)
        collections.setSegments(segmentRowsForSave)
      }

      const wallIssues = validateV2WallsBeforeSave({
        rooms: collections.rooms,
        scopes: scopeRowsForSave,
        segments: segmentRowsForSave,
      })
      const ceilingIssues = validateV2CeilingsBeforeSave({
        rooms: collections.rooms.map((room) => ({
          roomId: room.roomId,
          roomName: room.roomName,
          position: room.position,
        })),
        ceilingScopes: ceilingScopesForSave,
        ceilingSegments: ceilingSegmentsForSave,
      })
      const trimIssues = validateV2TrimBeforeSave({
        rooms: collections.rooms.map((room) => ({
          roomId: room.roomId,
          roomName: room.roomName,
          mode: saveRoomModeById.get(room.roomId) ?? 'RECT',
          position: room.position,
        })),
        trimScopes: trimScopesForSave.map((scope) => ({
          id: scope.id,
          roomId: scope.roomId,
          position: scope.position,
          include: scope.include,
          trimTypeId: scope.trimTypeId,
          measurementMode: scope.measurementMode,
          helperSource: scope.helperSource || null,
          measurementValue: scope.measurementValue,
        })),
      })
      const issues = [...wallIssues, ...ceilingIssues, ...trimIssues]
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
          lastNormalizedDomains: normalizedDomains,
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
        lastNormalizedDomains: normalizedDomains,
      }))

      const response = await authedFetch(`/api/quotes/${estimateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        ...(trigger === 'auto' ? { 'X-Estimate-Save-Mode': 'auto' } : {}),
        body: JSON.stringify(payloadForSave),
      })
      const payload = await response.json().catch(() => null)
      meta.setSaving(false)

      if (!saveRequestTrackerRef.current.isLatest(requestId)) {
        return false
      }

      if (!response.ok) {
        const message = payload?.error ?? response.statusText
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

      const nextWallCalculations =
        payload != null && typeof payload === 'object' && 'wall_calculations' in payload
          ? ((payload as { wall_calculations?: EstimateV2WallCalculationsPayload }).wall_calculations ?? null)
          : meta.wallCalculations

      let nextScopes = scopeRowsForSave
      let nextSegments = segmentRowsForSave
      if (trigger === 'manual') {
        if (nextWallCalculations?.scopes) {
          nextScopes = sortByPosition(
            nextWallCalculations.scopes.map((scope, index) => {
              const normalized = normalizeScope(scope, index)
              return {
                ...normalized,
                paintProductId: normalizeJobDefaultProductOverride(
                  normalized.paintProductId,
                  effectiveJobProductDefaults.wallPaintProductId
                ),
                primerProductId: normalizeJobDefaultProductOverride(
                  normalized.primerProductId,
                  effectiveJobProductDefaults.wallPrimerProductId
                ),
              }
            })
          )
          collections.setScopes(nextScopes)
        }
        if (nextWallCalculations?.segments) {
          nextSegments = sortByPosition(nextWallCalculations.segments.map(normalizeSegment))
          collections.setSegments(nextSegments)
        }
      }
      meta.setWallCalculations(nextWallCalculations)

      const nextCeilingCalc =
        payload != null && typeof payload === 'object' && 'ceiling_calculations' in payload
          ? ((payload as { ceiling_calculations?: Unsafe }).ceiling_calculations ?? null)
          : meta.ceilingCalculations
      let nextCeilingScopes = ceilingScopesForSave
      let nextCeilingSegments = ceilingSegmentsForSave
      if (trigger === 'manual') {
        if (nextCeilingCalc && Array.isArray((nextCeilingCalc as Unsafe).scopes)) {
          nextCeilingScopes = sortByPosition(
            ((nextCeilingCalc as Unsafe).scopes as Unsafe[]).map((scope, index) => {
              const normalized = normalizeCeilingScope(scope, index)
              return {
                ...normalized,
                paintProductId: normalizeJobDefaultProductOverride(
                  normalized.paintProductId,
                  effectiveJobProductDefaults.ceilingPaintProductId
                ),
                primerProductId: normalizeJobDefaultProductOverride(
                  normalized.primerProductId,
                  effectiveJobProductDefaults.ceilingPrimerProductId
                ),
              }
            })
          )
          collections.setCeilingScopes(nextCeilingScopes)
        }
        if (nextCeilingCalc && Array.isArray((nextCeilingCalc as Unsafe).segments)) {
          nextCeilingSegments = sortByPosition(
            ((nextCeilingCalc as Unsafe).segments as Unsafe[]).map(normalizeCeilingSegment)
          )
          collections.setCeilingSegments(nextCeilingSegments)
        }
      }
      meta.setCeilingCalculations(nextCeilingCalc)

      const nextTrimCalc =
        payload != null && typeof payload === 'object' && 'trim_calculations' in payload
          ? ((payload as { trim_calculations?: Unsafe }).trim_calculations ?? null)
          : meta.trimCalculations
      let nextTrimScopes = trimScopesForSave
      if (trigger === 'manual' && nextTrimCalc && Array.isArray((nextTrimCalc as Unsafe).scopes)) {
        nextTrimScopes = sortByPosition(
          ((nextTrimCalc as Unsafe).scopes as Unsafe[]).map((scope, index) => {
            const normalized = normalizeTrimScope(scope, index)
            return {
              ...normalized,
              paintProductId: normalizeJobDefaultProductOverride(
                normalized.paintProductId,
                effectiveJobProductDefaults.trimPaintProductId
              ),
              primerProductId: normalizeJobDefaultProductOverride(
                normalized.primerProductId,
                effectiveJobProductDefaults.trimPrimerProductId
              ),
            }
          })
        )
        collections.setTrimScopes(nextTrimScopes)
      }
      meta.setTrimCalculations(nextTrimCalc)

      meta.setEstimate((prev) => (prev ? { ...prev, updated_at: new Date().toISOString() } : prev))
      meta.setLastSavedSnapshot(
        JSON.stringify(
          buildEstimateV2SavePayload(
            collections.rooms,
            nextScopes,
            nextSegments,
            collections.roomFlags,
            nextCeilingScopes,
            nextCeilingSegments,
            nextTrimScopes
          )
        )
      )
      meta.setSaveStatus('saved')
      return true
    },
    [collections, effectiveJobProductDefaults, estimateId, meta, normalizeJobDefaultProductOverride]
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
  }, [currentSnapshot, dirty, meta.loading, meta.saving])

  useEffect(
    () => () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    },
    []
  )

  return { save }
}
