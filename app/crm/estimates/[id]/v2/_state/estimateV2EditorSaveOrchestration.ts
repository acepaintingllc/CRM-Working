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
import { formatEstimateV2ScopeLabel } from './estimateV2DestructiveConfirm'
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

function sortRowsByPosition<T extends { position: number }>(rows: T[]) {
  return [...rows].sort((a, b) => a.position - b.position)
}

function buildReadableRoomLabel(room: { roomName: string; position: number }, roomId: string) {
  const trimmedName = room.roomName.trim()
  return trimmedName || `Room ${room.position + 1}` || roomId
}

function buildIndexedFallback(label: string, position: number) {
  return `${label} ${position + 1}`
}

function normalizeIssueText(value: string) {
  return value.trim().toLowerCase()
}

function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

type EstimateV2ValidationCollections = EstimateV2SavePayloadPreparationInput['collections']

function resolveTrimScopeLabel(
  scope: NonNullable<EstimateV2ValidationCollections['trimScopes']>[number]
) {
  return formatEstimateV2ScopeLabel(scope.scopeName, buildIndexedFallback('Trim item', scope.position))
}

function resolveDoorScopeLabel(
  scope: NonNullable<EstimateV2ValidationCollections['doorScopes']>[number]
) {
  return formatEstimateV2ScopeLabel(scope.scopeName, buildIndexedFallback('Door scope', scope.position))
}

function resolveWallScopeLabel(
  scope: NonNullable<EstimateV2ValidationCollections['scopes']>[number]
) {
  return formatEstimateV2ScopeLabel(scope.scopeName, buildIndexedFallback('Wall scope', scope.position))
}

function resolveCeilingScopeLabel(
  scope: NonNullable<EstimateV2ValidationCollections['ceilingScopes']>[number]
) {
  return formatEstimateV2ScopeLabel(
    scope.scopeName,
    buildIndexedFallback('Ceiling scope', scope.position)
  )
}

function resolveDrywallRepairLabel(
  repair: NonNullable<EstimateV2ValidationCollections['drywallRepairs']>[number]
) {
  const surfaceLabel = repair.surface === 'ceiling' ? 'Ceiling drywall repair' : 'Wall drywall repair'
  return buildIndexedFallback(surfaceLabel, repair.position)
}

function findSingleMatchingScopeLabel<T>(
  rows: T[],
  predicate: (row: T) => boolean,
  getLabel: (row: T) => string,
  fallbackLabel: string
) {
  const matches = rows.filter(predicate)
  return matches.length === 1 ? getLabel(matches[0]) : fallbackLabel
}

