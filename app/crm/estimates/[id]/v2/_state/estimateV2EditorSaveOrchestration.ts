'use client'

import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import { validateV2WallsBeforeSave } from '@/lib/estimator/v2WallsValidation'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { validateV2CeilingsBeforeSave } from '@/lib/estimator/v2CeilingsValidation'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { validateV2TrimBeforeSave } from '@/lib/estimator/v2TrimValidation'
import type { EstimateV2EditorStoreState } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  EstimateV2PricingSummary,
  EstimateV2WallCalculationsPayload,
} from '@/types/estimator/v2'
import {
  normalizeCeilingScope,
  normalizeCeilingSegment,
  normalizeScope,
  normalizeSegment,
  normalizeTrimScope,
  resolveRoomModeById,
} from '../_lib/estimateV2EditorNormalize'
import type { EstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import { buildEstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import type { NormalizedDomain, Unsafe } from './estimateV2EditorTypes'

type EstimateV2SaveCollections = EstimateV2EditorStoreState['collections']
type EstimateV2SaveMeta = EstimateV2EditorStoreState['meta']

export type EstimateV2PreparedSaveState = {
  normalizedDomains: NormalizedDomain[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  collections: {
    scopes: EstimateV2SaveCollections['scopes']
    segments: EstimateV2SaveCollections['segments']
    ceilingScopes: EstimateV2SaveCollections['ceilingScopes']
    ceilingSegments: EstimateV2SaveCollections['ceilingSegments']
    trimScopes: EstimateV2SaveCollections['trimScopes']
    rollers: EstimateV2SaveCollections['rollers']
  }
  payloadSnapshot: EstimateV2DirtySnapshot
}

export function prepareEstimateV2SaveState(
  currentState: EstimateV2EditorStoreState
): EstimateV2PreparedSaveState {
  const normalizedDomains: NormalizedDomain[] = []
  const sanitizedWalls = sanitizeV2WallsDrafts({
    rooms: currentState.collections.rooms,
    scopes: currentState.collections.scopes,
    segments: currentState.collections.segments,
  })
  if (sanitizedWalls.changed) normalizedDomains.push('walls')

  const sanitizedCeilings = sanitizeV2CeilingsDrafts({
    rooms: currentState.collections.rooms.map((room) => ({
      roomId: room.roomId,
      lengthIn: room.lengthIn,
      widthIn: room.widthIn,
      position: room.position,
    })),
    ceilingScopes: currentState.collections.ceilingScopes,
    ceilingSegments: currentState.collections.ceilingSegments,
  })
  if (sanitizedCeilings.changed) normalizedDomains.push('ceilings')

  const roomModeById = resolveRoomModeById({
    rooms: currentState.collections.rooms,
    wallScopes: sanitizedWalls.scopes,
    ceilingScopes: sanitizedCeilings.ceilingScopes,
  })
  const sanitizedTrim = sanitizeV2TrimDrafts({
    rooms: currentState.collections.rooms.map((room) => ({
      roomId: room.roomId,
      mode: roomModeById.get(room.roomId) ?? 'RECT',
      position: room.position,
    })),
    trimScopes: currentState.collections.trimScopes,
  })
  if (sanitizedTrim.changed) normalizedDomains.push('trim')

  const collections = {
    scopes: sanitizedWalls.scopes,
    segments: sanitizedWalls.segments,
    ceilingScopes: sanitizedCeilings.ceilingScopes,
    ceilingSegments: sanitizedCeilings.ceilingSegments,
    trimScopes: sanitizedTrim.trimScopes,
    rollers: currentState.collections.rollers,
  }

  return {
    normalizedDomains,
    roomModeById,
    collections,
    payloadSnapshot: buildEstimateV2DirtySnapshot({
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
      rooms: currentState.collections.rooms,
      scopes: collections.scopes,
      segments: collections.segments,
      roomFlags: currentState.collections.roomFlags,
      ceilingScopes: collections.ceilingScopes,
      ceilingSegments: collections.ceilingSegments,
      trimScopes: collections.trimScopes,
      rollers: collections.rollers,
    }),
  }
}

export function validateEstimateV2PreparedSave(params: {
  currentState: EstimateV2EditorStoreState
  prepared: EstimateV2PreparedSaveState
  trigger?: 'manual' | 'auto'
}) {
  const { currentState, prepared } = params
  const allowIncomplete = params.trigger === 'auto'
  const wallIssues = validateV2WallsBeforeSave({
    rooms: currentState.collections.rooms,
    scopes: prepared.collections.scopes,
    segments: prepared.collections.segments,
    allowIncomplete,
  })
  const ceilingIssues = validateV2CeilingsBeforeSave({
    rooms: currentState.collections.rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      position: room.position,
    })),
    ceilingScopes: prepared.collections.ceilingScopes,
    ceilingSegments: prepared.collections.ceilingSegments,
    allowIncomplete,
  })
  const trimIssues = validateV2TrimBeforeSave({
    rooms: currentState.collections.rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      mode: prepared.roomModeById.get(room.roomId) ?? 'RECT',
      position: room.position,
    })),
    trimScopes: prepared.collections.trimScopes.map((scope) => ({
      id: scope.id,
      roomId: scope.roomId,
      position: scope.position,
      include: scope.include,
      trimTypeId: scope.trimTypeId,
      measurementMode: scope.measurementMode,
      helperSource: scope.helperSource || null,
      measurementValue: scope.measurementValue,
    })),
    allowIncomplete,
  })

  return [...wallIssues, ...ceilingIssues, ...trimIssues]
}

