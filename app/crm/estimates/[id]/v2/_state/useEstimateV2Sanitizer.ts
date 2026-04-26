'use client'

import {
  DEFAULT_DAY_HOURS,
  DEFAULT_JOB_MINIMUM_AMOUNT,
  DEFAULT_JOB_MINIMUM_ENABLED,
  DEFAULT_LABOR_DAY_POLICY_ENABLED,
  DEFAULT_LABOR_RATE,
  DEFAULT_ROUNDING_INCREMENT_HOURS,
} from '@/lib/estimator/defaults'
import { asText } from '@/lib/estimator/parsing'
import { normalizeWallRollerTargetId } from '@/lib/estimator/rollerIdentity'
import { sortByPosition } from '@/lib/estimator/v2DraftPayload'
import { sanitizeV2CeilingsDrafts } from '@/lib/estimator/v2CeilingsSanitize'
import { sanitizeV2TrimDrafts } from '@/lib/estimator/v2TrimSanitize'
import { sanitizeV2WallsDrafts } from '@/lib/estimator/v2WallsSanitize'
import type {
  EstimateV2CatalogsPayload as CatalogsPayload,
  EstimateV2GetResponse as EstimateResponse,
  EstimateV2JobDefaultProducts,
  EstimateV2JobMeta,
  EstimateV2JobSettingsDraft as JobSettingsDraft,
  EstimateV2RollerDraft,
  EstimateV2RollerScope,
  EstimateV2RoomFlagDraft as RoomFlagDraft,
  EstimateV2TrimTypeOption,
} from '@/types/estimator/v2'
import { recalculateEditorDraftFactors } from '../_lib/estimateV2EditorRecalculate'
import {
  normalizeCeilingScope,
  normalizeCeilingSegment,
  normalizeRoom,
  normalizeRoomFlag,
  normalizeScope,
  normalizeSegment,
  normalizeTrimScope,
} from '../_lib/estimateV2EditorNormalize'
import type { EstimateV2EditorDebugMeta, Unsafe } from './estimateV2EditorTypes'
import { buildEstimateV2DirtySnapshot } from './estimateV2DirtySnapshot'

type ProductOverrideInputs = {
  wallPaintOverride: string
  wallPrimerOverride: string
  ceilingPaintOverride: string
  ceilingPrimerOverride: string
  trimPaintOverride: string
  trimPrimerOverride: string
}

export type EstimateV2SanitizedLoadResult = {
  catalogs: CatalogsPayload['catalogs']
  trimTypeOptions: EstimateV2TrimTypeOption[]
  collections: {
    rooms: ReturnType<typeof normalizeRoom>[]
    scopes: ReturnType<typeof normalizeScope>[]
    segments: ReturnType<typeof normalizeSegment>[]
    roomFlags: RoomFlagDraft[]
    rollers: EstimateV2RollerDraft[]
    ceilingScopes: ReturnType<typeof normalizeCeilingScope>[]
    ceilingSegments: ReturnType<typeof normalizeCeilingSegment>[]
    trimScopes: ReturnType<typeof normalizeTrimScope>[]
  }
  meta: {
    wallCalculations: EstimateResponse['wall_calculations']
    ceilingCalculations: EstimateResponse['ceiling_calculations']
    trimCalculations: EstimateResponse['trim_calculations']
    pricingSummary: EstimateResponse['pricing_summary']
    selectedRoomId: string
    lastSavedSnapshot: ReturnType<typeof buildEstimateV2DirtySnapshot>
    saveStatus: 'saved'
    autoSaveHint: null
    debugMeta: EstimateV2EditorDebugMeta
    orgJobProductDefaults: EstimateV2JobDefaultProducts
    jobSettingsDraft: JobSettingsDraft
  }
}