function formatIssueBody(
  message: string,
  roomId: string,
  collections: EstimateV2ValidationCollections
) {
  const trimScopes = sortRowsByPosition(
    (collections.trimScopes ?? []).filter((scope) => scope.roomId === roomId)
  )
  const doorScopes = sortRowsByPosition(
    (collections.doorScopes ?? []).filter((scope) => scope.roomId === roomId)
  )
  const wallScopes = sortRowsByPosition(
    (collections.scopes ?? []).filter((scope) => scope.roomId === roomId)
  )
  const ceilingScopes = sortRowsByPosition(
    (collections.ceilingScopes ?? []).filter((scope) => scope.roomId === roomId)
  )
  const drywallRepairs = sortRowsByPosition(
    (collections.drywallRepairs ?? []).filter((repair) => repair.roomId === roomId)
  )

  const formatted = message
    .replace(/\btrim scope ([^:]+)\b/gi, (_, scopeId: string) => {
      const scope = trimScopes.find((entry) => entry.id === scopeId)
      return scope ? resolveTrimScopeLabel(scope) : 'Trim item'
    })
    .replace(/\bdoor scope ([^:]+)\b/gi, (_, scopeId: string) => {
      const scope = doorScopes.find((entry) => entry.id === scopeId)
      return scope ? resolveDoorScopeLabel(scope) : 'Door scope'
    })
    .replace(/\bwall scope ([^:]+)\b/gi, (_, scopeId: string) => {
      const scope = wallScopes.find((entry) => entry.id === scopeId)
      return scope ? resolveWallScopeLabel(scope) : 'Wall scope'
    })
    .replace(/\bceiling scope ([^:]+)\b/gi, (_, scopeId: string) => {
      const scope = ceilingScopes.find((entry) => entry.id === scopeId)
      return scope ? resolveCeilingScopeLabel(scope) : 'Ceiling scope'
    })
    .replace(/\bdrywall repair (?!type\b|id\b)([^:]+)\b/gi, (_, repairId: string) => {
      const repair = drywallRepairs.find((entry) => entry.id === repairId)
      return repair ? resolveDrywallRepairLabel(repair) : 'Drywall repair'
    })

  const normalized = normalizeIssueText(formatted)

  if (normalized === 'door type is required') {
    const label = findSingleMatchingScopeLabel(
      doorScopes,
      (scope) => scope.include === 'Y' && !scope.doorTypeId.trim(),
      resolveDoorScopeLabel,
      'Door scope'
    )
    return `${label}: door type is required`
  }
  if (normalized === 'door quantity is required') {
    const label = findSingleMatchingScopeLabel(
      doorScopes,
      (scope) => scope.include === 'Y' && asNullableNumber(scope.quantity) == null,
      resolveDoorScopeLabel,
      'Door scope'
    )
    return `${label}: door quantity is required`
  }
  if (normalized === 'door quantity must be nonnegative') {
    const label = findSingleMatchingScopeLabel(
      doorScopes,
      (scope) => {
        const quantity = asNullableNumber(scope.quantity)
        return scope.include === 'Y' && quantity != null && quantity < 0
      },
      resolveDoorScopeLabel,
      'Door scope'
    )
    return `${label}: door quantity must be nonnegative`
  }
  if (normalized === 'door sides is required') {
    const label = findSingleMatchingScopeLabel(
      doorScopes,
      (scope) => scope.include === 'Y' && asNullableNumber(scope.sides) == null,
      resolveDoorScopeLabel,
      'Door scope'
    )
    return `${label}: door sides are required`
  }
  if (normalized === 'door sides must be 1 or 2') {
    const label = findSingleMatchingScopeLabel(
      doorScopes,
      (scope) => {
        const sides = asNullableNumber(scope.sides)
        return scope.include === 'Y' && sides != null && sides !== 1 && sides !== 2
      },
      resolveDoorScopeLabel,
      'Door scope'
    )
    return `${label}: door sides must be 1 or 2`
  }
  if (normalized === 'drywall repair type is required') {
    const label = findSingleMatchingScopeLabel(
      drywallRepairs,
      (repair) => !repair.repairType.trim(),
      resolveDrywallRepairLabel,
      'Drywall repair'
    )
    return `${label}: repair type is required`
  }
  if (normalized === 'drywall quantity is required') {
    const label = findSingleMatchingScopeLabel(
      drywallRepairs,
      (repair) => asNullableNumber(repair.quantity) == null,
      resolveDrywallRepairLabel,
      'Drywall repair'
    )
    return `${label}: quantity is required`
  }
  if (normalized === 'drywall quantity must be nonnegative') {
    const label = findSingleMatchingScopeLabel(
      drywallRepairs,
      (repair) => {
        const quantity = asNullableNumber(repair.quantity)
        return quantity != null && quantity < 0
      },
      resolveDrywallRepairLabel,
      'Drywall repair'
    )
    return `${label}: quantity must be nonnegative`
  }
  if (normalized === 'drywall repair type is not valid for ceiling') {
    const label = findSingleMatchingScopeLabel(
      drywallRepairs,
      (repair) => repair.surface === 'ceiling',
      resolveDrywallRepairLabel,
      'Ceiling drywall repair'
    )
    return `${label}: repair type is not valid for the ceiling`
  }
  if (normalized === 'drywall repair type is not valid for wall') {
    const label = findSingleMatchingScopeLabel(
      drywallRepairs,
      (repair) => repair.surface === 'wall',
      resolveDrywallRepairLabel,
      'Wall drywall repair'
    )
    return `${label}: repair type is not valid for the wall`
  }

  return formatted
}

