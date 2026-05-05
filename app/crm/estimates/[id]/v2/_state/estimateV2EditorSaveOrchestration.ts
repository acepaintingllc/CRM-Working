'use client'

import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import { validateV2WallsBeforeSave } from '@/lib/estimator/v2WallsValidation'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { validateV2CeilingsBeforeSave } from '@/lib/estimator/v2CeilingsValidation'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { validateV2TrimBeforeSave } from '@/lib/estimator/v2TrimValidation'
import { validateV2DoorsBeforeSave } from '@/lib/estimator/v2DoorsValidation'
import { validateV2DrywallBeforeSave } from '@/lib/estimator/v2DrywallValidation'
import type { EstimateV2EditorStoreState } from '@/lib/estimates/v2/store/estimateV2Store'
import type {
  EstimateV2EstimateMeta,
  EstimateV2PricingSummary,
  EstimateV2WallCalculationsPayload,
} from '@/types/estimator/v2'
import {
  createUuid,
  normalizeDoorScope,
  normalizeDrywallRepair,
  resolveRoomModeById,
} from '../_lib/estimateV2EditorNormalize'
import type { EstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import { buildEstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'
import type { NormalizedDomain, Unsafe } from './estimateV2EditorTypes'

type EstimateV2SaveCollections = EstimateV2EditorStoreState['collections']
type EstimateV2SaveMeta = EstimateV2EditorStoreState['meta']
type CalculationMissingInput = {
  message?: unknown
  scope_id?: unknown
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function ensureUuid(value: string, replacements: Map<string, string>) {
  if (UUID_RE.test(value)) return value
  const existing = replacements.get(value)
  if (existing) return existing
  const generated = createUuid()
  const next = UUID_RE.test(generated)
    ? generated
    : `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
  replacements.set(value, next)
  return next
}

function isTemporaryCeilingPersistenceId(value: string) {
  return value.startsWith('temp-') || value.includes('-local')
}

function normalizeCeilingIdsForPersistence(params: {
  ceilingScopes: EstimateV2SaveCollections['ceilingScopes']
  ceilingSegments: EstimateV2SaveCollections['ceilingSegments']
}) {
  const replacements = new Map<string, string>()
  let changed = false
  const ceilingScopes = params.ceilingScopes.map((scope) => {
    if (scope.mode !== 'SEG') return scope
    if (!isTemporaryCeilingPersistenceId(scope.id)) return scope
    const nextId = ensureUuid(scope.id, replacements)
    if (nextId === scope.id) return scope
    changed = true
    return { ...scope, id: nextId }
  })
  const ceilingSegments = params.ceilingSegments.map((segment) => {
    const nextId = replacements.has(segment.ceilingScopeId)
      ? ensureUuid(segment.id, replacements)
      : segment.id
    const nextCeilingScopeId = replacements.get(segment.ceilingScopeId) ?? segment.ceilingScopeId
    if (nextId === segment.id && nextCeilingScopeId === segment.ceilingScopeId) return segment
    changed = true
    return {
      ...segment,
      id: nextId,
      ceilingScopeId: nextCeilingScopeId,
    }
  })

  return {
    ceilingScopes,
    ceilingSegments,
    changed,
  }
}

function missingInputsFrom(value: unknown): CalculationMissingInput[] {
  if (!value || typeof value !== 'object') return []
  const missing = (value as { missing_inputs?: unknown }).missing_inputs
  return Array.isArray(missing) ? (missing as CalculationMissingInput[]) : []
}

function excludedCalculationScopeIdsFrom(value: unknown) {
  const ids = new Set<string>()
  if (!value || typeof value !== 'object') return ids
  const scopes = (value as { scopes?: unknown }).scopes
  if (!Array.isArray(scopes)) return ids

  for (const scope of scopes) {
    if (!scope || typeof scope !== 'object') continue
    const row = scope as {
      include?: unknown
      id?: unknown
      scope_id?: unknown
      scope_key?: unknown
    }
    if (row.include !== 'N') continue
    for (const id of [row.id, row.scope_id, row.scope_key]) {
      if (typeof id === 'string' && id.trim()) ids.add(id)
    }
  }

  return ids
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
    groups.flatMap(([label, value]) => {
      const excludedScopeIds = excludedCalculationScopeIdsFrom(value)
      return missingInputsFrom(value)
        .filter((input) => {
          const scopeId = typeof input.scope_id === 'string' ? input.scope_id : ''
          return !scopeId || !excludedScopeIds.has(scopeId)
        })
        .map((input) => `${label}: ${String(input.message || 'Required input is missing')}`)
    })
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
  const persistentCeilings = normalizeCeilingIdsForPersistence({
    ceilingScopes: sanitizedCeilings.ceilingScopes,
    ceilingSegments: sanitizedCeilings.ceilingSegments,
  })
  if (persistentCeilings.changed && !normalizedDomains.includes('ceilings')) {
    normalizedDomains.push('ceilings')
  }

  const roomModeById = resolveRoomModeById({
    rooms: currentState.collections.rooms,
    wallScopes: sanitizedWalls.scopes,
    ceilingScopes: persistentCeilings.ceilingScopes,
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
    ceilingScopes: persistentCeilings.ceilingScopes,
    ceilingSegments: persistentCeilings.ceilingSegments,
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
      overrideMeasurement: scope.overrideMeasurement,
      overrideHours: scope.overrideHours,
      overrideGallons: scope.overrideGallons,
      overrideSupplyCost: scope.overrideSupplyCost,
      overrideTotal: scope.overrideTotal,
    })),
    allowIncomplete,
  })
  const doorIssues = validateV2DoorsBeforeSave({
    rooms: currentState.collections.rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      position: room.position,
    })),
    doorScopes: (prepared.collections.doorScopes ?? []).map((scope) => ({
      id: scope.id,
      roomId: scope.roomId,
      position: scope.position,
      include: scope.include,
      doorTypeId: scope.doorTypeId,
      quantity: scope.quantity,
      sides: scope.sides,
      overridePaintHours: scope.overridePaintHours,
      overridePrimerHours: scope.overridePrimerHours,
      overrideMaterialCost: scope.overrideMaterialCost,
      overrideSupplyCost: scope.overrideSupplyCost,
      overrideTotal: scope.overrideTotal,
    })),
    allowIncomplete,
  })
  const drywallIssues = validateV2DrywallBeforeSave({
    rooms: currentState.collections.rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      position: room.position,
    })),
    drywallRepairs: (prepared.collections.drywallRepairs ?? []).map((repair) => ({
      id: repair.id,
      roomId: repair.roomId,
      position: repair.position,
      surface: repair.surface,
      repairType: repair.repairType,
      quantity: repair.quantity,
      overrideTotal: repair.overrideTotal,
    })),
    allowIncomplete,
  })

  return filterNonBlockingEstimateV2ValidationIssues([
    ...wallIssues,
    ...ceilingIssues,
    ...trimIssues,
    ...doorIssues,
    ...drywallIssues,
  ])
}

export function deriveEstimateV2PreparedSaveValidation(params: {
  collections: EstimateV2EditorStoreState['collections']
  jobSettingsDraft: EstimateV2EditorStoreState['meta']['jobSettingsDraft']
  trigger?: 'manual' | 'auto'
}) {
  const currentState = {
    collections: params.collections,
    meta: {
      jobSettingsDraft: params.jobSettingsDraft,
    },
  } as EstimateV2EditorStoreState
  const prepared = prepareEstimateV2SaveState(currentState)
  const issues = validateEstimateV2PreparedSave({
    currentState,
    prepared,
    trigger: params.trigger,
  })

  return {
    prepared,
    issues,
  }
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

function normalizeWallScopeJobDefaultOverrides(
  scopes: EstimateV2SaveCollections['scopes'],
  effectiveJobProductDefaults: {
    wallPaintProductId: string
    wallPrimerProductId: string
  }
) {
  return sortByPosition(
    scopes.map((scope) => ({
      ...scope,
      paintProductId: normalizeJobDefaultProductOverride(
        scope.paintProductId,
        effectiveJobProductDefaults.wallPaintProductId
      ),
      primerProductId: normalizeJobDefaultProductOverride(
        scope.primerProductId,
        effectiveJobProductDefaults.wallPrimerProductId
      ),
    }))
  )
}

function normalizeCeilingScopeJobDefaultOverrides(
  scopes: EstimateV2SaveCollections['ceilingScopes'],
  effectiveJobProductDefaults: {
    ceilingPaintProductId: string
    ceilingPrimerProductId: string
  }
) {
  return sortByPosition(
    scopes.map((scope) => ({
      ...scope,
      paintProductId: normalizeJobDefaultProductOverride(
        scope.paintProductId,
        effectiveJobProductDefaults.ceilingPaintProductId
      ),
      primerProductId: normalizeJobDefaultProductOverride(
        scope.primerProductId,
        effectiveJobProductDefaults.ceilingPrimerProductId
      ),
    }))
  )
}

function normalizeTrimScopeJobDefaultOverrides(
  scopes: EstimateV2SaveCollections['trimScopes'],
  effectiveJobProductDefaults: {
    trimPaintProductId: string
    trimPrimerProductId: string
  }
) {
  return sortByPosition(
    scopes.map((scope) => ({
      ...scope,
      paintProductId: normalizeJobDefaultProductOverride(
        scope.paintProductId,
        effectiveJobProductDefaults.trimPaintProductId
      ),
      primerProductId: normalizeJobDefaultProductOverride(
        scope.primerProductId,
        effectiveJobProductDefaults.trimPrimerProductId
      ),
    }))
  )
}

function resolveSavedEstimateMeta(params: {
  payload: unknown
  currentEstimate: EstimateV2EstimateMeta | null
}) {
  if (!params.payload || typeof params.payload !== 'object' || !('estimate' in params.payload)) {
    return params.currentEstimate
  }

  const estimate = (params.payload as { estimate?: unknown }).estimate
  if (!estimate || typeof estimate !== 'object') return params.currentEstimate

  return {
    ...(params.currentEstimate ?? {}),
    ...(estimate as Partial<EstimateV2EstimateMeta>),
  } as EstimateV2EstimateMeta
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
    nextScopes = normalizeWallScopeJobDefaultOverrides(
      prepared.collections.scopes,
      effectiveJobProductDefaults
    )
    nextSegments = sortByPosition(prepared.collections.segments)
  }

  const nextCeilingCalculations =
    payload != null && typeof payload === 'object' && 'ceiling_calculations' in payload
      ? ((payload as { ceiling_calculations?: Unsafe }).ceiling_calculations ?? null)
      : meta.ceilingCalculations
  let nextCeilingScopes = prepared.collections.ceilingScopes
  let nextCeilingSegments = prepared.collections.ceilingSegments
  if (trigger === 'manual') {
    nextCeilingScopes = normalizeCeilingScopeJobDefaultOverrides(
      prepared.collections.ceilingScopes,
      effectiveJobProductDefaults
    )
    nextCeilingSegments = sortByPosition(prepared.collections.ceilingSegments)
  }

  const nextTrimCalculations =
    payload != null && typeof payload === 'object' && 'trim_calculations' in payload
      ? ((payload as { trim_calculations?: Unsafe }).trim_calculations ?? null)
      : meta.trimCalculations
  let nextTrimScopes = prepared.collections.trimScopes
  if (trigger === 'manual') {
    nextTrimScopes = normalizeTrimScopeJobDefaultOverrides(
      prepared.collections.trimScopes,
      effectiveJobProductDefaults
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
  let nextDoorScopes = prepared.collections.doorScopes ?? []
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
    estimate: resolveSavedEstimateMeta({
      payload,
      currentEstimate: currentState.meta.estimate,
    }),
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
