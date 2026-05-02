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
  normalizeDoorScope,
  normalizeDrywallRepair,
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
type CalculationMissingInput = {
  message?: unknown
}

function missingInputsFrom(value: unknown): CalculationMissingInput[] {
  if (!value || typeof value !== 'object') return []
  const missing = (value as { missing_inputs?: unknown }).missing_inputs
  return Array.isArray(missing) ? (missing as CalculationMissingInput[]) : []
}

export function collectEstimateV2CalculationMissingInputIssues(params: {
  wallCalculations: unknown
  ceilingCalculations: unknown
  trimCalculations: unknown
  doorCalculations: unknown
  drywallCalculations: unknown
}) {
  const groups: Array<[label: string, value: unknown]> = [
    ['Walls', params.wallCalculations],
    ['Ceilings', params.ceilingCalculations],
    ['Trim', params.trimCalculations],
    ['Doors', params.doorCalculations],
    ['Drywall', params.drywallCalculations],
  ]
  return filterNonBlockingEstimateV2ValidationIssues(
    groups.flatMap(([label, value]) =>
      missingInputsFrom(value).map((input) => `${label}: ${String(input.message || 'Required input is missing')}`)
    )
  )
}

export type EstimateV2PreparedSaveState = {
  normalizedDomains: NormalizedDomain[]
  roomModeById: Map<string, 'RECT' | 'SEG'>
  collections: {
    scopes: EstimateV2SaveCollections['scopes']
    segments: EstimateV2SaveCollections['segments']
    ceilingScopes: EstimateV2SaveCollections['ceilingScopes']
    ceilingSegments: EstimateV2SaveCollections['ceilingSegments']
    trimScopes: EstimateV2SaveCollections['trimScopes']
    doorScopes: EstimateV2SaveCollections['doorScopes']
    drywallRepairs: EstimateV2SaveCollections['drywallRepairs']
    rollers: EstimateV2SaveCollections['rollers']
    accessFees: EstimateV2SaveCollections['accessFees']
    otherItems: EstimateV2SaveCollections['otherItems']
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
    doorScopes: currentState.collections.doorScopes ?? [],
    drywallRepairs: currentState.collections.drywallRepairs ?? [],
    rollers: currentState.collections.rollers,
    accessFees: currentState.collections.accessFees ?? [],
    otherItems: currentState.collections.otherItems ?? [],
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
      doorScopes: collections.doorScopes ?? [],
      drywallRepairs: collections.drywallRepairs ?? [],
      rollers: collections.rollers,
      accessFees: collections.accessFees,
      otherItems: collections.otherItems,
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

  return filterNonBlockingEstimateV2ValidationIssues([...wallIssues, ...ceilingIssues, ...trimIssues])
}

const NON_BLOCKING_PAINT_ASSUMPTION_FIELDS = new Set([
  'paint_prod_rate_sqft_per_hour',
  'primer_prod_rate_sqft_per_hour',
  'paint_coverage_sqft_per_gal_per_coat',
  'primer_coverage_sqft_per_gal_per_coat',
  'paint_prod_rate_units_per_hour',
  'primer_prod_rate_units_per_hour',
  'paint_coverage_units_per_gal_per_coat',
  'primer_coverage_units_per_gal_per_coat',
  'paint_price_per_gal',
  'primer_price_per_gal',
])

export function filterNonBlockingEstimateV2ValidationIssues(issues: string[]) {
  const seen = new Set<string>()
  const filtered: string[] = []

  for (const issue of issues) {
    const requiredField = issue.match(/:\s*([a-z0-9_]+)\s+is required\s*$/i)?.[1]
    if (requiredField && NON_BLOCKING_PAINT_ASSUMPTION_FIELDS.has(requiredField)) {
      continue
    }
    if (seen.has(issue)) continue
    seen.add(issue)
    filtered.push(issue)
  }

  return filtered
}

function normalizeJobDefaultProductOverride(productId: string, defaultProductId: string) {
  return !productId || productId === defaultProductId ? '' : productId
}

export function resolveEstimateV2SaveResponseState(params: {
  trigger: 'manual' | 'auto'
  payload: unknown
  meta: Pick<
    EstimateV2SaveMeta,
    'wallCalculations' | 'ceilingCalculations' | 'trimCalculations' | 'doorCalculations' | 'drywallCalculations'
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

  const nextDoorCalculations =
    payload != null && typeof payload === 'object' && 'door_calculations' in payload
      ? ((payload as { door_calculations?: Unsafe }).door_calculations ?? null)
      : meta.doorCalculations
  let nextDoorScopes = prepared.collections.doorScopes
  if (
    trigger === 'manual' &&
    nextDoorCalculations &&
    Array.isArray((nextDoorCalculations as Unsafe).scopes)
  ) {
    nextDoorScopes = sortByPosition(
      ((nextDoorCalculations as Unsafe).scopes as Unsafe[]).map(normalizeDoorScope)
    )
  }

  const nextDrywallCalculations =
    payload != null && typeof payload === 'object' && 'drywall_calculations' in payload
      ? ((payload as { drywall_calculations?: Unsafe }).drywall_calculations ?? null)
      : meta.drywallCalculations
  let nextDrywallRepairs = prepared.collections.drywallRepairs ?? []
  if (
    trigger === 'manual' &&
    nextDrywallCalculations &&
    Array.isArray((nextDrywallCalculations as Unsafe).scopes)
  ) {
    nextDrywallRepairs = sortByPosition(
      ((nextDrywallCalculations as Unsafe).scopes as Unsafe[]).map(normalizeDrywallRepair)
    )
  }

  return {
    collections: {
      scopes: nextScopes,
      segments: nextSegments,
      ceilingScopes: nextCeilingScopes,
      ceilingSegments: nextCeilingSegments,
      trimScopes: nextTrimScopes,
      doorScopes: nextDoorScopes,
      drywallRepairs: nextDrywallRepairs,
      rollers: currentState.collections.rollers,
      accessFees: currentState.collections.accessFees ?? [],
      otherItems: currentState.collections.otherItems ?? [],
    },
    calculations: {
      wallCalculations: nextWallCalculations,
      ceilingCalculations: nextCeilingCalculations,
      trimCalculations: nextTrimCalculations,
      doorCalculations: nextDoorCalculations,
      drywallCalculations: nextDrywallCalculations,
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
      doorScopes: nextDoorScopes,
      drywallRepairs: nextDrywallRepairs,
      rollers: currentState.collections.rollers,
      accessFees: currentState.collections.accessFees ?? [],
      otherItems: currentState.collections.otherItems ?? [],
    }),
  }
}

export type EstimateV2ResolvedSaveState = ReturnType<
  typeof resolveEstimateV2SaveResponseState
>