function buildJobSettingsDraft(
  jobsettings: Unsafe | null,
  orgDefaults: Unsafe | null,
  overrides: ProductOverrideInputs
) {
  const crewSize = Number(jobsettings?.crew_size ?? 1)
  return {
    laborDayEnabled:
      typeof jobsettings?.labor_day_policy_enabled === 'boolean'
        ? jobsettings.labor_day_policy_enabled
        : typeof orgDefaults?.labor_day_policy_enabled === 'boolean'
          ? orgDefaults.labor_day_policy_enabled
          : DEFAULT_LABOR_DAY_POLICY_ENABLED,
    dayhours: Number(jobsettings?.dayhours ?? orgDefaults?.dayhours ?? DEFAULT_DAY_HOURS),
    roundingIncrementHours: Number(
      jobsettings?.rounding_increment_hours ??
        orgDefaults?.rounding_increment_hours ??
        DEFAULT_ROUNDING_INCREMENT_HOURS
    ),
    laborRate: Number(
      jobsettings?.override_labor_rate ?? orgDefaults?.override_labor_rate ?? DEFAULT_LABOR_RATE
    ),
    jobMinEnabled:
      typeof jobsettings?.job_minimum_enabled === 'boolean'
        ? jobsettings.job_minimum_enabled
        : typeof orgDefaults?.job_minimum_enabled === 'boolean'
          ? orgDefaults.job_minimum_enabled
          : DEFAULT_JOB_MINIMUM_ENABLED,
    jobMinAmount: Number(
      jobsettings?.job_minimum_amount ??
        orgDefaults?.job_minimum_amount ??
        DEFAULT_JOB_MINIMUM_AMOUNT
    ),
    crewSize: Number.isFinite(crewSize) ? Math.max(1, Math.floor(crewSize)) : 1,
    wallPaintProductId: overrides.wallPaintOverride,
    wallPrimerProductId: overrides.wallPrimerOverride,
    ceilingPaintProductId: overrides.ceilingPaintOverride,
    ceilingPrimerProductId: overrides.ceilingPrimerOverride,
    trimPaintProductId: overrides.trimPaintOverride,
    trimPrimerProductId: overrides.trimPrimerOverride,
  } satisfies JobSettingsDraft
}

export function buildEstimateV2CustomerDraft(job: EstimateV2JobMeta | null) {
  return {
    customerId: job?.customer_id ?? '',
    name: job?.customer_name ?? '',
    email: job?.customer_email ?? '',
    phone: job?.customer_phone ?? '',
    address: job?.customer_address ?? '',
  }
}

export function mergeEstimateV2Catalogs(params: {
  currentCatalogs: CatalogsPayload['catalogs']
  catalogsPayload: CatalogsPayload | null
}) {
  const { currentCatalogs, catalogsPayload } = params
  if (!catalogsPayload) return currentCatalogs
  return {
    ...currentCatalogs,
    ...catalogsPayload.catalogs,
    production_rates:
      catalogsPayload.catalogs.production_rates ?? currentCatalogs.production_rates,
  }
}

function buildTrimTypeOptions(catalogs: CatalogsPayload['catalogs']): EstimateV2TrimTypeOption[] {
  return (catalogs.trim_items ?? []).map((item) => ({
    id: item.id,
    label: item.label || item.id,
    family: item.family || null,
    category: item.category || item.family || null,
    unit_type: item.unit_type,
    helper_allowed: !!item.helper_allowed,
    default_production_rate_id: item.default_production_rate_id,
  }))
}

function normalizeRollerScope(value: unknown): EstimateV2RollerScope {
  const raw = asText(value).toLowerCase()
  if (raw === 'ceiling') return 'Ceiling'
  if (raw === 'trim') return 'Trim'
  return 'Wall'
}

function normalizeRoller(row: Unsafe, index: number): EstimateV2RollerDraft {
  const scope = normalizeRollerScope(row.scope)
  return {
    id: asText(row.id),
    scope,
    wallColorId: scope === 'Wall' ? normalizeWallRollerTargetId(row.wallColorId ?? row.wall_color_id) : '',
    selectedOptionId: asText(row.selectedOptionId ?? row.selected_option_id),
    rollerSizeIn: asText(row.rollerSizeIn ?? row.roller_size_in),
    coversQty: asText(row.coversQty ?? row.covers_qty),
    notes: asText(row.notes),
    position: Number(row.position ?? index),
  }
}