export function formatEstimateV2ValidationIssues(params: {
  issues: string[]
  collections: EstimateV2ValidationCollections
}) {
  const roomById = new Map(
    params.collections.rooms.map((room) => [room.roomId, room] as const)
  )

  return params.issues.map((issue) => {
    const roomMatch = issue.match(/^([^:]+):\s*(.+)$/)
    if (!roomMatch) return issue

    const [, roomId, message] = roomMatch
    const room = roomById.get(roomId)
    if (!room) return issue

    const roomLabel = buildReadableRoomLabel(room, roomId)
    const formattedBody = formatIssueBody(message, roomId, params.collections)
    return `${roomLabel}: ${formattedBody}`
  })
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

export type EstimateV2SavePayloadPreparationInput = {
  collections: {
    rooms: EstimateV2SaveCollections['rooms']
    scopes: EstimateV2SaveCollections['scopes']
    segments: EstimateV2SaveCollections['segments']
    roomFlags: EstimateV2SaveCollections['roomFlags']
    ceilingScopes: EstimateV2SaveCollections['ceilingScopes']
    ceilingSegments: EstimateV2SaveCollections['ceilingSegments']
    trimScopes: EstimateV2SaveCollections['trimScopes']
    doorScopes?: EstimateV2SaveCollections['doorScopes']
    drywallRepairs?: EstimateV2SaveCollections['drywallRepairs']
    rollers?: EstimateV2SaveCollections['rollers']
    accessFees?: EstimateV2SaveCollections['accessFees']
    otherItems?: EstimateV2SaveCollections['otherItems']
  }
  jobSettingsDraft: EstimateV2SaveMeta['jobSettingsDraft']
}

export type EstimateV2SavePayloadPreparationOutput = {
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

export type EstimateV2PreparedSaveState = EstimateV2SavePayloadPreparationOutput

export function prepareEstimateV2SavePayload(
  input: EstimateV2SavePayloadPreparationInput
): EstimateV2SavePayloadPreparationOutput {
  const { collections: sourceCollections, jobSettingsDraft } = input
  const normalizedDomains: NormalizedDomain[] = []
  const sanitizedWalls = sanitizeV2WallsDrafts({
    rooms: sourceCollections.rooms,
    scopes: sourceCollections.scopes,
    segments: sourceCollections.segments,
  })
  if (sanitizedWalls.changed) normalizedDomains.push('walls')

  const sanitizedCeilings = sanitizeV2CeilingsDrafts({
    rooms: sourceCollections.rooms.map((room) => ({
      roomId: room.roomId,
      lengthIn: room.lengthIn,
      widthIn: room.widthIn,
      position: room.position,
    })),
    ceilingScopes: sourceCollections.ceilingScopes,
    ceilingSegments: sourceCollections.ceilingSegments,
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
    rooms: sourceCollections.rooms,
    wallScopes: sanitizedWalls.scopes,
    ceilingScopes: persistentCeilings.ceilingScopes,
  })
  const sanitizedTrim = sanitizeV2TrimDrafts({
    rooms: sourceCollections.rooms.map((room) => ({
      roomId: room.roomId,
      mode: roomModeById.get(room.roomId) ?? 'RECT',
      position: room.position,
    })),
    trimScopes: sourceCollections.trimScopes,
  })
  if (sanitizedTrim.changed) normalizedDomains.push('trim')

  const collections = {
    scopes: sanitizedWalls.scopes,
    segments: sanitizedWalls.segments,
    ceilingScopes: persistentCeilings.ceilingScopes,
    ceilingSegments: persistentCeilings.ceilingSegments,
    trimScopes: sanitizedTrim.trimScopes,
    doorScopes: sourceCollections.doorScopes ?? [],
    drywallRepairs: sourceCollections.drywallRepairs ?? [],
    rollers: sourceCollections.rollers ?? [],
    accessFees: sourceCollections.accessFees ?? [],
    otherItems: sourceCollections.otherItems ?? [],
  }

  return {
    normalizedDomains,
    roomModeById,
    collections,
    payloadSnapshot: buildEstimateV2DirtySnapshot({
      jobSettingsDraft,
      rooms: sourceCollections.rooms,
      scopes: collections.scopes,
      segments: collections.segments,
      roomFlags: sourceCollections.roomFlags,
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

export function prepareEstimateV2SaveState(
  currentState: EstimateV2EditorStoreState
): EstimateV2PreparedSaveState {
  return prepareEstimateV2SavePayload({
    collections: currentState.collections,
    jobSettingsDraft: currentState.meta.jobSettingsDraft,
  })
}

export function validateEstimateV2PreparedSave(params: {
  collections: EstimateV2SavePayloadPreparationInput['collections']
  prepared: EstimateV2PreparedSaveState
  trigger?: 'manual' | 'auto'
}) {
  const { collections, prepared } = params
  const allowIncomplete = params.trigger === 'auto'
  const wallIssues = validateV2WallsBeforeSave({
    rooms: collections.rooms,
    scopes: prepared.collections.scopes,
    segments: prepared.collections.segments,
    allowIncomplete,
  })
  const ceilingIssues = validateV2CeilingsBeforeSave({
    rooms: collections.rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      position: room.position,
    })),
    ceilingScopes: prepared.collections.ceilingScopes,
    ceilingSegments: prepared.collections.ceilingSegments,
    allowIncomplete,
  })
  const trimIssues = validateV2TrimBeforeSave({
    rooms: collections.rooms.map((room) => ({
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
    rooms: collections.rooms.map((room) => ({
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
    rooms: collections.rooms.map((room) => ({
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

  const rawIssues = filterNonBlockingEstimateV2ValidationIssues([
    ...wallIssues,
    ...ceilingIssues,
    ...trimIssues,
    ...doorIssues,
    ...drywallIssues,
  ])

  return formatEstimateV2ValidationIssues({
    issues: rawIssues,
    collections,
  })
}

export function deriveEstimateV2PreparedSaveValidation(params: {
  collections: EstimateV2EditorStoreState['collections']
  jobSettingsDraft: EstimateV2EditorStoreState['meta']['jobSettingsDraft']
  trigger?: 'manual' | 'auto'
}) {
  const prepared = prepareEstimateV2SavePayload({
    collections: params.collections,
    jobSettingsDraft: params.jobSettingsDraft,
  })
  const issues = validateEstimateV2PreparedSave({
    collections: params.collections,
    prepared,
    trigger: params.trigger,
  })

  return {
    prepared,
    issues,
  }
}

export type EstimateV2SaveSnapshotInput = EstimateV2SavePayloadPreparationInput

export function buildEstimateV2SaveSnapshot(
  input: EstimateV2SaveSnapshotInput
): EstimateV2DirtySnapshot {
  return buildEstimateV2DirtySnapshot({
    jobSettingsDraft: input.jobSettingsDraft,
    rooms: input.collections.rooms,
    scopes: input.collections.scopes,
    segments: input.collections.segments,
    roomFlags: input.collections.roomFlags,
    ceilingScopes: input.collections.ceilingScopes,
    ceilingSegments: input.collections.ceilingSegments,
    trimScopes: input.collections.trimScopes,
    doorScopes: input.collections.doorScopes,
    drywallRepairs: input.collections.drywallRepairs,
    rollers: input.collections.rollers,
    accessFees: input.collections.accessFees,
    otherItems: input.collections.otherItems,
  })
}

export function hasEstimateV2SaveStateChangedSincePrepared(params: {
  latestSnapshot: EstimateV2DirtySnapshot
  prepared: Pick<EstimateV2PreparedSaveState, 'payloadSnapshot'>
}) {
  return params.latestSnapshot.comparisonKey !== params.prepared.payloadSnapshot.comparisonKey
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

type EstimateV2SaveResponseCalculationsInput = Pick<
  EstimateV2SaveMeta,
  | 'wallCalculations'
  | 'ceilingCalculations'
  | 'trimCalculations'
  | 'doorCalculations'
  | 'drywallCalculations'
>

type EstimateV2SaveResponseCurrentInput = {
  collections: {
    rooms: EstimateV2SaveCollections['rooms']
    roomFlags: EstimateV2SaveCollections['roomFlags']
    rollers: EstimateV2SaveCollections['rollers']
    accessFees?: EstimateV2SaveCollections['accessFees']
    otherItems?: EstimateV2SaveCollections['otherItems']
  }
  meta: {
    estimate: EstimateV2SaveMeta['estimate']
    jobSettingsDraft: EstimateV2SaveMeta['jobSettingsDraft']
  }
}

type EstimateV2SaveResponseEffectiveJobProductDefaults = {
  wallPaintProductId: string
  wallPrimerProductId: string
  ceilingPaintProductId: string
  ceilingPrimerProductId: string
  trimPaintProductId: string
  trimPrimerProductId: string
}

export type EstimateV2SaveResponseReconciliationInput = {
  trigger: 'manual' | 'auto'
  payload: unknown
  meta: EstimateV2SaveResponseCalculationsInput
  prepared: EstimateV2PreparedSaveState
  current: EstimateV2SaveResponseCurrentInput
  effectiveJobProductDefaults: EstimateV2SaveResponseEffectiveJobProductDefaults
}

export type EstimateV2SaveResponseReconciliationOutput = {
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
  calculations: {
    wallCalculations: EstimateV2WallCalculationsPayload | null
    ceilingCalculations: Unsafe | null
    trimCalculations: Unsafe | null
    doorCalculations: Unsafe | null
    drywallCalculations: Unsafe | null
    pricingSummary: EstimateV2PricingSummary | null
  }
  estimate: EstimateV2EstimateMeta | null
  lastSavedSnapshot: EstimateV2DirtySnapshot
}

export function reconcileEstimateV2SaveResponse(
  params: EstimateV2SaveResponseReconciliationInput
): EstimateV2SaveResponseReconciliationOutput {
  const { trigger, payload, meta, prepared, current, effectiveJobProductDefaults } = params

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
      : (meta.doorCalculations ?? null)
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
      : (meta.drywallCalculations ?? null)
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
      rollers: current.collections.rollers,
      accessFees: current.collections.accessFees ?? [],
      otherItems: current.collections.otherItems ?? [],
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
      currentEstimate: current.meta.estimate,
    }),
    lastSavedSnapshot: buildEstimateV2DirtySnapshot({
      jobSettingsDraft: current.meta.jobSettingsDraft,
      rooms: current.collections.rooms,
      scopes: nextScopes,
      segments: nextSegments,
      roomFlags: current.collections.roomFlags,
      ceilingScopes: nextCeilingScopes,
      ceilingSegments: nextCeilingSegments,
      trimScopes: nextTrimScopes,
      doorScopes: nextDoorScopes,
      drywallRepairs: nextDrywallRepairs,
      rollers: current.collections.rollers,
      accessFees: current.collections.accessFees ?? [],
      otherItems: current.collections.otherItems ?? [],
    }),
  }
}

export function resolveEstimateV2SaveResponseState(params: {
  trigger: 'manual' | 'auto'
  payload: unknown
  meta: EstimateV2SaveResponseCalculationsInput
  prepared: EstimateV2PreparedSaveState
  currentState: EstimateV2EditorStoreState
  effectiveJobProductDefaults: EstimateV2SaveResponseEffectiveJobProductDefaults
}): EstimateV2SaveResponseReconciliationOutput {
  return reconcileEstimateV2SaveResponseFromState(params)
}

export function reconcileEstimateV2SaveResponseFromState(params: {
  trigger: 'manual' | 'auto'
  payload: unknown
  meta: EstimateV2SaveResponseCalculationsInput
  prepared: EstimateV2PreparedSaveState
  currentState: EstimateV2EditorStoreState
  effectiveJobProductDefaults: EstimateV2SaveResponseEffectiveJobProductDefaults
}): EstimateV2SaveResponseReconciliationOutput {
  return reconcileEstimateV2SaveResponse({
    trigger: params.trigger,
    payload: params.payload,
    meta: params.meta,
    prepared: params.prepared,
    current: {
      collections: {
        rooms: params.currentState.collections.rooms,
        roomFlags: params.currentState.collections.roomFlags,
        rollers: params.currentState.collections.rollers,
        accessFees: params.currentState.collections.accessFees,
        otherItems: params.currentState.collections.otherItems,
      },
      meta: {
        estimate: params.currentState.meta.estimate,
        jobSettingsDraft: params.currentState.meta.jobSettingsDraft,
      },
    },
    effectiveJobProductDefaults: params.effectiveJobProductDefaults,
  })
}

export type EstimateV2ResolvedSaveState = EstimateV2SaveResponseReconciliationOutput