function normalizeJobDefaultProductOverride(productId: string, defaultProductId: string) {
  return !productId || productId === defaultProductId ? '' : productId
}

export function resolveEstimateV2SaveResponseState(params: {
  trigger: 'manual' | 'auto'
  payload: unknown
  meta: Pick<
    EstimateV2SaveMeta,
    'wallCalculations' | 'ceilingCalculations' | 'trimCalculations'
  >
  prepared: EstimateV2PreparedSaveState
  currentState: EstimateV2EditorStoreState
  effectiveJobProductDefaults: {
    wallPaintProductId: string
    wallPrimerProductId: string
    ceilingPaintProductId: string
    ceilingPrimerProductId: string
    trimPaintProductId: string
    trimPrimerProductId: string
  }
}) {
  const { trigger, payload, meta, prepared, currentState, effectiveJobProductDefaults } = params

  const nextWallCalculations =
    payload != null && typeof payload === 'object' && 'wall_calculations' in payload
      ? ((payload as { wall_calculations?: EstimateV2WallCalculationsPayload }).wall_calculations ??
          null)
      : meta.wallCalculations

  let nextScopes = prepared.collections.scopes
  let nextSegments = prepared.collections.segments
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
    }
    if (nextWallCalculations?.segments) {
      nextSegments = sortByPosition(nextWallCalculations.segments.map(normalizeSegment))
    }
  }

  const nextCeilingCalculations =
    payload != null && typeof payload === 'object' && 'ceiling_calculations' in payload
      ? ((payload as { ceiling_calculations?: Unsafe }).ceiling_calculations ?? null)
      : meta.ceilingCalculations
  let nextCeilingScopes = prepared.collections.ceilingScopes
  let nextCeilingSegments = prepared.collections.ceilingSegments
  if (trigger === 'manual') {
    if (nextCeilingCalculations && Array.isArray((nextCeilingCalculations as Unsafe).scopes)) {
      nextCeilingScopes = sortByPosition(
        ((nextCeilingCalculations as Unsafe).scopes as Unsafe[]).map((scope, index) => {
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
    }
    if (nextCeilingCalculations && Array.isArray((nextCeilingCalculations as Unsafe).segments)) {
      nextCeilingSegments = sortByPosition(
        ((nextCeilingCalculations as Unsafe).segments as Unsafe[]).map(normalizeCeilingSegment)
      )
    }
  }

  const nextTrimCalculations =
    payload != null && typeof payload === 'object' && 'trim_calculations' in payload
      ? ((payload as { trim_calculations?: Unsafe }).trim_calculations ?? null)
      : meta.trimCalculations
  let nextTrimScopes = prepared.collections.trimScopes
  if (
    trigger === 'manual' &&
    nextTrimCalculations &&
    Array.isArray((nextTrimCalculations as Unsafe).scopes)
  ) {
    nextTrimScopes = sortByPosition(
      ((nextTrimCalculations as Unsafe).scopes as Unsafe[]).map((scope, index) => {
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
  }

  const nextPricingSummary =
    payload != null && typeof payload === 'object' && 'pricing_summary' in payload
      ? (((payload as { pricing_summary?: unknown }).pricing_summary ??
          null) as EstimateV2PricingSummary | null)
      : null

  return {
    collections: {
      scopes: nextScopes,
      segments: nextSegments,
      ceilingScopes: nextCeilingScopes,
      ceilingSegments: nextCeilingSegments,
      trimScopes: nextTrimScopes,
      rollers: currentState.collections.rollers,
    },
    calculations: {
      wallCalculations: nextWallCalculations,
      ceilingCalculations: nextCeilingCalculations,
      trimCalculations: nextTrimCalculations,
      pricingSummary: nextPricingSummary,
    },
    lastSavedSnapshot: buildEstimateV2DirtySnapshot({
      jobSettingsDraft: currentState.meta.jobSettingsDraft,
      rooms: currentState.collections.rooms,
      scopes: nextScopes,
      segments: nextSegments,
      roomFlags: currentState.collections.roomFlags,
      ceilingScopes: nextCeilingScopes,
      ceilingSegments: nextCeilingSegments,
      trimScopes: nextTrimScopes,
      rollers: currentState.collections.rollers,
    }),
  }
}

export type EstimateV2ResolvedSaveState = ReturnType<
  typeof resolveEstimateV2SaveResponseState
>