export function sanitizeEstimateV2EditorLoad(params: {
  estimatePayload: EstimateResponse
  catalogs: CatalogsPayload['catalogs']
  selectedRoomId: string
}) {
  const { estimatePayload, catalogs, selectedRoomId } = params
  const trimTypeOptions = buildTrimTypeOptions(catalogs)
  const js = estimatePayload.inputs?.jobsettings ?? null
  const orgDefaults = (estimatePayload.inputs?.org_defaults ?? null) as Unsafe | null
  const orgWallDefault = asText(orgDefaults?.walls_paint_id)
  const orgWallPrimerDefault = asText(orgDefaults?.walls_primer_id)
  const orgCeilingDefault = asText(orgDefaults?.ceiling_paint_id)
  const orgCeilingPrimerDefault = asText(orgDefaults?.ceiling_primer_id)
  const orgTrimDefault = asText(orgDefaults?.trim_paint_id)
  const orgTrimPrimerDefault = asText(orgDefaults?.trim_primer_id)
  const wallPaintOverride = asText(js?.walls_paint_id ?? js?.wall_paint_id)
  const wallPrimerOverride = asText(js?.walls_primer_id ?? js?.primer_id)
  const ceilingPaintOverride = asText(js?.ceiling_paint_id)
  const ceilingPrimerOverride = asText(js?.ceiling_primer_id ?? js?.primer_id)
  const trimPaintOverride = asText(js?.trim_paint_id)
  const trimPrimerOverride = asText(js?.trim_primer_id ?? js?.primer_id)
  const normalizedWallDefault = wallPaintOverride || orgWallDefault
  const normalizedWallPrimerDefault = wallPrimerOverride || orgWallPrimerDefault
  const normalizedCeilingDefault = ceilingPaintOverride || orgCeilingDefault
  const normalizedCeilingPrimerDefault = ceilingPrimerOverride || orgCeilingPrimerDefault
  const normalizedTrimDefault = trimPaintOverride || orgTrimDefault
  const normalizedTrimPrimerDefault = trimPrimerOverride || orgTrimPrimerDefault

  const normalizedRooms = sortByPosition((estimatePayload.inputs.rooms ?? []).map(normalizeRoom))
  const loadedScopes = sortByPosition(
    (estimatePayload.inputs.room_wall_scopes ?? []).map(normalizeScope)
  )
  const loadedSegments = sortByPosition(
    (estimatePayload.inputs.wall_segments ?? []).map(normalizeSegment)
  )
  const sanitizedWalls = sanitizeV2WallsDrafts({
    rooms: normalizedRooms,
    scopes: loadedScopes,
    segments: loadedSegments,
  })
  const wallScopesWithoutDefaults = sanitizedWalls.scopes.map((scope) => ({
    ...scope,
    paintProductId: scope.paintProductId === normalizedWallDefault ? '' : scope.paintProductId,
    primerProductId:
      scope.primerProductId === normalizedWallPrimerDefault ? '' : scope.primerProductId,
  }))
  const normalizedRoomFlags = sortByPosition(
    (estimatePayload.inputs.room_flags ?? [])
      .map(normalizeRoomFlag)
      .filter((flag): flag is RoomFlagDraft => flag != null)
  )
  const normalizedRollers = sortByPosition(
    (estimatePayload.inputs.rollers ?? [])
      .map(normalizeRoller)
      .filter((roller): roller is NonNullable<ReturnType<typeof normalizeRoller>> => roller != null)
  )

  const normalizedCeilingScopes = sortByPosition(
    (estimatePayload.inputs.room_ceiling_scopes ?? []).map(normalizeCeilingScope)
  )
  const normalizedCeilingSegments = sortByPosition(
    (estimatePayload.inputs.ceiling_scope_segments ?? []).map(normalizeCeilingSegment)
  )
  const sanitizedCeilings = sanitizeV2CeilingsDrafts({
    rooms: normalizedRooms.map((room) => ({
      roomId: room.roomId,
      lengthIn: room.lengthIn,
      widthIn: room.widthIn,
      position: room.position,
    })),
    ceilingScopes: normalizedCeilingScopes,
    ceilingSegments: normalizedCeilingSegments,
  })
  const ceilingScopesWithoutDefaults = sanitizedCeilings.ceilingScopes.map((scope) => ({
    ...scope,
    paintProductId:
      scope.paintProductId === normalizedCeilingDefault ? '' : scope.paintProductId,
    primerProductId:
      scope.primerProductId === normalizedCeilingPrimerDefault ? '' : scope.primerProductId,
  }))

  const normalizedTrimScopes = sortByPosition(
    (estimatePayload.inputs.room_trim_scopes ?? []).map(normalizeTrimScope)
  )
  const sanitizedTrim = sanitizeV2TrimDrafts({
    rooms: normalizedRooms.map((room) => ({
      roomId: room.roomId,
      mode: 'RECT' as const,
      position: room.position,
    })),
    trimScopes: normalizedTrimScopes,
  })
  const trimScopesWithoutDefaults = sanitizedTrim.trimScopes.map((scope) => ({
    ...scope,
    paintProductId: scope.paintProductId === normalizedTrimDefault ? '' : scope.paintProductId,
    primerProductId:
      scope.primerProductId === normalizedTrimPrimerDefault ? '' : scope.primerProductId,
  }))
  const recalculated = recalculateEditorDraftFactors({
    rooms: normalizedRooms,
    wallScopes: wallScopesWithoutDefaults,
    ceilingScopes: ceilingScopesWithoutDefaults,
    trimScopes: trimScopesWithoutDefaults,
    roomFlags: normalizedRoomFlags,
    catalogs,
    trimTypeOptions,
  })

  const nextSelectedRoomId =
    selectedRoomId && normalizedRooms.some((room) => room.roomId === selectedRoomId)
      ? selectedRoomId
      : normalizedRooms[0]?.roomId ?? ''

  const lastSavedSnapshot = buildEstimateV2DirtySnapshot({
    jobSettingsDraft: buildJobSettingsDraft(js, orgDefaults, {
      wallPaintOverride,
      wallPrimerOverride,
      ceilingPaintOverride,
      ceilingPrimerOverride,
      trimPaintOverride,
      trimPrimerOverride,
    }),
    rooms: normalizedRooms,
    scopes: recalculated.wallScopes,
    segments: sanitizedWalls.segments,
    roomFlags: normalizedRoomFlags,
    ceilingScopes: recalculated.ceilingScopes,
    ceilingSegments: sanitizedCeilings.ceilingSegments,
    trimScopes: recalculated.trimScopes,
    rollers: normalizedRollers,
  })

  return {
    catalogs,
    trimTypeOptions,
    collections: {
      rooms: normalizedRooms,
      scopes: recalculated.wallScopes,
      segments: sanitizedWalls.segments,
      roomFlags: normalizedRoomFlags,
      ceilingScopes: recalculated.ceilingScopes,
      ceilingSegments: sanitizedCeilings.ceilingSegments,
      trimScopes: recalculated.trimScopes,
      rollers: normalizedRollers,
    },
    meta: {
      wallCalculations: estimatePayload.wall_calculations ?? null,
      ceilingCalculations: estimatePayload.ceiling_calculations ?? null,
      trimCalculations: estimatePayload.trim_calculations ?? null,
      pricingSummary: estimatePayload.pricing_summary ?? null,
      selectedRoomId: nextSelectedRoomId,
      lastSavedSnapshot,
      saveStatus: 'saved' as const,
      autoSaveHint: null,
      debugMeta: {
        dirtySource: 'load',
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
      orgJobProductDefaults: {
        wallPaintProductId: orgWallDefault,
        wallPrimerProductId: orgWallPrimerDefault,
        ceilingPaintProductId: orgCeilingDefault,
        ceilingPrimerProductId: orgCeilingPrimerDefault,
        trimPaintProductId: orgTrimDefault,
        trimPrimerProductId: orgTrimPrimerDefault,
      },
      jobSettingsDraft: buildJobSettingsDraft(js, orgDefaults, {
        wallPaintOverride,
        wallPrimerOverride,
        ceilingPaintOverride,
        ceilingPrimerOverride,
        trimPaintOverride,
        trimPrimerOverride,
      }),
    },
  } satisfies EstimateV2SanitizedLoadResult
}
